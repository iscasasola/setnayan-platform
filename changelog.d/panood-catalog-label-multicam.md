## 2026-06-26 · chore(pricing): normalize PANOOD_SYSTEM admin pricelist label

New migration `20270301600000_panood_catalog_label_multicam.sql` idempotently
updates `public.platform_retail_catalog_v2` for `service_code = 'PANOOD_SYSTEM'`:
`title` → "Panood — Multicam control room" and `description` to an accurate line
describing the paid multicam upgrade. Replaces stale labels "Panood (Website
Add-on)" / "Panood Multi-Cam Live Broadcast Engine". Label + description ONLY —
`retail_price_php` and all cost columns are untouched (price is admin-managed at
₱2,499/day). Applies on the next `supabase db push`.

SPEC IMPACT: None (display-label normalization; price unchanged).
