## 2026-08-21 · fix(people): the ask reaches the bell, and the answer travels back

Two holes left by the connections work, both the same shape — **something
happened and the person it happened to had no way to find out inside the app.**

**1 · A request lived on one page and nowhere else.** The launcher counts only
*confirmed* connections, so somebody who had been added learned about it from
their inbox or not at all. If they opened Setnayan without opening People, the
app showed them nothing. `addPersonConnection` now emits a
`connection_request` notification to the person being asked, pointing at
`/dashboard/people`.

**2 · The person who asked learned nothing when the answer came.** Their row
simply changed state the next time the page loaded. `confirmConnection` now
emits `connection_confirmed` back to the declarer.

**Deliberately NOT on the notification email allowlist.**
`addPersonConnection` already sends its own tailored invitation; adding these
types to that Set would send the same person a second, generic email about the
same event. A test reads the allowlist literal and fails if either name appears
in it — with a vacuity check, so a passing assertion means the slice really was
the allowlist.

**And `confirmConnection` now `.select()`s its own UPDATE.** It has to, to know
who to tell — and the empty array that comes back from an update matching
nothing is also the only way to tell a real confirmation from a stale click on a
row somebody already answered. An RLS denial and "no such pending row" are the
same value here, and both mean: say nothing to anybody.

Tone is a decision, not decoration: the ask takes the terracotta
"you're being asked" register `rsvp_received` uses; the confirmation takes the
emerald of the other mutual-yes signals. A test asserts they differ — rendering
an action item identically to an FYI is how it gets skimmed past.

SPEC IMPACT: None — no schema change (`notifications.type` is free TEXT with no
CHECK, verified in production), and both label/tone maps are
`Record<NotificationType, …>`, so the compiler required the new entries.
