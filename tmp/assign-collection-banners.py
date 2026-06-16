#!/usr/bin/env python3
"""Assign Shopify Files banner URLs to collection.image via Admin API.

Reads tmp/shopify-banner-urls.tsv
Skips handles that appear more than once (manual assignment needed).
Uses: shopify store execute --allow-mutations

Usage:
  bash tmp/fetch-shopify-collections.sh   # optional refresh
  python3 tmp/assign-collection-banners.py
  python3 tmp/assign-collection-banners.py --dry-run
"""

from __future__ import annotations

import argparse
import csv
import json
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BANNER_URLS = ROOT / "shopify-banner-urls.tsv"
STORE = "petalscom.myshopify.com"
MUTATION = """
mutation collectionUpdate($input: CollectionInput!) {
  collectionUpdate(input: $input) {
    collection {
      handle
      image {
        url
      }
    }
    userErrors {
      field
      message
    }
  }
}
"""


def shopify_execute(query: str, variables: dict | None = None, allow_mutations: bool = False) -> dict:
    cmd = [
        "shopify",
        "store",
        "execute",
        "--store",
        STORE,
        "--json",
        "--query",
        query,
    ]
    if allow_mutations:
        cmd.append("--allow-mutations")
    if variables is not None:
        cmd.extend(["--variables", json.dumps(variables)])

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())

    payload = json.loads(result.stdout)
    if isinstance(payload, dict) and payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"], indent=2))
    return payload


def load_banner_rows() -> list[dict]:
    with BANNER_URLS.open(newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def split_auto_manual(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    counts = Counter(row["shopify_handle"] for row in rows)
    auto = [row for row in rows if counts[row["shopify_handle"]] == 1]
    manual = [row for row in rows if counts[row["shopify_handle"]] > 1]
    return auto, manual


def fetch_collection_ids() -> dict[str, dict]:
    query = """
    {
      collections(first: 250) {
        nodes {
          id
          handle
          title
        }
      }
    }
    """
    data = shopify_execute(query)
    nodes = data.get("collections", {}).get("nodes", [])
    return {node["handle"]: node for node in nodes}


def assign_banner(collection_id: str, image_url: str, dry_run: bool) -> dict:
    variables = {"input": {"id": collection_id, "image": {"src": image_url}}}
    if dry_run:
        return {"dry_run": True, "variables": variables}
    return shopify_execute(MUTATION, variables, allow_mutations=True)


def write_tsv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, delimiter="\t", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Plan updates without calling mutations")
    args = parser.parse_args()

    if not BANNER_URLS.exists():
        print(f"Missing {BANNER_URLS}", file=sys.stderr)
        return 1

    rows = [row for row in load_banner_rows() if row.get("shopify_banner_url")]
    auto_rows, manual_rows = split_auto_manual(rows)

    print(f"Total banner rows: {len(rows)}")
    print(f"Auto-assign (unique handles): {len(auto_rows)}")
    print(f"Manual review (duplicate handles): {len(manual_rows)}")

    manual_path = ROOT / "banner-assign-manual.tsv"
    manual_fields = [
        "shopify_handle",
        "shopify_title",
        "label",
        "filename",
        "shopify_banner_url",
        "path",
        "reason",
    ]
    for row in manual_rows:
        row["reason"] = "duplicate handle in banner map"
    write_tsv(manual_path, manual_rows, manual_fields)
    print(f"Wrote {manual_path}")

    collections = fetch_collection_ids()
    print(f"Loaded {len(collections)} Shopify collections")

    results = []
    failures = []

    for i, row in enumerate(auto_rows, start=1):
        handle = row["shopify_handle"]
        collection = collections.get(handle)
        if not collection:
            failures.append({**row, "error": "collection handle not found in Shopify"})
            print(f"[{i}/{len(auto_rows)}] MISSING handle {handle}", file=sys.stderr)
            continue

        try:
            response = assign_banner(collection["id"], row["shopify_banner_url"], args.dry_run)
            if args.dry_run:
                image_url = row["shopify_banner_url"]
                status = "dry_run"
            else:
                payload = response.get("collectionUpdate", {})
                errors = payload.get("userErrors") or []
                if errors:
                    raise RuntimeError(json.dumps(errors))
                image_url = (payload.get("collection") or {}).get("image", {}).get("url", "")
                status = "updated"

            results.append(
                {
                    "shopify_handle": handle,
                    "shopify_title": row["shopify_title"],
                    "label": row["label"],
                    "shopify_banner_url": row["shopify_banner_url"],
                    "assigned_collection_image_url": image_url,
                    "status": status,
                }
            )
            print(f"[{i}/{len(auto_rows)}] {status} {handle}")
        except RuntimeError as exc:
            failures.append({**row, "error": str(exc)})
            print(f"[{i}/{len(auto_rows)}] FAILED {handle}: {exc}", file=sys.stderr)

        if not args.dry_run:
            time.sleep(0.25)

    assigned_path = ROOT / "banner-assign-completed.tsv"
    write_tsv(
        assigned_path,
        results,
        [
            "shopify_handle",
            "shopify_title",
            "label",
            "shopify_banner_url",
            "assigned_collection_image_url",
            "status",
        ],
    )

    if failures:
        fail_path = ROOT / "banner-assign-failures.tsv"
        write_tsv(
            fail_path,
            failures,
            ["shopify_handle", "label", "shopify_banner_url", "path", "error"],
        )
        print(f"Failures: {len(failures)} -> {fail_path}")

    print()
    print(f"Completed: {len(results)}")
    print(f"Wrote {assigned_path}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
