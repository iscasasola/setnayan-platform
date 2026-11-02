## 2026-07-02 · feat(vendor-dashboard): unify My Performance filter row + tap-to-expand cards

Owner requests on the vendor **My Performance** cockpit
(`/vendor-dashboard/performance`):

1. **One filter row.** The Daily/Monthly/Annual window toggle and the "All
   services" scope selector now sit on a single row that governs everything
   below it. Content that has no time-window or per-service dimension (Business
   Health, Grow tips, Inquiries, Conversion, Reputation, Capacity, Market
   Intelligence) is reordered to sit ABOVE the row; the only cards that actually
   segment on window/service (Momentum + ROI + funnel) sit below it. The
   Momentum window toggle was lifted out of `MomentumCard` into a shared
   `MomentumWindowToggle`; a new client `PerformanceControls` owns the window
   state and renders both controls + the Momentum card.

2. **Tap-to-expand Business Health.** The dark Business Health card is now the
   tap target that reveals the "Grow your business" recommendations beneath it
   (collapsed by default, chevron affordance). The redundant "Grow your business
   · HIGHEST IMPACT FIRST" section header is removed — the recs render as bare
   cards inside the expanded card.

3. **Tap-to-expand funnel rows.** Each stage row in "Where bookings come from"
   (Profile views / Inquiries / Quotes sent / Booked) expands on tap to show a
   one-line explainer of what that stage counts.

4. **Section-label kickers removed.** The in-page "OVERVIEW" / "YOUR BUSINESS" /
   "INQUIRIES" / … uppercase dividers are dropped (consistent with the
   site-wide kicker removal); the local `SectionHeading` helper is deleted. The
   ROI + funnel block sits under a collapsed-by-default "Show more" disclosure.

New components: `performance-controls.tsx`, `momentum-window-toggle.tsx`,
`section-disclosure.tsx`. `MomentumCard` is now a controlled, presentational
component (window state lifted to the parent). Reconciled onto current
`origin/main`, which had already removed the page-title header block and widened
the container — both preserved.

Verified: `tsc --noEmit` clean, `eslint` clean, production `next build` green.

SPEC IMPACT: None — vendor-dashboard UI reorganization, no schema/SKU/pricing/flow change.
