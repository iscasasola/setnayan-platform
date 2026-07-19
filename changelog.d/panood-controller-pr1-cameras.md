## 2026-06-26 · feat(panood): camera-operator data layer (multicam controller PR1)

Foundation for the upgraded Panood multicam controller — the CAMERA-OPERATOR
data layer, built by cloning the proven Papic seat-claim pattern
(paparazzi_seats + lib/papic-seats.ts). PR1 ships the table + couple-scoped RLS
+ the read/provision/token lib + unit tests; the login-free operator claim path
(SECURITY DEFINER RPC / admin client) and the controller UI land in later PRs.

- New migration `20270227010000_panood_camera_operators.sql` —
  `public.panood_camera_operators` (one row per camera "seat": dense
  `camera_index`, per-camera unguessable `claim_qr_token`, `claimer_user_id`
  binding, `status` open/live/offline/revoked, `last_seen_at` heartbeat).
  Idempotent (CREATE TABLE IF NOT EXISTS + defensive ADD COLUMN IF NOT EXISTS,
  mirrors panood_broadcasts). `UNIQUE (event_id, camera_index)`, unique index on
  `claim_qr_token`, index on `event_id`. RLS ENABLED in the same migration with
  the EXACT paparazzi_seats approach: couple/host of the event get full CRUD via
  the canonical `current_event_ids()` helper (+ `is_admin()`); no invented
  pattern, no anon/operator policy (that goes through an RPC later).
- New `apps/web/lib/panood-camera-seats.ts` mirroring lib/papic-seats.ts:
  `PanoodCameraRow` type, `PANOOD_CAMERA_*` consts, `fetchPanoodCameras`
  (ordered by camera_index, graceful-degrade to [] on 42P01/42703),
  `generateCameraClaimToken` (24-byte base64url), `panoodCameraClaimUrl` →
  `/panood/cam/[token]`, and `provisionPanoodCamerasAdmin` (idempotent
  best-effort TOP-UP keyed on (event_id, camera_index)). Extracted the pure
  `missingCameraIndexes()` so the provisioner and its test share one source.
- New `apps/web/lib/panood-camera-seats.test.ts` (node:test) — 15 tests: token
  URL-safety + entropy + cross-call uniqueness, missing-index top-up logic,
  claim-URL building/encoding, and the 42P01/42703 graceful-degrade. All pass.

SPEC IMPACT: None — additive data-layer foundation (new table behind couple-only
RLS + helper lib), no schema rename/SKU/pricing/flow change to any shipped
surface. The Panood multicam controller remains an in-build SKU.
