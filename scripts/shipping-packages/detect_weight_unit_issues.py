#!/usr/bin/env python3
"""
Detect products likely affected by ounces-vs-pounds weight misconfiguration.

During the shipping package dry run, many variants had Shopify weights that looked
like ounce values stored with a POUNDS unit (e.g. sheet 2 lb, was 32 POUNDS).

Modes:
  --from-log FILE     Parse dry-run output or assignment-report.csv (no API)
  --scan-store        Scan all Shopify variants for the same weight profile

Usage:
  python3 scripts/shipping-packages/detect_weight_unit_issues.py --from-log "Package map dry run.txt"
  python3 scripts/shipping-packages/detect_weight_unit_issues.py --from-log output/assignment-report.csv
  python3 scripts/shipping-packages/detect_weight_unit_issues.py --scan-store
  python3 scripts/shipping-packages/detect_weight_unit_issues.py --scan-store --exclude-sheet-items
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = Path(__file__).resolve().parent
OUT_DIR = SCRIPT_DIR / "output"
STORE = "petalscom.myshopify.com"
SHEET_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1rc6jGvnRSVVZ0HppagHV8zWFT0eYPwNjVp7k1svcF8s/export?format=csv&gid=0"
)
DEFAULT_OUTPUT = OUT_DIR / "weight-unit-issues.csv"

DRY_RUN_LINE = re.compile(
    r"\[dry-run\]\s+(\S+)\s+/\s+(\S+):\s+(.*)$"
)
WAS_WEIGHT = re.compile(r"was:([\d.]+)\s+POUNDS")
TARGET_WEIGHT = re.compile(r"weight:([\d.]+)lb")

# Common ounce-as-pound values seen in the dry run (multiples of 8/12/16).
OZ_LIKE_VALUES = frozenset(
    {
        16,
        24,
        32,
        36,
        48,
        64,
        72,
        80,
        96,
        128,
        160,
        192,
        224,
        256,
        320,
        384,
        448,
        512,
    }
)


def shopify_graphql(query: str, variables: dict | None = None) -> dict:
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
                "weight": (raw.get("Ship Weight") or "").strip(),
            }
        )
    return rows


def parse_numeric_weight(value: str | None) -> float | None:
    if not value:
        return None
    try:
        w = float(value)
    except ValueError:
        return None
    return w if w >= 0 else None


def sheet_item_set(sheet_rows: list[dict[str, str]]) -> set[str]:
    return {row["item"] for row in sheet_rows}


def sku_matches_sheet_item(sku: str, item: str) -> bool:
    return sku == item or sku.startswith(f"{item}-")


def classify_oz_lb_issue(
    sheet_lbs: float | None,
    was_lbs: float,
    *,
    tolerance: float = 0.25,
) -> tuple[bool, str, str]:
    """
    Return (is_issue, issue_type, detail).

    Heuristics derived from the shipping package dry run:
      - exact_16x: was ≈ sheet * 16 (ounce value stored as pounds)
      - oz_value_as_lb: was / 16 ≈ sheet (same underlying mistake, different ratio)
      - multiple_of_16: was is a multiple of 16, much higher than sheet
      - div16_near_sheet: was / 16 within ~1 lb of sheet
      - oz_like_value: common dry-run values (24, 36, 48, …) with high ratio
    """
    if was_lbs <= 0:
        return False, "", ""

    if sheet_lbs is not None and abs(was_lbs - sheet_lbs) <= tolerance:
        return False, "", ""

    ratio = was_lbs / sheet_lbs if sheet_lbs and sheet_lbs > 0 else None
    implied_lb = was_lbs / 16

    if ratio is not None and 15.5 <= ratio <= 16.5:
        return True, "exact_16x", f"was/sheet={ratio:.2f}"

    if sheet_lbs is not None and abs(implied_lb - sheet_lbs) <= tolerance:
        return True, "oz_value_as_lb", f"was/16={implied_lb:.2f}lb"

    if sheet_lbs is not None and was_lbs >= 16 and was_lbs % 16 == 0 and ratio is not None and ratio >= 6:
        return True, "multiple_of_16", f"was={was_lbs:g}lb sheet={sheet_lbs:g}lb ratio={ratio:.2f}"

    if (
        sheet_lbs is not None
        and was_lbs >= 16
        and abs(implied_lb - sheet_lbs) <= 1.0
        and ratio is not None
        and ratio >= 4
    ):
        return True, "div16_near_sheet", f"was/16={implied_lb:.2f}lb vs sheet={sheet_lbs:g}lb"

    if (
        sheet_lbs is not None
        and was_lbs in OZ_LIKE_VALUES
        and ratio is not None
        and ratio >= 4
        and abs(implied_lb - sheet_lbs) <= 2.0
    ):
        return True, "oz_like_value", f"was={was_lbs:g}lb implies {implied_lb:.2f}lb"

    return False, "", ""


def classify_store_only_weight(was_lbs: float) -> tuple[bool, str, str]:
    """Flag weights that match the oz-as-lb profile without sheet context."""
    if was_lbs < 16:
        return False, "", ""

    implied_lb = was_lbs / 16
    if not (0.5 <= implied_lb <= 25):
        return False, "", ""

    if was_lbs % 16 == 0:
        return True, "store_multiple_of_16", f"implies {implied_lb:.2f}lb if oz→lb"

    if was_lbs in OZ_LIKE_VALUES:
        return True, "store_oz_like_value", f"implies {implied_lb:.2f}lb if oz→lb"

    return False, "", ""


def parse_log_file(path: Path) -> list[dict]:
    """Parse dry-run text or assignment-report.csv into normalized rows."""
    rows: list[dict] = []

    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for raw in reader:
                notes = raw.get("notes") or ""
                was_m = WAS_WEIGHT.search(notes)
                if not was_m:
                    continue
                was_lbs = float(was_m.group(1))
                sheet_lbs = parse_numeric_weight(raw.get("weight"))
                tw_m = TARGET_WEIGHT.search(notes)
                if sheet_lbs is None and tw_m:
                    sheet_lbs = float(tw_m.group(1))
                rows.append(
                    {
                        "item": (raw.get("item") or "").strip(),
                        "variant_sku": (raw.get("variant_sku") or "").strip(),
                        "product_title": "",
                        "sheet_weight_lb": sheet_lbs,
                        "was_weight_lb": was_lbs,
                        "current_weight_lb": sheet_lbs,
                        "source": path.name,
                    }
                )
        return rows

    for line in path.read_text(encoding="utf-8").splitlines():
        m = DRY_RUN_LINE.search(line)
        if not m:
            continue
        item, sku, rest = m.groups()
        was_m = WAS_WEIGHT.search(rest)
        if not was_m:
            continue
        was_lbs = float(was_m.group(1))
        tw_m = TARGET_WEIGHT.search(rest)
        sheet_lbs = float(tw_m.group(1)) if tw_m else None
        rows.append(
            {
                "item": item,
                "variant_sku": sku,
                "product_title": "",
                "sheet_weight_lb": sheet_lbs,
                "was_weight_lb": was_lbs,
                "current_weight_lb": sheet_lbs,
                "source": path.name,
            }
        )
    return rows


def analyze_rows(rows: list[dict]) -> list[dict]:
    findings: list[dict] = []
    for row in rows:
        sheet_lbs = row.get("sheet_weight_lb")
        was_lbs = row["was_weight_lb"]
        is_issue, issue_type, detail = classify_oz_lb_issue(sheet_lbs, was_lbs)
        if not is_issue:
            continue
        ratio = was_lbs / sheet_lbs if sheet_lbs else ""
        findings.append(
            {
                **row,
                "issue_type": issue_type,
                "detail": detail,
                "ratio": f"{ratio:.2f}" if ratio != "" else "",
                "implied_lb_from_div16": f"{was_lbs / 16:.2f}",
            }
        )
    return findings


def fetch_all_variants(*, sleep_s: float = 0.15) -> list[dict]:
    query = """
    query AllProducts($cursor: String) {
      products(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          title
          variants(first: 100) {
            nodes {
              id
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
    """
    variants: list[dict] = []
    cursor: str | None = None
    page = 0
    while True:
        page += 1
        data = shopify_graphql(query, {"cursor": cursor})
        conn = data["products"]
        for product in conn["nodes"]:
            for variant in product["variants"]["nodes"]:
                sku = (variant.get("sku") or "").strip()
                inv = variant.get("inventoryItem") or {}
                m = inv.get("measurement") or {}
                w = m.get("weight") or {}
                value = w.get("value")
                unit = (w.get("unit") or "").upper()
                weight_lbs: float | None = None
                if value is not None:
                    weight_lbs = float(value)
                    if unit == "OUNCES":
                        weight_lbs = weight_lbs / 16
                variants.append(
                    {
                        "product_id": product["id"],
                        "product_title": product["title"],
                        "variant_id": variant["id"],
                        "variant_sku": sku,
                        "current_weight_lb": weight_lbs,
                        "weight_unit": unit,
                    }
                )
        page_info = conn["pageInfo"]
        print(f"  fetched page {page} ({len(variants)} variants so far)", file=sys.stderr)
        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]
        time.sleep(sleep_s)
    return variants


def scan_store(
    sheet_rows: list[dict[str, str]],
    *,
    exclude_sheet_items: bool,
) -> list[dict]:
    items = sheet_item_set(sheet_rows)
    item_weights = {
        row["item"]: parse_numeric_weight(row["weight"]) for row in sheet_rows
    }

    print("Scanning Shopify store for suspicious weights...", file=sys.stderr)
    variants = fetch_all_variants()
    findings: list[dict] = []

    for v in variants:
        sku = v["variant_sku"]
        current = v["current_weight_lb"]
        if current is None or current <= 0:
            continue

        matched_item = None
        for item in items:
            if sku_matches_sheet_item(sku, item):
                matched_item = item
                break

        if exclude_sheet_items and matched_item:
            continue

        sheet_lbs = item_weights.get(matched_item or "") if matched_item else None

        if sheet_lbs is not None:
            is_issue, issue_type, detail = classify_oz_lb_issue(sheet_lbs, current)
        else:
            is_issue, issue_type, detail = classify_store_only_weight(current)

        if not is_issue:
            continue

        ratio = current / sheet_lbs if sheet_lbs else ""
        findings.append(
            {
                "item": matched_item or "",
                "variant_sku": sku,
                "product_title": v["product_title"],
                "sheet_weight_lb": sheet_lbs if sheet_lbs is not None else "",
                "was_weight_lb": current,
                "current_weight_lb": current,
                "issue_type": issue_type,
                "detail": detail,
                "ratio": f"{ratio:.2f}" if ratio != "" else "",
                "implied_lb_from_div16": f"{current / 16:.2f}",
                "source": "live_store_scan",
            }
        )

    return findings


def write_report(path: Path, findings: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "item",
        "variant_sku",
        "product_title",
        "sheet_weight_lb",
        "was_weight_lb",
        "current_weight_lb",
        "ratio",
        "implied_lb_from_div16",
        "issue_type",
        "detail",
        "source",
    ]
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(findings)


def print_summary(findings: list[dict], *, label: str) -> None:
    unique_items = sorted({f["item"] for f in findings if f.get("item")})
    unique_skus = sorted({f["variant_sku"] for f in findings if f.get("variant_sku")})
    type_counts = Counter(f["issue_type"] for f in findings)

    print(f"\n{label}")
    print(f"  Variants flagged: {len(findings)}")
    print(f"  Unique sheet items: {len(unique_items)}")
    print(f"  Unique SKUs: {len(unique_skus)}")
    print("  By issue type:")
    for issue_type, count in type_counts.most_common():
        print(f"    {issue_type}: {count}")

    if unique_items:
        print("\n  Items:")
        for item in unique_items:
            print(f"    {item}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--from-log",
        type=Path,
        action="append",
        metavar="FILE",
        help="Dry-run log or assignment-report.csv (repeatable)",
    )
    parser.add_argument(
        "--scan-store",
        action="store_true",
        help="Scan live Shopify catalog for the same weight profile",
    )
    parser.add_argument(
        "--exclude-sheet-items",
        action="store_true",
        help="With --scan-store, skip variants whose SKU matches a sheet Item #",
    )
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
        help=f"Output CSV (default: {DEFAULT_OUTPUT.relative_to(ROOT)})",
    )
    args = parser.parse_args()

    if not args.from_log and not args.scan_store:
        parser.error("Provide --from-log and/or --scan-store")

    all_findings: list[dict] = []

    if args.from_log:
        log_rows: list[dict] = []
        for path in args.from_log:
            if not path.exists():
                print(f"ERROR: log not found: {path}", file=sys.stderr)
                return 1
            log_rows.extend(parse_log_file(path))
        log_findings = analyze_rows(log_rows)
        all_findings.extend(log_findings)
        print_summary(log_findings, label="Historical analysis (pre-apply weights from log)")

    if args.scan_store:
        sheet_rows = fetch_sheet_rows(args.sheet_csv)
        store_findings = scan_store(sheet_rows, exclude_sheet_items=args.exclude_sheet_items)
        all_findings.extend(store_findings)
        label = "Live store scan"
        if args.exclude_sheet_items:
            label += " (excluding sheet Item # SKUs)"
        print_summary(store_findings, label=label)

    if all_findings:
        write_report(args.output, all_findings)
        print(f"\nReport written to {args.output}")
    else:
        print("\nNo oz/lb issues matched the detection criteria.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
