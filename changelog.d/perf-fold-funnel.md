## 2026-07-02 · feat(vendor): Daily/Monthly/Annual filter now drives ROI + booking funnel

Follow-up to the fold-in below. The Daily/Monthly/Annual window toggle + service
scope now also drive **Setnayan vs your own book (ROI)** and **Where bookings
come from (funnel + by-source)** — previously those were pinned to the annual
window. Owner: *"align this to … setnayan vs your own book and where do bookings
come from … autopopulate when the values are changed, no button to apply."*

- **Instant, no Apply button** — all three windows (year 365d · month 28d · day
  30d) are pre-fetched server-side and passed to `PerformanceControls`, which
  swaps the ROI + funnel + by-source section **client-side** on toggle (same
  pattern the Momentum card already used). The service selector still re-fetches
  on navigation. No new button; nothing to "apply".
- **Window framing** matches the Momentum card ("this year" / "this month" /
  "in the last 30 days"). The **"× your annual plan"** ROI multiple is
  annual-specific, so `annualPlanPhp` is passed to the year node only — the
  multiple auto-hides on the month/day windows (comparing a month of sourced
  revenue to an annual plan cost would be misleading).
- **Per-service booked callout** now tracks the window too (year/month/day
  `fetchServiceBookedCount`, one parallel batch, only when a service is picked).
- **Demand Radar + Capacity intentionally NOT wired** (owner "leave them
  global") — Demand Radar is de-identified cross-business *market* data and
  Capacity is *forward-looking*; neither maps to a trailing window or the
  vendor's own service list. They stay above the filter row, visibly outside it.

Verified: `tsc --noEmit` clean · ESLint clean · production build.

SPEC IMPACT: None (own-business analytics interaction — existing windowed data,
now surfaced through the existing filter). Logged in `DECISION_LOG.md` (2026-07-02).

## 2026-07-02 · refactor(vendor): fold Quote-to-Booking Funnel into My Performance + Demand

Consolidates the standalone `/vendor-dashboard/funnel` page (owner "just
integrate this to My Performance as well and the demand radar page"). The
four-stage funnel already previewed on My Performance; this brings over the
unique **by-source breakdown** ("where your bookings / views come from") and
retires the separate page.

- **My Performance (`/vendor-dashboard/performance`)** — now renders the full
  funnel read inline: ROI card + booking-funnel bars + two new **"Where your
  bookings/views come from"** by-source tables (this-year window, min-N floored
  via the shared `FUNNEL_MIN_N`). The funnel preview card was retitled "Your
  booking funnel" and lost its now-dead `Details → /funnel` link.
- **Removed the "Show more/less" collapse** — the old `SectionDisclosure`
  wrapper around ROI + funnel is gone (component deleted); everything on the
  page now shows without a click (owner "remove the collapse, we want everything
  to show").
- **Demand Radar (`/vendor-dashboard/demand`)** — added a clearly-labeled
  **"Your own data"** strip below the (de-identified, market-intel) radar: a
  single "Where your bookings come from" table, visually + textually separated
  so own-attribution never reads as market data.
- **Shared plumbing** — `lib/vendor-funnel.ts` gained `fetchBookedBySource()` /
  `fetchViewsBySource()` + `SourceSlice` type + `humanizeSource`/`SOURCE_LABELS`
  (moved off the old page), and a new server component
  `vendor-dashboard/_components/source-breakdown.tsx` both surfaces reuse. All
  reads stay RLS/ownership-scoped + min-N gated — no behavioral-data regression.
- **Route retired gracefully** — `/vendor-dashboard/funnel` is now a redirect
  stub → `/vendor-dashboard/performance` (no 404 on stale bookmarks). Sidebar
  sub-item, nav-registry slot (`vendor.sidebar.funnel`), and the `Filter` icon
  import removed; bottom-nav keeps `/funnel` in `activeMatch` for the transient
  redirect hop. `VENDOR_TIERS_AND_BENEFITS.md` updated.

Verified: `tsc --noEmit` clean · ESLint clean · nav-icon + bottom-nav lints pass
· `nav-registry-defaults` unit test 8/8 · retired-strings lint clean.

SPEC IMPACT: Vendor IA change — the standalone Quote-to-Booking Funnel page is
retired and folded into My Performance + Demand Radar. Logged at the bottom of
the corpus `DECISION_LOG.md` (2026-07-02 row).
