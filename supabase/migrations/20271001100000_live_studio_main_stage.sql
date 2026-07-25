-- live_studio_main_stage — the switching state for the unified Live Studio
-- controller (owner 2026-07-25: merge Cast + Roam into ONE "Live Studio" product
-- with a switching-based controller; see Live_Studio_Unified_Spec_2026-07-25.md).
--
-- MODEL: the unified product is a directed **Main Stage** (channel 1) plus the
-- existing switchable guest cameras (the Roam zones). "Cut to Main Stage" is a
-- one-tap directing action that re-points the Main Stage output at one camera —
-- switching only, NO server-side compositing/PiP (explicit V1 non-goal). This
-- adds the persisted "which zone is currently cut to Main Stage" pointer.
--
-- It is a SINGLE additive boolean on the EXISTING live_studio_roam_zones control
-- table (migration 20270919193341) — the Roam substrate the unified product is
-- built on. At most one zone per event carries is_main_stage=true (the current
-- cut); the controller clears the rest when it cuts, mirroring the is_featured
-- "one default at a time" pattern already on this table. The public picker reads
-- the mirrored non-secret field via events.live_studio_roam_manifest (a later
-- provisioning mirror stamps it); the viewer falls back to the featured zone when
-- nothing is cut, so Main Stage always has a source.
--
-- RLS is UNCHANGED: the zones table already carries the couple+coordinator+admin
-- policy (live_studio_roam_zones_couple_full), which covers this new column — no
-- new policy needed. Everything stays flag-dark behind
-- NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED (nothing reads is_main_stage until the
-- unified controller/viewer, which are all flag-gated).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Re-running is a no-op.

ALTER TABLE public.live_studio_roam_zones
  ADD COLUMN IF NOT EXISTS is_main_stage boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.live_studio_roam_zones.is_main_stage IS
  'Unified Live Studio: the zone currently CUT to the directed Main Stage output (at most one true per event; the controller clears the rest on a cut). Switching only — no compositing. Mirrored to the public picker via events.live_studio_roam_manifest; the viewer falls back to the featured zone when none is cut. lib/live-studio-roam.ts.';
