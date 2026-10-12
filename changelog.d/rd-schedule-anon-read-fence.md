## 2026-10-12 · fix(schedule-rls): the database's anonymous schedule read keeps the audience fence

The `anon` read policy on `event_schedule_blocks`
(`event_schedule_blocks_public_read`, last defined in 20270901120000) was
`is_public = TRUE AND visibility <> 'coordinator_only'`. It never asked
`audience` (the Schedule "For ▾" column, 20271265788160; NULL = Everyone), so
anyone holding the public anon key and an event id could ask PostgREST directly
for a moment made "Only for · Entourage / Sponsors / Family / Suppliers" — its
label, times, location and tagged suppliers — whatever the pages drew (found by
#6467, which fenced the pages).

Migration `20271267138064_guests_schedule_read_is_for_everyone.sql` recreates
only that policy as `is_public = TRUE AND visibility <> 'coordinator_only' AND
audience IS NULL` — the same three conditions as `onlyWhatGuestsMaySee`
(lib/schedule.ts) — and asserts the policy text in the same transaction. The
host's, coordinator's and booked supplier's read policies are untouched.

Proved by `apps/web/tests/db/a-guest-reads-only-the-everyone-moments.db.test.ts`
(real `anon` / `authenticated` sessions on the replayed schema): anon reads only
the public, released Everyone moment; no role-only moment by any column; the host
and a booked supplier still read every moment but unreleased prep.

The same fence now reaches the two other places that said they showed the
guests' schedule (both flagged by #6467), so DB, pages and prints say one thing:

- **The printed Details card's programme** (`lib/print-set.server.ts` →
  `printProgram` in `lib/print-pieces.ts`) listed every `is_public` top-level
  moment whoever it was for; guests are handed that card. It now prints only
  moments that pass `isOnTheGuestsSchedule` (`lib/schedule-audience.ts`: public,
  `audience` NULL, not `coordinator_only`); the print's schedule read adds
  `audience, visibility`. Ceremony / reception times on the cards are unchanged.
- **The older website editor's schedule panel**
  (`app/dashboard/[eventId]/website/editor/page.tsx`) says it is "the same set
  guests see" but asked `is_public` only, so a host saw role-only moments listed
  as guests' schedule. Its read now also asks `audience IS NULL` and
  `visibility <> 'coordinator_only'`.

Guarded by `apps/web/lib/the-print-and-the-editor-keep-the-guests-fence.test.ts`
(behaviour of the predicate and the programme; the print's read and the editor's
read pinned; the migration's policy pinned to the same three conditions).

SPEC IMPACT: None — enforces the existing rule (DECISION_LOG 2026-10-06
"STUDIO › SCHEDULE AND LOVE STORY": a moment for a role is shown only to that
role; the guests' schedule shows only the Everyone moments) in the database; no
new decision.
