## 2026-07-01 · chore(vendor): seed founder vendor demo data so dashboard stats populate

Adds migration `20270405784887_seed_founder_vendor_demo_stats.sql` — demo data
for the sole published marketplace vendor (`Setnayan Founder · Ice`,
`646c9457-…`) so the owner can dogfood a populated `/vendor-dashboard`.

Seeds, all tagged `events.display_name LIKE 'FOUNDER-DEMO · %'` (idempotent —
the script deletes prior demo events first; ON DELETE CASCADE clears dependents):

- 18 member-less demo events (8 past + 10 future; not slug-reachable, invisible
  to any host dashboard)
- 8 `event_vendors` completed/delivered bookings → **Completed events = 8** +
  Experience badge "Established"
- 8 `vendor_reviews` (avg ~4.6, anonymous `couple_user_id = NULL`) → public
  review count/rating + panel review score
- 10 `chat_threads` (6 accepted / 4 pending; 3 within 14 days) + couple/vendor
  `chat_messages` → **Open inquiries = 10 · Confirmed bookings = 6 · Upcoming = 3**
- `vendor_activity_stats` row (quality 88 · response 95% · ~1h35m reply · etc.)
  — this table is service-role/admin write-only and does not auto-derive
- `vendor_wallets` = 150 tokens (100 earned + 50 purchased)
- Non-concurrent REFRESH of the completed-events + review matviews

To retire later: `DELETE FROM public.events WHERE display_name LIKE 'FOUNDER-DEMO · %';`
then clear `vendor_activity_stats`/`vendor_wallets` for the founder id.

SPEC IMPACT: None — demo/dogfood data only, no schema or behavior change.
