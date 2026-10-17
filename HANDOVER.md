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

### Step 2 — FIX 1 live wall ✅ (commit 08345f1a43)
`lib/live-day-cache.ts` (`rememberedLiveRead`, `notRemembered`, `liveDayTag`) — rememberedGlobalRead's pattern per EVENT,
10 s. `/[slug]/live-wall`: whole answer remembered per event; only an OPEN wall remembered + `s-maxage=5, swr=10`;
404/503/unmeasured challenge → that phone only, `no-store` (a 404 stops the block for good, so a shared blip would close
the wall on every phone). A failed event read is now 503 (retried) not 404. Block: jittered ± 20 % timeout chain.
NOTE: the route had no per-viewer bits at all (snapshot read with viewer `null`) — nothing to split.
Guard `lib/live-day-answers-are-shared.test.ts`; 7 sabotages RED.

### Step 3 — FIX 4 watch route ✅
One events read (slug + both links; old 2-step kept as 42703 fallback), broadcast row only when no link, remembered per
event, `s-maxage=10, swr=20` on a definite answer; 'unknown'/404 not shared, `no-store`. Embed skips polls while hidden.
6 sabotages RED.

### Step 4 — FIX 3 run-of-show + announcement ✅
Run-of-show: guests apply the postgres_changes payload (`lib/run-of-show-live.ts` `applyGuestBlockChange`) behind
`rowGuestsMaySee` (lib/schedule.ts — the fence's 3 conditions on one row; missing fence column → 'unknown' → re-read).
Re-reads (unsettled payload, reconnect) wait `herdDelay(10 s)`. Hosts/suppliers unchanged.
Announcement: per-event remembered read; writer `revalidateTag(liveDayTag(eventId))` BEFORE the ping; ping asks spread
over 3 s; hidden phone does not pull. 10 sabotages RED.
LEFT (named, not built): Realtime itself still evaluates RLS per subscriber per change (postgres_changes). Moving guests
to a broadcast-from-trigger channel needs a migration — another lane is adding migrations now; out of this PR.

### Step 5 — FIX 2 pulse (next)
Plan: `lib/event-pulse.server.ts` (per-event stamp v + per-guest recent changes g, remembered 10 s) · route
`app/[slug]/live-pulse/route.ts` · `lib/event-pulse.ts` (pure decision) · `lib/use-event-pulse.ts` (hook, 15 s ± 20 %,
hidden = no poll, back after ≥ 9 min away = refresh, 3 misses = refresh) · HubShell stage frame + LiveRefresher +
find-seat name search use it when the page passes a baseline; hub/page.tsx startAhead.

### Step 5 — FIX 2 pulse ✅ (b49a6ea05f) + edge fix (bd10c37720)
`/[slug]/live-pulse` (lib/event-pulse.server.ts · event-pulse-stamp.ts · event-pulse.ts · use-event-pulse.ts ·
app/_components/pulsed-live-refresher.tsx). Hub stage frame, LiveRefresher (seat, find-my-table, find-seat) and the
find-seat name search use it when the page passes a baseline; otherwise the 45 s refresh as before (host check-in /
souvenirs untouched). Hub: independent reads started together (startAhead), pinned spellings kept.
Schedule read in the stamp goes through onlyWhatGuestsMaySee (roster entry added); seats through guestsMaySeeSeatsFor.
17 sabotages RED. Related suites: 158 files / 1,713 tests green. `next lint` on changed files clean.
LAB FINDING: `fetch(…, {cache:'no-store'})` sends `Cache-Control: no-cache` → `next dev` skips the data cache
(incremental-cache/index.js `this.dev && requestHeaders['cache-control'] === 'no-cache'`) — 10 phones = 78 computes for
77 polls. Polls now send no directive; browser gets `max-age=0, must-revalidate`; CDN window in
`Vercel-CDN-Cache-Control` (`liveEdgeHeaders`). Closed events: pulse door = signature-checked guest pass, else
canViewSlugEvent.
Known narrower freshness (documented in event-pulse.server.ts): a purchase on the day, a new e-gift destination or venue
booking, a published album → shown at the next watched change or on return after 9+ min away.

### Step 6 — MEASURED AFTER + walk + PR ✅
Fixed-window cache (d0829ebb5c) after two measured mistakes (no-store bypass; stale-then-double-read). Table in PR #6624
body. WebKit 375 px walk: table rename 10.6 s, own check-in 10.6 s, no reload; quiet minute 0 re-renders. Shots
~/Documents/Claude/Projects/shots-2026-10-18/6624/. 47 sabotages RED total. Draft PR #6624, label do-not-auto-merge,
auto-merge null. NEXT: watch CI to green.

### Step 7 — CI rounds
Round 1 (48b3190c6): typecheck (announcement type, seat-pass guest scope) · port baseline (<LiveRefresher> → <PulsedLiveRefresher>) ·
ugat screens stale → fixed in fb573fb1d. Round 2 (fb573fb1d): DB replay 6/6 `ugat-both-ends` — the watch route branched on
an events read error without saying it → logged. Local: that db test 4/4 green; guards job's 25 node steps green.
