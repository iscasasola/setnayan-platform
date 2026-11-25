## 2026-11-25 · fix(supplier): LAUNCH L9 · A6-71 — the first registered booked QR wins the date

Owner ruling (25 Nov, LAUNCH-GATE.md L9): two booked (Locked) QR claims for one supplier date — the one registered first wins.

- **One atomic step.** New pipeline migration `first_registered_booked_qr_wins_the_date` replaces `vendor_claim_locked_qr`'s body with one added step (0): before the single-use token flips or anything is written, the claim takes the shop's schedule row `FOR UPDATE` (a second claim on that schedule waits, then counts again) and refuses a full date with `date_full`. It honours the schedule's own number (`schedule_pool_taken_on`, the count the yes and the acquire use) and the code's service card limit per date (`service_card_daily_limit`). An event already holding the shop is not counted against itself. Every other step is the shipped body, unchanged.
- **The booking carries its card.** The claim now writes the code's `vendor_service_id` as `event_vendors.service_id`, so the card's daily count sees QR bookings.
- **The second claimant is told** on the lock page: "Someone booked this supplier for this date just before you, so nothing was booked or charged. Ask the supplier for another date or another option." Nothing is written, and the code stays pending, so the supplier sees it and can move that couple.
- **The "+1 booking per date" add-on**: since 18 Nov a card's limit is its own number per date with no plan ceiling over it, so the add-on has nothing left to raise (`lib/vendor-ultra-addons.ts`). The claim honours the card's own number.
- **Tests:** new `tests/db/the-first-booked-qr-wins-the-date.db.test.ts` (two claims at once → exactly one books; capacity 2 → the third refused; card limit; same couple not counted against itself; META: lock before the flip). `tests/db/locked-qr-claim-reserves-its-date.db.test.ts` case 3 now pins the new rule (a full date refuses and writes nothing); its degrade-open cases moved to their own open days.
- Migration applied by the pipeline only. Not run by hand.

SPEC IMPACT: The booked-QR claim now refuses a full date (owner ruling 25 Nov, LAUNCH-GATE L9). The DECISION_LOG row is the owner's ruling recorded in LAUNCH-GATE.md.
