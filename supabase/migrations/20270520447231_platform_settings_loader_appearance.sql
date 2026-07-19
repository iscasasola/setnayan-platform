-- ============================================================================
-- 20270520447231_platform_settings_loader_appearance.sql
--
-- Admin-configurable loading animation (owner 2026-07-05). Lets an internal
-- admin pick, from /admin/settings, how the shared brand loader (<SDLoader> +
-- the boot splash + the app-wide blocking overlay) looks and behaves:
--
--   - loader_variant         one of three visual treatments of the SAME mark:
--                              'gather' (particles + twin orbit · the shipped
--                              default), 'aurora' (a slow champagne sweep behind
--                              the mark), 'pulse' (concentric sonar rings).
--   - loader_veil_opacity    solidity of the blocking overlay veil (70–100%) —
--                              how much of the page behind a blocking action
--                              shows through.
--   - loader_step_interval_ms narration cadence (800–3000 ms) — how fast the
--                              status line advances.
--   - loader_pop_enabled     the tap-to-pop micro-interaction (a small gold
--                              mote burst + ripple on pointer-down over the mark).
--
-- Stored on the platform_settings singleton (id=1). RLS already enabled on the
-- table (public read / service-role write) — these columns inherit it, no new
-- policy needed. Additive + idempotent; the reader (lib/loader-settings.ts)
-- degrades to the DEFAULT config if this migration hasn't been applied yet.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS loader_variant TEXT NOT NULL DEFAULT 'gather'
    CHECK (loader_variant IN ('gather','aurora','pulse')),
  ADD COLUMN IF NOT EXISTS loader_veil_opacity INTEGER NOT NULL DEFAULT 90
    CHECK (loader_veil_opacity BETWEEN 70 AND 100),
  ADD COLUMN IF NOT EXISTS loader_step_interval_ms INTEGER NOT NULL DEFAULT 1500
    CHECK (loader_step_interval_ms BETWEEN 800 AND 3000),
  ADD COLUMN IF NOT EXISTS loader_pop_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.platform_settings.loader_variant IS
  'Loading-animation variant for the shared <SDLoader>: gather (particles+orbit, default) | aurora (champagne sweep) | pulse (sonar rings). Read cached in lib/loader-settings.ts, threaded to the client via LoaderConfigProvider.';
COMMENT ON COLUMN public.platform_settings.loader_veil_opacity IS
  'Solidity (70–100%) of the app-wide blocking overlay veil (.sd-overlay background), exposed as the --sd-veil CSS var on <html>. Lower = more of the page shows through.';
COMMENT ON COLUMN public.platform_settings.loader_step_interval_ms IS
  'Narration cadence (800–3000 ms) — how fast the loader status line advances. Default stepIntervalMs for <SDLoader> when a caller does not pass one.';
COMMENT ON COLUMN public.platform_settings.loader_pop_enabled IS
  'Tap-to-pop micro-interaction on the loader mark (gold mote burst + ripple on pointer-down). TRUE = on. Silently no-ops under prefers-reduced-motion.';

COMMIT;
