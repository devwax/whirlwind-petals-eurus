# Container nesting

How a plant and its container stay together on the cart, in checkout, in the order confirmation email, and on the packing slip.

The picker and the cart setup are described in the Dawn migration notes at `petals/docs/CONTAINER_PICKER_MIGRATION.md`. This file is the one to update when the packing slip or the email changes.

## What gets stored

On add to cart, `assets/container-picker.js` adds the plant and the pot in one request. The pot uses Shopify nested cart lines (`parent_id` = the plant variant id). A new id is written on both lines so later documents can tell two of the same plant apart.

| Property | Plant | Pot |
| --- | --- | --- |
| `Selected Container` | yes. Title plus price, for people reading the order | no |
| `_bundle_id` | yes | yes. Same value |
| `_container_sku` | yes, when the pot variant has a SKU | no |
| `_is_container` | no | `true` |
| `_parent_variant_id` | no | plant variant id. Same value Cart Ajax requires for `parent_id` |

A cart swap copies the plant's existing `_bundle_id` onto the new pot and updates `Selected Container` and `_container_sku`. Changing quantity finds the pot by `parent_relationship.parent_key`, then by `_bundle_id`. It does not search by variant id.

`_bundle_id` does not exist on orders placed before this change.

## What each surface can see

| Surface | How the pot is linked |
| --- | --- |
| Cart | `item.parent_relationship.parent_key`. `item.id` is the variant id, not a line id |
| Checkout | Shopify's nested summary. We do not rebuild it |
| Order confirmation | `line.nested_lines` when `nested_line_parent?` is true. A property fallback covers orders Shopify did not mark as nested |
| Packing slip | No line id, no `variant_id`, no `nested_lines`. Properties, SKU, title, quantity, and `line_item.groups` only. `groups` is the parent product title, so two of the same plant look identical |

The order line id does not exist when the property is written. Cart `item.id` is the variant id. Using either one as the match key does not separate two lines of the same variant.

`order.line_items` on the packing slip does include `variant_id`. The slip resolves a blank shipment `variant_id` from there, by SKU, then by decoded title.

## Packing slip matcher

Implemented in `tmp/packing-slip-template.liquid`. The live copy is **Settings → Shipping and delivery → Packing slip**, not a theme file. Paste it there only after review. The editor preview for a real order does not include line item properties, so it will not show nesting. Print a packing slip to verify.

For each plant that has `Selected Container`, use the first rule that applies. A pot already printed under a plant is skipped. A pot that matches nothing prints at the end of that shipment, including a shipment that contains only the pot.

1. Same `_bundle_id`.
2. `_container_sku` equals the pot SKU, and only one unused pot has that SKU.
3. Legacy pool: unused pots whose `_parent_variant_id` equals the plant variant.
   - One pot in the pool: use it.
   - Otherwise the pot whose title matches `Selected Container`, when only one does.
   - Otherwise the pot whose quantity equals the plant quantity, when only one does.

Title compare decodes `&amp;`, `&quot;`, `&#34;`, `&#39;`, and `&apos;`, then ignores case, spaces, and quotes. Packing slip titles are stored with those entities. `Selected Container` is the raw product title. Exact compare fails on every container name that contains an inch mark.

Do not match with `contains`. Do not attach whatever pot happens to be left over.

## Email fallback

`tmp/email-order-conf.liquid` and `tmp/Order-confirmation-email-teplate.liquid` render `nested_lines` first. The property fallback uses the same ladder and does not attach the only container on the order to every unmatched plant. Both files are Admin notification copies, not theme files.

## Order 329131

[Container issues again](https://whirlwind.teamwork.com/app/tasks/41389723). Two PLA381-GR lines share parent variant `55630035583049`.

The printed slip nested the four plants that each had their own variant. CTD137-GLD (qty 1) and CTA241-LGH (qty 3) printed at the bottom with "Part of: 4' ZZ Silk Plant."

Admin values already match after the price suffix is removed, including the double space in the CTD137 title. The slip still missed because `line_item.title` is HTML-escaped (`&amp;`, `&quot;`) and the old compare was exact. The four pots that nested never used the title compare. They were the only pot in their variant pool.

There is no `_bundle_id` on this order. The decoded title match is what reprints it: qty 1 under CTD137-GLD, qty 3 under CTA241-LGH.

## Legacy limits

Orders without `_bundle_id` cannot tell two identical pots apart when the plants also share a variant, a title, and a quantity. Those pots print on their own instead of under the wrong plant. A later swap stamps `_bundle_id` on that pair.

## Regression

Run against the ladder above, using the strings from the 329131 preview:

| Case | Result |
| --- | --- |
| 329131 as stored (escaped titles, shared variant) | Each plant gets its own pot. Nothing left over |
| Two of the same plant and the same pot, no bundle id | Neither pot is nested |
| Two of the same plant and the same pot, with bundle ids | Each pot nests under its own plant |
| Two pots with SKU `NDL` and different parent variants (order 318947) | Each nests under its own plant |
| Shipment that is only a pot (order 321809, CTB240-SWH) | The pot prints as its own row |
| One unrelated pot | It is not attached to the plant |

Still to do on a preview theme after the theme files are pushed, and after the slip and email are pasted into Admin:

- One plant, one pot
- The same plant twice with the same pot, and twice with different pots at qty 1 and qty 3
- Quantity 2 on one line
- Swap from the cart drawer and the cart page
- Change quantity on one of two same-variant lines
- Remove the plant and confirm the pot leaves with it
- No container, a free liner, and a paid cover
- A split shipment

Reprint 321809, 326471, 318947, and 329131 after the slip is pasted. 326471 is the two Large poinsettias that share a variant.
