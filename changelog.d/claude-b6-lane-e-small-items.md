## 2026-11-11 · feat(supplier-today): setup step 7 — How many a day, on Today (Build 6 Lane E)

- Today's new-shop setup gains **step 7** under the six (never counted in "N of 6 done", per prototype v119
  `todayNew`): **"How many events can you take on one day?"** — venues: **"How many halls?"** — with a stepper from 1
  and the line "Count your teams. 2 crews = 2." (venues: "Count your halls. 2 halls = 2."). It is the SAME number as
  Clients ⚙ › How many a day: the shipped `FormCounter` in a `StayForm` on the `supCalendar.updatePoolCapacity` door,
  writing `vendor_schedule_pools.daily_booking_capacity`, saved in place a pause after the last tap. One stepper per
  schedule when a shop has several.
- No schedule yet → the Clients wording from #7423, "Set how many events you take a day so couples see if your date is
  open.", with a **[Set it]** button to the ⚙'s How many a day. A venue whose schedules are all halls → "N halls ·
  names" and a **Your halls** button (a stepper there would invent unnamed halls). A refused read → "Couldn't load your
  schedule", no stepper.
- `lib/vendor-schedule.ts`: new `fetchVendorPoolsOrNull` (null on a refused pools or category read);
  `fetchVendorPools` keeps returning `[]` through it. Today reads it only while the shop is setting up.
- `updatePoolCapacity` (via `revalidateScheduleSurfaces`) now also revalidates `/vendor-dashboard`, so Today redraws
  with the saved number.
- Dev lab: `/dev/supplier-lab?easy=setup&daily=one|two|unset|unread|halls|off`.
- The plan's other two items (the shop hero's "—" → "Couldn't load events", and the `SupplierSetupFolds` key warning)
  had already shipped in #7423; nothing redone. Guard: `app/vendor-dashboard/_components/setup-step-7-is-how-many-a-day.test.ts`.

SPEC IMPACT: None
