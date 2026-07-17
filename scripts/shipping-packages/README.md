# Petals shipping package scripts

## Package IDs — no public GraphQL query

Verified on `petalscom.myshopify.com` (API 2026-04): the public Admin API cannot list shipping packages.

Admin UI uses an internal `ShippingPackages` operation. Custom package IDs look like:

```
gid://shopify/ShippingPackageV2/108966805577
```

(not `gid://shopify/ShippingPackage/…` — our script handles `ShippingPackageV2`.)

### Capture from DevTools HAR (recommended)

1. Open [Settings → Shipping and delivery → Packages](https://admin.shopify.com/store/petalscom/settings/shipping/saved-packages)
2. DevTools → **Network** → filter **`ShippingPackages`**
3. **Click through every pagination page** (10 packages per page; ~8 pages for 76 Petals boxes)
4. Right-click Network → **Save all as HAR with content**
5. Run:

```bash
python3 scripts/shipping-packages/build_package_id_map.py \
  --from-har scripts/shipping-packages/admin.shopify.com.har
```

If you capture additional pages in a second HAR:

```bash
  python3 scripts/shipping-packages/build_package_id_map.py --from-har page2.har --merge
  python3 scripts/shipping-packages/build_package_id_map.py --from-json page2.json --merge
  # Or paste each page's Response JSON to output/pages/page-N.json and merge all:
  python3 scripts/shipping-packages/build_package_id_map.py --from-json output/pages/*.json --merge
```

Output: `output/package-id-map.json` (expect 76 entries when complete).

### Single JSON response (paste per page)

Filter Network for `ShippingPackages`, open a response, copy the **Response** JSON (starts with `{"data":{"shippingPackages":…`), save each page to a file, then merge:

```bash
# Save pasted JSON as output/pages/page-2.json, page-3.json, etc.
python3 scripts/shipping-packages/build_package_id_map.py --from-json output/pages/page-2.json --merge
python3 scripts/shipping-packages/build_package_id_map.py --from-json output/pages/page-3.json --merge

# Or all page files at once:
python3 scripts/shipping-packages/build_package_id_map.py --from-json output/pages/page-*.json --merge
```

Each page adds ~9–10 Petals packages. Repeat until the script reports **76 mappings**.

## Assign packages + weights to products

PM rules (Mark Wexler):
- Numeric **Box #** in map → assign package
- Numeric **Ship Weight** → assign weight (lbs)
- Otherwise ignore that field

```bash
# Test one item
python3 scripts/shipping-packages/assign_shipping_packages.py --dry-run --sku FLA216

# Apply after review
python3 scripts/shipping-packages/assign_shipping_packages.py --apply --sku FLA216

# Full run
python3 scripts/shipping-packages/assign_shipping_packages.py --dry-run
python3 scripts/shipping-packages/assign_shipping_packages.py --apply
```

**Note:** Sheet `Item #` like `FLA216` applies to all variants whose SKU is `FLA216` or `FLA216-*` (color variants).

Reports: `output/assignment-report.csv`

## Detect ounces-vs-pounds weight issues

Some variants had ounce values stored with a POUNDS unit before the shipping update
(e.g. sheet 2 lb, Shopify had 32 POUNDS). Use this audit script to list affected products.

```bash
# Historical: analyze pre-apply dry run or assignment report (no API)
python3 scripts/shipping-packages/detect_weight_unit_issues.py \
  --from-log "scripts/shipping-packages/Package map dry run.txt"

python3 scripts/shipping-packages/detect_weight_unit_issues.py \
  --from-log scripts/shipping-packages/output/assignment-report.csv

# Live: scan catalog for the same weight profile
python3 scripts/shipping-packages/detect_weight_unit_issues.py --scan-store

# Live: only products NOT in the Item/Box/Weight sheet
python3 scripts/shipping-packages/detect_weight_unit_issues.py \
  --scan-store --exclude-sheet-items
```

Output: `output/weight-unit-issues.csv`

## BigCommerce weight audit

Compare BigCommerce catalog weights against the same sheet + heuristics (zero weight
and oz-as-lb multiples of 16). Useful for cross-checking Shopify against the legacy
BigCommerce source.

```bash
cp scripts/shipping-packages/.env.example scripts/shipping-packages/.env
# Add BIGCOMMERCE_AUTH_TOKEN to .env

# Test with a small page of products
python3 scripts/shipping-packages/compare_bigcommerce_weights.py --limit 5

# Full catalog
python3 scripts/shipping-packages/compare_bigcommerce_weights.py

# Sheet-matched SKUs only, with Shopify cross-check
python3 scripts/shipping-packages/compare_bigcommerce_weights.py \
  --sheet-only --compare-shopify
```

Output: `output/bigcommerce-weight-issues.csv`

## Shopify-only issues export (for PM)

Live scan of Shopify variants that **still** have a weight problem. Output includes an
`issue` column: `zero weight` or `incorrect weight`.

```bash
python3 scripts/shipping-packages/export_shopify_weight_issues.py
```

Output: `output/shopify-weight-issues.csv`

## Fix incorrect Shopify weights (PM list)

Apply corrected weights from the PM CSV (`implied_lb_if_oz` column):

```bash
python3 scripts/shipping-packages/fix_shopify_weights.py --dry-run
python3 scripts/shipping-packages/fix_shopify_weights.py --apply
```

Default input: `Petals - Incorrect weight in Shiopify - shopify-weight-issues.csv`  
Report: `output/fix-shopify-weights-report.csv`
