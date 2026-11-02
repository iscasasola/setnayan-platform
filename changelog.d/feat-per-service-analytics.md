## 2026-07-01 · feat(vendor-performance): per-service analytics — service selector + segment Momentum/ROI/booked on real data

Adds an optional per-service scope to the vendor **My Performance** page so a
multi-service vendor can read their bookings-derived cards for one service, not
just the shop-level total. Segmentation rides on `event_vendors.service_id`
(the real booked-service link) — no per-service number is ever fabricated.

- **Migration** `20270421256598_per_service_analytics_rpc_service_filter.sql` —
  `CREATE OR REPLACE` on the two bookings-derived RPCs, replicating the shipped
  bodies verbatim and only appending: a nullable `p_service_id UUID DEFAULT
  NULL` arg, an IDOR ownership guard (`RAISE 'FORBIDDEN: service not owned'`
  unless the service belongs to the vendor), and `AND (p_service_id IS NULL OR
  ev.service_id = p_service_id)` in each booked CTE.
    - `public.vendor_source_attribution(UUID, TIMESTAMPTZ, UUID)`
    - `public.vendor_booking_monthly_series(UUID, INTEGER, UUID)`
  - The `DEFAULT NULL` keeps every existing 2-arg caller working unchanged;
    `REVOKE ALL / GRANT EXECUTE … TO authenticated` re-issued on each new
    3-arg signature.
- **Data libs** — `fetchVendorSourceAttribution` + `fetchVendorBookingSeries`
  take an optional trailing `serviceId?: string | null` (passed as
  `p_service_id`). New `fetchServiceBookedCount()` in `lib/vendor-funnel.ts`
  returns ONLY a per-service booked count (mirrors the funnel's booked-stage
  query + `.eq('service_id', …)`); the 4-bar funnel itself is untouched.
- **Page** (`app/vendor-dashboard/performance/page.tsx`) — new `?service` param
  (validated against the caller's own ACTIVE services; spoofed / non-owned /
  inactive / deleted → All, silently). `ServiceScopeSelector` (pills ≤4 active,
  native `<select>` ≥5, 44px targets) renders in the header only with 2+ active
  services (Pro+). Only Momentum + ROI + a booked callout segment; Health,
  Grow, Demand, and the funnel's views/inquiries/quotes stay **shop-level by
  design** and wear an "across all services" note when a service is picked.
  Both view params (`service` + `momentum`) now survive every toggle via
  `buildPerformanceHref` (fixes a param-drop bug where the Momentum toggle
  erased `?service`). Scoped empty states + a NULL-service reconciliation
  footnote ("Excludes N bookings not tied to a specific service").

Inquiries-per-service (`thread_service_interests`) was intentionally deferred —
a thread can carry multiple requested services, so counting it per service
over-counts. Left shop-wide with a visible note.

SPEC IMPACT: None. No new tables/columns; adds a nullable arg to two shipped
SECURITY DEFINER RPCs (backward-compatible) and a vendor-facing UI scope filter.

## 2026-07-01 · fix(vendor-performance): honest null-service footnote + segment daily series + drop old RPC overloads (gap-check)

Follow-up gap-check fixes on the per-service analytics work above.

- **Honest "Excludes N …" footnote (was a correctness/honesty bug).** The
  Momentum + ROI "Excludes N bookings not tied to a specific service" footnote
  was computed as `shopBooked.totalBookings − thisService.totalBookings`. For a
  multi-service vendor that remainder is `(OTHER services' bookings) + (true
  NULL-service bookings)`, so it MISLABELLED other services' bookings as "not
  tied to a specific service." Replaced with a direct count of
  `service_id IS NULL` booked rows per window: new
  `fetchNullServiceBookedCount()` in `lib/vendor-funnel.ts` (mirrors
  `fetchServiceBookedCount` but `.is('service_id', null)`), run in the existing
  parallel batch — not a subtraction, not a serial waterfall. The
  momentum-card / roi-attribution-card copy is now accurate as-is.
- **Daily chart now segments per-service (was force-emptied).** Previously the
  Momentum DAILY *count* was per-service but the daily *chart* was blanked
  (`serviceId ? [] : …`) because `vendor_booking_daily_series` had no service
  filter. The migration now `CREATE OR REPLACE`s that RPC too with
  `p_service_id UUID DEFAULT NULL` (shipped body replicated verbatim + the same
  IDOR ownership guard + `AND (p_service_id IS NULL OR ev.service_id =
  p_service_id)`); `fetchVendorBookingDailySeries()` threads `serviceId`; the
  page passes the segmented series so the daily chart renders per-service. The
  daily footnote now works via a 30-day `fetchNullServiceBookedCount`.
- **Dropped the stale 2-arg RPC overloads (ambiguity trap).** `CREATE OR
  REPLACE` with a 3rd arg does not remove the old 2-arg signature — the two
  overloads would coexist and a 2-arg call would become ambiguous. The migration
  now `DROP FUNCTION IF EXISTS` the 2-arg signature of all three RPCs
  (`vendor_source_attribution(UUID, TIMESTAMPTZ)`,
  `vendor_booking_monthly_series(UUID, INTEGER)`,
  `vendor_booking_daily_series(UUID, INTEGER)`) immediately before each
  re-create, so only the single 3-arg overload survives; 2-arg callers resolve
  via the DEFAULT NULL. No view/policy/function depends on the 2-arg forms
  (verified), so the DROPs need no CASCADE.
- **a11y.** The 5+-services native `<select>` had no branded keyboard focus
  ring (the global `:focus-visible` list covers `[role='tab']` pills but not a
  bare `<select>`); added
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-mulberry` to match the pill tabs.

SPEC IMPACT: None. Correctness/honesty + a11y fixes; the daily-series RPC gains
the same backward-compatible nullable `p_service_id` arg as the other two, and
the stale 2-arg overloads are dropped (2-arg calls still resolve via DEFAULT).
