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
