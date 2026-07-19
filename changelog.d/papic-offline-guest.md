## 2026-06-28 · feat(papic): offline capture queue — guest (per-guest camera) path

Group A · PR A1b. Extends the Papic offline queue to the PAPIC_GUEST surface,
completing the offline story for both capture paths.

- The guest camera uploads through a DIFFERENT contract than the seat (a
  multipart POST to `/api/papic/guest-capture`, cookie-authed session + the
  quota-enforcing `papic_record_guest_capture` RPC), so its drain re-POSTs the
  same form rather than presign+recordSeatCapture. Both paths share the one
  `papic` IndexedDB store, discriminated by a `payload.mode` field
  (`guest` vs the default seat).
- `papic-drain.ts` gains `drainGuestCaptureWith` (reconstructs the full
  multipart form — `media_type` / `file` / `poster` / `duration_ms` /
  `share_publicly` / `face_vectors`) + `enqueuePapicGuestCapture`. `drainPapicCapture`
  now dispatches on mode.
- Guest UI (`papic-guest-capture.tsx`) enqueues on infrastructure failure in both
  the photo + clip catch blocks (terminal states — quota / blocked / terms — were
  already handled with early returns, so they never queue) and runs the same
  foreground `triggerSyncNow()` drain on mount + `online`. `eventId` threaded
  through both render sites (`/papic/guest` + the day-of `[slug]` landing).
- Drain classification: server `ok` → land + dequeue; a terminal guest state
  (quota_exhausted / blocked / terms_required) → resolve + dequeue (no infinite
  retry); 5xx / network → keep for retry (7-day TTL backstop).
- Unit tests: full-form reconstruction for a clip, terminal-state dequeue, and
  5xx/network retention. typecheck + lint clean; prod `next build` green.

SPEC IMPACT: None — completes 0012's already-spec'd offline queue for the guest
path (companion to PR A1's seat path).
