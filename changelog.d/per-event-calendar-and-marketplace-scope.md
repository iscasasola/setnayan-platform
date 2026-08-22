## 2026-08-22 · feat(dashboard): add-to-calendar moves onto each event card; marketplace shows only inside an event

- Each My Events card's "⋯" menu now offers **Add to calendar** — a one-shot
  `.ics` download for that single celebration (reuses the existing
  `buildWeddingIcs` builder from the Save-the-Date flow). This is separate
  from the all-events subscription feed (`calendar-subscribe.tsx`), which is
  unchanged: owner, 2026-08-22, *"adding an event to a calendar is not all
  events but just per event."*
- The rail's **Marketplace** destination row and its "Browse by category"
  group now show only while standing inside a specific event
  (`/dashboard/[eventId]`), not on the front door or the My Events board.
  This **reverses** the 2026-08-12 rule that showed it everywhere except
  inside an event — owner, 2026-08-22: *"marketplace is best shown inside an
  event not when they just logged in."* Gated on a new `insideEvent` prop
  (derived from `studioEventId`) rather than the shared `railContext`, so the
  admin console and vendor dashboard — which also push a `railContext` — are
  unaffected.

SPEC IMPACT: None — both are UI-placement changes with no schema or pricing
impact. The marketplace-visibility reversal supersedes the front-door rail
composition decided 2026-08-12 (see the code's own docblock in
`front-door-shell.tsx` for the full history).
