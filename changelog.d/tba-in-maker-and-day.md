## 2026-11-02 · fix(schedule): a Time-TBA chapter is never midnight in the Maker, the floor, Memories or the mood board

Follow-up to #7158. A Time-TBA chapter keeps its day in `start_at` at a placeholder 00:00.

- **Maker ceremony-time box** (`lib/ceremony-time.server.ts`): `readLiveCeremony` reads a TBA ceremony as no time + TBA;
  the box says "Time TBA" and stays empty (`ceremonyTimeBox`). Apply never writes 00:00 — with no typed time nothing is
  written; a typed time is written and clears `time_tba` (its parts do not walk from the placeholder). The preview's
  drafted ceremony clears the flag the same way.
- **Details › Ceremony / Reception rows**: `blockTime` says "Time TBA" for a TBA chapter. Printed pieces
  (`print-set.server.ts`) read `time_tba` and leave a TBA time off the print.
- **Floor command retime** (and every bulk retime): `selectRetimeSpan` never shifts a TBA chapter and cannot shift from
  one; the floor says why.
- **Memories' photo windows** (library + `event-memories.server.ts`): a TBA chapter makes no planned window
  (`alaala-chapters` `timeTba`); a chapter that really ran still uses its actual times.
- **Mood board guests' time**: `guestsSee` never takes a TBA chapter.

Guard `lib/a-tba-chapter-is-never-midnight.test.ts` extended (8 new tests + a scan of every `fetchScheduleBlocks`
caller). Reverted the fixes → 8 fail; restored → 13/13 pass.

SPEC IMPACT: None.
