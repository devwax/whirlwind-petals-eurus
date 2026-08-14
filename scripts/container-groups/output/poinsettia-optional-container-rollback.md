# Rollback: optional containers for Premier Poinsettias

Recorded 2026-08-13 before applying Teamwork [40906209](https://whirlwind.teamwork.com/app/tasks/40906209).

Code rollback: git tag the commit before/after the theme files change.

## Catalog — `custom.container_collections`

Live values fetched 2026-08-13 via Admin GraphQL.

### Premier Silk Poinsettia - Large (`premier-silk-poinsettia-large`)

- Product: `gid://shopify/Product/15517531144265`
- SKUs: `HDB200-RD`, `HDB200-WH`

**Original (restore this):**

```
ct-gold | container-group-1 | container-group-7
```

| Collection | GID |
|---|---|
| ct-gold | `gid://shopify/Collection/669574168649` |
| container-group-1 | `gid://shopify/Collection/669792469065` |
| container-group-7 | `gid://shopify/Collection/669792567369` |

**New:** `container-group-1 | container-group-7`

### Premier Silk Poinsettia - Extra Large (`premier-poinsettia-extra-large`)

- Product: `gid://shopify/Product/15523986014281`
- SKUs: `HDB201-RD`, `HDB201-WH`

**Original (restore this):**

```
ct-gold | container-group-2 | container-group-8
```

| Collection | GID |
|---|---|
| ct-gold | `gid://shopify/Collection/669574168649` |
| container-group-2 | `gid://shopify/Collection/669792501833` |
| container-group-8 | `gid://shopify/Collection/669792600137` |

**New:** `container-group-2 | container-group-8`

**Apply status (2026-08-13):** theme pushed to live `187432927305`, then metafields applied (ct-gold removed). Restore mutation is in `tmp/poinsettia-restore-ct-gold-variables.json`.

### Restore metafields

```bash
shopify store execute --store petalscom.myshopify.com --allow-mutations --query '
mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key namespace }
    userErrors { field message }
  }
}
' --variables '{
  "metafields": [
    {
      "ownerId": "gid://shopify/Product/15517531144265",
      "namespace": "custom",
      "key": "container_collections",
      "type": "list.collection_reference",
      "value": "[\"gid://shopify/Collection/669574168649\",\"gid://shopify/Collection/669792469065\",\"gid://shopify/Collection/669792567369\"]"
    },
    {
      "ownerId": "gid://shopify/Product/15523986014281",
      "namespace": "custom",
      "key": "container_collections",
      "type": "list.collection_reference",
      "value": "[\"gid://shopify/Collection/669574168649\",\"gid://shopify/Collection/669792501833\",\"gid://shopify/Collection/669792600137\"]"
    }
  ]
}'
```

## Theme originals

Picker was always required when shown. Original header (add mode):

```liquid
{%- unless picker_mode == 'change' -%}
  <span class="container-picker__required">(Required)</span>
{%- endunless -%}
```

Original ATC gate in `assets/container-picker.js`:

```javascript
async _onFormSubmit(e, form) {
  // Container is required — block submission if nothing is selected.
  if (!this.hasSelection) {
    e.preventDefault();
    e.stopImmediatePropagation();
    this._showError('Please select a container option before adding to cart.');
    this._openDropdown();
    return;
  }
```

CSS originally only had `.container-picker__required` (no optional class).
