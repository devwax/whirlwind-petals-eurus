#!/usr/bin/env python3
"""
Fix incorrect Shopify product weights from the PM issues CSV.

Uses `implied_lb_if_oz` as the corrected weight in pounds (oz values stored as lb).
Preserves any existing shipping package assignment on the variant.

Usage:
  python3 scripts/shipping-packages/fix_shopify_weights.py --dry-run
  python3 scripts/shipping-packages/fix_shopify_weights.py --dry-run --sku FLB163-NA
  python3 scripts/shipping-packages/fix_shopify_weights.py --apply
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
OUT_DIR = SCRIPT_DIR / "output"
STORE = "petalscom.myshopify.com"
DEFAULT_INPUT = (
    SCRIPT_DIR / "Petals - Incorrect weight in Shiopify - shopify-weight-issues.csv"
)
DEFAULT_OUTPUT = OUT_DIR / "fix-shopify-weights-report.csv"


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


def load_fix_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows: list[dict[str, str]] = []
        for raw in reader:
            sku = (raw.get("sku") or "").strip()
            target = (raw.get("implied_lb_if_oz") or raw.get("target_weight_lb") or "").strip()
            if not sku or not target:
                continue
            try:
                target_lb = float(target)
            except ValueError:
                continue
            rows.append(
                {
                    "sku": sku,
                    "product_title": (raw.get("product_title") or "").strip(),
                    "was_weight_lb": (raw.get("shopify_weight_lb") or "").strip(),
                    "target_weight_lb": target_lb,
                }
            )
        return rows


def fetch_variant_by_sku(sku: str) -> dict | None:
    data = shopify_graphql(
        """
        query VariantBySku($query: String!) {
          products(first: 5, query: $query) {
            nodes {
              title
              variants(first: 20) {
                nodes {
                  id
                  sku
                  inventoryItem {
                    id
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
            m = inv.get("measurement") or {}
            w = m.get("weight") or {}
            value = w.get("value")
            unit = (w.get("unit") or "").upper()
            current_lb: float | None = None
            if value is not None:
                current_lb = float(value)
                if unit == "OUNCES":
                    current_lb /= 16
            return {
                "product_title": product["title"],
                "variant_id": variant["id"],
                "sku": sku,
                "inventory_item_id": inv.get("id"),
                "current_weight_lb": current_lb,
            }
    return None


def current_weight_str(current_lb: float | None) -> str:
    if current_lb is None:
        return "0 POUNDS"
    return f"{current_lb:g} POUNDS"


def build_measurement_input(target_lb: float) -> dict:
    return {
        "weight": {"value": target_lb, "unit": "POUNDS"},
    }


def apply_weight(
    inventory_item_id: str,
    measurement: dict,
    *,
    apply: bool,
) -> list[dict]:
    if not apply:
        return []
    data = shopify_graphql(
        """
        mutation InventoryItemUpdateWeight($id: ID!, $input: InventoryItemInput!) {
          inventoryItemUpdate(id: $id, input: $input) {
            inventoryItem { id }
            userErrors { field message }
          }
        }
        """,
        {"id": inventory_item_id, "input": {"measurement": measurement}},
        mutation=True,
    )
    return data["inventoryItemUpdate"].get("userErrors") or []


def process_row(row: dict, *, apply: bool) -> dict:
    sku = row["sku"]
    target_lb = row["target_weight_lb"]
    variant = fetch_variant_by_sku(sku)
    if not variant:
        return {
            "sku": sku,
            "status": "sku_not_found",
            "was_weight_lb": row.get("was_weight_lb", ""),
            "target_weight_lb": target_lb,
            "notes": row.get("product_title", ""),
        }

    inv_id = variant.get("inventory_item_id")
    if not inv_id:
        return {
            "sku": sku,
            "status": "missing_inventory_item",
            "was_weight_lb": current_weight_str(variant.get("current_weight_lb")),
            "target_weight_lb": target_lb,
            "notes": variant.get("product_title", ""),
        }

    current = variant.get("current_weight_lb")
    if current is not None and abs(current - target_lb) <= 0.01:
        return {
            "sku": sku,
            "status": "already_correct",
            "was_weight_lb": current_weight_str(current),
            "target_weight_lb": target_lb,
            "notes": "no change needed",
        }

    measurement = build_measurement_input(target_lb)
    notes = [
        f"weight:{target_lb:g}lb",
        f"was:{current_weight_str(current)}",
    ]

    errors = apply_weight(inv_id, measurement, apply=apply)
    if errors:
        return {
            "sku": sku,
            "status": "error",
            "was_weight_lb": current_weight_str(current),
            "target_weight_lb": target_lb,
            "notes": str(errors),
        }

    return {
        "sku": sku,
        "status": "updated" if apply else "would_update",
        "was_weight_lb": current_weight_str(current),
        "target_weight_lb": target_lb,
        "notes": "; ".join(notes),
    }


def write_report(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["sku", "status", "was_weight_lb", "target_weight_lb", "notes"]
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--sku", action="append", default=[], help="Only process these SKUs")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Report CSV (default: {DEFAULT_OUTPUT.name})",
    )
    parser.add_argument("--sleep", type=float, default=0.15, help="Seconds between API calls")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Specify --dry-run or --apply", file=sys.stderr)
        return 1
    if args.dry_run and args.apply:
        print("Use only one of --dry-run or --apply", file=sys.stderr)
        return 1

    if not args.input.exists():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 1

    rows = load_fix_rows(args.input)
    if args.sku:
        wanted = {s.strip() for s in args.sku}
        rows = [r for r in rows if r["sku"] in wanted]

    if not rows:
        print("No rows to process.", file=sys.stderr)
        return 1

    apply = args.apply
    mode = "apply" if apply else "dry-run"
    print(f"Processing {len(rows)} SKU(s) ({mode}) from {args.input.name}")

    results: list[dict] = []
    for idx, row in enumerate(rows, start=1):
        result = process_row(row, apply=apply)
        results.append(result)
        print(f"  [{result['status']}] {result['sku']}: {result['notes']}")
        if idx < len(rows):
            time.sleep(args.sleep)

    write_report(args.output, results)
    updated = sum(1 for r in results if r["status"] in ("updated", "would_update"))
    errors = sum(1 for r in results if r["status"] == "error")
    print(f"\nDone. {updated} to update, {errors} errors.")
    print(f"Report: {args.output}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
