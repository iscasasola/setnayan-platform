## 2026-11-04 · feat(hub): Change the schedule — move a part ± minutes or skip it, from the coordinator's floor and a crew Member's phone; the crew row opens what Member / Helper get

Owner 2026-11-04, `SUPPLIER_PLANS_GIFTS_QUOTES_BUILD_NOTES_2026-11-04.md` · Supplier › Hub (*"'Change the schedule' (move a
part ± minutes, later parts follow; skip a part) replaces Hold 10 min; crew row opens what Member / Helper get"*) and Couple
(*"Schedule changes by the coordinator's crew (move / skip) reach the couple's timeline and the guests' Event Hub"*);
supplier prototype v59 (`rosMoveSheet`, `crewSheet`).

- **Supplier (coordinator floor + the emcee's desk):** the `+5m · +10m · +15m · +30m` row in `ScheduleUpdater` is replaced by
  one **Change the schedule** button → a sheet: Part ▾ · Move it Later/Earlier ▾ · By N min ▾ (5–60), one line saying what
  Move will do, **Move** and **Skip this part**, then the shipped Undo toast. A move carries the picked part and every
  later part that has not run (it was the chapter span before); earlier moves are new. Writes through the shipped
  running-late shift (`running_late_shift_schedule`). `floorRetimeFrom` → `floorChangeSchedule` (net-zero server actions).
- **Crew Member's phone (`/join/crew/[token]`):** the same sheet in its ASK mode — **Ask the hosts**, no Skip, no Undo
  (owner 2026-11-05, DECISION_LOG "WHO CHANGES THE SCHEDULE…" (D): crew changes are requests the coordinator / hosts
  approve with one tap). `crew_request_schedule_move` files one shipped request per part (`event_schedule_suggestions`,
  kind 'adjust', the shifted times) and moves nothing; the approvers are told by the shipped `notifyScheduleRequest`.
  Drawn only when `crew_schedule_door(event)` says `ok` — a Member of the coordinator's crew.
- **Emcee lent The Day (C):** the floor action now asks the shipped "Done · next" gate (`mayAdvance`: the couple, a
  delegate with The Day = **Edit** within the access window, the booked coordinator) instead of "coordinator trade
  only", so an emcee lent Edit can change it from the stage desk; View / Off change nothing (RLS).
- **Crew row (Hub › Crew for the day):** the name/line is now a tap → a sheet with what that role gets
  (`crewRoleGets`, from the crew page's own `crewRoleOpens`), the other role in one line, Role ▾, Allow, Remove.
- **Skip** is a new run state `skipped` (not `done`): "Done · next" passes over it, "N left" does not count it, the couple's
  timeline says SKIPPED (never a ✓), the crew/supplier run of show shows it struck, and guests never see it
  (`withoutSkipped` on all three guest reads, after the pinned fence).
- **Change lock:** a skip (or un-skip) of a locked supplier's part is refused by the database with #7253's line
  ("<shop> isn't taking changes. Send them a request instead."). A **move** passes the lock — the owner's running-late
  ruling of 2026-11-03 — and the supplier gets the shift notice.
- **Who is told:** every booked supplier — the shipped `schedule_shifted` notice (skip has its own words); guest accounts —
  ONE in-app notice per change (`tell_guests_the_schedule_changed`, service role only), only when a part guests can see
  changed, opening Details. No email, nothing re-sent. The guest Event Hub moves by its existing stamp + one
  `revalidateTag(liveDayTag)` per change; no new live connection.

Migration `20271308380805_the_crew_changes_the_schedule.sql` (enum value, a run_state-only lock trigger, three functions; no
new table). Tests: `lib/change-the-schedule.test.ts`, `tests/db/the-crew-changes-the-schedule.db.test.ts`; re-pointed
`a-schedule-shift-tells-every-booked-supplier` ⓷ and `a-schedule-write-that-moves-nothing-says-so` to `changeTheSchedule`.

Shared files touched (in-flight PRs may also touch them): `app/dashboard/[eventId]/schedule/_components/day-rail.tsx`
(SKIPPED tag only), `…/day-types.ts` (run_state union), `lib/schedule.ts` (`fetchPublicScheduleBlocks` return line),
`app/_actions/run-of-show.ts`, `app/api/live/run-of-show/[eventId]/route.ts`.

SPEC IMPACT: None — builds the 2026-11-04 build notes and the owner's 2026-11-05 rulings (DECISION_LOG "WHO CHANGES THE
SCHEDULE…" (A)(C)(D)). Still open (no ruling): a skip request — a locked skip says the lock's line and stops, and the
crew phone offers no Skip.
