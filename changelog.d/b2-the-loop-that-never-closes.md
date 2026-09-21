## 2026-09-22 · feat(loop): CTRL-B2 — the loop that never closes

### 7 — paying the booking fee holds the date

Owner 2026-09-18: a lock on the supplier's schedule happens *upon the vendor paying their booking
fee.* Until now a supplier could pay us to hold a date and stay bookable — his own calendar and
every couple's availability search both said he was free. `vendor_calendar_blocks` is **0 rows** in
production.

🛑 **The brief's diagnosis was wrong, and the truth is worse.** It blames
`event_vendor_autoblock_on_booking`'s `deposit_paid` condition. That trigger has **three** guards,
and prod's three `deposit_paid` rows all carry `marketplace_vendor_id IS NULL` — manual suppliers
with no shop — so they fail guard **one**, correctly. The two marketplace bookings sit at
`contracted` and fail guard two. **The trigger's happy path has never once run in production.**

🔑 **Additive, not a re-pointing.** `recordDeposit`'s docblock says the HOST advances `deposit_paid`
separately. Re-pointing the trigger would move a status the host owns as a side effect of a payment.
This adds a second, independent reason for a date to be held and leaves the trigger untouched.

⚠ **Both ends, or neither.** A new reason to CLOSE a date is a defect on its own unless the release
side learns it: `vendor_unblock_booked_date` refused to reopen a day another *status-live* booking
held, and now also refuses when another booking holds it by a **settled fee**. Without that,
releasing booking A reopens a date booking B has paid to hold.

⚠ `waived_free5` / `waived_import` count as settled, as they do in `event-access-stage.ts`. Reading
"settled" as `paid` alone would leave every supplier's **first five bookings** unable to hold a date.

Guard `tests/db/the-paid-fee-holds-the-date.db.test.ts` — 6 tests on a replayed schema. Three
sabotages, each hitting only its own test: migration parked → all 6 red; the new release arm removed
→ only the both-ends test; "settled" narrowed to `paid` → only the waived test.

SPEC IMPACT: None — applies the 2026-09-18 ruling; makes no new one.

### 1 — the supplier is told their event is over

`coupleConfirmReceived` requires `service_marked_complete_at`. Measured 2026-09-22: **51 bookings,
that column set on 0, `vendor_reviews` empty.** No couple has ever been able to confirm delivery, so
the review door has never opened, so no shop has a track record. **The retention loop has never
closed once.**

🛑 **RULE 0 caught this build mid-flight, and the correction shrank it.** The first version wrote a
new `vendorMarkServiceComplete`. **It already existed** — in the same file — and was better: it also
sets `completion_status: 'vendor_marked'`, which the new one missed. The duplicate was deleted and
the desk now posts to the shipped action.

🔑 **The measurement that missed it was a `grep … | head`.** The writer was real and simply below the
cut, so a truncated non-zero result read as a complete one. The register's actual claim — *"no
`mark_complete` kind exists on the answers desk"* — was correct. **The starter motor was the card,
not the writer.**

- New `readBookingsAwaitingCompletion` (paged, like its four siblings).
- New `needsCompletionMark` in `answers-desk.ts` — pure, so it is executed rather than grepped. It
  **fails closed**, against that module's usual direction: an over-eager row asks a supplier to
  assert something not yet true, and that assertion unlocks a review.
- The date is parsed at PH midnight. A bare `new Date('YYYY-MM-DD')` is UTC midnight = **8am the same
  day in Manila**, which would ask a supplier eight hours into their own event.
- `createdAt` is the day after the event, not `now` — on an oldest-waiting-first desk, `now` would
  pin every completion row to the bottom forever.

Guard `the-event-is-over-and-somebody-says-so.test.ts` — 8 tests, 8 sabotages confirmed red.
🪤 One of those guards had the very bug it was written to catch: its
`/function MarkCompleteBody\([\s\S]*?\n}/` window stopped at the **destructuring's** closing brace —
60 characters, containing no form — so the assertion could never fail. Now sliced to the next
top-level function, with a length floor so a collapsed window fails loudly.

SPEC IMPACT: None.
