#!/usr/bin/env python3
"""Download BigCommerce collection banner images for Shopify upload.

Reads:
  tmp/banner-images-to-download.txt
  tmp/banner-upload-needed.tsv (optional manifest with Shopify handles)

Writes:
  tmp/banners-to-upload/<filename>
  tmp/banners-to-upload/manifest.tsv
"""

from __future__ import annotations

import csv
import html
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse, urlunparse

ROOT = Path(__file__).resolve().parent
URL_LIST = ROOT / "banner-images-to-download.txt"
UPLOAD_NEEDED = ROOT / "banner-upload-needed.tsv"
OUT_DIR = ROOT / "banners-to-upload"
MANIFEST = OUT_DIR / "manifest.tsv"


def clean_url(url: str) -> str:
    url = html.unescape(url.strip())
    # Fix occasional trailing junk from BC export (e.g. "...jpg?t=...]")
    url = url.rstrip("]")
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def filename_from_url(url: str) -> str:
    name = urlparse(url).path.split("/")[-1]
    name = re.sub(r"[^\w.\-]", "_", name)
    return name or "banner.jpg"


def load_manifest_rows() -> list[dict]:
    if not UPLOAD_NEEDED.exists():
        return []

    rows = []
    with UPLOAD_NEEDED.open(newline="") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            url = clean_url(row.get("desktop_banner_image", ""))
            if not url:
                continue
            rows.append(
                {
                    "filename": filename_from_url(url),
                    "shopify_handle": row.get("shopify_handle", ""),
                    "shopify_title": row.get("shopify_title", ""),
                    "label": row.get("label", ""),
                    "path": row.get("path", ""),
                    "source_url": url,
                }
            )
    return rows


def download(url: str, dest: Path, ctx: ssl.SSLContext) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Petals banner migration"})
    with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
        dest.write_bytes(resp.read())


def main() -> int:
    if not URL_LIST.exists():
        print(f"Missing {URL_LIST}", file=sys.stderr)
        return 1

    urls = [clean_url(line) for line in URL_LIST.read_text().splitlines() if line.strip()]
    if not urls:
        print("No URLs to download.", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ctx = ssl.create_default_context()

    downloaded = 0
    skipped = 0
    failed: list[tuple[str, str]] = []

    for i, url in enumerate(urls, start=1):
        filename = filename_from_url(url)
        dest = OUT_DIR / filename

        if dest.exists() and dest.stat().st_size > 0:
            print(f"[{i}/{len(urls)}] skip existing {filename}")
            skipped += 1
            continue

        try:
            download(url, dest, ctx)
            size_kb = dest.stat().st_size // 1024
            print(f"[{i}/{len(urls)}] saved {filename} ({size_kb} KB)")
            downloaded += 1
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"[{i}/{len(urls)}] FAILED {filename}: {exc}", file=sys.stderr)
            failed.append((url, str(exc)))

        time.sleep(0.1)

    manifest_rows = load_manifest_rows()
    if manifest_rows:
        with MANIFEST.open("w", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "filename",
                    "shopify_handle",
                    "shopify_title",
                    "label",
                    "path",
                    "source_url",
                ],
                delimiter="\t",
            )
            writer.writeheader()
            writer.writerows(manifest_rows)

    print()
    print(f"Output folder: {OUT_DIR}")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped (already present): {skipped}")
    print(f"Failed: {len(failed)}")
    if MANIFEST.exists():
        print(f"Manifest: {MANIFEST}")

    if failed:
        fail_log = OUT_DIR / "download-failures.txt"
        fail_log.write_text("\n".join(f"{url}\t{err}" for url, err in failed) + "\n")
        print(f"Failures logged to: {fail_log}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
