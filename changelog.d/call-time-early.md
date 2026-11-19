## 2026-11-16 · feat(schedule): Crew call and On site from, as drawn; the call-time pin opens its control; hosts told in the app (owner ruling A + SCHEDULE MODEL)

**Owner ruling A (2026-11-16):** a supplier can set their call time right away. Cut 5 (merged 2026-11-14) already gave
the supplier's Schedule tab its Your times control when the hosts have no chapters.

- **The chat pin opens the control.** The supplier chat's amber "DUE NOW · Set your call time" pin had no body, so its
  "Answer ›" did nothing. It now opens "Set your call time", which goes to
  `/vendor-dashboard/clients/<event>?tab=schedule#own-times` (the control itself). The blocker button goes there too.
  Saving the times revalidates the chat, so the pin clears on the next read (`callTimeIsSet`, unchanged).
- **SCHEDULE MODEL (DECISION_LOG 16 Nov), rule 1**, worded as the approved drawing
  (`prototypes/event_pages_today_doors_2026-11-16/event_pages_today_doors_2026-11-16_fable.html`, "two times, two names").
  The couple's Booked row now reads "Crew call 11:00 AM" (the supplier's own `call_clock`) above "On site from 1:00 PM ·
  arrives 12:00 PM · done 10:00 PM". "On site from" is the earliest moment the couple tagged them on; arrives and done
  are the supplier's own clocks. A supplier with no times of their own reads "No times yet" above "On site from 2:30 PM,
  from the moments you tagged them on". The old single "Call time … / No call time yet" is gone. The words come from
  one pure rule, `bookedTimesLines` (`lib/supplier-own-times.ts`), rendered by `<TimesLines>` in `booked-row.tsx`.
  `readCrewCalls` reads call, arrive and done.
- **Rule 3:** the hosts get an IN-APP notice when a supplier sets, changes or clears their times, or presses Confirm my
  times. Recipients are the couple and The Day = Edit delegates, via `notifySupplierTimes` → `schedule_suggestion`, which
  is on no email list. Bodies are as drawn: "Crew call 11:00 AM · arrives 12:00 PM · done 10:00 PM" and "Arrives 4:00 PM ·
  done 10:30 PM". Some saves send nothing:
  - the before-read was refused (never announced as "set");
  - the times are the same as before;
  - Confirm is pressed again with nothing changed since the last Confirm.
- Clearing every time is now saved and told. `ownTimesFromForm` accepts all-blank, and the form sends the clear.
- **Today's Schedule card** carries "Lumière Studio set their times", their times and "See ›". The data is the newest
  `supplier_own_times` row with a time, from a shop on the event's list (`latestTimesSet`, read in `readHomeSchedule`'s
  one round; a refused read says "Schedule couldn't load").
- No migration. Arrive/done as real fields with a day are NOT in this PR (a schema change being drawn first).
- Guards: `apps/web/lib/the-call-time-is-set-early.test.ts` (5 tests). Other guards changed:
  - the `schedule_suggestion` site register (`couple-supplier-notices-reach-email.test.ts`) counts 7 (the new in-app-only notice);
  - the pinned `bookedView` shape (`your-team-phone-first.test.ts`) admits `crewCalls`;
  - the fold-order anchor (`booked-is-the-team.test.ts`) is now `<TimesLines`.
- The port baseline was regenerated (`<CallTimeLine>` → `<TimesLines>`, deliberate).

SPEC IMPACT: None from this PR (the SCHEDULE MODEL ruling was logged in DECISION_LOG 16 Nov by the controller).
