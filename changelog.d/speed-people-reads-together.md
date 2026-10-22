## 2026-10-23 · perf(people): the People roster's three branches start together; the spouse rule rides the roster's wait

Owner priority (23 Oct): *"consistency and reliability that we run smoothly … And fast."* Measured with
`app/dashboard/(account)/people/people-page-reads.harness.ts` — the REAL `getPeopleRoster` and `PeoplePage` against a
database that counts how deep each request ran (the `guests-page-reads.harness.ts` method), on a fixture with every
branch (a partner, a request sent from an event, a friend, a samahan, a loved one):

- **Roster depth 9 → 4** (simulated at 150 ms a trip: **1,375 → 661 ms**); **People page 12 → 5** (**1,838 → 806 ms**).
- `lib/people-roster.ts` `getPeopleRoster`: connections, samahan and loved ones need only the signed-in id, so they
  start together; inside connections, names · which event asked · their accounts start together; every partner's
  "do we share an event?" is asked at once (it was an `await` inside a `for` loop).
- `app/dashboard/(account)/people/page.tsx`: the follow list and the spouse rule (`getSpouseContext`, three reads) are
  asked in the roster's own wait instead of after it.
- Same reads, same scopes, same refusal handling, same rows in the same order (connections, then loved ones) —
  the harness compares the roster it hands the screen. No markup changed.
- Guard: `lib/the-people-roster-reads-together.test.ts` (roster ≤ 4 deep, page ≤ 5, identical rows). Sabotage: the
  old files restored → 2 of 5 red; restored → green.

SPEC IMPACT: None.
