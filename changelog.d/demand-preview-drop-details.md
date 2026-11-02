## 2026-07-02 · fix(vendor): drop the "Details →" drill-link on the My Performance demand card

The Demand radar preview card on My Performance still carried a "Details →"
link to `/vendor-dashboard/demand`, while the folded-in booking funnel next to it
no longer does — a visible inconsistency (owner: *"this [Details link] is still
here on demand radar"*).

- Removed the `Details →` `<Link>` from `DemandPreviewCard` (and its now-unused
  `Link` / `ArrowRight` imports). The card header is now just the title.
- The full radar (privacy note + own-bookings-by-source strip) is unchanged and
  still reachable from the sidebar's **Demand Radar** item — nothing is lost, the
  redundant inline drill-link is just gone.

Verified: `tsc --noEmit` clean · ESLint clean.

SPEC IMPACT: None (presentational — removes one redundant navigation affordance).
