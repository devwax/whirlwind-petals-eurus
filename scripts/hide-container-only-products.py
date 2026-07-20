#!/usr/bin/env python3
"""
Hide container-only products (Gold Cover, NDL) from storefront discovery.

Required product state (Shopify platform constraint):
- ACTIVE status
- Published to the Online Store sales channel

Draft / unpublished products return "Cannot find variant" from /cart/add.js and
cannot be used as container addons. Hiding is theme-only:
- layout/theme.liquid redirects direct PDP visits to /404 by handle
- Search excludes ct-gold / ct-ndl
- Discovery tags removed so smart collections drop them
- Picker omits "View Product" for these handles

Usage:
  python3 scripts/hide-container-only-products.py --dry-run
  python3 scripts/hide-container-only-products.py --apply

Pinned picker metadata lives in Theme settings → Petals — container free options
(variant IDs + images). Used as a fallback display source for ct-ndl / ct-gold.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time

STORE = "petalscom.myshopify.com"

CONTAINER_ONLY = {
    "gold-cover": {
        "keep_collections": {"ct-gold"},
        "remove_tags": {"general", "Containers", "Vases & Accessories"},
    },
    "non-decorative-liner-free-0-00": {
        "keep_collections": {"ct-ndl", "klaviyo-exclude"},
        "remove_tags": {"general"},
    },
}


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


def fetch_product(handle: str) -> dict:
    data = shopify_graphql(
        """
        query ProductByHandle($handle: String!) {
          productByHandle(handle: $handle) {
            id
            handle
            title
            status
            onlineStoreUrl
            tags
            collections(first: 50) {
              nodes {
                id
                handle
                title
                ruleSet { appliedDisjunctively }
              }
            }
          }
        }
        """,
        {"handle": handle},
    )
    product = data.get("productByHandle")
    if not product:
        raise RuntimeError(f"Product not found: {handle}")
    return product


def ensure_active(product: dict, *, apply: bool) -> None:
    if product["status"] == "ACTIVE":
        print("  ✓ Already ACTIVE")
        return
    if not apply:
        print(f"  [dry-run] Would set {product['handle']} status → ACTIVE")
        return
    result = shopify_graphql(
        """
        mutation SetActive($input: ProductInput!) {
          productUpdate(input: $input) {
            product { handle status }
            userErrors { field message }
          }
        }
        """,
        {"input": {"id": product["id"], "status": "ACTIVE"}},
        mutation=True,
    )
    errors = result["productUpdate"]["userErrors"]
    if errors:
        raise RuntimeError(f"productUpdate failed: {errors}")
    updated = result["productUpdate"]["product"]
    print(f"  ✓ Status set to {updated['status']} for {updated['handle']}")


def remove_from_manual_collection(collection_id: str, product_id: str, *, apply: bool) -> bool:
    if not apply:
        print(f"  [dry-run] Would remove product from manual collection {collection_id}")
        return True
    result = shopify_graphql(
        """
        mutation RemoveFromCollection($id: ID!, $productIds: [ID!]!) {
          collectionRemoveProducts(id: $id, productIds: $productIds) {
            job { id done }
            userErrors { field message }
          }
        }
        """,
        {"id": collection_id, "productIds": [product_id]},
        mutation=True,
    )
    errors = result["collectionRemoveProducts"]["userErrors"]
    if errors:
        message = errors[0].get("message", "")
        if "smart collection" in message.lower():
            print(f"  ↷ Skipped smart collection {collection_id}")
            return False
        raise RuntimeError(f"collectionRemoveProducts failed: {errors}")
    job = result["collectionRemoveProducts"]["job"]
    if job:
        print(f"  ✓ Removal job started: {job['id']}")
    return True


def update_tags(product_id: str, tags: list[str], *, apply: bool) -> None:
    if not apply:
        print(f"  [dry-run] Would set tags → {tags}")
        return
    result = shopify_graphql(
        """
        mutation UpdateTags($input: ProductInput!) {
          productUpdate(input: $input) {
            product { handle tags }
            userErrors { field message }
          }
        }
        """,
        {"input": {"id": product_id, "tags": tags}},
        mutation=True,
    )
    errors = result["productUpdate"]["userErrors"]
    if errors:
        raise RuntimeError(f"productUpdate tags failed: {errors}")
    product = result["productUpdate"]["product"]
    print(f"  ✓ Tags updated for {product['handle']}: {product['tags']}")


def process_product(handle: str, config: dict, *, apply: bool) -> None:
    keep = config["keep_collections"]
    product = fetch_product(handle)
    print(f"\n{product['title']} ({handle})")
    print(f"  Status: {product['status']}, onlineStoreUrl: {product['onlineStoreUrl']!r}")

    if product["status"] != "ACTIVE":
        ensure_active(product, apply=apply)
    else:
        print("  ✓ Already ACTIVE")

    if product["onlineStoreUrl"]:
        print("  ✓ Published to Online Store (required for cart/add.js)")
    else:
        print("  ! NOT published to Online Store — turn ON Online Store in Admin")
        print("    (Draft/unpublished → 'Cannot find variant' when adding as container)")

    remove_tags = config.get("remove_tags", set())
    current_tags = product.get("tags") or []
    if isinstance(current_tags, str):
        current_tags = [t.strip() for t in current_tags.split(",") if t.strip()]
    tags_to_remove = remove_tags.intersection(set(current_tags))
    if tags_to_remove:
        print(f"  Removing tags: {sorted(tags_to_remove)}")
        new_tags = [t for t in current_tags if t not in remove_tags]
        update_tags(product["id"], new_tags, apply=apply)
    else:
        print("  ✓ No discovery tags to remove")

    removals = [
        coll
        for coll in product["collections"]["nodes"]
        if coll["handle"] not in keep
    ]
    manual_removals = [coll for coll in removals if not coll.get("ruleSet")]
    smart_removals = [coll for coll in removals if coll.get("ruleSet")]

    if smart_removals and tags_to_remove:
        print(f"  ↷ {len(smart_removals)} smart collection(s) will drop off after tag removal")
    elif smart_removals:
        for coll in smart_removals:
            print(f"  ! Still in smart collection {coll['handle']} — add tag to remove_tags")

    if not manual_removals:
        if not smart_removals or tags_to_remove:
            print("  ✓ No manual collection removals needed")
        return

    print(f"  Removing from {len(manual_removals)} manual collection(s):")
    for coll in manual_removals:
        print(f"    - {coll['title']} ({coll['handle']})")
        remove_from_manual_collection(coll["id"], product["id"], apply=apply)
        if apply:
            time.sleep(0.3)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true")
    group.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    apply = args.apply

    print(f"Store: {STORE}")
    print("Mode:", "APPLY" if apply else "DRY RUN")

    for handle, config in CONTAINER_ONLY.items():
        process_product(handle, config, apply=apply)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
