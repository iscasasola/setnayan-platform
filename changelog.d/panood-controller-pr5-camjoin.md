## 2026-06-26 · feat(panood): camera-operator JOIN flow — PR5 of the multicam controller

The CAMERA-OPERATOR JOIN flow for the upgraded Panood multicam controller
(iteration 0011), cloned byte-for-byte from the PROVEN Papic seat-claim security
model. An operator scans a per-camera QR / opens `/panood/cam/[token]`, joins as
that camera, and lands in a local rear-camera preview while the controller
brings them live.

- **DB · new migration `20270301500000_panood_claim_camera.sql`** — adds the
  SECURITY DEFINER `public.panood_claim_camera(p_token)` RPC, a direct clone of
  `papic_claim_seat`: validates the token against `panood_camera_operators`,
  binds `claimer_user_id` + `claimed_at` + `status='live'` under a race-safe
  conditional `UPDATE … WHERE claimer_user_id IS NULL`. Idempotent on a re-open
  (same operator → `claimed`), rejects a revoked/reissued token (`invalid`), one
  token → one camera → one event (UNIQUE `claim_qr_token`, row-bound `event_id` →
  no cross-event reuse). `GRANT EXECUTE … TO authenticated`. Purely additive;
  safe on a live DB.
- **`lib/panood-camera-seats.ts`** — `panoodCameraAnonEnabled()` login-free flag
  (`NEXT_PUBLIC_PANOOD_CAM_ANON_ENABLED`, default OFF), a sibling of
  `papicSeatAnonEnabled()`; plus `fetchClaimedCameraForUser()` — admin-client
  read hard-scoped to the operator's OWN binding (never leaks another operator's
  camera or the secret token) so the GET page can render the publish view.
- **`app/panood/actions.ts`** — `claimPanoodCamera(token)` server action mirroring
  `claimPapicSeat`: POST-only, validates via the RPC, mints a native-anon session
  only after confirming the camera is claimable when the flag is ON, never leaks
  the token, redirects to the claimed/terminal state.
- **`app/panood/cam/[token]/page.tsx` + `loading.tsx`** — the join page: GET
  renders "Join as Camera N" (claim happens on the POST, NEVER on GET, so a
  link-preview bot can't silently claim); after a successful claim it renders the
  local camera-publish view. Sign-in gate graceful-degrade when the flag is OFF.
- **`app/panood/cam/[token]/_components/panood-camera-publish.tsx`** — client
  `getUserMedia` REAR-camera (`facingMode: environment`) LOCAL self-preview with
  an honest status: "You're Camera N · connected · the operator will bring you
  live." NO fake streaming — the real WebRTC publish arrives with the media core
  (engine) in a later PR; this PR is join + local preview only, clearly labeled.
- **Tests** — `lib/panood-camera-seats.test.ts` extended: login-free flag
  (default-OFF, exact-"true" only) + `fetchClaimedCameraForUser` scoping
  (own-binding only, no-leak on a different user, null on revoked/missing). 21/21
  green via the Node test runner (`tsx --test`).

SPEC IMPACT: None. Implements the already-specced PR5 of the Panood multicam
controller workstream (`Panood_Multicam_Architecture_2026-06-26.md`); no SKU,
schema-rename, retired-feature, or branding decision changed. The
`panood_camera_operators` table + lib foundation landed in earlier PRs; this only
adds the claim RPC + the operator-facing join route.
