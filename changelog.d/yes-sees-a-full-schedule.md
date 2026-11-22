## 2026-11-23 · fix(schedules): the supplier's yes sees a full team schedule

The follow-up to the supplier-ready walk (#8176; controller GO for a separate migration PR). A supplier could say yes on a day their TEAM schedule (a non-hall schedule pool, for example "Crew A · 2 a day") was already full. Only the couple's deposit (`acquire_schedule_pools`) counted the schedule, so the couple was refused at payment for a booking the supplier had already agreed to.

- **Migration `20271359089802_the_yes_sees_a_full_schedule.sql`:** a new read-only `vendor_card_schedules_on(event_vendor_id, pool_ids)`. It names the booking's team schedules that are full that day, by the deposit gate's own count (`schedule_pool_taken_on` + 1 > `daily_booking_capacity`).
  - Owner-only; anon has no EXECUTE.
  - Never reads another shop's pool.
  - Leaves halls to `vendor_card_halls_on`.
  - Leaves pieces and Always-available cards alone.
  - Leaves a booked row or a month-only event alone.
  - No table, no column.
- **The yes (`vendorAgreeToLock`)** asks it (`fullSchedulesOfAsk`, `lib/schedule-pools.ts`) before `vendor_agree_to_lock`, after the hall check. Nothing is booked and no fee is minted. The supplier reads "Crew A is already full that day…" with the door to Dates (`lock_agree=schedule_full`; the names ride the existing `?taken=`). It fails open on a read error, logged, like the hall and closed-day checks. The deposit gate still refuses after.
- **One pool list:** `poolIdsOfBooking` is now the one list for both the deposit (`acquireSchedulePoolsForBooking`) and the yes.
- Guards:
  - `tests/db/the-yes-sees-a-full-schedule.db.test.ts`: every "full" is also asked of the deposit gate as the same supplier, and they agree. 4 SQL sabotages, each red.
  - `lib/the-yes-sees-a-full-schedule.test.ts`: 3 sabotages, each red.
- Server actions: no new export.

SPEC IMPACT: None. It enforces the schedule's existing "how many a day" at the yes, with the deposit's own count.
