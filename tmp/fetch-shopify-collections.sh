#!/usr/bin/env bash
set -euo pipefail

STORE="${SHOPIFY_STORE:-petalscom.myshopify.com}"
OUT="tmp/shopify-collections.json"

QUERY='{
  collections(first: 250) {
    nodes {
      handle
      title
      image {
        url
        altText
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}'

shopify store execute --store "$STORE" --query "$QUERY" > "$OUT"
echo "Wrote $OUT"
