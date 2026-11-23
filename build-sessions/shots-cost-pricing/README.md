# Shots · cost-based price formula (390 × 844, @2x, light + dark)

Shot on `next dev` with the dummy no-database env, on a TEMPORARY lab page (not committed) that mounts the REAL
`PriceCatalogBrowser` from `app/admin/pricing/_components/catalog-editor.tsx` with five sample rows. "Now" is
`origin/main`'s catalog editor; "Proposed" is this branch. Next's dev-only issues badge is hidden (its three issues
are the root layout's database reads, which the no-database env refuses).

Sample rows: Live Watch ₱3,000 cost ₱40 · Setnayan AI ₱100 cost ₱2 · Print set ₱1,500 no cost ·
Event Plus — a year ₱4,990 (per_year, so no formula) · Supplier Pro (supplier price, no formula).

| file | what it shows |
|---|---|
| `1-list-now-vs-proposed-*.png` | the card on top; "Formula ₱124 · +₱24", "Formula ₱2,466 · −₱534", "Add cost"; no line on the yearly or supplier row |
| `2-row-open-now-vs-proposed-*.png` | the open card: "Base cost (what it costs us)", "Formula price ₱2,466", "Use formula price" |
| `3-apply-confirm-*.png` | "Apply to all rows with a cost" → every SKU, old → new, before anything is sent |
| `4-change-numbers-*.png` | the four numbers; round-up step is a dropdown (₱1 · ₱5 · ₱10) |
| `5-use-formula-filled-*.png` | "Use formula price" fills the Price box only; the admin still presses Save this price |
| `6-settings-unread-*.png` | the settings read failed: the card says so and no row shows a formula price |
