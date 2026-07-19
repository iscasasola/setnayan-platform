## 2026-06-29 · feat(vendor): Quote-to-Booking Funnel (Wave 6 "Soon" benefit)

Ships the full views → inquiries → quotes → booked funnel for vendors. The
only net-new stage is **VIEWS** — the other three already had data
(`chat_threads` = inquiries, `vendor_proposals` = quotes,
`event_vendors.status` = booked).

- **Migration `20270323312048_vendor_profile_views_funnel`** — new
  `public.vendor_profile_views` table (vendor_profile_id, event_id, source,
  utm, **viewer_hash**, viewed_at) + `(vendor_profile_id, viewed_at DESC)`
  index. RLS at create: vendor reads OWN via `current_vendor_profile_ids()`,
  admin via `is_admin()`; no anon/authenticated INSERT (writes go through the
  service-role action only).
- **View capture** — `/v/[slug]` fires `after(() => recordVendorProfileView(...))`
  (Next 15, fire-and-forget, never blocks render, fully best-effort). The viewer
  is **de-identified**: stored as `sha256(VIEWER_HASH_SALT || id)`, never the raw
  user_id / anon-session id. `source='profile_direct'` + opaque `utm` captured.
- **Vendor surface** — new `/vendor-dashboard/funnel` route (4-stage funnel +
  bookings-by-source + views-by-source). Aggregates are **min-N suppressed**
  (`public.min_n_ok` / TS `minNOk`, floor 5) on the sliced breakdowns. Sidebar
  entry added under "Grow".
- **Admin surface** — `/admin/funnels` gains a per-vendor drill-down (vendor
  picker → that vendor's funnel for the selected range).
- Shared logic in `lib/vendor-funnel.ts` (`hashViewer`, `minNOk`,
  `fetchVendorFunnelTotals`, `buildFunnelSteps`). New env var
  `VIEWER_HASH_SALT` (falls back to `SUPABASE_SERVICE_ROLE_KEY`).

Explore-card impression capture is **deferred** — per-card grid impressions are
too noisy without a client intersection observer; `/v/[slug]` view-capture is
the solid V1 signal.

SPEC IMPACT: None (new internal analytics surface; no pricing/SKU/public-claim
change). Wave 6 vendor-benefit build only.
