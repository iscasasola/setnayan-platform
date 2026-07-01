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
