## 2026-07-01 · feat(vendor-performance): charts on My Performance (Momentum trend + inline funnel & demand bars)

The shipped `/vendor-dashboard/performance` cockpit was data-backed but
visually flat — Momentum rendered plain big numbers, and the Funnel / Demand
surfaces were reachable only through drill-down link cards. This loads the page
with the graphs the finalized prototype shows, all over the SAME
ownership-gated data the existing surfaces already use.

**New Momentum charts (trailing 12 months)**

- `<BookingsBars>` — a bar per month of booked business, current month deepened.
- `<EarningsSparkline>` — an SVG area line of confirmed booked revenue.
- Both are pure server-rendered (no client JS) and degrade to nothing on an
  all-zero series, so a new vendor keeps the honest big-number empty state.

**New inline previews (replace the "Go deeper" link cards, keep the links)**

- `<FunnelPreviewCard>` — views → inquiries → quotes → booked bar cascade with
  step-to-step conversion %, from the shared `fetchVendorFunnelTotals()` +
  `buildFunnelSteps()` (so the preview and full `/funnel` never disagree).
- `<DemandPreviewCard>` — top "looks couples are asking for" bars + a
  months-heating-up strip, from `getVendorDemandRadar()` (min-N suppressed).

**Schema** (migration `20270405896838_vendor_booking_monthly_series_rpc.sql`)

- `public.vendor_booking_monthly_series(p_vendor_profile_id UUID, p_months INT)`
  — SECURITY DEFINER, STABLE, ownership-gated to `current_vendor_profile_ids()`
  (or a console admin), mirroring `vendor_source_attribution()` /
  `demand_radar_for_vendor()`. Returns one zero-filled row per month
  (`generate_series`) with `booking_count` + `SUM(total_cost_php)` over the
  caller's BOOKED `event_vendors` rows (contracted/deposit_paid/delivered/
  complete), bucketed in Asia/Manila local time. Window clamped 1..24 months.
  Peso figures are partial by nature (nullable `total_cost_php`, off-platform
  settlement) and labeled honestly. Never exposes couple identity.

**Files**

- New: `lib/vendor-booking-series.ts` (reader),
  `app/vendor-dashboard/performance/_components/momentum-chart.tsx`,
  `.../funnel-preview-card.tsx`, `.../demand-preview-card.tsx`.
- Edited: `.../momentum-card.tsx` (accepts `series`, renders the two charts),
  `.../performance/page.tsx` (fetches series/funnel/demand in the existing
  parallel batch; swaps the drill-down cards for the bar previews).

SPEC IMPACT: None. Implements the shipped `/performance` prototype's
visualizations against existing data + one new read-only, ownership-gated RPC.
No pricing, SKU, or scope change. Design artifact:
`03_Strategy/Vendor_Dashboard_Build_Plan_2026-07-01.md` Phase 6.
