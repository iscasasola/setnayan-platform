## 2026-11-16 · fix(couple): Event settings and Papic say the day the couple picked, not "Not set"

Found on the phone walk of every couple button (16 Nov 2026, EB-111 · EB-168 · EB-191). The test wedding has one picked option (`date_candidates = {2027-06-19}`) and no locked day (`event_date` NULL). Its header read "Saturday, June 19, 2027 · 214 days to go", while:

- **Event settings** (EB-111) said "Wedding date · Not set", because the "Your event" loader read only `event_date`;
- **Papic** (EB-191) said "Switches on when your date is set";
- **Event details** used a describer that said "1 candidate date" (a count, no day).

Same cause as the supplier card (#7820): the locked day read alone, the open options ignored.

- **One shared phrase:** `openDateWords` in `lib/event-date-options.ts`. Examples: "Jun 19, 2027" · "2 options · Jun 19, 2027 – Jul 3, 2027" · "between … and …" · "· N days". Years are kept.
- **Event settings and Event details:** "Not settled · Jun 19, 2027". The locked day still wins when there is one.
- **Papic:** the capture window really does need a fixed day; it is built from `event_date`, and that rule is unchanged. Its words now say what is missing, in the date sheet's own verb: "Switches on when you pick the day · you're considering Jun 19, 2027".
- **EB-168 left as is:** the date sheet ("Day · not yet · considering 1 date: Jun 19") already said the truth, and "Pick the day" is the step that makes the date exact.

No new server action, no migration. The Papic read is a signed-in read; all five added columns are granted to `authenticated` in prod (checked). The settings read uses the service client.

Guard: `lib/the-couple-reads-their-open-date.test.ts` (4 tests). Three sabotages, each measured 1 → 0 and each red:
1. Event settings' column list without `date_candidates`;
2. the describer back to "1 candidate date";
3. Papic back to "when your date is set".

Follow-up, once #7820 has merged: its `eventDateWords` (lib/agreed-now.ts) should call `openDateWords`, so the phrase lives once.

SPEC IMPACT: None.
