## 2026-06-26 · feat(panood): venue-screen data layer (multicam controller PR2)

Foundation for the upgraded Panood multicam controller — the VENUE-SCREEN data
layer, a persistent named multi-screen registry the control room routes sources
to. Mirrors PR1's camera-operator layer structure exactly; reuses the
wall_display_sessions short pairing-code idea (a TV/stick types a 6-char code,
unlike a phone scanning a long token). PR2 ships the table + couple-scoped RLS +
the read/provision/route lib + unit tests; the screen pair/claim handshake
(SECURITY DEFINER RPC / admin client) and the controller UI land in later PRs.

- New migration `20270227600000_panood_screens.sql` — `public.panood_screens`
  (one row per registered display: dense `screen_index`, optional `name`, short
  6-char Crockford `pairing_code` + `pairing_expires_at`, `paired_at`,
  loose-text `current_source` DEFAULT 'photos' routing — photos/mirror/live_bg/
  off/cam1/… (no CHECK, sources are dynamic), `status` pending/online/offline,
  `last_seen_at` heartbeat, `revoked_at`). DISTINCT from the transient
  `wall_display_sessions` 15-minute claim handshake — this is the durable screen
  registry. Idempotent (CREATE TABLE IF NOT EXISTS + defensive ADD COLUMN IF NOT
  EXISTS, mirrors panood_camera_operators). `UNIQUE (event_id, screen_index)`,
  index on `event_id`. RLS ENABLED in the same migration, copied EXACTLY from
  panood_camera_operators: control-room scope (couple + coordinator via the
  EXISTS-on-event_members pattern, + `is_admin()`), NOT current_event_ids / not
  guests; no anon/device policy (that goes through an RPC later).
- New `apps/web/lib/panood-screens.ts` mirroring lib/panood-camera-seats.ts:
  `PanoodScreenRow` type, `PANOOD_SCREEN_*` consts, `fetchPanoodScreens`
  (ordered by screen_index, graceful-degrade to [] on 42P01/42703),
  `generateScreenPairingCode` (6-char uppercase Crockford, unambiguous alphabet
  — no I/L/O/U, rejection-sampled), `panoodScreenPairUrl` → `/wall?code=<code>`,
  `provisionPanoodScreensAdmin` (idempotent best-effort TOP-UP keyed on
  (event_id, screen_index)), and `setPanoodScreenSourceAdmin` (best-effort
  current_source + updated_at write). Extracted the pure `missingScreenIndexes()`
  so the provisioner and its test share one source.
- New `apps/web/lib/panood-screens.test.ts` (node:test) — pairing-code shape
  (6-char/uppercase/unambiguous-alphabet) + cross-call uniqueness, missing-index
  top-up logic, pair-URL building/encoding, setSource shape/error/bad-input, and
  the 42P01/42703 graceful-degrade. All pass.

SPEC IMPACT: None — additive data-layer foundation (new table behind
control-room-only RLS + helper lib), no schema rename/SKU/pricing/flow change to
any shipped surface. The Panood multicam controller remains an in-build SKU.
