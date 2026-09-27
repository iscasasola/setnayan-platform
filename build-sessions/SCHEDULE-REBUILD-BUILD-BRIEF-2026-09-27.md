# Schedule rebuild — build brief (2026-09-27)

**Spec:** the approved prototype `~/Documents/Claude/Projects/Setnayan/prototypes/schedule_redesign_2026-09-25.html`.
**Sequencing:** DECISION_LOG row "BEFORE APPLE: SCHEDULE REBUILD" (2026-09-27) — the Schedule goes first, before Apple.

Every anchor below is a DECISION_LOG headline — find it with
`grep -n "<headline>" ~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`. No line numbers on purpose.

| Decision (grep this headline) | What it asks for | Slice |
|---|---|---|
| `SCHEDULE (event-day view) JOINS THE PAGE REDESIGN` | intro paragraph → one line + ⓘ; one "Next up", not two; no stack of cards; blocks reveal their controls on selection; list + inspector on desktop | 1 |
| `SCHEDULE REDESIGN PROTOTYPE APPROVED` | the day as a time rail · one live strip on the day · tap → inspector (sheet on a phone) · drag/resize, 5-min snap shown only while dragging · tap a gap to add · eye = show to guests · Shift everything after · Add-a-step sheet · roles | 1 (rail); `setup` block_type → 5 |
| `WHO SETS UP THE SCHEDULE, AND HOW SUPPLIERS REQUEST CHANGES` | hosts + an approved coordinator edit, everyone else reads · supplier requests as ghost blocks + a Requests inbox | 1 |
| `WHERE ANNOUNCEMENTS ARE TYPED` | one **Announce** button on the Schedule for the couple + a `schedule: 'edit'` coordinator, before and on the day; the day-of Overview box stays | 1 (composer) · guest side before the day → see ⚠ below |
| `SCHEDULE = JOURNEY LOG · PREPARATION · EVENT DAY` | Journey = dated planning LOG (meetings, calls, tastings, fittings, notes); Preparation = what is due | 1 keeps both views, separate · the log itself → 6 |
| `PAYMENTS LIVE ON THE SCHEDULE TOO` | payment due dates in Preparation "from Budget"; paid → Journey with the paid date | 2 |
| `PAPIC CHAPTERS: AUTOMATIC BY DEFAULT` | Event Day moments = the day's chapters; setup never a chapter; hosts rename/reorder/merge; manual wins; "Reset to automatic" | 3 |
| `PHOTOGRAPHERS & VIDEOGRAPHERS USE THE SAME SCHEDULE` | their requests via the same inbox (already true); their uploads auto-file into the day's chapters | 4 |
| `YES TO ALL — PALETTE, DAY-OF SCHEDULE` item (4) | the Event Hub schedule scene uses ONE style | not this build — `app/[slug]/**` belongs to the stage-scene builders |

## ✅ STATUS — SLICE 1 FINISHED (2026-09-28, `rd/schedule-rebuild`; owner 2026-09-28: every Event Hub build lands before the Thursday Apple check)

Resumed from the WIP on `rd/schedule-rebuild-1`, cherry-picked onto `origin/main` AFTER the timezone
hotfix (`rd/schedule-times-in-manila`: a schedule time is the venue's wall clock in a UTC column;
`lib/schedule-rail.ts` already read and wrote UTC digits, so nothing moved — its round-trip test and
`lib/a-schedule-time-reads-the-same-everywhere.test.ts` both hold; the strip's real-instant
`fmtInstant` is listed in that guard's EXEMPT with its reason).

Added on resume, per the owner's 2026-09-27 control rules: every set of choices is ONE `PickMenu`
(phase · tag a supplier · View as · Starts · Runs for · From · Through · By), quantities are −/+
steppers, on/off stays a switch — no pill rows, no native selects. Glance shows days to go.
`/dev/schedule-lab` drives the real rail on the prototype's fixtures (dev-only). Full typecheck, lint,
unit suite and the CI guard set run before the PR; visual check at 375 and desktop in the lab.

Still owned elsewhere: a pre-day announcement reaches guests only inside the day-of window
(`app/[slug]/**`, pinned by `day-of-announcement.test.ts`). Decline-with-a-reason still needs a
column (slice 7).

## Slice 1 — the rebuilt page on the existing data (this PR)

- Event Day (non-travel events) is a **time rail**: `lib/schedule-rail.ts` (pure, tested) +
  `schedule/_components/day-rail.tsx`, `moment-inspector.tsx`, `day-sheets.tsx`.
- Every write is an **existing** action in `schedule/actions.ts`, handed down by the page
  (`DayActions`). Zero new server actions (the route budget is tight), zero migrations.
  `updateScheduleBlock` now also accepts `block_type` (the inspector's phase picker).
- Roles from `resolveBroadcastAuthority` — the same rule as the block write policies and the
  announcement INSERT policy.
- The live strip is `RunOfShowHeader variant="strip"`, drawn only inside the day-of window.
- **Announce** (`announce-button.tsx`) writes through `sendCoordinatorBroadcast` — the one channel.
- Supplier requests: ghosts on the rail + the Requests sheet (`event_schedule_suggestions`,
  `resolveScheduleSuggestion`) — shipped already, so they are in slice 1.
- Host / MC (segments, questions, a note) move into one sheet behind the mic tool.
- Travel events keep their shipped list, clash guard and day-by-day lens (a hotel night is not a
  one-day rail).
- First-visit tour `customer_schedule_v1` (MiniTour / `TOURS`).

⚠ **Announce before the day reaches guests ON THE DAY, not at once.** The guest reader
(`app/[slug]/_lib/loaders.ts` → `loadDayOfBroadcast`, gated `isLive` in `app/[slug]/layout.tsx`)
shows the latest announcement only inside the day-of window. The composer says exactly that. Making
a pre-day announcement visible immediately is a two-line change in `app/[slug]/**`, which the
stage-scene builds own — flagged to the controller, not touched here.

⚠ **Declining with a reason** (the prototype's optional reason box) needs a column
`event_schedule_suggestions` does not have. Slice 1 declines without one; it rides a later slice.

## Later slices (separate PRs, each only after the previous one is reported)

2. **Payments on the schedule** — Preparation rows "from Budget" (read, never retyped); a paid
   one moves into Journey with its paid date.
3. **Papic chapters** — automatic from Event Day moments (via `lib/papic-chapters.ts`); a Papic
   chapters panel; host overrides stored as exceptions only; "Reset to automatic".
4. **Photos and videos filed into chapters** by capture time (guest Papic + supplier capture lane).
5. **`setup` moments** — a `setup` block_type (CHECK migration), never public, never a chapter,
   drawn "Setup" on the rail.
6. **The Journey log** — "Log an entry" (meeting · call · tasting · fitting · payment · paperwork ·
   note) with who/where/note/attachments/"who sees it"; check `event_preparation_items` first.
7. **Supplier side** — the same rail read-only on `vendor-dashboard/clients/[eventId]`, "Request a
   moment" / "Request a change" from a tapped moment or gap; decline reason.
