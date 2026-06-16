#!/usr/bin/env python3
"""Resolve Shopify CDN URLs for uploaded banner files in Content > Files.

Reads tmp/banners-to-upload/manifest.tsv and probes:
  https://cdn.shopify.com/s/files/1/0626/3681/8505/files/<filename>

Writes:
  tmp/shopify-banner-urls.tsv
  tmp/shopify-banner-urls.txt
"""

from __future__ import annotations

import csv
import ssl
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "banners-to-upload/manifest.tsv"
FILES_BASE = "https://cdn.shopify.com/s/files/1/0626/3681/8505/files/"
COLLECTIONS_BASE = "https://cdn.shopify.com/s/files/1/0626/3681/8505/collections/"
SKIP_FILENAMES = {"lndg-strip-cp-flash-sale-0326.jpg"}
EXTRA = [
    {
        "filename": "arrang-main-lndg-21-1500-450.jpg",
        "shopify_handle": "silk-flower-arrangements",
        "shopify_title": "Arrangements",
        "label": "All Arrangements",
        "path": "/silk-flower-arrangements",
    }
]


def resolve_url(url: str, ctx: ssl.SSLContext) -> int:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Petals banner URL resolver"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except OSError:
        return 0


def find_url(filename: str, ctx: ssl.SSLContext) -> tuple[str, str]:
    for base in (FILES_BASE, COLLECTIONS_BASE):
        url = base + filename
        if resolve_url(url, ctx) == 200:
            return "found", url
    return "missing", ""


def main() -> int:
    if not MANIFEST.exists():
        print(f"Missing {MANIFEST}", file=sys.stderr)
        return 1

    rows = []
    with MANIFEST.open(newline="") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            if row["filename"] in SKIP_FILENAMES:
                continue
            rows.append(row)
    rows.extend(EXTRA)

    ctx = ssl.create_default_context()
    results = []
    missing = []

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(find_url, row["filename"], ctx): row for row in rows}
        for future in as_completed(futures):
            row = futures[future]
            status, url = future.result()
            results.append(
                {
                    "shopify_handle": row["shopify_handle"],
                    "shopify_title": row["shopify_title"],
                    "label": row["label"],
                    "filename": row["filename"],
                    "shopify_banner_url": url,
                    "path": row["path"],
                    "status": status,
                }
            )
            if status != "found":
                missing.append(row["filename"])

    results.sort(key=lambda item: item["shopify_handle"])

    out_tsv = ROOT / "shopify-banner-urls.tsv"
    fields = [
        "shopify_handle",
        "shopify_title",
        "label",
        "filename",
        "shopify_banner_url",
        "path",
        "status",
    ]
    with out_tsv.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, delimiter="\t")
        writer.writeheader()
        writer.writerows(results)

    out_txt = ROOT / "shopify-banner-urls.txt"
    out_txt.write_text(
        "\n".join(row["shopify_banner_url"] for row in results if row["shopify_banner_url"]) + "\n"
    )

    found = sum(1 for row in results if row["status"] == "found")
    print(f"Found: {found}")
    print(f"Missing: {len(missing)}")
    print(f"Wrote {out_tsv}")
    print(f"Wrote {out_txt}")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
