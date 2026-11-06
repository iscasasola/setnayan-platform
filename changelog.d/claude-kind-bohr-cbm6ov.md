## 2026-11-05 · feat(found-you): the record of when a couple first saw a supplier here, checked when that supplier claims

Owner, 5 Nov 2026 (DECISION_LOG "THE 15 'ACT FIRST' ITEMS", item 2): *"we already had this plan which logs users
that has seen or shown in the app as a result. and it saves the date when you first saw that supplier. yes this is
important"*. Builds the 2026-07-27 FOUND-YOU plan (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §10).

- **The record** — `event_vendor_found`, one row per (event × supplier): `first_found_at`, `first_source`,
  `view_count`, `last_viewed_at`, `found_at_claim_at`. Written by a trigger on the profile-view row the app already
  writes, only for a view with an event from a Setnayan surface (Explore, search / Find, favourites …), counted until
  the supplier is on the event. Write cost: one primary-key upsert + one index probe inside the existing insert —
  no extra round trip, no read on any page; lists and scrolling write nothing. Couple-only reads; no session writes
  it. Backfilled from the existing view rows.
- **The check** — `found_you_check_at_claim`, run inside the couple's Approve (`answer_claim_access_request`) in its
  own savepoint, so it can never refuse or undo an Approve. No account before the couple's record → free, always.
  Account the couple opened here before typing the record → found: the receipt is stamped and My Performance counts
  it as Setnayan's (without rewriting `event_vendors.source`).
- **The lead alert** — in-app notice `found_you_lead` to the supplier ("<event> found you on Setnayan", first-seen
  date, how many times). Not on the email list.
- **The couple nudge** — the add walk's name step shows "You found them on Setnayan on <date>…" under a matching
  supplier the couple already opened, and lists those first.
- **Money: unchanged.** `booking_fee_attribution_for` is not touched; it already answers `sourced` for the found
  case (its view arm). The new db test holds the two to the same answer. No flag, no price.
- Tests: `tests/db/found-you-at-claim.db.test.ts` (7 walks, including a supplier with NO account claiming free end to
  end) · `lib/found-you.test.ts`.

## 2026-11-05 · feat(booking-fee): a supplier can dispute a booking fee — the grace-first ladder

Owner, 5 Nov 2026: *"switch on booking fee. and build dispute"*. Builds the DECISION_LOG 2026-07-27 "FOUND-YOU
DISPUTES — grace-first ladder" row.

- **The record** — `booking_fee_disputes`, one per charge. The supplier reads its own; admins read all; no session
  writes it. Two database steps, service role only: `booking_fee_open_dispute` and `booking_fee_decide_dispute`.
- **First dispute per supplier, ever → accepted on the spot.** The unpaid charge becomes `waived_import` ("the
  supplier brought this client" — an existing settled status every fee rule already reads) and its open bill is
  cancelled by the one shared bill writer. The bill page shows the owner's reminder ("This one's on us…"), with the
  found-record's view count when there is one.
- **Second and later → admin review** in a new section of `/admin/disputes`, with the receipts (found-record, a chat
  started from Setnayan, a save from Find). Accept waives the fee; reject keeps the bill. The supplier gets an in-app
  notice (`fee_dispute_answered`); admins get one when a dispute waits (`fee_dispute_opened`). No emails.
- **Only an unpaid fee can be disputed.** No flag and no price is touched. The free-five place is not given back.
- Tests: `tests/db/a-supplier-can-dispute-a-booking-fee.db.test.ts` (6) · `lib/booking-fee-dispute.test.ts` (5).

SPEC IMPACT: None to the rules — both builds implement the DECISION_LOG 2026-07-27 FOUND-YOU rows. Owner rulings
5 Nov 2026 (for a DECISION_LOG row): found = OPENED only, never a list appearance · the supplier's alert fires at the
couple's Approve · the Locked QR found-check waits until after the 7 Nov supplier invite · disputes built now, and the
booking fee switched on (an owner action in Vercel — not done from this session).

- **2026-11-06 · fix(disputes): the three dispute submits are buttons.** "Dispute this fee" (supplier bill) and
  Accept / Reject (Admin › Disputes) drew as bare text — `SubmitButton` carries no look of its own and they were
  given no class. Now `button-secondary` (the bill keeps "Send your payment" as its one primary) and the deposit
  section's own filled / outlined pair. Caught in the 390 px check-card shots.
