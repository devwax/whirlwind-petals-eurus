#!/usr/bin/env python3
"""
Reorder custom.container_collections so free options appear first.

Ensures ct-ndl (CONTAINER-NDL) and ct-gold (CONTAINER-GOLDCOVER) are at the
start of the list (NDL before GOLD when both exist), followed by container
groups in their existing relative order.

Usage:
  python3 scripts/container-groups/reorder_container_free_options.py --dry-run
  python3 scripts/container-groups/reorder_container_free_options.py --dry-run --output report.csv
  python3 scripts/container-groups/reorder_container_free_options.py --apply
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSIGNMENTS_CSV = ROOT / "tmp/Petals container groups - Plants & trees container groups.csv"
OUT_DIR = ROOT / "scripts/container-groups/output"
STORE = "petalscom.myshopify.com"

FREE_ORDER = ["ct-ndl", "ct-gold"]
FREE_OPTION_HANDLES = set(FREE_ORDER)


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


def fetch_product_by_sku(sku: str) -> dict | None:
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
        {"query": f"sku:{sku}"},
    )
    nodes = data["products"]["nodes"]
    if not nodes:
        return None
    for node in nodes:
        for v in node["variants"]["nodes"]:
            if v["sku"] == sku:
                return node
    return nodes[0]


def set_container_collections_metafield(product_id: str, collection_ids: list[str], dry_run: bool) -> None:
    value = json.dumps(collection_ids)
    if dry_run:
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


def read_parent_skus() -> list[str]:
    skus: list[str] = []
    with ASSIGNMENTS_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row["Item #"].strip()
            if sku and sku not in skus:
                skus.append(sku)
    return skus


def get_collection_refs(product: dict) -> list[dict]:
    mf = product.get("metafield")
    if not mf or not mf.get("references"):
        return []
    return list(mf["references"]["nodes"])


def handles_str(refs: list[dict]) -> str:
    return " | ".join(r["handle"] for r in refs)


def reorder_refs(refs: list[dict]) -> list[str]:
    by_handle = {r["handle"]: r["id"] for r in refs}
    free_ids = [by_handle[h] for h in FREE_ORDER if h in by_handle]
    other_ids = [r["id"] for r in refs if r["handle"] not in FREE_OPTION_HANDLES]
    return free_ids + other_ids


def process_sku(sku: str, apply: bool) -> dict:
    product = fetch_product_by_sku(sku)
    if not product:
        return {
            "sku": sku,
            "product_id": "",
            "status": "sku_not_found",
            "before_handles": "",
            "after_handles": "",
        }

    refs = get_collection_refs(product)
    before_handles = handles_str(refs)
    pid = product["id"]

    if not refs:
        return {
            "sku": sku,
            "product_id": pid,
            "status": "missing_metafield",
            "before_handles": "",
            "after_handles": "",
        }

    has_free = any(r["handle"] in FREE_OPTION_HANDLES for r in refs)
    if not has_free:
        return {
            "sku": sku,
            "product_id": pid,
            "status": "missing_free_option",
            "before_handles": before_handles,
            "after_handles": before_handles,
        }

    current_ids = [r["id"] for r in refs]
    new_ids = reorder_refs(refs)
    after_refs = sorted(refs, key=lambda r: new_ids.index(r["id"]))
    after_handles = handles_str(after_refs)

    if current_ids == new_ids:
        return {
            "sku": sku,
            "product_id": pid,
            "status": "already_ok",
            "before_handles": before_handles,
            "after_handles": after_handles,
        }

    set_container_collections_metafield(pid, new_ids, dry_run=not apply)
    return {
        "sku": sku,
        "product_id": pid,
        "status": "needs_reorder",
        "before_handles": before_handles,
        "after_handles": after_handles,
    }


def write_report(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["sku", "product_id", "status", "before_handles", "after_handles"],
        )
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print actions without mutating Shopify")
    parser.add_argument("--apply", action="store_true", help="Apply metafield reordering")
    parser.add_argument(
        "--output",
        type=Path,
        default=OUT_DIR / "reorder-container-free-options-report.csv",
        help="CSV report path",
    )
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Specify --dry-run or --apply", file=sys.stderr)
        return 1

    apply = args.apply
    skus = read_parent_skus()
    print(f"Processing {len(skus)} parent SKUs from {ASSIGNMENTS_CSV.name}")

    rows: list[dict] = []
    counts: dict[str, int] = {}

    for i, sku in enumerate(skus):
        row = process_sku(sku, apply=apply)
        rows.append(row)
        counts[row["status"]] = counts.get(row["status"], 0) + 1

        if row["status"] == "needs_reorder":
            prefix = "[apply]" if apply else "[dry-run]"
            print(f"  {prefix} {sku}: {row['before_handles']} -> {row['after_handles']}")
        elif row["status"] in ("sku_not_found", "missing_free_option", "missing_metafield"):
            print(f"  WARNING {sku}: {row['status']}")

        if i < len(skus) - 1:
            time.sleep(0.1)

    write_report(args.output, rows)
    print(f"\nReport written to {args.output}")
    print("\nSummary:")
    for status in sorted(counts):
        print(f"  {status}: {counts[status]}")

    if args.dry_run:
        print("\nRe-run with --apply to execute reordering.")
    else:
        print("\nApply complete.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
