## 2026-08-22 · fix(dashboard): per-event "Add to calendar" only on Now happening + Planning

The per-card "Add to calendar" added in #4717 rendered on every shelf,
including Untold and Told (both past events). Owner, asked directly:
*"shouldn't now happening and planning be the only ones to have this add to
calendar?"* — a day that already happened is not something to add to a
phone calendar.

`BoardCardWithMenu` and `EventCardMenu` take a new `finished` prop (mirroring
the `finished` prop already passed to the card underneath on those two
shelves); when true, the "Add to calendar" row is dropped entirely rather
than offered on a past card.

SPEC IMPACT: None.
