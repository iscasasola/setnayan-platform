## 2026-07-22 · fix(papic): capture delivery integrity — honest 413, bounded clip size, no silent offline discard

Fixes a verified data-loss cluster on the Papic guest capture path — "a capture
must actually get delivered, or the guest is told the truth." Three coupled fixes:

**A — Guest 413 was mishandled as a network failure (silent data loss).**
`app/papic/guest/_components/papic-guest-capture.tsx`: a non-OK HTTP response
(notably 413 `too_large`) was caught in the same `catch` as a network/offline
failure, so the clip was enqueued for offline retry AND the guest saw "this will
upload once you're back online." A 413 fails identically on every retry, so the
clip was silently lost while the guest believed it was saved. Added a
`isPermanentUploadReject(status)` classifier (4xx except 429) and branched both
the photo and clip upload paths: a permanent 4xx now surfaces an honest message
(413/too_large clip → "That clip was too long or heavy to save — try a shorter
one.") and does NOT queue. Only genuine transient failures (network throw, 5xx,
429) still queue with the "back online" copy. 409 (pool) and 403 (blocked/terms)
are handled earlier and unchanged. `mode=web_copy` best-effort path untouched.

**B — Clip byte ceilings + unbounded full-tier bitrate (why 413s happened).**
The clip encode + ceilings were sized for the retired 5-second/1080p clip.
`lib/papic-adaptive-quality.ts`: `clipVideoBitsPerSecond('full')` returned
`undefined` → browser default (often 20–40+ Mbps), so a 10s 1440p clip could be
huge. Now bounded to 10 Mbps (a 10s clip targets 10 Mbps × 10 s ÷ 8 = 12.5 MB).
Raised ceilings with headroom over that target: guest `MAX_CLIP_BYTES` 25→40 MB
(`app/api/papic/guest-capture/route.ts`, ~3×), seat `PAPIC_SEAT_VIDEO_MAX_BYTES`
40→48 MB (`app/api/upload/route.ts`, ~3.8×). Replaced stale "5-second"/"5s"/
"1080p" comments near these constants (also `lib/use-papic-camera.ts`).
NOTE: `app/api/vendor/papic-capture/route.ts` and `app/api/pabati/clip/route.ts`
still hold the old 25 MB ceiling — left out of scope; the bitrate bound is global,
so their clips shrink too and are no longer at 413 risk (flagged for follow-up).

**C — Offline queue discarded a pool-exhausted capture as success + retried
permanently-failing items forever.** `lib/offline/service-handlers/papic-drain.ts`:
`GUEST_RESOLVED_STATES` contained `quota_exhausted`, so a drained capture hitting
an exhausted pool was dequeued as ok:true — silently discarded while counted a
success. It also didn't recognize the route's other exhaustion string
(`camera_points_exhausted`). Reconciled both strings into a new
`GUEST_POOL_EXHAUSTED_STATES`; exhaustion now returns `{ ok:false,
error:'camera_points_exhausted' }` — kept + surfaced (never dequeued-as-success).
Policy: a pool CAN refill (couple top-up), so the item stays queued and a later
drain can still land it; if the pool never refills the daemon's TTL/retry cap
terminalizes it (visible, not silent). `blocked`/`terms_required` remain terminal
dequeues (nothing to save). `lib/offline/sync-daemon.ts`: the "7-day TTL" was a
comment-only promise (the daemon only incremented `retry_count` → doomed items
retried forever). Implemented it for real: named `OFFLINE_ITEM_TTL_MS` (7 days,
primary bound) + `OFFLINE_MAX_RETRY_COUNT` (50, secondary guard) with a pure,
unit-tested `isOfflineItemExpired()` predicate; the daemon loop now evicts an
expired item (counts as failed) instead of attempting it again. Applies to all 7
offline queues (matches the existing per-handler "7-day TTL eviction is the
backstop" comments).

Tests: updated `lib/papic-adaptive-quality.test.ts` (full-tier bitrate now
bounded), rewrote the exhaustion case + added blocked/terms coverage in
`lib/offline/service-handlers/papic-drain.test.ts`, and added
`lib/offline/sync-daemon.test.ts` for the eviction predicate. No DB migration
needed (offline queue is client-side IndexedDB; exhaustion visibility rides the
existing `last_error` surface).

SPEC IMPACT: None. No SKU/pricing/metering point values changed (photo=1pt,
clip=7pt untouched); the 10s clip cap and 1440p capture were already spec — this
only bounds the clip encode bitrate and raises byte ceilings to match them.
