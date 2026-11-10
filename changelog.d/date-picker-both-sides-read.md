## 2026-11-10 · feat(date-picker): both sides' availability for a meeting — the one read behind the date sheet's slots

Build 3 · Lane D. The shared date sheet itself shipped in part 1 (`changelog.d/supplier-build3-d.md`); this is the
"both-sides availability read" its meeting step was waiting for (prototype v3.1 README § "Both sides' availability
(meetings)"; DECISION_LOG 📆 2026-11-09). No call site is wired — the rollout is by role, later.

- `lib/meeting-availability.ts` (pure, client-safe) — folds both sides' raw reads into ONE serialisable answer the sheet
  draws: closed days (an all-day `vendor_calendar_blocks` row via `blockClosesDay`, or the lock's own refusal via
  `calendar-truth`), busy stretches (a part-of-day block's hours, `DAY_PART_MINUTES`; meetings already held in
  `event_appointments`), and who was read. `meetingRefusal` → the sheet's `refuse`; `meetingSlots` → its `slots`;
  `meetingAboutWords` → the ⓘ. 🔒 The other side only "is not available" — another couple's meeting, a block's reason,
  a meeting's type never reach the answer; only your own clash names itself ("You have the florist meeting at 3 PM").
  A read that FAILED is never "free": it leaves "Free for …" and reads "Lumina's schedule could not be read — check
  with them".
- `lib/meeting-availability.server.ts` — `readMeetingAvailability`: proves the viewer on the caller's own session FIRST
  (host → `getHostUserId`; supplier → `vendor_profiles_self`; both → a shared `chat_threads` row), then reads the
  supplier's blocks (`NOT_AVAILABLE_COLUMNS` + `notAvailableWindowFilter`, so repeats count), `readCalendarTruth`, the
  supplier's meetings on other events and this event's meetings. No new table, RPC or migration.
- `date-sheet.tsx` — the sheet now hides a quick choice outside [min, max] itself (`choicesInRange`), whatever list a
  screen hands it; before, only the per-use helpers did.
- `/dev/date-sheet-lab` — the Meeting row now draws through `foldMeetingAvailability` over raw-shaped fixtures.
- Guards: `lib/meeting-availability.test.ts` (new); `app/_components/the-date-sheet.test.ts` (2) holds the sheet-level
  range filter.

⚠ NOT BUILT, needs the owner: a host's OWN busy times ("Maria is not available at 2 PM" in the prototype). The platform
holds the event's meetings, not a co-host's or a parent's personal day — no table stores one (measured 2026-11-10), so
anyone else included is named in the ⓘ as having not added a schedule. Storing one is a migration.

SPEC IMPACT: None. Builds the approved Lane D contract; the host-schedule gap above is surfaced, not decided.
