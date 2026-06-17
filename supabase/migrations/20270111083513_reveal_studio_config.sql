-- ============================================================================
-- 20270111083513_reveal_studio_config.sql
-- Admin "Reveal Studio" — the house-default config for the Save-the-Date
-- opening reveal (the bridal-veil / envelope / doors templates).
--
-- Setnayan HQ controls this from /admin/reveal-studio:
--   • the master on/off for the reveal (replaces the NEXT_PUBLIC_STD_REVEAL
--     env flag — a DB toggle instead of a build-time constant)
--   • which reveal templates couples may use + the house default template
--   • per-feature toggles (petals · logo · music)
--   • the veil "look" knobs (default colours, petal density, fold valance,
--     wind, weight, …) — the live slider panel, persisted as JSON
--
-- The whole config lives in a single JSONB column so the slider panel can grow
-- without a migration per knob. The app reads the one row and merges it over
-- the locked code defaults (lib/reveal-config.ts DEFAULT_REVEAL_CONFIG), so a
-- missing/partial row always resolves to the owner-tuned 2026-06-17 defaults.
--
-- Single-row enforcement via CHECK (id = 1), mirroring platform_settings /
-- homepage_hero_config. Read-all RLS (these are public couple-site display
-- settings, not secrets); writes go through the service-role admin client after
-- an application-level is_admin check (see app/admin/reveal-studio/actions.ts).
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.reveal_studio_config (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),

  -- the whole studio config (master enabled, default + allowed templates,
  -- feature toggles, veil look knobs). Shape resolved in lib/reveal-config.ts.
  config               JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_admin_id  UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

INSERT INTO public.reveal_studio_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.reveal_studio_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read — these are public couple-site display settings, not secrets.
-- Writes are admin-only via the service-role client (see the admin actions).
DROP POLICY IF EXISTS reveal_studio_config_read_all ON public.reveal_studio_config;
CREATE POLICY reveal_studio_config_read_all
  ON public.reveal_studio_config FOR SELECT
  TO anon, authenticated
  USING (true);

COMMIT;
