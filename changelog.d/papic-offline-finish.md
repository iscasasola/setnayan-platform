## 2026-06-28 · feat(papic): offline capture queue — seat captures survive a venue WiFi blip

Group A · PR A1 of the Papic completion program. Finishes the offline-queue
last mile for the seat (paparazzo) capture path: the IndexedDB framework + sync
daemon + Background-Sync service worker already shipped (V2 Phase G), but the
`papic` handler was a stub and no live capture path enqueued anything — so a
capture that couldn't deliver was lost when the tab closed.

- **Real drain.** `lib/offline/service-handlers/papic-drain.ts` replays a queued
  capture through the SAME shipped seat delivery the live path uses (presign
  `/api/upload` with the `papicSeatToken` contract → PUT to R2 →
  `recordSeatCapture`). `papic-handler.ts` now delegates to it (was the
  `'V1.x post-pilot'` stub). A queued clip preserves its real `durationMs` (the
  sink's `record` dep arity drops it; `buildSeatSinkDeps` closes over it).
- **Enqueue on infra-failure only.** The seat capture UI persists a shot to the
  `papic` queue when delivery fails for an INFRASTRUCTURE reason (presign / PUT /
  network); a terminal server rejection (revoked seat, window closed, …) is NOT
  queued (retry can't succeed) and keeps the existing in-memory "tap to retry".
- **No double-delivery.** A persisted shot becomes a new `'queued'` roll status:
  the optimistic count is kept (it WILL land) and the manual-retry path (which
  only re-fires `'failed'` shots) can't also deliver it. A `CloudOff` badge marks
  queued shots; they're non-tappable.
- **Drains without the pilot flag.** The capture surface triggers a foreground
  `triggerSyncNow()` on mount + on `online`, so queued shots upload the moment
  connectivity returns — independent of the global `NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED`
  flag and Background Sync (which iOS Safari/PWA lacks). When the global daemon
  flag IS on, Background Sync additionally drains across closed tabs.
- Unit tests (`papic-drain.test.ts`): terminal-vs-infra classification, the
  deliverCapture replay, and clip-duration preservation. typecheck + lint clean;
  prod `next build` green.

SPEC IMPACT: None on product decisions — implements 0012's already-spec'd
offline queue + 7-day TTL posture. `App_Build_Status.md` 0012 "offline queue:
implementation pending" moves to shipped for the SEAT path on the next status
refresh; guest-capture offline persistence (separate `/api/papic/guest-capture`
endpoint) is tracked as follow-up PR A1b.
