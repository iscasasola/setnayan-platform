## 2026-07-09 · feat(dashboard): Schedule section on the event Overview

Adds a **Schedule** section to the couple Overview (`/dashboard/[eventId]`),
surfacing the event's day-of timeline — the `event_schedule_blocks` rows the
couple builds under `/schedule` and that the day-of grid goes live with. This
is distinct from the existing "Needs you" panel (deadline/reminder items from
`fetchUpcomingItems`); the Overview previously only showed the actual timeline
during the day-of window (inside `DayOfModeGrid`).

- New `SchedulePreview` (presentational) + `SchedulePreviewAsync` / `SchedulePreviewSkeleton`
  (Suspense-streamed fetch with the same graceful-degrade contract as the other
  async home panels). Shows up to 4 top-level upcoming blocks, falls back to the
  earliest blocks when the program is past (never empty while data exists), and
  renders a build-your-timeline empty state that funnels into `/schedule`.
- Pure selection logic `selectSchedulePreviewBlocks` lives in `lib/schedule.ts`
  (so the `lib/**` unit runner covers it); 4 new tests in `schedule.test.ts`.
- Always-on (the couple's own data, not an assist nudge — stays visible in
  Manual mode); hidden during the day-of window where the live grid already
  shows the schedule. The `SuriCockpit` dormant-flag gating is untouched.

SPEC IMPACT: None (additive UI surface; no schema, no pricing, no locked-decision
change). Design consistent with the session's Progress-page Schedule card.
