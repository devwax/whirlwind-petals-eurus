#!/usr/bin/env python3
"""
Assign shipping packages and weights to Petals products from the Item/Box/Weight sheet.

PM rules:
  - Numeric Box # matching package-id-map → assign package
  - Numeric Ship Weight → assign weight (lbs)
  - Otherwise ignore that field (partial updates OK)

Usage:
  python3 scripts/shipping-packages/assign_shipping_packages.py --dry-run --sku FLA216
  python3 scripts/shipping-packages/assign_shipping_packages.py --dry-run --sku FLA164-MP --sku ACM104-00
  python3 scripts/shipping-packages/assign_shipping_packages.py --apply --sku FLA216
  python3 scripts/shipping-packages/assign_shipping_packages.py --dry-run
  python3 scripts/shipping-packages/assign_shipping_packages.py --apply
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = Path(__file__).resolve().parent
OUT_DIR = SCRIPT_DIR / "output"
STORE = "petalscom.myshopify.com"
SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1rc6jGvnRSVVZ0HppagHV8zWFT0eYPwNjVp7k1svcF8s/export?format=csv&gid=0"
)
DEFAULT_MAP = OUT_DIR / "package-id-map.json"
DEFAULT_OUTPUT = OUT_DIR / "assignment-report.csv"


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


def load_package_map(path: Path) -> dict[str, str]:
    if not path.exists():
        raise FileNotFoundError(
            f"Package map not found: {path}\n"
            "Run build_package_id_map.py first (requires DevTools GraphQL export)."
        )
    return json.loads(path.read_text(encoding="utf-8"))


def fetch_sheet_rows(local_csv: Path | None) -> list[dict[str, str]]:
    if local_csv:
        text = local_csv.read_text(encoding="utf-8")
    else:
        with urllib.request.urlopen(SHEET_CSV_URL, timeout=30) as resp:
            text = resp.read().decode("utf-8")
    reader = csv.DictReader(text.splitlines())
    rows: list[dict[str, str]] = []
    for raw in reader:
        item = (raw.get("Item #") or raw.get("Item") or "").strip()
        if not item:
            continue
        rows.append(
            {
                "item": item,
                "description": (raw.get("Description") or "").strip(),
                "box": (raw.get("Box #") or "").strip(),
                "weight": (raw.get("Ship Weight") or "").strip(),
            }
        )
    return rows


def parse_numeric_weight(value: str) -> float | None:
    if not value:
        return None
    try:
        w = float(value)
    except ValueError:
        return None
    return w if w >= 0 else None


def parse_box_number(value: str, package_map: dict[str, str]) -> tuple[str | None, str | None]:
    if not value or not value.isdigit():
        return None, None
    gid = package_map.get(value)
    if not gid:
        return value, None
    return value, gid


def fetch_variants_for_item(item: str) -> list[dict]:
    data = shopify_graphql(
        """
        query ProductsBySku($query: String!) {
          products(first: 10, query: $query) {
            nodes {
              id
              title
              variants(first: 50) {
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
        {"query": f"sku:{item}"},
    )
    matched: list[dict] = []
    seen_variant_ids: set[str] = set()
    for product in data["products"]["nodes"]:
        for variant in product["variants"]["nodes"]:
            sku = (variant.get("sku") or "").strip()
            if sku == item or sku.startswith(f"{item}-"):
                vid = variant["id"]
                if vid in seen_variant_ids:
                    continue
                seen_variant_ids.add(vid)
                matched.append(
                    {
                        "product_id": product["id"],
                        "product_title": product["title"],
                        "variant_id": vid,
                        "sku": sku,
                        "inventory_item": variant.get("inventoryItem"),
                    }
                )
    return matched


def build_measurement_input(
    package_gid: str | None,
    weight: float | None,
) -> dict | None:
    measurement: dict = {}
    if package_gid:
        measurement["shippingPackageId"] = package_gid
    if weight is not None:
        measurement["weight"] = {"value": weight, "unit": "POUNDS"}
    return measurement or None


def current_weight_str(inventory_item: dict | None) -> str:
    if not inventory_item:
        return ""
    m = inventory_item.get("measurement") or {}
    w = m.get("weight") or {}
    val = w.get("value")
    unit = w.get("unit") or ""
    if val is None:
        return ""
    return f"{val} {unit}".strip()


def assign_inventory_item(
    inventory_item_id: str,
    measurement: dict,
    *,
    apply: bool,
) -> list[dict]:
    if not apply:
        return []
    data = shopify_graphql(
        """
        mutation InventoryItemAssignShipping($id: ID!, $input: InventoryItemInput!) {
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


def process_row(
    row: dict[str, str],
    package_map: dict[str, str],
    *,
    apply: bool,
) -> list[dict]:
    item = row["item"]
    box_raw = row["box"]
    weight_raw = row["weight"]

    box_num, package_gid = parse_box_number(box_raw, package_map)
    weight = parse_numeric_weight(weight_raw)

    assign_package = package_gid is not None
    assign_weight = weight is not None

    if not assign_package and not assign_weight:
        reason = []
        if box_raw and not box_raw.isdigit():
            reason.append(f"box_ignored:{box_raw}")
        elif box_num and not package_gid:
            reason.append(f"missing_package:{box_num}")
        if weight_raw and weight is None:
            reason.append(f"weight_ignored:{weight_raw}")
        if not box_raw and not weight_raw:
            reason.append("empty")
        return [{
            "item": item,
            "variant_sku": "",
            "status": "skipped_nothing_to_assign",
            "box": box_raw,
            "weight": weight_raw,
            "package_gid": "",
            "notes": ";".join(reason) or "no_assignable_fields",
        }]

    variants = fetch_variants_for_item(item)
    if not variants:
        return [{
            "item": item,
            "variant_sku": "",
            "status": "sku_not_found",
            "box": box_raw,
            "weight": weight_raw,
            "package_gid": package_gid or "",
            "notes": "",
        }]

    measurement = build_measurement_input(package_gid if assign_package else None, weight if assign_weight else None)
    if not measurement:
        return [{
            "item": item,
            "variant_sku": "",
            "status": "skipped_nothing_to_assign",
            "box": box_raw,
            "weight": weight_raw,
            "package_gid": "",
            "notes": "no_measurement_built",
        }]

    results: list[dict] = []
    for variant in variants:
        inv = variant.get("inventory_item")
        if not inv or not inv.get("id"):
            results.append({
                "item": item,
                "variant_sku": variant["sku"],
                "status": "missing_inventory_item",
                "box": box_raw,
                "weight": weight_raw,
                "package_gid": package_gid or "",
                "notes": variant["product_title"],
            })
            continue

        notes = []
        if assign_package:
            notes.append(f"package:#{box_num}")
        if assign_weight:
            notes.append(f"weight:{weight}lb")
        notes.append(f"was:{current_weight_str(inv)}")

        errors = assign_inventory_item(inv["id"], measurement, apply=apply)
        if errors:
            status = "error"
            notes.append(str(errors))
        else:
            status = "updated" if apply else "would_update"

        results.append({
            "item": item,
            "variant_sku": variant["sku"],
            "status": status,
            "box": box_raw,
            "weight": weight_raw,
            "package_gid": package_gid or "",
            "notes": "; ".join(notes),
        })
    return results


def write_report(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["item", "variant_sku", "status", "box", "weight", "package_gid", "notes"]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--sku", action="append", default=[], help="Item # to process (repeatable)")
    parser.add_argument("--sku-file", type=Path, help="CSV with Item # column")
    parser.add_argument("--limit", type=int, default=0, help="Max sheet rows to process")
    parser.add_argument("--local-csv", type=Path, help="Local Item/Box/Weight CSV instead of Google Sheet")
    parser.add_argument("--package-map", type=Path, default=DEFAULT_MAP)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Specify --dry-run or --apply", file=sys.stderr)
        return 1

    apply = args.apply
    package_map = load_package_map(args.package_map)
    all_rows = fetch_sheet_rows(args.local_csv)

    filter_items: list[str] = list(args.sku)
    if args.sku_file:
        with args.sku_file.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                val = (row.get("Item #") or row.get("item") or row.get("sku") or "").strip()
                if val:
                    filter_items.append(val)

    if filter_items:
        wanted = set(filter_items)
        all_rows = [r for r in all_rows if r["item"] in wanted]

    if args.limit:
        all_rows = all_rows[: args.limit]

    print(f"Package map: {len(package_map)} entries from {args.package_map.name}")
    print(f"Processing {len(all_rows)} sheet row(s) ({'apply' if apply else 'dry-run'})")

    report: list[dict] = []
    counts: dict[str, int] = {}

    for i, row in enumerate(all_rows):
        row_results = process_row(row, package_map, apply=apply)
        report.extend(row_results)
        for r in row_results:
            counts[r["status"]] = counts.get(r["status"], 0) + 1
            if r["status"] in ("would_update", "updated"):
                prefix = "[apply]" if apply else "[dry-run]"
                print(f"  {prefix} {r['item']} / {r['variant_sku']}: {r['notes']}")
            elif r["status"] in ("sku_not_found", "error", "missing_inventory_item"):
                print(f"  WARNING {r['item']} / {r['variant_sku']}: {r['status']} {r['notes']}")

        if i < len(all_rows) - 1:
            time.sleep(0.15)

    write_report(args.output, report)
    print(f"\nReport: {args.output}")
    print("Summary:")
    for status in sorted(counts):
        print(f"  {status}: {counts[status]}")

    if args.dry_run:
        print("\nRe-run with --apply to write changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
