## 2026-07-02 · feat(vendor): Daily/Monthly/Annual + service filter now drives ROI + booking funnel

The My Performance filter row (Daily/Monthly/Annual window + service scope)
previously drove only the Momentum card; ROI + funnel + by-source were pinned to
the annual window. They now respond to the filter too. Owner: *"align this to …
setnayan vs your own book and where do bookings come from … autopopulate when the
values are changed, no need a button to apply."*

- **Instant, no Apply button** — all three windows (year 365d · month 28d · day
  30d) are pre-fetched server-side and passed to `PerformanceControls`, which
  swaps the ROI + funnel + by-source section **client-side** on toggle (same
  pattern the Momentum card already used). The service selector still re-fetches
  on navigation. No new button; nothing to "apply".
- **Window framing** matches the Momentum card ("this year" / "this month" / "in
  the last 30 days"). The **"× your annual plan"** ROI multiple is
  annual-specific, so `annualPlanPhp` is passed to the year node only — the
  multiple auto-hides on the month/day windows (a month of sourced revenue vs an
  annual plan cost would mislead).
- **Per-service booked callout** now tracks the window too (year/month/day
  `fetchServiceBookedCount`, one parallel batch, only when a service is picked).
- **Fault isolation preserved** — every new windowed reader is wrapped in the
  existing `safeRead()` guard (added 2026-07-02), so one failing reader degrades
  to an empty card, never the whole cockpit.
- **Demand Radar + Capacity intentionally NOT wired** (owner "leave them
  global") — Demand Radar is de-identified cross-business *market* data and
  Capacity is *forward-looking*; neither maps to a trailing window or the
  vendor's own service list. They stay above the filter row, visibly outside it.

Verified: `tsc --noEmit` clean · ESLint clean · production build compiles.

SPEC IMPACT: None (own-business analytics interaction over existing windowed
data). Logged in the corpus `DECISION_LOG.md` (2026-07-02).
