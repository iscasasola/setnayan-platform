## 2026-11-25 · fix(import, date, people, staging seed): the plan's remaining area-2 rows, part 1 (batch 8)

- Guest import: closed until December 19 shows the notice alone, never steps that lead nowhere (A2-P5).
- Pick your date: once a supplier is confirmed, every path shows the set date and why ("Contact support to change
  it"), never "Let's start with your date"; a refused supplier read is said (A2-P9).
- Staging seed: the event's creator is linked to the couple row with their own name, so Bea's account no longer draws
  her name on Paolo's row (A2-P6; the copy shows it after a re-seed).
- People › Groups: the view never lands on nothing; missing rows are said (A2-P4).
- Home: the card's count and the list are one reader's; two loads of the same facts draw the same Home, and a failed
  read says so (A2-P10 — held by a test; the walk's difference was the copy's data, not the code).
- Offline: Home and the desk are kept from three days before the day; the walk's event was ~90 days out, so nothing
  was kept, by design (A2-P22 — held by a test).

Guards: `guests/import/a-closed-import-shows-no-steps.test.ts` · `date-selection/a-locked-date-does-not-start-over.test.ts`
· `tests/db/the-staging-seed-runs-clean.db.test.ts` (new test) · `(account)/people/the-groups-door-lands-on-groups.test.ts` · `home-two-loads-agree.test.ts` · `lib/the-desk-reopens-offline.test.ts`.

SPEC IMPACT: None (honest states; the date rule Event settings already states).
