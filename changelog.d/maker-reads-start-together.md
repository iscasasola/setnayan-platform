## 2026-10-23 · perf(maker): the Maker's and its editor's event-only reads start together — 40 trips → 20

Owner priority (23 Oct): *"consistency and reliability that we run smoothly … And fast."* Measured with
`app/dashboard/[eventId]/launch/maker-page-reads.harness.ts` — the REAL `LaunchHubPage`, then the REAL
`WebsiteEditorPage` it mounts (React draws it after the page returns), against a database that counts how deep each
request ran (the `guests-page-reads.harness.ts` method), new Maker (Stages | Studio) on:

- **Page depth 26 → 15; with its editor 40 → 20.** Simulated at 150 ms a trip: **6,108 → 3,104 ms**. Same 94 requests.
- `launch/page.tsx` `LaunchHubPage`: right after the host gate, `eventHasRenamed`, the tour keys, and the per-request
  caches behind `viewAsFreeSwitch` / `resolveProfileByEvent` start together; in the work block the See-as role names
  start with it, and once the print row is in, the draft, RSVP deadline, requests count, invitation base, reveal
  stages and the setup's guest count start together; the background read starts as soon as the draft is read; two
  query builders that only left at their `await` are started. Each is awaited where it always was
  (`lib/start-ahead.ts`); every one is awaited on every path it is started on.
- `website/editor/page.tsx` `WebsiteEditorPage`: the couple-only gate's read leaves with the event row; past the gate
  and the Maker-only redirect, the draft, scenes, fixed styles, public schedule, names, rite, roles, role names,
  entourage count, reveal stages and logo fonts start together. `readPostEventForMaker` (which may write) is unmoved.
- Migration `20271284442305_slug_change_log_reads_by_event.sql`: `slug_change_log (entity_type, entity_id)` — the
  by-event read `eventHasRenamed` makes on every Maker open had only the `LOWER(old_slug)` index. Additive,
  idempotent, pipeline only.
- No markup, CSS or client code changed.
- Guards: new `lib/the-maker-reads-start-together.test.ts` (page ≤ 15, with editor ≤ 20, event-only reads leave right
  after the host gate, the index exists). Re-pointed — same property, never loosened — `each-role-wears-its-own`,
  `hub-font-shelves`, `the-look-step-is-done-by-any-look-choice`; each sabotaged red, restored green.

SPEC IMPACT: None.
