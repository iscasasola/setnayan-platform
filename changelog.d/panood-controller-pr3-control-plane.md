## 2026-06-26 · feat(panood): live control plane — moments + program/preview state (multicam controller PR3)

Foundation for the upgraded Panood multicam controller — the LIVE CONTROL PLANE
that turns the day-of switcher into a scriptable director's run-of-show. Sits on
top of PR1 (camera-operator layer) and PR2 (venue-screen layer); mirrors their
table/RLS/lib/test structure exactly. PR3 ships the two control-plane tables +
control-room-scoped RLS + the moment-director / control-state libs + unit tests;
the control-room UI and the moment-macro fan-out (a moment applying its config
across the camera + screen layers) land in a later PR.

- New migration `20270228010000_panood_control_plane.sql` (prefix strictly >
  every existing one) — TWO tables:
  - `public.panood_moments` — per-event MOMENT-DIRECTOR presets/macros: dense-ish
    `sort_order`, `label`, optional ti-* `icon`, loose-text `config` jsonb DEFAULT
    `'{}'` (the macro — program_source, overlays[], walls_source, audio_duck,
    banner_label, banner_icon; NO CHECK, sources/overlays dynamic per event),
    `is_default` (flags the seeded spine), created_at/updated_at. Index on
    `event_id`.
  - `public.panood_control_state` — the live program/preview/routing state, ONE
    row per event (`UNIQUE event_id`): `program_source`, `preview_source` (loose
    text), `director_mode`, `is_live`, `active_moment_id` (FK → panood_moments,
    ON DELETE SET NULL), `updated_at`. Index on `event_id`.
  Both: idempotent (CREATE TABLE IF NOT EXISTS + defensive ADD COLUMN IF NOT
  EXISTS + CREATE INDEX IF NOT EXISTS), RLS ENABLED in the SAME migration, DROP
  POLICY IF EXISTS before CREATE — RLS copied EXACTLY from panood_screens /
  panood_camera_operators: control-room scope (couple + coordinator via the
  EXISTS-on-event_members pattern, + `is_admin()`), NOT current_event_ids / not
  guests; no anon/device policy (control-plane mutations go through the admin
  client in the lib layer).
- New `apps/web/lib/panood-moments.ts` — `PanoodMomentRow` / `PanoodMomentConfig`
  types, `DEFAULT_MOMENTS` (the 8-beat spine Processional · Vows · The Kiss ·
  Grand Entrance · First Dance · Speeches · Cake Cutting · Toast, each with a ti-*
  icon + macro), `fetchPanoodMoments` (ordered by sort_order, graceful-degrade to
  [] on 42P01/42703), `provisionPanoodMomentsAdmin` (idempotent SEED-ONLY-WHEN-
  EMPTY — seeds the spine only if the event has no moments yet; best-effort returns
  the count), and best-effort `createPanoodMomentAdmin` / `updatePanoodMomentAdmin`.
- New `apps/web/lib/panood-control.ts` — `PanoodControlState` type,
  `fetchOrInitControlStateAdmin` (idempotent get-or-create the single row, upsert
  on `event_id`), and best-effort `setProgramSourceAdmin` / `setPreviewSourceAdmin`
  / `setDirectorModeAdmin` / `setLiveAdmin` / `applyMomentAdmin` (all upsert the
  field + a fresh updated_at, never throw on a missing table). Like its two sibling
  layers it takes the admin client as a parameter and carries NO `'server-only'`
  (no secret of its own; the server-only boundary is the server action that builds
  the service-role client), so it stays unit-testable under `tsx --test`.
- New `apps/web/lib/panood-moments.test.ts` + `apps/web/lib/panood-control.test.ts`
  (node:test) — 30 tests total: DEFAULT_MOMENTS shape/order/icon/macro validity,
  seed-only-when-empty provisioning, create/update shapes + input guards,
  control-state get-or-init + each setter's upsert payload + bad-input guards, and
  the 42P01 graceful-degrade. All pass.

SPEC IMPACT: None — additive data-layer foundation (two new tables behind
control-room-only RLS + helper libs), no schema rename/SKU/pricing/flow change to
any shipped surface. The Panood multicam controller remains an in-build SKU
(single-cam livestream stays FREE; the multicam controller + overlays + moment
director are the paid/future tier).
