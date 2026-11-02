## 2026-09-20 · feat(booking-fee): a waived booking fee sends the supplier a receipt

Owner, 2026-09-20, asked whether a free-5 booking should be emailed: **"yes, add the email
receipt for waived bookings."**

**What was silent.** A booking inside a verified shop's first `FREE_BOOKING_LIMIT` Setnayan
bookings opens a `booking_fee_charges` row with `status = 'waived_free5'` and then
`collectBookingFeeAtLock` returns `'free'` — **before** the `orders` insert. So the waived
path minted no order, no `payments` row, no /admin/payments entry, no notification and no
email. PR #5737 gave the waived charge three in-app surfaces; every one of them reaches only
a shop already sitting at a console.

**Why a new notification type, and not the one already wired.** `order_quoted` is the
transactional "you have an order to pay" type and is on `EMAIL_ENABLED_TYPES` — aiming it at
a waived charge would have **emailed a supplier a fee they do not owe**. A wrong sentence
delivered reliably is worse than the silence it replaces, which is exactly why #5737 shipped
the surfaces and stopped short of the notice. `booking_fee_waived` is its own enum label
(`20271235690341_notification_type_booking_fee_waived.sql`), its own union member, its own
tray label + badge, and its own `EMAIL_ENABLED_TYPES` entry. 🔑 **The notification and the
allowlist are two halves of one mechanism; having one is indistinguishable from having
neither** — and here there is a third half, the Postgres ENUM, because a TS-only member
typechecks and the INSERT is then refused in silence.

**One resolver for both channels.** `waivedFeeReceiptCopy` *composes* `waivedFeeCopy` — the
same function the fee hub's "Waived — your first 5" row renders — so the email subject IS the
in-app headline and the body opens with the in-app detail. They cannot drift.
`freeBookingsLeftClause` is now shared by the forecast (before the booking) and the receipt
(after it), so the count promised at the Agree button is the count the receipt confirms; it
used to be typed out twice.

- Subject: `Booking fee ₱508.50 — waived for Rosa & Ben`
- Body: `This was booking 1 of your first 5 on Setnayan, which are free — 4 more free
  bookings after this one. You were not billed the ₱508.50, and nothing is owed on it. This
  is your receipt — there is nothing to pay. Your Booking fees page lists every Setnayan
  booking fee you have had, waived and billed.`

**It is a receipt, not a bill.** No "pay", no "due", no payment rail. The only mention of
owing is the sentence saying nothing is — and the guard scans every produced string for the
bill vocabulary rather than forbidding one phrasing.

**Numbers come off the record, or not at all.** `computed_fee_centavos` (prod's waived charge
carries 50850) and `booking_fee_ledger.booking_ordinal` are read through
`fetchWaivedFeeCharge`, which shares its select, its `!inner` ledger join and its row mapper
with the hub's list read. An unreadable amount prints **no number** — never ₱0, which would
tell a shop their booking was worthless. An unreadable charge sends nothing at all.

**Idempotent on `related_url`, the house pattern.** `vendorWaivedFeePath(chargeId)` is
`/vendor-dashboard/booking-fees?waived=<chargeId>` — a waived charge has no pay page because
it has no order, and a `#fragment` to an id the page does not render fails silently. An
existence check on that URL runs before every emit, and **a refused existence check sends
nothing**: read as "none yet" it would mail a second receipt every time the read failed.

**Both ends.** The COUPLE is told nothing. The booking fee is between Setnayan and the shop;
a couple-facing sibling would price the supplier's relationship in front of the person paying
for it. The guard asserts the emitter never reaches for the couple.

**Guards** — `apps/web/lib/the-waived-fee-sends-a-receipt.test.ts`, nine sabotages proven
RED: drop the allowlist entry · delete the emit from the waived arm · move it onto the
billable arm · degrade an unreadable amount to ₱0 · drop the existence check · read a refused
existence check as "none yet" · delete the `ADD VALUE` line · drop the amount from the
headline · re-type the remaining-count clause instead of sharing it.

🪤 **Two traps this PR paid for, both recorded in the test file.** (1) The
refused-existence-check assertion was first written as `/alreadyError[\s\S]{0,300}return;/`
and **passed its own sabotage** — deleting the `return` left the next statement's
`if (already) return;` inside the window. The window now ends at the block's own brace.
(2) `the-fee-finds-the-supplier.test.ts` counted `emitNotification` **across the file** and
expected 1; two deliberately different notices now live there, so the count is scoped to
`collectBookingFeeAtLock` and paired with an assertion that the billable arm carries **zero**
`booking_fee_waived`. A file-level count of 2 would have been satisfied by two bills.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — one row, 2026-09-20,
recording the owner's "yes, add the email receipt for waived bookings" and the ruling that it
is a receipt on its own notification type, never `order_quoted`.
