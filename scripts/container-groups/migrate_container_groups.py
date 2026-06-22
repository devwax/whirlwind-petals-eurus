#!/usr/bin/env python3
"""
Migrate Petals container groups from SKU-named collections to Container-group-N.

Uses Shopify CLI (`shopify store execute`) for Admin GraphQL — safer than Matrixify
for prefix matching and deduplicating product-level metafield updates.

Usage:
  python3 scripts/container-groups/migrate_container_groups.py --dry-run
  python3 scripts/container-groups/migrate_container_groups.py --apply
  python3 scripts/container-groups/migrate_container_groups.py --apply --delete-old
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MATRIX_CSV = ROOT / "tmp/Petals container groups - Container Matrix.csv"
ASSIGNMENTS_CSV = ROOT / "tmp/Petals container groups - Plants & trees container groups.csv"
OUT_DIR = ROOT / "scripts/container-groups/output"
STORE = "petalscom.myshopify.com"

GROUP_NUMBERS = ["1", "2", "3", "7", "8"]
GROUP_HANDLES = {g: f"container-group-{g}" for g in GROUP_NUMBERS}
GROUP_TITLES = {g: f"Container-group-{g}" for g in GROUP_NUMBERS}

# Old SKU-prefix collections from April setup (delete after migration)
OLD_SKU_COLLECTION_HANDLES = [
    "ctb255", "ctd137", "ctb138", "ctd280", "ctb281", "ctd119", "ctb103",
    "ctd216", "ctb217", "ctf199", "ctd200", "ctb203", "ctb240", "cta241",
    "ctd251", "ctb252", "ctb245", "cta246", "random",
]

FREE_OPTION_HANDLES = {"ct-ndl", "ct-gold"}


def shopify_graphql(query: str, variables: dict | None = None, *, mutation: bool = False) -> dict:
    cmd = [
        "shopify", "store", "execute",
        "--store", STORE,
        "--query", query,
        "--json",
    ]
    if variables:
        cmd.extend(["--variables", json.dumps(variables)])
    if mutation:
        cmd.append("--allow-mutations")
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    if proc.returncode != 0:
        raise RuntimeError(f"shopify CLI failed ({proc.returncode}):\n{stdout}\n{stderr}")
    if not stdout:
        raise RuntimeError(f"Empty shopify output\n{stderr}")
    data = json.loads(stdout)
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")
    return data.get("data", data)


def parse_matrix() -> dict[str, list[str]]:
    """group_number -> list of sku prefixes."""
    by_group: dict[str, list[str]] = {g: [] for g in GROUP_NUMBERS}
    with MATRIX_CSV.open(newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    groups = [h.strip() for h in rows[0][1:]]
    for row in rows[1:]:
        prefix = row[0].strip()
        if not prefix:
            continue
        for i, g in enumerate(groups):
            if i + 1 < len(row) and row[i + 1].strip().upper() == "X":
                by_group[g].append(prefix)
    return by_group


def parse_assignments() -> dict[str, set[str]]:
    """parent variant SKU -> set of group numbers."""
    sku_groups: dict[str, set[str]] = defaultdict(set)
    with ASSIGNMENTS_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row["Item #"].strip()
            for col in ("C Group 1", "C Group 2"):
                g = row.get(col, "").strip()
                if g:
                    sku_groups[sku].add(g)
    return dict(sku_groups)


def fetch_all_collections() -> dict[str, dict]:
    data = shopify_graphql("""
    {
      collections(first: 250) {
        nodes { id handle title }
      }
    }
    """)
    return {n["handle"]: n for n in data["collections"]["nodes"]}


def fetch_product_by_sku(sku: str) -> dict | None:
    # Escape special chars in search query
    q = f"sku:{sku}"
    data = shopify_graphql(
        """
        query ProductsBySku($query: String!) {
          products(first: 5, query: $query) {
            nodes {
              id
              handle
              title
              variants(first: 20) { nodes { id sku } }
              metafield(namespace: "custom", key: "container_collections") {
                type
                references(first: 30) {
                  nodes { ... on Collection { id handle title } }
                }
              }
            }
          }
        }
        """,
        {"query": q},
    )
    nodes = data["products"]["nodes"]
    if not nodes:
        return None
    # Prefer product where variant SKU matches exactly
    for node in nodes:
        for v in node["variants"]["nodes"]:
            if v["sku"] == sku:
                return node
    return nodes[0]


def fetch_container_products(prefixes: list[str]) -> tuple[dict[str, dict], dict[str, list[str]]]:
    """Return (all_products by id, prefix -> product ids)."""
    all_products: dict[str, dict] = {}
    prefix_products: dict[str, list[str]] = {p: [] for p in prefixes}

    unique_prefixes = sorted(set(prefixes))
    for prefix in unique_prefixes:
        cursor = None
        while True:
            data = shopify_graphql(
                """
                query ContainerProducts($query: String!, $after: String) {
                  products(first: 100, query: $query, after: $after) {
                    nodes {
                      id
                      handle
                      title
                      variants(first: 10) { nodes { sku } }
                    }
                    pageInfo { hasNextPage endCursor }
                  }
                }
                """,
                {"query": f"sku:{prefix}*", "after": cursor},
            )
            for node in data["products"]["nodes"]:
                matched = any(
                    (v.get("sku") or "").startswith(prefix)
                    for v in node["variants"]["nodes"]
                )
                if matched:
                    all_products[node["id"]] = node
                    if node["id"] not in prefix_products[prefix]:
                        prefix_products[prefix].append(node["id"])
            pi = data["products"]["pageInfo"]
            if not pi["hasNextPage"]:
                break
            cursor = pi["endCursor"]
            time.sleep(0.15)

    return all_products, prefix_products


def create_collection(title: str, handle: str, dry_run: bool) -> str | None:
    if dry_run:
        print(f"  [dry-run] would create collection {title} ({handle})")
        return f"gid://shopify/Collection/DRY_{handle}"

    data = shopify_graphql(
        """
        mutation CreateCollection($input: CollectionInput!) {
          collectionCreate(input: $input) {
            collection { id handle title }
            userErrors { field message }
          }
        }
        """,
        {"input": {"title": title, "handle": handle}},
        mutation=True,
    )
    result = data["collectionCreate"]
    errors = result.get("userErrors") or []
    if errors:
        raise RuntimeError(f"collectionCreate {handle}: {errors}")
    coll = result["collection"]
    print(f"  Created collection {coll['title']} ({coll['handle']})")
    return coll["id"]


def add_products_to_collection(collection_id: str, product_ids: list[str], dry_run: bool) -> None:
    if not product_ids:
        return
    # Batch in chunks of 50
    for i in range(0, len(product_ids), 50):
        chunk = product_ids[i : i + 50]
        if dry_run:
            print(f"  [dry-run] would add {len(chunk)} products to {collection_id}")
            continue
        data = shopify_graphql(
            """
            mutation AddProducts($id: ID!, $productIds: [ID!]!) {
              collectionAddProducts(id: $id, productIds: $productIds) {
                collection { id }
                userErrors { field message }
              }
            }
            """,
            {"id": collection_id, "productIds": chunk},
            mutation=True,
        )
        errors = data["collectionAddProducts"].get("userErrors") or []
        if errors:
            raise RuntimeError(f"collectionAddProducts: {errors}")
        time.sleep(0.2)
    if not dry_run:
        print(f"  Added {len(product_ids)} products to collection")


def set_container_collections_metafield(product_id: str, collection_ids: list[str], dry_run: bool) -> None:
    value = json.dumps(collection_ids)
    if dry_run:
        print(f"  [dry-run] would set metafield on {product_id} -> {len(collection_ids)} collections")
        return
    data = shopify_graphql(
        """
        mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { id key namespace }
            userErrors { field message }
          }
        }
        """,
        {
            "metafields": [
                {
                    "ownerId": product_id,
                    "namespace": "custom",
                    "key": "container_collections",
                    "type": "list.collection_reference",
                    "value": value,
                }
            ]
        },
        mutation=True,
    )
    errors = data["metafieldsSet"].get("userErrors") or []
    if errors:
        raise RuntimeError(f"metafieldsSet {product_id}: {errors}")


def delete_collection(collection_id: str, handle: str, dry_run: bool) -> None:
    if dry_run:
        print(f"  [dry-run] would delete collection {handle}")
        return
    data = shopify_graphql(
        """
        mutation DeleteCollection($input: CollectionDeleteInput!) {
          collectionDelete(input: $input) {
            deletedCollectionId
            userErrors { field message }
          }
        }
        """,
        {"input": {"id": collection_id}},
        mutation=True,
    )
    errors = data["collectionDelete"].get("userErrors") or []
    if errors:
        raise RuntimeError(f"collectionDelete {handle}: {errors}")
    print(f"  Deleted collection {handle}")


def write_normalized_csvs(by_group: dict[str, list[str]], sku_groups: dict[str, set[str]]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with (OUT_DIR / "container-group-prefixes.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["group_number", "sku_prefix"])
        for g in GROUP_NUMBERS:
            for prefix in by_group[g]:
                w.writerow([g, prefix])

    with (OUT_DIR / "container-group-assignments.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["parent_sku", "group_number"])
        for sku, groups in sorted(sku_groups.items()):
            for g in sorted(groups, key=int):
                w.writerow([sku, g])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print actions without mutating Shopify")
    parser.add_argument("--apply", action="store_true", help="Apply changes to Shopify")
    parser.add_argument("--delete-old", action="store_true", help="Delete old SKU-named collections (requires --apply)")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Specify --dry-run or --apply", file=sys.stderr)
        return 1

    dry_run = args.dry_run

    print("=== Phase 0: Parse source CSVs ===")
    by_group = parse_matrix()
    sku_groups = parse_assignments()
    write_normalized_csvs(by_group, sku_groups)
    print(f"  Wrote normalized CSVs to {OUT_DIR}")

    for g in GROUP_NUMBERS:
        print(f"  Group {g}: {len(by_group[g])} prefixes -> {', '.join(by_group[g])}")

    print("\n=== Phase 1: Fetch Shopify collections ===")
    collections = fetch_all_collections()
    free_ids = {
        collections[h]["id"]
        for h in FREE_OPTION_HANDLES
        if h in collections
    }
    print(f"  Found {len(collections)} collections; free options: {FREE_OPTION_HANDLES}")

    print("\n=== Phase 2: Resolve container products by prefix ===")
    all_prefixes = sorted({p for prefs in by_group.values() for p in prefs})
    all_container_products, _ = fetch_container_products(all_prefixes)
    print(f"  Matched {len(all_container_products)} container products for {len(all_prefixes)} prefixes")

    group_product_ids: dict[str, list[str]] = {}
    for g in GROUP_NUMBERS:
        ids: list[str] = []
        seen: set[str] = set()
        for prefix in by_group[g]:
            for pid, prod in all_container_products.items():
                for v in prod["variants"]["nodes"]:
                    sku = v.get("sku") or ""
                    if sku.startswith(prefix) and pid not in seen:
                        seen.add(pid)
                        ids.append(pid)
        group_product_ids[g] = ids
        print(f"  Group {g}: {len(ids)} products")

    print("\n=== Phase 3: Create/populate Container-group-N collections ===")
    group_collection_ids: dict[str, str] = {}
    for g in GROUP_NUMBERS:
        handle = GROUP_HANDLES[g]
        title = GROUP_TITLES[g]
        if handle in collections:
            cid = collections[handle]["id"]
            print(f"  Collection {title} already exists ({handle})")
        else:
            cid = create_collection(title, handle, dry_run)
        group_collection_ids[g] = cid
        add_products_to_collection(cid, group_product_ids[g], dry_run)

    print("\n=== Phase 4: Resolve parent products and update metafields ===")
    # sku -> product id; merge groups for same product
    product_target_groups: dict[str, set[str]] = defaultdict(set)
    product_free_collections: dict[str, set[str]] = defaultdict(set)
    missing_skus: list[str] = []

    for sku, groups in sku_groups.items():
        prod = fetch_product_by_sku(sku)
        if not prod:
            missing_skus.append(sku)
            continue
        pid = prod["id"]
        product_target_groups[pid].update(groups)
        mf = prod.get("metafield")
        if mf and mf.get("references"):
            for ref in mf["references"]["nodes"]:
                if ref["handle"] in FREE_OPTION_HANDLES:
                    product_free_collections[pid].add(ref["id"])
        time.sleep(0.1)

    if missing_skus:
        print(f"  WARNING: {len(missing_skus)} SKUs not found: {missing_skus}")

    updated = 0
    for pid, groups in sorted(product_target_groups.items()):
        collection_ids: list[str] = []
        for g in sorted(groups, key=int):
            collection_ids.append(group_collection_ids[g])
        for fid in sorted(product_free_collections.get(pid, set())):
            if fid not in collection_ids:
                collection_ids.append(fid)
        set_container_collections_metafield(pid, collection_ids, dry_run)
        updated += 1

    print(f"  Updated {updated} parent products")

    if args.delete_old:
        print("\n=== Phase 6: Delete old SKU-named collections ===")
        if dry_run:
            print("  [dry-run] skipping deletes")
        else:
            for handle in OLD_SKU_COLLECTION_HANDLES:
                if handle in collections:
                    delete_collection(collections[handle]["id"], handle, dry_run=False)
                    time.sleep(0.2)

    print("\n=== Done ===")
    if dry_run:
        print("Re-run with --apply to execute. Add --delete-old after verifying QA.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
