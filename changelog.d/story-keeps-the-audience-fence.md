## 2026-10-08 · fix(story): the guests' Story keeps the schedule's audience fence

A schedule moment can be made "Only for · Entourage / Sponsors / Family /
Suppliers" (`event_schedule_blocks.audience`, NULL = Everyone) or left as a
coordinator's unreleased prep block (`visibility = 'coordinator_only'`). The
guests' SCHEDULE has respected both since they shipped. The guests' STORY page
did not: `loadStorySpineFacts` (`app/[slug]/_components/story/spine-data.ts`)
read the table on the service-role client — where the query's filter is the
whole fence — asking only `is_public = true`. So a moment the couple made
"Only for · Entourage" (still `is_public`) could be named on the public Story
page with its time, its place and the supplier credited to it. The comment
above that query already said what it meant to do.

**The rule now lives in one place.** `onlyWhatGuestsMaySee(query)` in
`lib/schedule.ts` applies the three conditions — `is_public = true`,
`audience IS NULL`, `visibility <> 'coordinator_only'` — to a query builder.
Every guest-facing read asks through it:

- `fetchPublicScheduleBlocks` (the guests' schedule) — **unchanged**, condition
  for condition; the same test pins the request chain before and after, and it
  still takes the prep-release control from its callers exactly as before.
- `loadStorySpineFacts` — the Story's "venue, minute by minute". Was
  `is_public` only.
- the Story's chapter names, and the Story editor's placeholder that is their
  declared twin (`app/[slug]/_components/editorial/data.ts`, two reads). Were
  `is_public` only.
- `loadRunOfShowMoments` (`lib/story-arrangement-store.ts`) — the moments a
  guest's arranged Story pages are grouped under. Had `is_public` and
  `visibility`, not `audience`.
- `fetchRunOfShowBlocks` (`app/_actions/run-of-show.ts`) when the guests'
  schedule asks: the live "Now · Up next" header painted from the fenced read
  and then, on the first change of the day, refetched by the database's
  anonymous policy, which does not ask `audience`. The guests' header now
  mounts with `forGuests` and the action narrows by the same rule. Hosts,
  coordinators and suppliers call it as before and see what they saw.

No migration. No new request — each read is the same single query, narrower.
Nothing a host, a coordinator or a booked supplier sees has changed.

Guard: `apps/web/lib/the-guests-schedule-has-one-fence.test.ts` — a roster of
every file that reads the table (guest-facing and fenced, or not and why; a new
read fails until someone classifies it), and the real loaders run against an
in-memory table that really filters.

**Not closed here, reported:** (1) the database's anonymous read policy
`event_schedule_blocks_public_read` asks `is_public` and `visibility` but not
`audience`, so anyone holding the public key and an event id can still ask
PostgREST for role-only moments directly — closing that is a migration;
(2) the printed Details card's programme (`lib/print-set.server.ts`, a print the
couple makes and previews) lists `is_public` moments without asking `audience`.
Production was not queried: whether any live event has a role-only moment is
not known.

SPEC IMPACT: None. The rule is the one DECISION_LOG 2026-10-06 "STUDIO ›
SCHEDULE AND LOVE STORY" already states (a role's moment is shown only to that
role; the guests' schedule shows only the Everyone moments); this makes the
Story follow it.
