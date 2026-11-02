# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-04 · fix(day-of): the couple's home screen showed the ceremony eight hours late

Stacked on `claude/schedule-time-roundtrip` — it needs the same helper.

On the wedding morning the couple's own home screen put the 2 PM ceremony at 10 PM and the 5 PM reception at 1 AM, while the **Schedule page one tap away showed both correctly**. Same stored value, two answers.

**Why.** A stored block time is the venue's **wall clock**, not an instant. The Schedule page renders on the server, where TZ is UTC, so `toLocaleTimeString` accidentally printed the wall clock correctly. The day-of cards are **client** components, so the same call rendered in the guest's own timezone — eight hours late in Manila.

`formatWallClock()` reads the components directly and therefore gives the **same answer everywhere**, which is the only property that matters for a value that was never an instant. Applied to `whats-happening-card` and `live-schedule-card`.

Tests run under UTC, Manila, New York and Kiritimati — the fault is invisible under UTC, which is where CI runs. Midnight and noon are pinned explicitly, since 12-hour formatting is where hand-rolled clocks usually break.

Verified: 6,447/6,447 unit tests, `tsc --noEmit` clean. No migration.

⚠ Still unfixed from the same root cause: the *"running N minutes ahead"* badge (`lib/run-of-show.ts` subtracts a wall clock from a real timestamp), the emcee's *"next moment in N min"*, the vendor calendar feed, and the coordinator call-time email. Each shows a wrong time; **none writes**, so none corrupts data. Recorded in `DECISION_LOG.md` 2026-08-03.

SPEC IMPACT: None — restores intended behaviour.
