-- ============================================================================
-- 20260520010000_iteration_0005_led_background_foundation.sql
--
-- PR 1 of 5 for V1 iteration 0005 LED Background Maker.
-- Spec corpus: 0005_led_background_maker/0005_led_background_maker.md
-- Engineering brief: ENGINEERING_BRIEF.md at the 0005 worktree root
-- CLAUDE.md decision log: 2026-05-18 V1.5+ → V1 promotion row promoted 0005
--                         from deferred to V1; this migration lays the schema.
--
-- Schema foundation for the Renderforest-class LED motion-graphics pipeline:
--   • Couples save their per-template customization JSON to
--     led_background_configs (event-scoped, 10-template enum guard, one
--     default config per event surface).
--   • Each render run lives in led_background_renders with explicit
--     output_resolution + master loop length + R2 output key. Re-renders
--     create new rows so couples can keep older versions until they
--     explicitly delete them (per spec § Functional scope · Re-render).
--
-- Scope explicitly EXCLUDED from this PR (later PRs cover):
--   (a) service_catalog SKU seed (1080p ₱249 / 4K ₱399 / 8K ₱99 / Custom
--       ₱899 + Photo Pool · Ultrawide · Live Playback URL add-ons). The
--       spec's 2026-05-08 pricing table shows 8K cheaper than 1080p which
--       reads like a typo — flagged for owner reconciliation before
--       seeding live SKUs. Skipped here on purpose; lands in PR 1b once
--       pricing is confirmed.
--   (b) Template gallery + editor surface — PR 2 (~3-5d).
--   (c) Remotion render worker on Cloudflare Containers/Queues — PR 3.
--   (d) Delivery flow + USB pack + email template — PRs 4-5.
--
-- Template definitions live in version-controlled
-- /templates/{template_id}/{Composition.tsx,defaults.json,thumb.mp4} — NOT
-- in a DB table. The CHECK on led_background_configs.template_id is the
-- enum guard.
--
-- Backwards compatibility:
--   - All new tables · idempotent (CREATE TABLE IF NOT EXISTS · CREATE INDEX
--     IF NOT EXISTS). No DROP, no destructive change. Safe to re-run.
--   - One default config per event enforced by a partial unique index
--     instead of a row trigger — cheaper, no extra plpgsql surface.
--
-- RLS:
--   - Both tables enable RLS but ship with NO policies in this PR. Server-side
--     service-role writes only until PR 2 wires couple-side reads + writes.
--     Blocks anon/auth reads of config_json (which contains palette + photo
--     overlay choices) until the editor surface lands with proper policies.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. led_background_configs — per-event saved customization
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.led_background_configs (
  config_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL
               REFERENCES public.events(event_id) ON DELETE CASCADE,
  template_id  TEXT NOT NULL CHECK (template_id IN (
                 'filigree_bloom',
                 'capiz_shimmer',
                 'sampaguita_drift',
                 'gold_particles',
                 'ethereal_mist',
                 'bokeh_lights',
                 'watercolor_wash',
                 'slow_pulse',
                 'constellation',
                 'velvet_sweep'
               )),
  config_json  JSONB NOT NULL,
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_led_bg_configs_event
  ON public.led_background_configs(event_id);

-- One default config per event — partial unique index instead of a trigger.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_led_bg_configs_event_default
  ON public.led_background_configs(event_id)
  WHERE is_default = TRUE;

COMMENT ON TABLE public.led_background_configs IS
  '0005 LED Background — couples save per-template customization JSON here. Multiple configs per event allowed; one is is_default=TRUE (enforced by partial unique index). Server-side Zod validators (PR 2+) gate config_json shape per template.';
COMMENT ON COLUMN public.led_background_configs.config_json IS
  '0005 LED Background — customization payload: { background_color, effect_intensity, animation_speed, overlay, loop_duration_s, aspect_ratio, show_couple_names, show_date, plus template-specific extensions }. See spec § config_json schema.';

-- ----------------------------------------------------------------------------
-- 2. led_background_renders — one row per render run
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.led_background_renders (
  render_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id            UUID NOT NULL
                       REFERENCES public.led_background_configs(config_id) ON DELETE CASCADE,
  status               TEXT NOT NULL CHECK (status IN (
                         'queued', 'rendering', 'complete', 'failed'
                       )),
  progress_pct         INTEGER NOT NULL DEFAULT 0
                       CHECK (progress_pct BETWEEN 0 AND 100),
  output_resolution    TEXT NOT NULL CHECK (output_resolution IN (
                         '1080p', '4k', '8k', 'custom'
                       )),
  output_duration_s    INTEGER NOT NULL
                       CHECK (output_duration_s IN (300, 600, 1800, 5400)),
                       -- 5min / 10min default / 30min / 90min custom-tier max.
  loop_seam_validated  BOOLEAN NOT NULL DEFAULT FALSE,
  photo_rotation_seed  INTEGER,
  output_r2_key        TEXT,
  output_size_bytes    BIGINT,
  error_message        TEXT,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_led_bg_renders_config
  ON public.led_background_renders(config_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_led_bg_renders_active
  ON public.led_background_renders(config_id)
  WHERE status IN ('queued', 'rendering');

COMMENT ON TABLE public.led_background_renders IS
  '0005 LED Background — one row per render run. Re-renders create new rows; old renders stay accessible until the couple explicitly deletes them (per spec § Functional scope · Re-render). The 8K/4K/1080p outputs share a single render run (Remotion downscales in one pass); output_resolution distinguishes Custom-tier rows from standard tiers.';
COMMENT ON COLUMN public.led_background_renders.loop_seam_validated IS
  '0005 LED Background — renderer flips this TRUE when the wrap-frame check passes (first vs last frame visual diff under threshold). Used in PR 3 worker to gate render-complete email until the loop is genuinely seamless.';
COMMENT ON COLUMN public.led_background_renders.photo_rotation_seed IS
  '0005 LED Background — random seed for the Photo Pool blend add-on. Stored so a render can be reproduced bit-for-bit if needed.';

ALTER TABLE public.led_background_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.led_background_renders  ENABLE ROW LEVEL SECURITY;
-- No policies in this PR (see header). Server-side service role only.

COMMIT;
