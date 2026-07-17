#!/usr/bin/env python3
"""
Build package-id-map.json from Shopify Admin DevTools export or checklist CSV.

Shopify's public Admin API has no query to list shipping packages. Admin UI uses
an internal ShippingPackages operation; IDs look like:
  gid://shopify/ShippingPackageV2/108966805577
(not the older gid://shopify/ShippingPackage/… form).

Capture from Admin:
  1. Settings → Shipping and delivery → Packages
  2. DevTools → Network → filter "ShippingPackages"
  3. Click through ALL pagination pages (10 packages per page; ~8 pages for 76 boxes)
  4. Export HAR or copy each response JSON
  5. Run this script (use --merge when combining multiple captures)

Usage:
  python3 scripts/shipping-packages/build_package_id_map.py --from-har scripts/shipping-packages/admin.shopify.com.har
  python3 scripts/shipping-packages/build_package_id_map.py --from-har page2.har --merge
  python3 scripts/shipping-packages/build_package_id_map.py --from-json response.json --merge
  python3 scripts/shipping-packages/build_package_id_map.py --from-checklist
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent / "output"
DEFAULT_MAP = OUT_DIR / "package-id-map.json"
DEFAULT_CHECKLIST = OUT_DIR / "box-master-checklist.csv"

# Custom Petals packages use numeric ShippingPackageV2 GIDs.
PACKAGE_GID_RE = re.compile(r"^gid://shopify/ShippingPackageV2/\d+$")
PACKAGE_NAME_RE = re.compile(r"^Petals Package #(\d+)$")


def is_petals_package(name: str, gid: str) -> bool:
    if not PACKAGE_GID_RE.match(gid):
        return False
    return PACKAGE_NAME_RE.match(name.strip()) is not None


def box_number_from_name(name: str) -> str | None:
    m = PACKAGE_NAME_RE.match(name.strip())
    return m.group(1) if m else None


def extract_from_json_obj(obj: object, found: dict[str, str]) -> None:
    if isinstance(obj, dict):
        name = obj.get("name")
        gid = obj.get("id")
        if isinstance(name, str) and isinstance(gid, str) and is_petals_package(name, gid):
            box = box_number_from_name(name)
            if box:
                found[box] = gid
        for value in obj.values():
            extract_from_json_obj(value, found)
    elif isinstance(obj, list):
        for item in obj:
            extract_from_json_obj(item, found)


def extract_from_har(path: Path, found: dict[str, str]) -> int:
    har = json.loads(path.read_text(encoding="utf-8"))
    responses = 0
    for entry in har.get("log", {}).get("entries", []):
        text = entry.get("response", {}).get("content", {}).get("text") or ""
        if "Petals Package #" not in text:
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            continue
        before = len(found)
        extract_from_json_obj(data, found)
        if len(found) > before:
            responses += 1
    return responses


def load_json_source(path: Path | None, stdin: bool) -> object:
    if stdin:
        return json.load(sys.stdin)
    if path is None:
        raise ValueError("No JSON input provided")
    return json.loads(path.read_text(encoding="utf-8"))


def build_from_checklist(path: Path) -> dict[str, str]:
    mapping: dict[str, str] = {}
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            box = (row.get("box_number") or "").strip()
            gid = (row.get("shopify_package_gid") or "").strip()
            if box and gid and PACKAGE_GID_RE.match(gid):
                mapping[box] = gid
    return mapping


def load_existing(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_map(path: Path, mapping: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = dict(sorted(mapping.items(), key=lambda kv: int(kv[0])))
    path.write_text(json.dumps(ordered, indent=2) + "\n", encoding="utf-8")


def report_missing(mapping: dict[str, str]) -> None:
    if not DEFAULT_CHECKLIST.exists():
        return
    missing = []
    with DEFAULT_CHECKLIST.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            box = (row.get("box_number") or "").strip()
            if box and box not in mapping:
                missing.append(box)
    if missing:
        print(f"WARNING: {len(missing)} checklist boxes still missing, e.g. {', '.join(missing[:8])}")
        print("  Paginate through all Packages pages in Admin and re-run with --merge.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build package-id-map.json for Petals shipping setup")
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--from-har", type=Path, help="DevTools HAR export from Admin Packages page")
    src.add_argument("--from-json", type=Path, nargs="+", help="DevTools GraphQL response JSON file(s)")
    src.add_argument(
        "--from-checklist",
        type=Path,
        nargs="?",
        const=DEFAULT_CHECKLIST,
        help="Checklist CSV with shopify_package_gid column",
    )
    src.add_argument("--from-stdin", action="store_true", help="Read JSON from stdin")
    parser.add_argument("--output", type=Path, default=DEFAULT_MAP, help="Output JSON path")
    parser.add_argument("--merge", action="store_true", help="Merge into existing output file")
    parser.add_argument("--expected", type=int, default=76, help="Expected package count")
    args = parser.parse_args()

    mapping: dict[str, str] = load_existing(args.output) if args.merge else {}

    if args.from_checklist is not None:
        checklist = args.from_checklist if isinstance(args.from_checklist, Path) else DEFAULT_CHECKLIST
        if not checklist.exists():
            print(f"Checklist not found: {checklist}", file=sys.stderr)
            return 1
        mapping.update(build_from_checklist(checklist))
        source = f"checklist {checklist.name}"
    elif args.from_har:
        if not args.from_har.exists():
            print(f"HAR not found: {args.from_har}", file=sys.stderr)
            return 1
        n = extract_from_har(args.from_har, mapping)
        source = f"HAR {args.from_har.name} ({n} ShippingPackages response(s))"
    elif args.from_stdin:
        before = len(mapping)
        data = load_json_source(None, True)
        extract_from_json_obj(data, mapping)
        added = len(mapping) - before
        source = f"stdin (+{added} new)" if args.merge and added else "stdin"
    else:
        json_paths = args.from_json or []
        before = len(mapping)
        for path in json_paths:
            if not path.exists():
                print(f"JSON not found: {path}", file=sys.stderr)
                return 1
            data = load_json_source(path, False)
            extract_from_json_obj(data, mapping)
        added = len(mapping) - before
        if len(json_paths) == 1:
            source = f"json export (+{added} new)" if args.merge and added else "json export"
        else:
            source = f"{len(json_paths)} json files (+{added} new)" if args.merge else f"{len(json_paths)} json files"

    if not mapping:
        print("No Petals Package #N → GID mappings found.", file=sys.stderr)
        print(
            "\nIn DevTools Network, filter for 'ShippingPackages' (not generic graphql).\n"
            "IDs look like gid://shopify/ShippingPackageV2/108966805577\n"
            "The list is paginated (10/page) — click through all pages before exporting HAR.\n",
            file=sys.stderr,
        )
        return 1

    write_map(args.output, mapping)
    print(f"Wrote {len(mapping)} mappings to {args.output} (from {source})")
    if args.expected and len(mapping) < args.expected:
        print(f"WARNING: expected ~{args.expected} packages, have {len(mapping)}")
    else:
        print(f"OK: {len(mapping)} packages mapped")
    report_missing(mapping)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
