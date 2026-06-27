#!/usr/bin/env python3
"""
Import cross-sell complementary products from BigCommerce CSV into Shopify
Search & Discovery.

Sets the Eurus-native cart.upsell product metafield (namespace: cart,
key: upsell, type: list.product_reference) for each product. This is option (1)
in the Eurus cart upsell settings — highest priority, cart drawer only, and
never read by the product page recommendations.

Usage:
  python3 tmp/import-complementary-products.py --dry-run
  python3 tmp/import-complementary-products.py --apply

Source data:
  tmp/products-2026-06-19 - products-2026-06-19.csv

  Columns used:
    Product SKU          — BC base SKU; matched to Shopify variants via prefix search
    Extracted Cross Sell SKUs — comma-separated BC base SKUs for the cross-sell products
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
from pathlib import Path

STORE = "petalscom.myshopify.com"
CSV_PATH = Path(__file__).parent / "products-2026-06-19 - products-2026-06-19.csv"

CART_UPSELL_NAMESPACE = "cart"
CART_UPSELL_KEY = "upsell"

# Known typo in source data: CTV4809-CLR does not exist in Shopify.
# Map it to the likely intended SKU so we can warn rather than silently skip.
SKU_TYPO_MAP: dict[str, str] = {
    "CTV4809-CLR": None,  # No Shopify match — will warn and skip
}


# ---------------------------------------------------------------------------
# Shopify CLI wrapper (same pattern as other scripts in this repo)
# ---------------------------------------------------------------------------

def shopify_graphql(query: str, variables: dict | None = None, *, mutation: bool = False) -> dict:
    cmd = [
        "shopify",
        "store",
        "execute",
        "--store",
        STORE,
        "--query",
        query,
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


# ---------------------------------------------------------------------------
# SKU lookups
# ---------------------------------------------------------------------------

FIND_PRODUCT_QUERY = """
query FindProduct($query: String!) {
  products(first: 5, query: $query) {
    nodes {
      id
      title
      variants(first: 20) {
        nodes { sku }
      }
    }
  }
}
"""


def find_product_by_sku_prefix(sku_prefix: str) -> dict | None:
    """Return the Shopify product whose variant SKUs start with sku_prefix, or None."""
    data = shopify_graphql(FIND_PRODUCT_QUERY, {"query": f"sku:{sku_prefix}*"})
    nodes = data["products"]["nodes"]
    for node in nodes:
        for v in node["variants"]["nodes"]:
            variant_sku = (v.get("sku") or "").upper()
            if variant_sku.startswith(sku_prefix.upper()):
                return node
    return None


# ---------------------------------------------------------------------------
# CSV parsing
# ---------------------------------------------------------------------------

def parse_csv(path: Path) -> list[dict]:
    """
    Return list of dicts with keys:
      product_sku    — normalised BC base SKU
      cross_sell_skus — list of normalised BC cross-sell SKUs
      product_name   — for display only
    """
    rows = []
    with path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            raw_sku = (row.get("Product SKU") or "").strip().upper()
            raw_xsell = (row.get("Extracted Cross Sell SKUs") or "").strip()
            if not raw_sku or not raw_xsell:
                continue
            cross_sell_skus = [s.strip().upper() for s in raw_xsell.split(",") if s.strip()]
            rows.append({
                "product_sku": raw_sku,
                "cross_sell_skus": cross_sell_skus,
                "product_name": (row.get("Product Name") or "").strip(),
            })
    return rows


# ---------------------------------------------------------------------------
# Pre-resolve cross-sell SKUs → Shopify product IDs
# ---------------------------------------------------------------------------

def resolve_cross_sell_skus(rows: list[dict]) -> dict[str, str | None]:
    """
    Return mapping: normalised_sku → shopify_product_gid (or None if unresolved).
    Looks up each unique cross-sell SKU exactly once.
    """
    unique_skus: set[str] = set()
    for row in rows:
        unique_skus.update(row["cross_sell_skus"])

    resolved: dict[str, str | None] = {}
    print(f"\nResolving {len(unique_skus)} unique cross-sell SKU(s)...")
    for sku in sorted(unique_skus):
        # Apply known typo map first
        if sku in SKU_TYPO_MAP:
            mapped = SKU_TYPO_MAP[sku]
            if mapped is None:
                print(f"  [WARN] {sku}: known bad SKU (typo in source data) — will skip")
                resolved[sku] = None
                continue
            lookup_sku = mapped
        else:
            lookup_sku = sku

        product = find_product_by_sku_prefix(lookup_sku)
        if product:
            resolved[sku] = product["id"]
            print(f"  {sku} → {product['id']} ({product['title']})")
        else:
            resolved[sku] = None
            print(f"  [WARN] {sku}: no Shopify product found — rows using this SKU will be skipped")
        time.sleep(0.2)

    return resolved


# ---------------------------------------------------------------------------
# Metafield mutation
# ---------------------------------------------------------------------------

SET_METAFIELD_MUTATION = """
mutation SetComplementary($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      namespace
      key
      value
    }
    userErrors {
      field
      message
    }
  }
}
"""


def set_complementary_products(product_id: str, complementary_ids: list[str], *, apply: bool) -> None:
    value = json.dumps(complementary_ids)
    if not apply:
        print(f"    [dry-run] Would set {CART_UPSELL_NAMESPACE}.{CART_UPSELL_KEY} = {value}")
        return

    variables = {
        "metafields": [
            {
                "ownerId": product_id,
                "namespace": CART_UPSELL_NAMESPACE,
                "key": CART_UPSELL_KEY,
                "type": "list.product_reference",
                "value": value,
            }
        ]
    }
    result = shopify_graphql(SET_METAFIELD_MUTATION, variables, mutation=True)
    errors = result["metafieldsSet"]["userErrors"]
    if errors:
        raise RuntimeError(f"metafieldsSet failed: {errors}")
    mf = result["metafieldsSet"]["metafields"]
    if mf:
        print(f"    ✓ Set {mf[0]['namespace']}.{mf[0]['key']} ({len(complementary_ids)} product(s))")
    else:
        print("    ✓ Metafield set (no return data)")


# ---------------------------------------------------------------------------
# Main processing loop
# ---------------------------------------------------------------------------

def process_rows(rows: list[dict], xsell_map: dict[str, str | None], *, apply: bool) -> None:
    mode_label = "APPLY" if apply else "DRY RUN"
    print(f"\n--- Processing {len(rows)} products [{mode_label}] ---\n")

    skipped_source = 0
    skipped_xsell = 0
    processed = 0

    for row in rows:
        bc_sku = row["product_sku"]
        name = row["product_name"]
        cross_sell_skus = row["cross_sell_skus"]

        # Resolve cross-sell GIDs; skip entirely if any are unresolvable
        complementary_ids: list[str] = []
        bad_skus: list[str] = []
        for xsku in cross_sell_skus:
            gid = xsell_map.get(xsku)
            if gid:
                complementary_ids.append(gid)
            else:
                bad_skus.append(xsku)

        if bad_skus:
            print(f"  [SKIP] {bc_sku} ({name}): unresolved cross-sell SKU(s): {bad_skus}")
            skipped_xsell += 1
            continue

        if not complementary_ids:
            print(f"  [SKIP] {bc_sku} ({name}): no complementary products to set")
            skipped_source += 1
            continue

        # Find the source product in Shopify
        product = find_product_by_sku_prefix(bc_sku)
        if not product:
            print(f"  [MISS] {bc_sku} ({name}): no Shopify product found")
            skipped_source += 1
            continue

        print(f"  {bc_sku} → {product['id']}  \"{product['title']}\"")
        xsell_display = ", ".join(
            f"{s} ({xsell_map[s].split('/')[-1]})"
            for s in cross_sell_skus
            if xsell_map.get(s)
        )
        print(f"    Complementary: {xsell_display}")
        set_complementary_products(product["id"], complementary_ids, apply=apply)
        processed += 1

        if apply:
            time.sleep(0.3)

    print(f"\n--- Summary ---")
    print(f"  Processed : {processed}")
    print(f"  Skipped (source not found) : {skipped_source}")
    print(f"  Skipped (bad cross-sell SKU): {skipped_xsell}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Print what would be set without writing")
    group.add_argument("--apply", action="store_true", help="Write complementary product metafields to Shopify")
    args = parser.parse_args()
    apply = args.apply

    print(f"Store : {STORE}")
    print(f"Mode  : {'APPLY' if apply else 'DRY RUN'}")
    print(f"CSV   : {CSV_PATH}")

    if not CSV_PATH.exists():
        print(f"ERROR: CSV not found at {CSV_PATH}", file=sys.stderr)
        return 1

    rows = parse_csv(CSV_PATH)
    print(f"\nParsed {len(rows)} product row(s) from CSV.")

    xsell_map = resolve_cross_sell_skus(rows)

    process_rows(rows, xsell_map, apply=apply)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
