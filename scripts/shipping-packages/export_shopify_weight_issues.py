#!/usr/bin/env python3
"""
Export Shopify variants that still have a weight issue (live store scan).

Output CSV includes an `issue` column:
  - zero weight       — missing/zero weight when sheet expects a numeric weight
  - incorrect weight  — weight mismatch (oz/lb pattern or differs from sheet)

Usage:
  python3 scripts/shipping-packages/export_shopify_weight_issues.py
  python3 scripts/shipping-packages/export_shopify_weight_issues.py -o output/shopify-weight-issues.csv
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from detect_weight_unit_issues import (
    classify_oz_lb_issue,
    classify_store_only_weight,
    fetch_all_variants,
    fetch_sheet_rows,
    parse_numeric_weight,
    sheet_item_set,
    sku_matches_sheet_item,
)

OUT_DIR = SCRIPT_DIR / "output"
DEFAULT_OUTPUT = OUT_DIR / "shopify-weight-issues.csv"
WEIGHT_TOLERANCE = 0.25


def match_sheet_item(sku: str, items: set[str]) -> str | None:
    for item in items:
        if sku_matches_sheet_item(sku, item):
            return item
    return None


def sheet_weight_for_item(item: str, sheet_rows: list[dict[str, str]]) -> tuple[float | None, str]:
    for row in sheet_rows:
        if row["item"] == item:
            raw = row["weight"]
            return parse_numeric_weight(raw), raw
    return None, ""


def classify_issue(
    current_lbs: float | None,
    sheet_lbs: float | None,
    *,
    on_sheet: bool,
) -> tuple[str, str] | None:
    """Return (issue, detail) or None if OK."""
    if on_sheet and sheet_lbs is not None and sheet_lbs > 0:
        if current_lbs is None or current_lbs <= 0:
            return "zero weight", f"sheet expects {sheet_lbs:g} lb"

        if abs(current_lbs - sheet_lbs) <= WEIGHT_TOLERANCE:
            return None

        is_oz, _, oz_detail = classify_oz_lb_issue(sheet_lbs, current_lbs)
        detail = oz_detail or f"shopify={current_lbs:g} lb, sheet={sheet_lbs:g} lb"
        return "incorrect weight", detail

    if on_sheet and current_lbs is not None and current_lbs > 0:
        is_oz, _, detail = classify_store_only_weight(current_lbs)
        if is_oz:
            return "incorrect weight", detail

    if current_lbs is None or current_lbs <= 0:
        return None

    is_oz, _, detail = classify_store_only_weight(current_lbs)
    if is_oz:
        return "incorrect weight", detail

    return None


def build_rows(sheet_rows: list[dict[str, str]]) -> list[dict]:
    items = sheet_item_set(sheet_rows)
    print("Scanning Shopify store...", file=sys.stderr)
    variants = fetch_all_variants()

    rows: list[dict] = []
    for variant in variants:
        sku = variant["variant_sku"]
        if not sku:
            continue

        current = variant["current_weight_lb"]
        matched_item = match_sheet_item(sku, items)
        sheet_lbs, sheet_raw = (
            sheet_weight_for_item(matched_item, sheet_rows)
            if matched_item
            else (None, "")
        )

        classified = classify_issue(
            current,
            sheet_lbs,
            on_sheet=matched_item is not None,
        )
        if not classified:
            continue

        issue, detail = classified
        ratio = ""
        if sheet_lbs and current and current > 0:
            ratio = f"{current / sheet_lbs:.2f}"

        rows.append(
            {
                "item": matched_item or "",
                "sku": sku,
                "product_title": variant["product_title"],
                "sheet_weight_raw": sheet_raw,
                "sheet_weight_lb": sheet_lbs if sheet_lbs is not None else "",
                "shopify_weight_lb": current if current is not None else 0,
                "implied_lb_if_oz": f"{current / 16:.2f}" if current and current > 0 else "",
                "ratio_to_sheet": ratio,
                "issue": issue,
                "detail": detail,
            }
        )

    rows.sort(key=lambda r: (r["issue"], r.get("item") or "", r["sku"]))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sheet-csv",
        type=Path,
        help="Local Item/Box/Weight CSV instead of Google Sheet export",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output CSV (default: {DEFAULT_OUTPUT.name})",
    )
    args = parser.parse_args()

    sheet_rows = fetch_sheet_rows(args.sheet_csv)
    rows = build_rows(sheet_rows)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "item",
        "sku",
        "product_title",
        "sheet_weight_raw",
        "sheet_weight_lb",
        "shopify_weight_lb",
        "implied_lb_if_oz",
        "ratio_to_sheet",
        "issue",
        "detail",
    ]
    with args.output.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    counts = Counter(r["issue"] for r in rows)
    unique_items = len({r["item"] for r in rows if r["item"]})
    print(f"\nShopify variants with issues: {len(rows)}")
    print(f"  Unique sheet items: {unique_items}")
    for issue, count in counts.most_common():
        print(f"  {issue}: {count}")
    print(f"\nWrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
