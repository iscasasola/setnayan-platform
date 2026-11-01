## 2026-11-01 · fix(schedule): a Time-TBA chapter is never 12:00 AM in any reader

Follow-up to #7151 (`event_schedule_blocks.time_tba`, migration `20271300482585`). A TBA chapter keeps its day in
`start_at` at 00:00; readers that did not know the flag would draw it at 12:00 AM.

- **Supplier calendar file (.ics):** a TBA chapter is an all-day item, "Reception · Time TBA" (the house all-day pattern
  the shop-wide bookings file already uses). The VEVENT builder moved to `lib/supplier-timeline-ics.ts`.
- **Home now/next:** a TBA chapter is never "now" or "next" (Happening now card, day-of banner); Up next lists it after
  the timed ones as "Time TBA"; the Schedule preview tile never ranks it by time and labels it "Time TBA".
- **Call times:** `earliestTaggedBlock` (the one call-time rule) skips TBA chapters — the Booked Team row and the
  call-time emails. Plan §3: "Chapter time TBA = no call time".
- **Other readers found by the sweep:** the Schedule PDF and the Maker's Details › Schedule pieces print "Time TBA";
  supplier Today, the night-before email, the supplier's client timeline, the run-of-show desk, the crew pass, both emcee
  scripts, couple "What's next" and the assistant snapshot leave a TBA chapter out (`onlyTimedBlocks`, lib/schedule.ts).
- `fetchScheduleBlocks` now reads `time_tba`; `isTimeTba` (lib/schedule-chapters.ts) is the one question.

Guard: `apps/web/lib/a-tba-chapter-is-never-midnight.test.ts` — behaviour of each reader plus a source scan that fails
any `event_schedule_blocks` read of `start_at` that neither reads the flag, fences it, is a guests' read, nor gives a
reason.

SPEC IMPACT: None (implements plan §2/§3 as written).
