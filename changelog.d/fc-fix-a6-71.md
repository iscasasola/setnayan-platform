## 2026-11-25 · fix(supplier): LAUNCH L9 · A6-71 — the first registered booked QR wins the date

Owner ruling (25 Nov, LAUNCH-GATE.md L9): two booked (Locked) QR claims for one supplier date — the one registered first wins.

- **One atomic step.** New pipeline migration `first_registered_booked_qr_wins_the_date` replaces `vendor_claim_locked_qr`'s body with one added step (0). Before the single-use token flips or anything is written, the claim counts the date and refuses a full one with `date_full`.
  - **Locks, in the house order:** the event's booking row, then the card row, then the shop's count lock (`lock_shop_day_counts`), then the schedule row `FOR UPDATE`. That is the order the yes and the seat step take them, so there is no deadlock. A second claim waits, then counts again.
  - **The schedule's own number:** seats taken (`schedule_pool_taken_on`) **plus** this shop's booked bookings on that date that hold no seat. A booking whose seat step degraded open (a blocked, held or approve-first day) still took the date.
  - **The card's own number per date** (`service_card_daily_limit`).
  - **The seat's and the yes's exemptions apply:** Always available cards are never counted; by-the-piece cards are judged by the card only; slotted cards that are not by the piece skip the card check.
  - An event that already holds the shop is not counted against itself. Every other step is the shipped body, unchanged.
- **Only the couple may claim.** The ownership check is now `current_couple_event_ids`. Before, `current_event_ids` let a guest member claim a code onto the host's event, rewrite its date and book the supplier.
- **The booking carries its card.** The claim now writes the code's `vendor_service_id` as `event_vendors.service_id`, so the card's daily count sees QR bookings.
- **The second claimant is told** on the lock page: "Someone booked this supplier for this date just before you. Nothing was booked. Ask the supplier for another date, or see their other options." A button opens the supplier's shop page. Nothing is written, and the code stays pending, so the supplier sees it and can move that couple.
- **The "+1 booking per date" add-on** is not changed. It currently raises nothing, because `service_card_daily_limit` is the card's own number; that question is the owner's.
- **Tests:**
  - New `tests/db/the-first-booked-qr-wins-the-date.db.test.ts`:
    - two claims at once → exactly one books;
    - capacity 2 → the third is refused;
    - the card limit holds;
    - the same couple is not counted against itself;
    - a blocked day: the first books with no seat, the second is refused (red without the no-seat count);
    - a guest member → `not_your_event`, nothing written;
    - Always available → both book;
    - META: the shop lock comes before the schedule lock, and both before the flip; the couple check is used.
  - `tests/db/locked-qr-claim-reserves-its-date.db.test.ts` case 3 now pins the new rule (a full date refuses and writes nothing); its degrade-open cases moved to their own open days.
- Migration applied by the pipeline only. Not run by hand.

SPEC IMPACT: The booked-QR claim now refuses a full date, and only a couple of the event may claim (owner ruling 25 Nov, LAUNCH-GATE L9; controller review 25 Nov). The DECISION_LOG row is the owner's ruling recorded in LAUNCH-GATE.md.
