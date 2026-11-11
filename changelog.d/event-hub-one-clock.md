## 2026-11-10 · feat(event-hub): the one clock — every stage and live part follows The Day (06:00 → 06:00, venue time)

Owner ruling, 10 Nov 2026: the public Event Hub keeps its stages (Save the Date · Invitation · The Day · Post Event)
inside one link and every part follows ONE clock. Logic only — no visual change, no database migration.

- **The one function:** `eventClock` (`apps/web/lib/event-clock.ts`, server half `lib/event-clock.server.ts`) answers
  "which stage is this event in now, at the venue" — The Day's two instants, the day-of phase, the dashboard menu,
  the date's stage, the couple's pin and `backToAutomatic`. Built from `theDayWindow` / `getDayOfPhase` /
  `getMenuLifecyclePhase` (`lib/day-of-mode.ts`) and `getLifecyclePhase` / `manualLaunchPhase` (moved to
  `lib/lifecycle-stage.ts`, re-exported by `lib/invitation-widgets.ts`).
- **The window:** The Day opens at 06:00 on the event day and closes at 06:00 the morning after the LAST day, venue
  time, by default (`THE_DAY_OPENS_DEFAULT_MIN` / `THE_DAY_CLOSES_DEFAULT_MIN`; `TheDayHours` lets a caller move
  either). Replaces "noon the day before → noon the day after" from midnight on the first day. `pre` = the 3 days
  before it opens; `post` = the day after it closes. A missing zone is Asia/Manila, never the runtime's.
- **The zone:** the venue's coordinates (`venueTimezone`), Manila without a venue — the dashboard readers that fed
  `events.timezone` to a lifecycle resolver now read the venue's.
- **Readers moved** (full before → after list in the PR body): the live wall + `resolveWallMode` (new after-recap
  `archive` case), the dashboard Live page, the invitation page's typed-confirm, the schedule page, the room links'
  `/[slug]/hub` door, song requests, the seat finder, the check-in desk (was midnight Manila), souvenirs, the
  supplier "On the day" Hub (`phTodayIso` → 06:00 → 06:00), the day-of hooks (`useEventPulse`, `useDayOfLiveTick`,
  seat plan banner + editor, `isDayOfOpen`) which now get The Day's instants from the server instead of anchoring a
  date on the phone's midnight, `eventIsPast` on `/[slug]` (was a UTC parse), the announcement stage (was midnight
  "over"), the invitation's on-the-day lead and arrival action (were midnight Manila), the event pulse, the Event Hub
  controller (`venueTz`), and nine dashboard/route "is it over" readers.
- **Part-by-stage table:** `STAGE_CLOCK_PARTS` beside `STAGE_SCENES` (`lib/stage-scenes.ts`), read by
  `clockPartOpen`. Live parts follow the DATE's stage, never the pin.
- **Memories (ruling 6):** an invited guest's Memories tab appears when Papic opens (The Day, or early shooting),
  with its empty state, not only after the first photo.
- **Cache key:** the Event Hub's cache key is `v2` and carries the clock's two letters (`clockCode`), read by the
  middleware per stamp — a stage flip names a new copy, with no cron. `v1` keys still parse.
- **Copy that states the window** now reads it: "6am on the day" / "6am the morning after" (help, /features), and the
  supplier Hub's "6am to 6am the next morning, Philippine time".
- **Guard:** `lib/the-event-has-one-clock.test.ts` — the rulings as behaviour, every moved reader agreeing at each
  boundary, and a source sweep that fails a page computing the event day itself.

NOT DONE HERE (needs the owner or a migration): the couple's own open/close hours have no column to live in (the
clock takes them; nothing stores them); the guest seat-visibility rule (`seatDayHasCome` + its SQL twin
`public.guests_may_see_seats()`) still opens seats at 00:00 Manila, not 06:00 — moving it needs a migration of that
function; the "Back to automatic" line and the ONE Post Event card are UI (the clock exposes `backToAutomatic` and
`post_event_card`).

SPEC IMPACT: Behaviour change to the day-of window (noon-to-noon → 06:00-to-06:00 the morning after the last day,
venue time). The corpus DECISION_LOG row for the 10 Nov 2026 ruling should cite `lib/event-clock.ts` as its home; not
edited from this cloud session (the corpus is not in this container).
