## 2026-08-15 · feat(booking): the supplier's yes is what makes the booking (PR-H slice A, flag-dark)

A couple pressing **Lock** booked the supplier outright, while the words around
the button promised the supplier agrees first. The owner ruled 2026-07-27 that a
lock is a REQUEST. This wires the step that has never existed.

🔑 **HALF OF IT WAS ALREADY IN PRODUCTION WITH ZERO CALLERS.** Migration
`20271107090000_vendor_agrees_to_lock.sql` shipped nine `lock_*` columns, a
five-value `lock_request_state` machine, a forgery trigger covering INSERT *and*
UPDATE, two indexes and three SECDEF RPCs — and nothing anywhere called them
(`lock_request_state` NULL on all 45 prod rows). **The sixth gate with no
handle.** This is a WIRING change, not an authoring one.

**THE ARCHITECTURE CALL.** None of the three shipped RPCs read or wrote
`event_vendors.status`, deliberately — leaving a fork with no middle: either the
couple's Lock keeps booking outright (the bug) or a booking never becomes real
and all 20 `CONFIRMED_VENDOR_STATUSES` consumers answer "not booked" forever.
`vendor_agree_to_lock` now writes `state='agreed'` and `status='contracted'` in
ONE statement, so they can never disagree. Precedented by `vendor_claim_locked_qr`,
and atomic against the confirmed hard-single index.

**THE FLIP IS MONOTONE.** The printed Locked-QR path promotes a row to
`deposit_paid` without touching any `lock_*` column, so `(confirmed, pending)` is
reachable; an unconditional write would roll a PAID booking back to `contracted`
and fire the release trigger, handing the supplier's held date to everyone else.
The couple's own lock write already carries this guard — dropping it here would
have been a regression against shipped code.

**OWNER DECISION 3 (2026-06-02), which the re-plan had missed** — the owner
caught it in one sentence: *"we already had the correct handshake for this."* A
supplier may not take one couple while another is still waiting on the same
date; they must decline the others first, so **no customer loses a lock
silently**. Capacity is the owner's own documented default of 1
(`daily_booking_capacity` was never built; `max_soft_holds_per_date` has zero
writers, so no number is invented).
🔑 There are TWO competitions and conflating them is how this was missed:
couple-side (one couple, several venues — the hard-single group) and
**vendor-side** (one supplier, several couples). Only the first was modelled.

**Also in this slice:** an expiry that can actually fire (the shipped one was
lazy, and both lazy paths need the supplier to act — the exact thing expiry
exists for); a day-5 nudge whose stamp **resets on re-ask**, or every later round
is silently un-nudgeable; the agree gate re-anchored off `event_vendors.service_id`,
a column the COUPLE can write; and the shipped COMMENTs this migration falsifies,
corrected with a post-condition that fails if they return.

**Flag-off is byte-identical**, and the off-platform branch is not defensive
polish — **44 of 45 production bookings have no marketplace supplier behind
them**, and the DB CHECK rejects a pending request on one, so without the branch
the ordinary case throws a raw Postgres string at the couple.

⚠ **THE NEW TRIGGER ARM IS A COHERENCE RULE, NOT A FORGERY GUARD, AND IS LABELLED
THAT WAY.** The shipped machine lets a couple write `'cancelled'`, so
cancel-then-book walks past it. That bypass is **asserted in a test** rather than
hidden. Forgery on `status` closes when the flag-off path is retired.

**Verification.** 11 mutations, each measured by occurrence count before → after;
all 11 turn a suite red. Two caught defects in my own work: removing the nudge
status floor left 20/20 green because the expiry clause was masking it (fixed
with two rows so exactly one mechanism can exclude each), and the source-ordering
guard matched file-level — taking a TYPE declaration and an IMPORT as call sites
— and reported a defect that did not exist until it was scoped to
`finalizeVendor`'s body. 8350 unit tests · 20 new db tests · tsc clean · 24 lint
scripts · exposure baseline regenerated (exactly one added column, no new
function reach).

SPEC IMPACT: `DECISION_LOG.md` rows already landed 2026-08-15 — the schema that
actually shipped, the false retraction of Defect #1, and the 2026-06-02 handshake
becoming the design of record with the 7-day window settled.
