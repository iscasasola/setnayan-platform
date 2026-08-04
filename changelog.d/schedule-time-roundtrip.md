# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-04 · fix(schedule): saving a block without editing it moved the wedding eight hours

**The only defect found this week that DESTROYS DATA.** A couple opens their ceremony to change the end time. The line reads *2:00 PM*; the edit box reads *22:00*. They fix a typo, press Save, and the ceremony moves to 10 PM — on their own schedule and on their guests' invitation page. Save again another day and it moves again.

**Why it happened.** `event_schedule_blocks.start_at` holds the **venue's wall clock written into a UTC column** — a 2 PM ceremony is stored as `14:00Z`. Live prod proves the intent: `Ceremony 14:00+00`, `Hair & make-up 08:00+00`, `Last Song & Send-off 21:45+00`. As wall clocks those are right; as instants they describe a 10 PM ceremony and a 5:45 AM send-off.

The **write** ran on the server (TZ=UTC) and stored the typed clock verbatim — correct. The **prefill** ran in the browser using local getters, so in Manila `14:00Z` came back as `22:00`. Both halves were internally consistent; only together were they wrong, and **nothing failed** — not typecheck, not lint, not 6,000 tests.

**Worse than a display bug: unrepairable.** A 10 PM ceremony is odd but not impossible, so afterwards no tool — and no couple — can tell a shifted row from a deliberate one.

**The fix.** Both directions now live in one module, `lib/schedule-datetime-local.ts`, and neither touches `new Date()` — the runtime-timezone dependence *was* the bug. The property is a round trip: `toDatetimeLocalValue(fromDatetimeLocalValue(x)) === x`.

**The tests run under four timezones** — UTC, Manila, New York, Kiritimati — because the defect is **invisible under UTC, which is exactly where CI runs**. A UTC-only test would have passed on the broken code, which is precisely why this survived. **Mutation-verified**: reintroducing the original local-getter prefill fails 2 of the 5 tests.

Verified: 6,445/6,445 unit tests, `tsc --noEmit` clean, `next lint` clean. No migration.

⚠ **Ten related time faults share this root cause and are NOT fixed here** — the "running 480 minutes ahead" badge, the vendor calendar feed, the call-time email, the day-of cards. Each reads a wall clock as an instant. Recorded in `DECISION_LOG.md` 2026-08-03; this PR closes only the one that writes.

✅ Prod is still pre-launch-empty (5 owner-side events), so no real schedule has been damaged.

SPEC IMPACT: None — restores intended behaviour.
