# HANDOVER — rd/live-day-polling (event-day: phones stop hammering the server)  · started 2026-10-18 by the controller

Owner, 2026-10-18, verbatim: "stability and request fix? with speed fix? … make sure app will not collapse when a lot of
users are … connecting to the event" → "Yes — start … the live-day polling fix now". Audit:
~/Documents/Claude/Projects/controller-2026-10-12/EVENT-DAY-LOAD-AUDIT-2026-10-18.md (lane L2).

GOAL: during the event (Manila phase live/post) each open guest phone costs the database a small, FLAT number of requests
per minute that does not grow with how many guests are watching, while guests still see changes within ~15 s. Nothing a
guest sees changes. Verify each finding on this branch first (the audit was a Sonnet read).

MEASURE FIRST, then fix, then measure again: requests per guest per minute on /<slug>, /<slug>/hub, /<slug>/seat with the
wall + a watch link + a live run-of-show, using the counting stand-in harness from the 2026-10-08 perf work
(~/Documents/Claude/Projects/wt-perf2-scratch/harness/ — copy it, don't edit it). Before/after table goes in the PR body.

FIX (one commit each, each with a guard + sabotage):
1. Live wall: live-wall-block.tsx polls GET /<slug>/live-wall every 25 s (POLL_MS); route is force-dynamic, ~10-15 reads
   per poll, no cache. Split per-viewer bits from the per-event snapshot; cache the per-event snapshot ~10 s server-side
   (one compute per event per window, whatever the number of guests) and send s-maxage + stale-while-revalidate where the
   response is viewer-independent. Pause while the tab is hidden; add jitter.
2. /<slug>/hub, /seat, find-my-table, find-seat: `useDayOfLiveTick` / LiveRefresher do router.refresh() every 45 s = a
   full server re-render (~15-25 reads). Replace with a cheap cached "what changed" check per event (version/stamp,
   cached ~10-15 s for everyone) and refresh only when it changed; jitter; hidden tab = no poll. Parallelize the
   sequential awaits in hub/page.tsx with the existing `startAhead` (lib/start-ahead.ts).
3. Run-of-show (app/_components/run-of-show-header.tsx): every guest's postgres_changes on event_schedule_blocks → every
   block advance makes EVERY guest call fetchRunOfShowBlocks at once. Use the change payload (or one cached read per
   event) + jitter; no per-guest DB read per advance. Same check for day-of-announcement.tsx's 45 s pull.
4. /api/live/[slug]/watch: `max-age=15` only → add s-maxage + stale-while-revalidate (viewer-independent), one events read.

Shared helpers to reuse (do not reinvent): startAhead · askedOnce (lib/request-once.ts) · rememberedGlobalRead
(lib/global-settings-cache.ts) as the caching pattern · ServerTimer.mark. Do NOT touch app/[slug]/page.tsx or
app/[slug]/_lib/loaders.ts or lib/entitlements.ts (another lane takes those next) and do NOT touch app/[slug]/actions.ts,
the join/gift/find-me/papic capture files (the no-double-records lane is editing them now).
Proof: a 375 px WebKit (iPhone 13) walk of the hub in the lab showing an update arrives after a change, picture in
~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Changelog fragment changelog.d/rd-live-day-polling.md.

---
## BUILDER STATE (Opus 5.5, 2026-10-18)

### Step 1 — MEASURED BEFORE (origin/main cb673a22f4) ✅
Lab: counting stand-in (copy of wt-perf2-scratch/harness → ~/Documents/Claude/Projects/wt-live-day-polling-scratch/harness,
plus make-fixtures.mjs / drive.mjs / window.mjs / serve.sh), `next dev` on the LAB env (no prod), one guest with a signed
cookie, WebKit iPhone 13, Asia/Manila, a wedding pinned to The Day with a wall (LIVE_WALL + Papic), a YouTube watch link,
a live run-of-show and one announcement. Each page sat visible 120 s; DB stand-in requests counted in that window.
Lab artefacts excluded (CSP report rpc + client-fault rate-limit rpc — the stub's realtime socket is refused in the lab).

| page (one guest, visible) | first render | per minute while open |
|---|---|---|
| /<slug>/hub (Now tab) | 33 | 34.5 |
| /<slug>/hub?tab=photos (wall) | 33 | 50.5 |
| /<slug>/hub?tab=watch | 36 | 40.5 |
| /<slug> | 80 | 29.0 |
| /<slug>/seat | 27 | 23.0 |
Cause, per minute: hub/seat router.refresh every 45 s (~32 reads each) · wall poll every 25 s (~9 reads) · watch poll every
30 s (3 reads) · announcement pull every 45 s (2 reads, also while hidden). All of it × every guest.
