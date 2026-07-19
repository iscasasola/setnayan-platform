## 2026-07-19 · feat(vendor-papic): durable IndexedDB offline upload queue for on-the-day capture

The vendor on-the-day Papic capture controller (merged #3388) fired uploads
non-blocking but LOST the capture if the tab died offline — and weak-signal
venues are the norm. This mirrors the couple-side durable-queue pattern
(`lib/offline/service-handlers/papic-drain.ts`) for the vendor lane:

- **New `papic-vendor-drain.ts`** — vendor items ride the SAME shared `papic`
  IndexedDB store, discriminated by `payload.mode === 'vendor'` (the exact
  idiom the guest path established with `mode: 'guest'`). The drain re-POSTs
  the identical multipart form to `/api/vendor/papic-capture` (cookie-authed,
  consent attestation replayed); an item is deleted only after the route
  confirms the land. A separate module (not growing `papic-drain.ts`) keeps
  the shipped couple path untouched except a 2-line dispatch branch.
- **Failure policy mirrors the guest drain** — infra failures (network / 5xx /
  `no_session`) stay queued for the daemon's retry (7-day TTL backstop);
  TERMINAL rejections (`out_of_points` / `video_not_allowed` / `disabled` /
  `not_allowed` / …) resolve the item — retrying can never succeed, and the
  browser never retains guest PI hammering a counsel-closed gate.
- **Controller** enqueues on infrastructure failure only (terminal rejections
  keep the live rollback + toast), keeps the optimistic point spend on a
  successful enqueue (ownership transfers to the queue — seat-surface
  precedent), drains in the FOREGROUND on mount + `online` (iOS Safari has no
  Background Sync), and shows an "N waiting for signal" chip.
- **Storage cap** — per-event backlog ceiling of 90 items
  (`VENDOR_OFFLINE_QUEUE_MAX`; Ltd's budget is 70 points, so 90 already
  exceeds any tier that can still land); past it the enqueue refuses and the
  UI keeps its live "check your signal" affordance. TTL eviction backstops.
- **Flag posture unchanged** — the surface AND the capture route are already
  gated by the `vendor_papic_capture` Data Privacy control (default OFF); no
  new flag. A queued item can only originate from the approved surface.
- Unit tests (`papic-vendor-drain.test.ts`): terminal classification, full
  multipart replay w/ consent, photo never leaks clip-only fields,
  terminal-resolution drop, 5xx/network/no_session retry, backlog-cap boundary.

SPEC IMPACT: Vendor_Featured_Weddings_Whats_Next §vendor-papic#offline shipped (flag-dark).
