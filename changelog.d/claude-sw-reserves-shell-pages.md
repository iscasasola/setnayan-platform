## 2026-09-27 · fix(sw): 21 public pages stop being treated as a couple's guest link

`public/sw.js` `isDayOfGuestNavigation()` treats any single-segment path as a
couple's day-of guest slug, served stale-while-revalidate from the day-of cache,
unless the segment is in `RESERVED`. That set's guard
(`app/sw-reserved-routes.test.ts`) mirrored only top-level `app/*` folders and
**skipped `(route-group)` folders**. A group adds no URL segment, so every
public page living only under `app/(shell)/` was never reserved:

/about · /acceptable-use · /alaala · /budget · /cookies · /guest-list ·
/marketplace · /mood-board · /pa3d · /pakanta · /palogo · /patiktok ·
/pawebsite · /pricing · /privacy · /refunds · /schedule · /seat-plan ·
/setnayan-ai · /terms · /web-only

That is the /monogram bug (owner 2026-06-19: a public page stale-cached as a
guest slug) on 21 pages at once. It stayed invisible because the guard shared
the blind spot of the set it guarded.

- The guard now walks INTO route groups, the same walk
  `scripts/gen-reserved-slugs.mjs` always did, still excluding `_private` and
  `[dynamic]`. A new test asserts that the group-only pages exist and are
  reserved.
- The 21 words are added to `RESERVED`.
- No cache-version bump is needed: `scripts/stamp-sw.mjs` stamps the deploy SHA
  into `VERSION` on every build, so browsers install the new worker on their
  own.

Sabotage-checked. Restoring "skip route groups" in the walk → RED. Dropping
`pricing` from sw.js → RED.

SPEC IMPACT: None.
