# Claude Chrome Extension — Petals Shipping Package Setup

Use this on the **Petals** Shopify Admin packages page. The Claude browser extension **cannot attach CSV files** — copy/paste the checklist instead (see [How to send the data](#how-to-send-the-data) below).

---

## How to send the data

**Option A (recommended):** One message with two parts:
1. Paste the **Prompt** section below
2. Immediately below it, paste the **Package checklist CSV** from the bottom of this file (or from `output/box-master-checklist.csv`)

**Option B:** Two messages:
1. First message: paste the prompt; say *"CSV follows in next message"*
2. Second message: paste only the CSV block

**On resume:** Paste an updated CSV with `admin_status=done` on completed rows so Claude knows where to continue.

If the extension truncates a long paste, work in **batches of ~20 rows** — paste 20 pending rows at a time and use the resume prompt between batches.

---

## Prompt (copy everything below this line)

You are helping set up shipping packages for the Petals Shopify store (`petalscom.myshopify.com`).

### Context

- I will paste the **package checklist CSV** inline in this chat (76 packages). Treat it as your source of truth.
- I will manually create **2–3 sample packages first** so you can learn the exact Admin UI flow on this store.
- After I confirm the samples look correct, create the **remaining** packages from the CSV (rows where `admin_status` = `pending`).
- **Important business rule:** Product weights already include packaging weight, so every package must be saved with **package weight = 0 lbs**.

### Where to work

1. Go to **Settings → Shipping and delivery**
2. Open the **Packages** section
3. Click **Add package** to open the modal

### Add package modal — field order (top to bottom)

The modal has a **Custom package** / **Carrier package** toggle at the top. Always use **Custom package** (not Carrier package).

Fill fields in this order:

| # | Modal control | Value |
|---|---------------|-------|
| 1 | **Custom package** toggle | Select **Custom package** (left option) |
| 2 | **Package type** | Select **Box** (not Envelope or Soft package) |
| 3 | **Length** | `length_in` from CSV |
| 4 | **Width** | `width_in` from CSV |
| 5 | **Height** | `height_in` from CSV |
| 6 | Dimension unit dropdown | Leave as **in** (inches) |
| 7 | **Weight (empty)** | **0** |
| 8 | Weight unit dropdown | Leave as **lb** (pounds) |
| 9 | **Package name** | `package_name` from CSV (e.g. `Petals Package #2`) |
| 10 | **Use as default package for all products** | **Leave unchecked** — we assign packages per product later |

The **Add package** button stays disabled until required fields are filled. After entering all values, click **Add package** (bottom right). Use **Cancel** only to abandon a row.

Use the **length_in / width_in / height_in columns from the CSV**, not any free-text dimension description elsewhere in the source sheet.

### Workflow per row

1. Click **Add package** on the Packages page
2. Confirm **Custom package** is selected
3. Select **Box** under Package type
4. Enter Length, Width, Height from CSV (units: in)
5. Enter **0** in Weight (empty) (units: lb)
6. Enter Package name from CSV
7. Confirm **Use as default package for all products** is **unchecked**
8. Click **Add package** (wait for modal to close / package to appear in list)
9. Confirm the saved package shows correct name and dimensions
10. Mark the row `admin_status=done` in your working copy of the CSV
11. Move to the next `pending` row

### Pace and safety

- Work **one package at a time**. Do not skip ahead.
- After every **5 packages**, pause and summarize what you created (box #, name, dimensions).
- If a save fails or the UI behaves unexpectedly, **stop** and tell me what happened — do not guess.
- If a package with the same name already exists, mark the row `admin_status=done` and note `already_exists` — do not create a duplicate.
- Process rows in **numeric box_number order** (2, 5, 6, 7, …).

### Package ID capture (experiment)

After each successful save (or after refreshing the Packages page), try to capture the Shopify package GID for `package-id-map.json`:

1. Open **DevTools → Network**
2. Filter for `graphql`
3. Reload the Packages page or interact with the package list
4. Look for a GraphQL response containing shipping package objects with fields like `id` and `name`
5. Match `name` (e.g. `Petals Package #2`) to `id` (e.g. `gid://shopify/ShippingPackage/123456789`)
6. Write the GID into the CSV `shopify_package_gid` column for that row

If DevTools capture is unreliable, skip GID capture during creation and we'll do a bulk capture pass at the end.

### End-of-session deliverables

When stopping (finished or paused), provide:

1. Updated CSV with `admin_status` and any `shopify_package_gid` values filled in
2. Count of packages created vs still pending
3. List of any errors or rows skipped
4. If GIDs were captured, a JSON snippet:

```json
{
  "2": "gid://shopify/ShippingPackage/…",
  "5": "gid://shopify/ShippingPackage/…"
}
```

### Start

Wait for me to say **"samples done — proceed"** after I've created 2–3 packages by hand. Then begin with the first `pending` row in the CSV.

---

## Resume prompt (if session ends mid-run)

Continue creating Petals shipping packages. I will paste the current checklist CSV below — only process rows where `admin_status` is `pending`. Same rules as above: **Custom package** modal, **Box** type, dimensions from CSV (in), weight **0 lb**, package name from CSV, **do not** check "Use as default package for all products", one at a time, mark each row done after save. Start from the first pending row and tell me how many remain.

**Then paste your updated CSV** (with `done` rows marked) in the same message.

---

## GID-only pass prompt (after all packages exist)

All 76 `Petals Package #N` packages should now exist in Shopify Admin under Settings → Shipping and delivery → Packages.

Your task: fill in the `shopify_package_gid` column for every row. I will paste the checklist CSV below.

1. Open DevTools → Network → filter `graphql`
2. Reload the Packages settings page
3. Find the GraphQL response listing custom shipping packages
4. For each package name `Petals Package #N`, record its `id` (GID) in the CSV
5. Output the final CSV and a consolidated `package-id-map.json`:

```json
{
  "2": "gid://shopify/ShippingPackage/…"
}
```

Use box number (without `#`) as the JSON key.

---

## Package checklist CSV (copy from here)

Copy everything inside the code block below and paste it into Claude after the prompt:

```csv
box_number,package_name,length_in,width_in,height_in,package_weight_lbs,admin_status,shopify_package_gid
2,Petals Package #2,7,7,14,0,pending,
5,Petals Package #5,9,9,17,0,pending,
6,Petals Package #6,10,10,23,0,pending,
7,Petals Package #7,11,11,14,0,pending,
8,Petals Package #8,13,13,15,0,pending,
10,Petals Package #10,12,13,15,0,pending,
11,Petals Package #11,17,16,17,0,pending,
14,Petals Package #14,15,14,24,0,pending,
15,Petals Package #15,12,12,33,0,pending,
16,Petals Package #16,13,13,28,0,pending,
17,Petals Package #17,22,22,7,0,pending,
18,Petals Package #18,11,7,31,0,pending,
19,Petals Package #19,15,15,33,0,pending,
20,Petals Package #20,20,11,20,0,pending,
21,Petals Package #21,14,14,26,0,pending,
24,Petals Package #24,9,9,9,0,pending,
27,Petals Package #27,16,16,39,0,pending,
28,Petals Package #28,11,11,9,0,pending,
34,Petals Package #34,11,11,13,0,pending,
41,Petals Package #41,14,14,16,0,pending,
42,Petals Package #42,19,19,7,0,pending,
45,Petals Package #45,15,15,20,0,pending,
48,Petals Package #48,17,17,17,0,pending,
50,Petals Package #50,17,17,48,0,pending,
54,Petals Package #54,19,19,19,0,pending,
55,Petals Package #55,19,19,25,0,pending,
60,Petals Package #60,21,21,21,0,pending,
66,Petals Package #66,31,31,7,0,pending,
67,Petals Package #67,12,10,3,0,pending,
68,Petals Package #68,7,7,10,0,pending,
69,Petals Package #69,15,15,5,0,pending,
72,Petals Package #72,25,25,25,0,pending,
78,Petals Package #78,7,7,13,0,pending,
105,Petals Package #105,7,10,47,0,pending,
106,Petals Package #106,9,10,47,0,pending,
107,Petals Package #107,9,12,47,0,pending,
125,Petals Package #125,8,10,47,0,pending,
126,Petals Package #126,9,11,47,0,pending,
127,Petals Package #127,10,11,47,0,pending,
135,Petals Package #135,11,7,47,0,pending,
136,Petals Package #136,11,9,47,0,pending,
137,Petals Package #137,10,12,47,0,pending,
205,Petals Package #205,7,11,47,0,pending,
206,Petals Package #206,10,10,48,0,pending,
207,Petals Package #207,11,10,48,0,pending,
311,Petals Package #311,11,7,47,0,pending,
333,Petals Package #333,9,11,47,0,pending,
335,Petals Package #335,7,10,48,0,pending,
336,Petals Package #336,12,10,48,0,pending,
337,Petals Package #337,12,10,48,0,pending,
340,Petals Package #340,7,8,32,0,pending,
345,Petals Package #345,10,8,48,0,pending,
346,Petals Package #346,12,9,47,0,pending,
347,Petals Package #347,13,10,48,0,pending,
350,Petals Package #350,10,9,47,0,pending,
356,Petals Package #356,9,12,47,0,pending,
357,Petals Package #357,13,10,47,0,pending,
359,Petals Package #359,10,9,32,0,pending,
495,Petals Package #495,10,8,47,0,pending,
518,Petals Package #518,19,7,7,0,pending,
524,Petals Package #524,25,7,7,0,pending,
528,Petals Package #528,29,7,7,0,pending,
530,Petals Package #530,30,6,6,0,pending,
532,Petals Package #532,33,7,7,0,pending,
536,Petals Package #536,37,7,7,0,pending,
538,Petals Package #538,33,9,9,0,pending,
540,Petals Package #540,9,9,41,0,pending,
542,Petals Package #542,43,12,7,0,pending,
548,Petals Package #548,41,5,5,0,pending,
549,Petals Package #549,42,11,11,0,pending,
550,Petals Package #550,44,13,13,0,pending,
551,Petals Package #551,9,19,25,0,pending,
705,Petals Package #705,14,10,43,0,pending,
765,Petals Package #765,14,10,43,0,pending,
956,Petals Package #956,9,12,47,0,pending,
957,Petals Package #957,9,12,47,0,pending,
```

Source file (same data): `scripts/shipping-packages/output/box-master-checklist.csv`
