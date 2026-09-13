## 2026-09-03 · feat(mood-board): a cake slot, and the reorder type stops lying

Adds `cake` to the inspiration board — 17 named slots become 18. The cake is
one of the most photographed objects at a Filipino wedding and had no slot at
all, so a couple could collect a ceiling and a tunnel but not the cake standing
in the middle of their own reception.

It is deliberately a SUPPLIER slot. The vendor taxonomy already carries
`cake_maker`, `wedding_cake`, `cake_desserts`, `cake_table` and
`dessert_station`, so the slot maps onto real trades that can stock it from
their own portfolios — the same model as florists filling `flowers` and gown
designers filling `bride`. A baker's own photograph is content they own and
want discovered.

All three gates move together, because a slot added to only some of them fails
in a way that looks like nothing happened: the server validator
(`MOODBOARD_SLOT_KEYS`), the rendered tile list (`GROUPS`), and the DB CHECK
(new migration `20271198640000`, additive — every existing value preserved).
Verified by set comparison that all three carry an identical 18-key set.

FIXED IN PASSING — a stale type the 2-to-3 photo widening missed.
`MoodboardSlotRef.slotPosition` still read `1 | 2`, and the drag-reorder call
site papered over the mismatch with `as 1 | 2`. So dragging a photo onto the
third position type-lied instead of failing to compile. The cast is removed and
the position is typed from `MOODBOARD_SLOT_POSITIONS` end to end, which
promptly surfaced the real looseness (`number` flowing into the narrowed type)
and it is now typed through rather than re-suppressed.

SPEC IMPACT: None — additive slot vocabulary, no behavioural or pricing change.
