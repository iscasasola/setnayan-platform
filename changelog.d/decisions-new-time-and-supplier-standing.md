## 2026-09-10 · feat(chat): a new meeting time from Decisions, and the supplier gets "where you stand"

Follows #5402. Owner picked these from the follow-up list.

### "New time" on a meeting — the chat card's third answer, now on Decisions

A meeting waiting on you offered Confirm · Decline on Decisions; proposing a
different time meant switching to All. It now offers all three answers the
chat's own card offers: **Confirm · New time · Decline**.

**One form, two doors.** The chat card's inline new-time form was lifted out
verbatim into `app/_components/propose-new-time-form.tsx`, and BOTH the chat
card and Decisions render it. So the date bounds (today → the day before the
event), the time slots and the wall-clock rule (`scheduled_at` is the bare time
picked; `respondAppointment` reads it at the venue) live in one place. The chat
card's own behaviour is unchanged — same fields, same 36px sizing.

After sending, `propose_new` flips the proposer to the reader, so the card
turns to "waiting on them" and its buttons disappear on their own — the
`reply ⇔ needsYou` invariant from #5402 does that with no special case.

### The supplier's thread page gets its standing line

It had none: S6's sentence spoke only in the couple's second person, and
unchanged it would have told a supplier "waiting on you" about a quote they
were waiting on. `buildSupplierStanding` now takes a `viewer` and turns the
subject around INSIDE the one derivation — no supplier copy of the sentence.

Copy the supplier now reads (proposed; owner may want to adjust):

| Situation | Couple reads | Supplier reads |
|---|---|---|
| Quote out, couple silent | Quoted ₱187,500 · **waiting on you** | Quoted ₱187,500 · **waiting on them** |
| Other side wrote last | Replied yesterday | **They replied yesterday** |
| You wrote last, silence | No reply · 12 days | No reply · 12 days |

Nothing on the supplier's line is painted as a need: their decisions arrive as
Decisions entries and are counted there.

### Guards

- `the-standing-turns-around-for-the-supplier.test.ts` — across every rung ×
  speaker × age, the supplier is never told "waiting on you"; and omitting the
  viewer equals `couple` everywhere, so the couple's sentence did not move.
  S6's own suite passes untouched.
- S6's one-derivation allowlist gains the supplier's thread page, with the
  reason; its hand-typed-phrase check now covers that page too.
- The field-parity guard now checks the meeting reply's forms AND the shared
  new-time form against `respondAppointment`'s reads; `scheduled_at` is no
  longer on its optional list. Its slice boundary also stops at non-async
  functions now (the last `case` had been running on into the next component).

Sabotaged: supplier told "waiting on you" · default reader flipped to
supplier · new-time form stops posting the time. Each caught.

### Not built — "Not received" for a payment — needs an owner decision

Measured before building: the deposit ALREADY has a supplier refusal path
(`reject_vendor_deposit` → admin queue → `settle_vendor_deposit_dispute` →
the couple sees the note), on `event_vendors`. And the deposit is ALSO a row in
`event_vendor_payments`, whose "Confirm received" (`confirm_vendor_payment`)
stamps only the ledger row — not `deposit_acknowledged_at`. So one sum of money
can already carry two independent supplier answers. A generic "Not received"
would add a third. Which record it writes to, and whether installments go to
the same admin referee as deposits, is the owner's call.

SPEC IMPACT: None. No schema change; every control reuses a shipped action.
