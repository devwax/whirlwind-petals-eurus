#!/usr/bin/env python3
"""Compare BigCommerce banner audit against Shopify collection images.

Usage:
  1) Export Shopify collections (requires store auth once):
       shopify store auth --store petalscom.myshopify.com --scopes read_products
       shopify store execute --store petalscom.myshopify.com --query '...' > tmp/shopify-collections.json

  2) Run this script:
       python3 tmp/compare-banner-upload-status.py

Outputs in tmp/:
  - banner-upload-needed.tsv
  - banner-already-uploaded.tsv
  - banner-review.tsv
  - banner-images-to-download.txt
"""

from __future__ import annotations

import csv
import html
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
AUDIT_TSV = ROOT / "banner-migration-audit.tsv"
COLLECTIONS_JSON = ROOT / "shopify-collections.json"
HANDLE_MAP_JSON = ROOT / "shopify-collection-handle-map.json"

# Known BigCommerce path -> Shopify handle overrides from theme/nav setup.
DEFAULT_HANDLE_MAP = {
    "/silk-floral-arrangements/centerpieces": "centerpieces",
    "/silk-artificial-arrangement/orchids": "orchids",
    "/artificial-flowers-stems-plants-trees/tropical": "tropical",
    "/realistic-succulent-cactus-plants": "succulent-oasis",
    "/silk-flowers-stems/southern-inspired": "southern-inspired",
    "/seasonal-collections/spring": "seasonal-spring",
    "/full-silk-flower-plants-trees-collection": "seasonal-summer",
    "/fall-autumn-view-all/seasonal-collections": "fall-seasonal-collections",
    "/fall-autumn-silk-flowers-arrangements": "fall-seasonal-collections",
    "/shop-christmas-silk-flowers-poinsettias-trees/holiday": "holiday",
    "/silk-flower-stems/flowers": "flowers",
    "/artificial-and-silk-plants/floor-plants": "floor-plants",
    "/gifting": "gifting",
    "/gifting/": "gifting",
    "/send-a-gift": "gifting",
    "/silk-flower-gift-ideas": "gifting",
    "/gifts": "gifting",
}


def normalize_path(path: str) -> str:
    path = path.strip()
    if not path.startswith("/"):
        path = "/" + path
    return path.rstrip("/") or "/"


def banner_filename(url: str) -> str:
    if not url:
        return ""
    url = html.unescape(url)
    return urlparse(url).path.split("/")[-1].lower()


def banner_stem(url: str) -> str:
    """Filename without extension, for matching Shopify CDN renames."""
    name = banner_filename(url)
    if not name:
        return ""
    return re.sub(r"\.[^.]+$", "", name)


def banners_match(bc_image: str, shopify_url: str) -> bool:
    if not bc_image or not shopify_url:
        return False
    bc_name = banner_filename(bc_image)
    shopify_name = banner_filename(shopify_url)
    bc_stem = banner_stem(bc_image)
    shopify_stem = banner_stem(shopify_url)
    shopify_lower = shopify_url.lower()
    return (
        (bc_name and bc_name == shopify_name)
        or (bc_stem and bc_stem in shopify_lower)
        or (bc_name and bc_name in shopify_lower)
    )


def guess_handle(path: str, handle_map: dict[str, str]) -> str:
    norm = normalize_path(path)
    if norm in handle_map:
        return handle_map[norm]

    slug = norm.lstrip("/")
    if "/" not in slug:
        return slug

    # Prefer last segment for nested BC URLs unless full slug exists in map values.
    return slug.split("/")[-1]


def load_handle_map() -> dict[str, str]:
    merged = dict(DEFAULT_HANDLE_MAP)
    if HANDLE_MAP_JSON.exists():
        merged.update(json.loads(HANDLE_MAP_JSON.read_text()))
    return merged


