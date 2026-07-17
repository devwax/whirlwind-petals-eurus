#!/usr/bin/env python3
"""
Audit BigCommerce product weights for zero-weight and oz-as-lb issues.

Uses the Item/Box/Weight sheet as the expected weight source (same as the Shopify
shipping scripts). Optionally compares flagged SKUs against live Shopify weights.

Setup:
  cp scripts/shipping-packages/.env.example scripts/shipping-packages/.env
  # Add BIGCOMMERCE_AUTH_TOKEN to .env

Usage:
  python3 scripts/shipping-packages/compare_bigcommerce_weights.py --limit 5
  python3 scripts/shipping-packages/compare_bigcommerce_weights.py
  python3 scripts/shipping-packages/compare_bigcommerce_weights.py --compare-shopify
  python3 scripts/shipping-packages/compare_bigcommerce_weights.py --sheet-only
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from detect_weight_unit_issues import (
    classify_oz_lb_issue,
    classify_store_only_weight,
    fetch_sheet_rows,
    parse_numeric_weight,
    sheet_item_set,
    sku_matches_sheet_item,
)

OUT_DIR = SCRIPT_DIR / "output"
DEFAULT_ENV = SCRIPT_DIR / ".env"
DEFAULT_OUTPUT = OUT_DIR / "bigcommerce-weight-issues.csv"
BC_API_BASE = "https://api.bigcommerce.com/stores"
SHOPIFY_STORE = "petalscom.myshopify.com"
DEFAULT_STORE_HASH = "r932bs4ubb"


def load_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def resolve_auth(env: dict[str, str]) -> tuple[str, str]:
    store_hash = env.get("BIGCOMMERCE_STORE_HASH", DEFAULT_STORE_HASH)
    token = env.get("BIGCOMMERCE_AUTH_TOKEN") or env.get("X_AUTH_TOKEN")
    if not token:
        raise RuntimeError(
            f"Missing BIGCOMMERCE_AUTH_TOKEN in {DEFAULT_ENV}\n"
            "Copy .env.example to .env and add your X-Auth-Token value."
        )
    return store_hash, token


def bc_request(
    store_hash: str,
    token: str,
    path: str,
    *,
    params: dict | None = None,
) -> dict:
    query = urllib.parse.urlencode(params or {})
    url = f"{BC_API_BASE}/{store_hash}/v3{path}"
    if query:
        url = f"{url}?{query}"
    req = urllib.request.Request(
        url,
        headers={
            "X-Auth-Token": token,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"BigCommerce API {exc.code} for {path}:\n{body}") from exc


def fetch_paginated(
    store_hash: str,
    token: str,
    path: str,
    *,
    params: dict | None = None,
    page_limit: int = 250,
    max_pages: int | None = None,
    sleep_s: float = 0.15,
) -> list[dict]:
    base_params = dict(params or {})
    base_params["limit"] = page_limit
    page = 1
    rows: list[dict] = []

    while True:
        base_params["page"] = page
        payload = bc_request(store_hash, token, path, params=base_params)
        batch = payload.get("data") or []
        rows.extend(batch)
        pagination = (payload.get("meta") or {}).get("pagination") or {}
        total_pages = pagination.get("total_pages") or page
        print(
            f"  {path} page {page}/{total_pages} ({len(rows)} records)",
            file=sys.stderr,
        )
        if page >= total_pages:
            break
        if max_pages is not None and page >= max_pages:
            break
        page += 1
        time.sleep(sleep_s)

    return rows


def fetch_catalog_rows(
    store_hash: str,
    token: str,
    *,
    page_limit: int = 250,
    max_pages: int | None = None,
) -> list[dict]:
    products = fetch_paginated(
        store_hash,
        token,
        "/catalog/products",
        params={
            "include_fields": "id,name,sku,weight,type,is_visible",
        },
        page_limit=page_limit,
        max_pages=max_pages,
    )
    product_by_id = {p["id"]: p for p in products}

    variants = fetch_paginated(
        store_hash,
        token,
        "/catalog/variants",
        params={"include_fields": "id,product_id,sku,weight"},
        page_limit=page_limit,
        max_pages=max_pages,
    )

    rows: list[dict] = []
    seen_skus: set[str] = set()

    for variant in variants:
        sku = (variant.get("sku") or "").strip()
        if not sku:
            continue
        product = product_by_id.get(variant["product_id"], {})
        weight = variant.get("weight")
        if weight is None:
            weight = product.get("weight")
        weight_lbs = float(weight) if weight is not None else None
        rows.append(
            {
                "sku": sku,
                "product_name": product.get("name") or "",
                "bc_weight_lb": weight_lbs,
                "product_id": variant["product_id"],
                "variant_id": variant["id"],
                "product_type": product.get("type") or "",
                "is_visible": product.get("is_visible"),
            }
        )
        seen_skus.add(sku)

    for product in products:
        sku = (product.get("sku") or "").strip()
        if not sku or sku in seen_skus:
            continue
        weight = product.get("weight")
        weight_lbs = float(weight) if weight is not None else None
        rows.append(
            {
                "sku": sku,
                "product_name": product.get("name") or "",
                "bc_weight_lb": weight_lbs,
                "product_id": product["id"],
                "variant_id": "",
                "product_type": product.get("type") or "",
                "is_visible": product.get("is_visible"),
            }
        )

    return rows


def match_sheet_item(sku: str, sheet_items: set[str]) -> str | None:
    for item in sheet_items:
        if sku_matches_sheet_item(sku, item):
            return item
    return None


def classify_zero_weight(
    weight_lbs: float | None,
    sheet_lbs: float | None,
    *,
    sheet_only: bool,
) -> tuple[bool, str, str]:
    if weight_lbs is not None and weight_lbs > 0:
        return False, "", ""

    if sheet_lbs is not None and sheet_lbs > 0:
        return True, "zero_weight", f"sheet expects {sheet_lbs:g}lb"

    if not sheet_only and (weight_lbs is None or weight_lbs <= 0):
        return True, "zero_weight", "no weight set on BigCommerce"

    return False, "", ""


def analyze_row(
    row: dict,
    sheet_rows: list[dict[str, str]],
    *,
    sheet_only: bool,
) -> dict | None:
    sku = row["sku"]
    bc_weight = row["bc_weight_lb"]
    items = sheet_item_set(sheet_rows)
    matched_item = match_sheet_item(sku, items)

    sheet_lbs: float | None = None
    sheet_weight_raw = ""
    if matched_item:
        for sheet_row in sheet_rows:
            if sheet_row["item"] == matched_item:
                sheet_weight_raw = sheet_row["weight"]
                sheet_lbs = parse_numeric_weight(sheet_weight_raw)
                break

    if sheet_only and not matched_item:
        return None

    is_zero, zero_type, zero_detail = classify_zero_weight(
        bc_weight,
        sheet_lbs,
        sheet_only=sheet_only,
    )
    if is_zero:
        return {
            **row,
            "item": matched_item or "",
            "sheet_weight_lb": sheet_lbs if sheet_lbs is not None else "",
            "sheet_weight_raw": sheet_weight_raw,
            "issue_type": zero_type,
            "detail": zero_detail,
            "ratio": "",
            "implied_lb_from_div16": "",
        }

    if bc_weight is None or bc_weight <= 0:
        return None

    if sheet_lbs is not None:
        is_issue, issue_type, detail = classify_oz_lb_issue(sheet_lbs, bc_weight)
    elif not sheet_only:
        is_issue, issue_type, detail = classify_store_only_weight(bc_weight)
    else:
        return None

    if not is_issue:
        return None

    ratio = bc_weight / sheet_lbs if sheet_lbs else ""
    return {
        **row,
        "item": matched_item or "",
        "sheet_weight_lb": sheet_lbs if sheet_lbs is not None else "",
        "sheet_weight_raw": sheet_weight_raw,
        "issue_type": issue_type,
        "detail": detail,
        "ratio": f"{ratio:.2f}" if ratio != "" else "",
        "implied_lb_from_div16": f"{bc_weight / 16:.2f}",
    }


def shopify_graphql(query: str, variables: dict | None = None) -> dict:
    cmd = [
        "shopify",
        "store",
        "execute",
        "--store",
        SHOPIFY_STORE,
        "--query",
        query,
        "--json",
    ]
    if variables:
        cmd.extend(["--variables", json.dumps(variables)])
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()
    if proc.returncode != 0:
        raise RuntimeError(f"shopify CLI failed ({proc.returncode}):\n{stdout}\n{stderr}")
    data = json.loads(stdout)
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")
    return data.get("data", data)


def fetch_shopify_weight(sku: str) -> float | None:
    data = shopify_graphql(
        """
        query ProductWeightBySku($query: String!) {
          products(first: 5, query: $query) {
            nodes {
              variants(first: 20) {
                nodes {
                  sku
                  inventoryItem {
                    measurement {
                      weight { value unit }
                    }
                  }
                }
              }
            }
          }
        }
        """,
        {"query": f"sku:{sku}"},
    )
    for product in data["products"]["nodes"]:
        for variant in product["variants"]["nodes"]:
            if (variant.get("sku") or "").strip() != sku:
                continue
            inv = variant.get("inventoryItem") or {}
            w = (inv.get("measurement") or {}).get("weight") or {}
            value = w.get("value")
            if value is None:
                return None
            weight = float(value)
            unit = (w.get("unit") or "").upper()
            if unit == "OUNCES":
                weight /= 16
            return weight
    return None


def enrich_with_shopify(findings: list[dict], *, sleep_s: float = 0.1) -> None:
    cache: dict[str, float | None] = {}
    total = len(findings)
    for idx, row in enumerate(findings, start=1):
        sku = row["sku"]
        if sku not in cache:
            try:
                cache[sku] = fetch_shopify_weight(sku)
            except RuntimeError as exc:
                print(f"WARNING: Shopify lookup failed for {sku}: {exc}", file=sys.stderr)
                cache[sku] = None
            time.sleep(sleep_s)
        shopify_weight = cache[sku]
        row["shopify_weight_lb"] = shopify_weight if shopify_weight is not None else ""
        bc_weight = row.get("bc_weight_lb")
        if shopify_weight is not None and bc_weight is not None:
            row["bc_minus_shopify_lb"] = f"{bc_weight - shopify_weight:.2f}"
        else:
            row["bc_minus_shopify_lb"] = ""
        if idx % 25 == 0 or idx == total:
            print(f"  Shopify lookup {idx}/{total}", file=sys.stderr)


def write_report(path: Path, findings: list[dict], *, compare_shopify: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "item",
        "sku",
        "product_name",
        "sheet_weight_raw",
        "sheet_weight_lb",
        "bc_weight_lb",
        "implied_lb_from_div16",
        "ratio",
        "issue_type",
        "detail",
        "product_id",
        "variant_id",
    ]
    if compare_shopify:
        fields.extend(["shopify_weight_lb", "bc_minus_shopify_lb"])

    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(findings)


def print_summary(findings: list[dict]) -> None:
    unique_items = sorted({f["item"] for f in findings if f.get("item")})
    unique_skus = sorted({f["sku"] for f in findings if f.get("sku")})
    type_counts = Counter(f["issue_type"] for f in findings)

    print("\nBigCommerce weight audit")
    print(f"  Rows flagged: {len(findings)}")
    print(f"  Unique sheet items: {len(unique_items)}")
    print(f"  Unique SKUs: {len(unique_skus)}")
    print("  By issue type:")
    for issue_type, count in type_counts.most_common():
        print(f"    {issue_type}: {count}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env-file",
        type=Path,
        default=DEFAULT_ENV,
        help=f"Path to .env with BIGCOMMERCE_AUTH_TOKEN (default: {DEFAULT_ENV.name})",
    )
    parser.add_argument(
        "--sheet-csv",
        type=Path,
        help="Local Item/Box/Weight CSV instead of Google Sheet export",
    )
    parser.add_argument(
        "--sheet-only",
        action="store_true",
        help="Only flag SKUs that match a sheet Item #",
    )
    parser.add_argument(
        "--compare-shopify",
        action="store_true",
        help="Add live Shopify weights for flagged SKUs (slower)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        metavar="N",
        help="BigCommerce page size for a single-page test fetch (e.g. 5 for API smoke test)",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        metavar="N",
        help="Stop after N API pages (default: all pages)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output CSV (default: {DEFAULT_OUTPUT.relative_to(SCRIPT_DIR.parent.parent)})",
    )
    args = parser.parse_args()

    env = load_env_file(args.env_file)
    store_hash, token = resolve_auth(env)

    sheet_rows = fetch_sheet_rows(args.sheet_csv)
    page_limit = args.limit or 250
    max_pages = 1 if args.limit else args.max_pages

    print("Fetching BigCommerce catalog...", file=sys.stderr)
    catalog_rows = fetch_catalog_rows(
        store_hash,
        token,
        page_limit=page_limit,
        max_pages=max_pages,
    )
    print(f"  {len(catalog_rows)} SKU rows loaded from BigCommerce", file=sys.stderr)

    findings: list[dict] = []
    for row in catalog_rows:
        if row.get("product_type") == "digital":
            continue
        finding = analyze_row(row, sheet_rows, sheet_only=args.sheet_only)
        if finding:
            findings.append(finding)

    findings.sort(key=lambda r: (r.get("issue_type", ""), r.get("sku", "")))

    if args.compare_shopify and findings:
        print("Fetching Shopify weights for flagged SKUs...", file=sys.stderr)
        enrich_with_shopify(findings)

    print_summary(findings)

    if findings:
        write_report(args.output, findings, compare_shopify=args.compare_shopify)
        print(f"\nReport written to {args.output}")
    else:
        print("\nNo zero-weight or oz/lb issues matched the detection criteria.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
