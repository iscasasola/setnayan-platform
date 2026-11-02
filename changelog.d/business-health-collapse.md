## 2026-07-02 · fix(vendor-performance): animate the Business Health card expand/collapse

The "How your shop is doing" card on My Performance
(`vendor-dashboard/performance/_components/health-composite-card.tsx`) previously
revealed its growth-recs tray with an instant `expanded ? … : null` mount/unmount.
Replaced that hard toggle with a smooth reveal:

- `grid-template-rows` 0fr↔1fr + opacity transition (500ms / 300ms, `ease-in-out`)
  so the card resizes to the tray's natural height with no hardcoded `max-height`.
- The rotating chevron (already present) stays in sync — down when collapsed, up
  when open.
- `motion-reduce:transition-none` honors `prefers-reduced-motion`.
- The tray is `inert` while collapsed so its CTAs (Open messages / Open calendar)
  stay out of the tab order and the accessibility tree until revealed.

Behavior is unchanged: still collapsed by default and re-collapsed on every load
(no persisted state), so the cockpit opens on the health snapshot alone.

SPEC IMPACT: None — presentation-only animation polish on an already-shipped
surface. No schema, pricing, copy, data, or interaction-model change.