def load_shopify_collections() -> dict[str, dict]:
    if not COLLECTIONS_JSON.exists():
        raise SystemExit(
            f"Missing {COLLECTIONS_JSON.name}. Run:\n"
            "  shopify store auth --store petalscom.myshopify.com --scopes read_products\n"
            "  bash tmp/fetch-shopify-collections.sh"
        )

    data = json.loads(COLLECTIONS_JSON.read_text())

    # Shopify CLI returns { "collections": { "nodes": [...] } } without a data wrapper.
    nodes = []
    if isinstance(data.get("collections"), dict):
        nodes = data["collections"].get("nodes", [])
    elif isinstance(data.get("data"), dict):
        nodes = data["data"].get("collections", {}).get("nodes", [])

    if not nodes:
        raise SystemExit(
            f"No collections found in {COLLECTIONS_JSON.name}. "
            "Re-run: bash tmp/fetch-shopify-collections.sh"
        )

    return {node["handle"]: node for node in nodes}


def load_audit_rows() -> list[dict]:
    rows = []
    with AUDIT_TSV.open(newline="") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            rows.append(row)
    return rows


def classify_row(row: dict, collections: dict[str, dict], handle_map: dict[str, str]) -> dict:
    path = normalize_path(row["path"])
    has_bc_banner = row.get("has_custom_banner", "").lower() == "yes"
    bc_image = html.unescape(row.get("desktop_banner_image", "").strip())
    bc_name = banner_filename(bc_image)
    handle = guess_handle(path, handle_map)
    collection = collections.get(handle)
    shopify_image = (collection or {}).get("image") or {}
    shopify_url = shopify_image.get("url") or ""
    shopify_name = banner_filename(shopify_url)

    if not has_bc_banner:
        status = "no_bc_banner"
    elif not collection:
        status = "missing_collection"
    elif not shopify_url:
        status = "needs_upload"
    elif banners_match(bc_image, shopify_url):
        status = "already_uploaded"
    elif bc_name and shopify_name:
        status = "review_mismatch"
    else:
        status = "review_unknown"

    return {
        **row,
        "shopify_handle": handle,
        "shopify_title": (collection or {}).get("title", ""),
        "shopify_image_url": shopify_url,
        "bc_banner_filename": bc_name,
        "shopify_banner_filename": shopify_name,
        "status": status,
    }


def write_tsv(path: Path, rows: list[dict], fields: list[str]) -> None:
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, delimiter="\t", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    handle_map = load_handle_map()
    collections = load_shopify_collections()
    audit_rows = load_audit_rows()
    classified = [classify_row(row, collections, handle_map) for row in audit_rows]

    fields = [
        "status",
        "nav_section",
        "label",
        "path",
        "shopify_handle",
        "shopify_title",
        "bc_banner_filename",
        "shopify_banner_filename",
        "desktop_banner_image",
        "shopify_image_url",
        "page_url",
    ]

    needs_upload = [r for r in classified if r["status"] == "needs_upload"]
    already = [r for r in classified if r["status"] == "already_uploaded"]
    review = [r for r in classified if r["status"] in {"review_mismatch", "review_unknown", "missing_collection"}]
    no_bc = [r for r in classified if r["status"] == "no_bc_banner"]

    write_tsv(ROOT / "banner-upload-needed.tsv", needs_upload, fields)
    write_tsv(ROOT / "banner-already-uploaded.tsv", already, fields)
    write_tsv(ROOT / "banner-review.tsv", review, fields)

    unique_needed = sorted({r["desktop_banner_image"] for r in needs_upload if r["desktop_banner_image"]})
    (ROOT / "banner-images-to-download.txt").write_text("\n".join(unique_needed) + ("\n" if unique_needed else ""))

    print("Banner upload comparison complete")
    print(f"  Shopify collections loaded: {len(collections)}")
    print(f"  Already uploaded (filename match): {len(already)}")
    print(f"  Needs upload: {len(needs_upload)}")
    print(f"  Review / missing handle: {len(review)}")
    print(f"  No BC banner: {len(no_bc)}")
    print(f"  Unique BC images still needed: {len(unique_needed)}")
    print()
    print("Wrote:")
    print("  tmp/banner-upload-needed.tsv")
    print("  tmp/banner-already-uploaded.tsv")
    print("  tmp/banner-review.tsv")
    print("  tmp/banner-images-to-download.txt")


if __name__ == "__main__":
    main()
