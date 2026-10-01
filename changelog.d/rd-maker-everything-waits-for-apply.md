## 2026-10-01 · feat(maker): the Name style waits for Apply · a date a booked supplier cannot do is never offered or accepted

Two owner rules that follow #6230 (DECISION_LOG 2026-10-01).

**The Name style goes through the draft.** Full · Middle initial · Surname first,
picked in the hero names' Wording ▾ or Details' Name style ▾, used to write
`events.print_details.name_style` live (`POST /api/hub-print/name-style`). Both
controls now put it in the Event Hub draft (`events.print_details`, held to the ONE
key `{ name_style }` — the prints' other keys are never drafted); the host's canvas
and Details show it at once, "Changes waiting" counts it, Undo takes it back, and
Apply merges it into the prints' blob through the admin client (every other key of
the blob carried untouched). `lib/name-style-save.ts` is now the patch builder; the
live door stays for the printed pieces' own routes.

**A clashing date is refused at the pick.** "Help me choose" lists only days that
fit every BOOKED supplier (`lib/date-fits-booked.ts`, over the matrix's own
`booked` reading — the availability read Compare uses; no second check). The
draft's save (`hubDraftAction`) asks `datePickClash` (`lib/date-clash.server.ts`)
before a day or month is accepted: a clash is refused with the plain reason ("Your
photographer is booked elsewhere that day."), the date stays as it is, and the one
action — "Ask them to move or unlock?" — opens that supplier's own conversation.
Apply's `eventDateRefusal` is unchanged, the backstop. No new server action, no
migration, no new booking state.

SPEC IMPACT: None.
