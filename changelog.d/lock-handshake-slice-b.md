## 2026-08-16 · feat(booking): the couple can take the ask back, and four more ways to book stop booking (PR-H slice B, flag-dark)

Slice A made a couple's **Lock** an ASK on ONE path and left the rest of the
product speaking as though the booking had happened. This finishes it: the
couple's screens say what is true, either side can back out cleanly before it is
answered, a supplier who has only been asked cannot read the venue address, and
the four other ways a booking gets created stop creating one outright.

🔴 **THE COUPLE COULD NOT TAKE THE ASK BACK.** `cancel_vendor_lock_request`
shipped in `20271107090000`, was re-emitted by `20271143289546`, holds an EXECUTE
grant to `authenticated`, and had **ZERO CALLERS ANYWHERE** — measured at
`origin/main` twice, a day apart. So a couple who asked the wrong supplier had no
way out: the request held that supplier's hard-single slot and both pending
indexes until either the supplier answered a question the couple no longer wanted
answered, or the 7-day fuse blew. **A FORWARD PRIMITIVE WITH NO INVERSE** — the
same shape that once left a vendor reading BUSY to everyone forever, and the
smallest, highest-value thing in this change.
🛡 `lib/rpcs-have-callers.test.ts` now asks the only question that finds this
class: *does any application code call it?* A granted RPC nothing calls is a gate
with no handle wearing a different costume — it typechecks, it has RLS, it has a
thoughtful comment, its db tests pass because a db test calls it directly, and
there is simply no button.

🔒 **THE ASK STAGE IS A PRIVACY BOUNDARY, NOT A LAYOUT JOB.**
`get_vendor_event_brief` had two rungs — BOOKED and INQUIRY — so an asked
supplier with no chat thread hit `RAISE EXCEPTION 'not_booked'` and could not open
the event at all: asked to hold a date with nothing in front of them but a name.
**The obvious repair is the wrong one.** Adding `'pending'` to the BOOKED
predicate is a two-word edit that hands over the venue NAME, the venue ADDRESS
and the whole RUN-OF-SHOW to a supplier who has agreed to nothing and may decline
tomorrow.
✅ Instead `'requested'` gets **no payload of its own**: it shares the ONE
pre-agreement build object `'inquiry'` already returns and that was reviewed as a
disclosure ladder. There is no second place for a field to be added to, so the
ceiling is structural rather than a promise. The only added key is
`lock_request`, every field of which is a fact about the supplier's OWN ROW.
🔑 **A TEST THAT ONLY CHECKS THE HAPPY STAGE PASSES WHILE LEAKING**, so every
assertion in the new db suite is a NEGATIVE — and the event it runs against is
seeded WITH a venue address and a run-of-show, because a ceiling test on an empty
event would pass against a completely open function.

🚨 **FIVE WAYS A BOOKING IS CREATED, NOT TWO — AND THE LIST CAME FROM A COLUMN,
NOT FROM MEMORY.** Enumerating every writer of `status='contracted'` found the
package cascade and the chat lock (both named in the brief) **plus two nobody had
listed**: the onboarding wizard's *Lock this vendor* and its booth lock. All four
now ask. The booth one proves the method — its marketplace link is OPTIONAL, so
the same call must ask for a real supplier and book outright for an off-platform
booth somebody typed; gating all of it throws a CHECK violation at the host,
gating none of it books a supplier who was never asked.
**A PACKAGE IS ONE ANSWER SPREAD OVER N ROWS**, so `vendor_agree_to_lock` now
promotes the anchor's covered lines and the booking row with it — otherwise the
supplier's yes confirms one line and leaves the rest of the package they just
accepted at `considering`, a state with no copy, no price and no way out. Same
MONOTONE `CASE`, so an already-paid line is never walked backwards.

📅 **THE DATE NARROWS AT THE AGREEMENT, NOT AT THE ASK** (owner §6.1). Slice A
skipped the narrowing on an ask and named this as its follow-up: run at the
press, it would pin the couple's FINAL wedding date off a supplier who had agreed
to nothing, and the date would survive the decline because the write is
`.is('event_date', null)`-guarded and nothing clears it. It now runs when the
supplier says yes — and the one message the couple is guaranteed to receive about
that agreement is the message that tells them their date was set.

🪤 **AND ONE OF MY OWN NEW TESTS WAS DECORATION — THE MUTATION RUN IS WHAT SAID
SO.** The coverage-strip clock test used `'photographer'`, which is a vendor
CATEGORY and not a catalogue TILE, so `planGroupsForTile` returned `[]` and the
assertion only ever exercised the no-groups early return; sabotaging the real
branch left it green. Repaired to a tile that genuinely resolves
(`'photo_video'` → `photography`), with the resolution itself asserted so the
fixture cannot go vacuous again. **A test that names the right behaviour can
still be measuring the wrong branch.**

🖥 **FIVE COUPLE SURFACES, NOT THE FOUR THE BRIEF NAMED** — counted by grepping
the derivations rather than trusting the list: the bench card, the coverage
strip, "Your team", the workspace, and `vendors-plan-budget`'s own planning
clock. `ChildState` and `TimelineStatus` each gain `'awaiting'`, which is
deliberately **neither `'considering'` nor `'finalized'`** and both misreadings
cost the couple something: filed as considering, the clock keeps counting down
and "What to lock next" tells them to lock a supplier they already asked — twice,
since the one-pending-request-per-group index rejects the second press; filed as
finalized, a decline six days later lands on a category they were told was done.
Adding the value to two exhaustive `Record<TimelineStatus, number>` maps is what
made the compiler find every consumer.

🔧 Also: `revertVendorToConsidering` now writes `lock_request_state='cancelled'`
when it unwinds an agreed booking — `lock-request-state.ts` had **asserted this
write existed** and it did not; the claim is made true rather than deleted. It is
scoped to rows that actually carry a marker, because stamping "you withdrew this"
on a legacy or printed-QR booking nobody ever requested is its own defect.
And the client card's `isInquiry` became `preAgreement` (= `!isBooked`): keyed on
one stage it was correct with two rungs and would have dropped an asked supplier
straight into the BOOKED render the moment a third arrived.

🛡 **THIRTEEN MUTATIONS, ALL MEASURED BY OCCURRENCE COUNT BEFORE → AFTER —
TWELVE CAUGHT ON THE FIRST RUN, AND THE THIRTEENTH CAUGHT A DEFECT IN MY OWN
TEST (above) rather than in the code.** Both harnesses refuse to run against a red baseline. The four SQL
sabotages include the exact "obvious repair" the migration header warns against;
the five app-side ones include deleting the withdraw call site, which correctly
recreates the zero-callers defect and reddens the new guard.

**FLAG-DARK.** `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` is off by default and every
new surface asks it. Flag-off is byte-identical to today, asserted rather than
assumed: the chat-lock core, the bench resolver, the planning clock and the
shortlist builder all take the flag as a PARAMETER so one test process drives
both worlds. The two new gates and four new pure cores are registered in
`flag-chokepoint-scan.test.ts`.

**Migrations:** `20271143774146_notification_type_lock_withdrawn.sql` (its own
file — Postgres forbids using a new enum value in the transaction that adds it) ·
`20271144258091_lock_handshake_slice_b.sql` (both functions re-emitted by
EXTRACTION from the shipped bodies, never retyped; the diff against each is only
the intended edits).

SPEC IMPACT: `DECISION_LOG.md` row 2026-08-16 · `CLAUDE.md` ACTIVE block.
