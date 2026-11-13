## 2026-11-13 · fix(booking): round 5 of the fee walk — the record's source, a refused quote, bookings closed, one date (RW-22 · RW-24 · RW-26 · RW-30)

- **RW-22 (money)** An inquiry stamped its thread (`shop_page`, `website`, …) but wrote the supplier record with
  `source = NULL`, so the supplier's card could not tell a couple Setnayan brought from their own. The record now carries
  the thread's own stamp — on insert, and on an existing row only while its source is empty (a Find save or a
  supplier invite is never overwritten). Money-neutral: the fee reads the thread first. The card's Imported badge now
  reads the same sets the fee does (`SUPPLIER_BROUGHT_SOURCES`, plus an inquiry through the supplier's own link).
- **RW-24** Send quote before saying yes to the inquiry was refused and the notice was drawn only for an OPEN
  conversation — so nothing showed, and the redirect emptied the quote. The notice now shows on the pending inquiry
  ("Say yes to this inquiry first … your quote is kept on this device") and the maker keeps the quote as Send is pressed,
  putting it back after any refused send (forgotten once it went).
- **RW-26** While bookings are closed (`platform_settings.bookings_open`), the couple's "Ask … to confirm your booking"
  in the chat reads "Bookings open soon" before the press, with the shared closed-bookings sentence.
- **RW-30** The supplier Plan page said "12 Dec 2026" (the gift) and "Dec 11, 2026" (the plan's end, in UTC) for the
  same moment. Every date there is now the Manila day, in the gift's phrasing.
- **RW-37 (money)** Minting a bill also writes a `payments` row on purpose — a placeholder (no reference, no
  screenshot) so the bill reaches /admin/payments and the approve → settle bridge has a row to flip. Nine order kinds
  do it (the booking fee, team seats, the add-ons). Read as a payment, it told a supplier who had paid nothing
  "₱1,337.50 · manual · PAID 2026-11-13 · PENDING REVIEW". One rule now (`paymentWasLogged`): a pending row with neither
  a reference nor a screenshot is NOT a payment. The fee page's log says "Nothing logged yet", the order totals no
  longer count it as pending review, and the admin payments card says "Nothing logged yet" in place of a paid date.
  Admin Money already counted only matched money.
- **RW-38** The supplier was told "Pay the booking fee and we'll tell the couple their booking is confirmed". It now
  says the booking stands for the couple whatever happens and the fee is due — and names the gate ("pay it to open this
  event's details and day-of tools") only when the live gate (`resolveFeeEnforcement`) is on.
- **RW-39** A Setnayan-sourced booking's chip read "In-house" beside "fee due". It reads **From Setnayan** now — the same
  sources the fee counts as sourced.
- **Round 6 folded in (same cause as RW-37 — the bill's placeholder payment row):**
  - **RW-46/47** Admin saw two approvable payments per fee order — the empty placeholder ("NO REFERENCE GIVEN") and the
    real one — and the placeholder stayed pending after the real one was approved. Logging a real payment now removes
    that order's placeholder (pending, no reference, no screenshot, never the new row), and the admin queue hides a
    placeholder beside any logged or matched payment for the same order (`hidePlaceholdersBesideLogged`), which also
    covers rows already in production.
  - **RW-45 (money)** The admin booking-fees page summed the fee alone ("₱2,675 owed") while the bill was ₱1,818.90
    (fee + Papic gift). Owed is now the bill's own total, shown as "fee + gift" where a gift rides on it; "has proof" is
    now "any logged row", not whichever row the read returned last.
  - **RW-48** A paid bill kept saying "up for verification, confirmation within 24 hrs" (the minted description). The
    screen drops that clause once the bill is no longer due; the stored text is untouched.
- Guard: `lib/the-walk-round-5.test.ts`.

SPEC IMPACT: None.
