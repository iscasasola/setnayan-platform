## 2026-11-13 · fix(booking-fee): the top-up email sweep fails closed, and words-only reaches new inquiries only

- **Rule 5 fails closed.** `maybeSweepVendorBookingFeeNotifications` used to email every due fee order NOT in a read-back set of top-ups — so a refused read (an empty set) emailed every due order, top-ups included. It now emails only orders whose charge was READ as an ordinary fee (`feeOrdersToEmail`, an allow-list). A failed read returns null and skips the run (logged); an empty read emails nobody.
- **Words only on a new inquiry, never a booked client** (prototype `booking-fee-hold.html`: "booked clients are unaffected"). `readOverdueTopUpForEvent` narrowed the BOOKED event that owed the top-up. It is now `readWordsOnlyTopUp`: the shop's overdue top-ups from ANY event narrow the message box only on a thread where the shop is NOT booked (`event_vendors.status` in `CONFIRMED_VENDOR_STATUSES`). A failed booked or top-up read narrows nothing. Decision in the pure `wordsOnlyTopUpPhp`.
- Tests: `lib/booking-fee-top-up.test.ts` — an empty read and a failed read each email nobody; a top-up or unread order is never emailed; an unbooked inquiry is narrowed, a booked client and a failed read are not.

SPEC IMPACT: None — brings the PR in line with DECISION_LOG 2026-11-12 "BOOKING-FEE TOP-UP — SIX RULES" and its prototype as written.
