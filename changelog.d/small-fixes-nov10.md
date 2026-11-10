## 2026-11-10 · fix(supplier): honest schedule + events lines, setup folds key

- Clients › Dates (over the month) and the day sheet: "Schedule not set — open ⚙ › How many a day…" (misread by the
  owner as "how many days") now reads "Set how many events you take a day so couples see if your date is open." with a
  "Set it" link that opens the Clients ⚙ (`?seg=dates&gear=1`) straight at the How many a day fold (new
  `#how-many-a-day` anchor; `SET_HOW_MANY_A_DAY_HREF` in `lib/vendor-dates.ts`). The chat's "Schedule not set" in
  `lib/thread-day-answer.ts` is unchanged. Guarded in `dates-is-one-calendar.test.ts`.
- Shop cover: a refused completed-events read printed "—" in the events slot (read as "Verified — Pro plan"); it now
  says "Couldn't load events", on the cover line and the pinned row — never "—" or 0. Guarded in
  `reads-are-honest.test.ts`.
- `SupplierSetupFolds`: the server-sent `gear` (`<TodaySettings />`) sits in a keyed Fragment, ending the React
  "unique key prop" warning.

SPEC IMPACT: None
