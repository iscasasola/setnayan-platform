## 2026-09-20 · feat(vendor): the booking fee unlocks the event — three stages, behind an OFF flag

Owner ruling, 2026-09-20: "when they pay the booking fee, that is when we unlock
the rest of the controls for that event" — and, the same day, "initially, they
get information they only need to create a quotation for free. but the rest of
access only begins after the booking fee."

**THE RULE IS ONE PURE FUNCTION.** `eventAccessUnlocked({ charge })` in
`apps/web/lib/event-access-stage.ts`, executed by `event-access-stage.test.ts`
(17 subtests, 5 sabotages proven).

- **"Settled" is PAID *or* WAIVED.** `paid` · `waived_free5` · `waived_import`
  all unlock. Reading it as `paid` alone would lock every supplier out of their
  own first five bookings, which the free-5 waiver makes free by design.
- **Only `pending` · `failed` · `expired` lock.** An unknown status unlocks: the
  lock is an allowlist, never a denylist.
- **Per (shop × event), never per shop.** An unpaid fee on event A says nothing
  about event B.
- **An unreadable fee FAILS OPEN**, and is logged. A supplier is never shut out
  of a wedding because one SELECT was refused.

**THREE STAGES.** *Quoting* keeps every pricing input (event type · date · the
AREA · guest count · the service asked for · the couple's preferences · the
budget band). *Booked, fee unsettled* adds the three surfaces that are always
open — the conversation, that booking's own money page, and the fee payment
screen. *Settled* opens everything.

**WITHHELD UNTIL SETTLED, AND NAMED ON THE SCREEN:** the exact venue and
address, meal counts, the day-of timeline, the seat plan, the monogram. Every
redaction is shape-preserving, so `redactBriefForStage` returns a `withheld`
list and the locked panel renders it — a withheld timeline must never read as a
wedding nobody has planned.

**APPLIED AT THE SERVER**, not only in the UI: 10 per-event supplier pages and
5 server-action modules. A locked action refuses with the fee message, not with
"You are not booked on this event" — a sentence a booked supplier cannot act on.

**THE COUPLE IS NEVER BLOCKED.** The fee is deliberately NOT folded into
`admitRoomBookings`: `lib/guest-song-request.ts` and the couple's celebration
page read that same "is this shop booked" answer, so folding it in would delete
the couple's band from their own wedding page over their supplier's debt. A
guard fails if any couple-side or guest-side file imports the gate.

**SHIPS DARK** behind `NEXT_PUBLIC_FEE_UNLOCKS_EVENT` (not set in Production).
With the flag off every stage resolves to `unlocked` and the redaction is a
no-op, so behaviour is byte-identical to today.

⚖ Two owner-open points, each one named constant:
`SHOW_BUDGET_BAND_WHILE_QUOTING = true` and `VENUE_WHILE_QUOTING = 'area_only'`.

⚠ Not gated in SQL. `get_vendor_event_brief` still returns those fields at every
rung; the narrowing is applied server-side before render. Closing the RPC itself
is a migration and is deliberately not in this PR.

Unchanged: when the charge opens (deposit acknowledgement) and the fee maths.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — dated row
2026-09-20 recording the ruling, the three stages, the flag, and the two points
still with the owner.
