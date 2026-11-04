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

SPEC IMPACT: None to the rules — this implements DECISION_LOG 2026-07-27 §10 as written. Two readings are left to the
owner (PR "Where I stopped"): impressions are not recorded (07-27 said never), and the lead alert fires at the
claim Approve, not at the add-time name match.
