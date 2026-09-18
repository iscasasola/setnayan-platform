## 2026-09-18 · fix(answers-desk): song_request leaves ANSWERS_THAT_DO_NOT_JOIN

`lib/answers-desk.ts`'s withheld list still carried `song_request` with the
reason "zero application callers" after #5601 shipped the guest-facing song
request card and API route (both call `guest_submit_song_request`). That made
`lib/answers-desk.test.ts`'s staleness guard (from #5603) fail on `main` for
every open PR — the branch-protection required check `typecheck + lint` runs
the full unit suite.

- Removed the `song_request` entry from `ANSWERS_THAT_DO_NOT_JOIN`. It was
  never rendered on the Answers Desk (no `kind: 'song_request'` card exists in
  `vendor-overview.ts`) — its real answer surface is the band's own song-desk
  inbox on `on-the-day/live/[eventId]`, unrelated to this desk.
- Replaced the guard's stale "still withheld" test with one that fails if
  `song_request` reappears in the list, so the regression stays caught.
- Updated the stale prose comment in `vendor-overview.ts` that still described
  four withheld answer kinds including the guest's song request.
- Register: `build-sessions/REGISTER-SWEEP-2026-09-18.md` SUP-52 moved from
  PARKED to DONE, citing #5601. (`HANDOFF-2026-09-18/REFERENCE/ONE_REGISTER.md`
  updated too, out of tree — that folder is gitignored, not tracked.)

SPEC IMPACT: None.
