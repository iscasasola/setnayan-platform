-- drop_retired_mood_board_render_schema
--
-- Mood Board "Make it real" renders were retired by 20271289025011 (owner
-- 2026-10-26: "mood board render is no longer available. can we delete
-- that?"), which deleted every app caller and left the schema in place because
-- two tables held rows. The owner then APPROVED DROPPING the schema and erasing
-- those two rows (2026-10-26, "Yes to all") — both on his own event:
--   event_render_credit_grants  → 1 row, a free 'consent_bonus' credit (no order)
--   event_render_share_consent  → 1 row, the owner's own consent, withdrawn
--
-- Measured on prod 2026-10-26 before writing this (read-only):
--   event_renders 0 · event_render_credit_usage 0 · moodboard_render_config 1 (the
--   config row) · event_inspiration_assets WHERE source_render_id IS NOT NULL → 0 ·
--   WHERE source_kind ILIKE '%render%' → 0.
--   Every OTHER object naming one of these (pg_proc bodies, pg_policies, pg_views,
--   FKs, triggers, cron.job): only event_inspiration_assets'
--   source_render_id FK (dropped below) and a COMMENT inside
--   colour_access_caller_is_couple's body that names moodboard_render_caller_may_act
--   (plpgsql — a comment is not a call; the function does not call it).
--   No app code calls any of these (lib/mood-board-renders-are-retired.test.ts).
--
-- ORDER: the one live table's link first (event_inspiration_assets — the Mood
-- Board's inspiration board, which stays), then the functions (all plpgsql /
-- SECURITY DEFINER, no pg_depend edges, so any order works), then the tables
-- children-first. Every statement IF EXISTS, so a re-apply is a no-op.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. `deploy-prod.yml` runs
-- `supabase db push --include-all --yes` on merge.

-- ── 1 · event_inspiration_assets: the "picked from a shared render" provenance ──
-- MB9's third provenance (20271202349564). Zero rows use it. The biconditional
-- CHECK goes first (it names the column), then the FK, then the column.
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_render_pick_has_provenance;
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_render_id_fkey;
ALTER TABLE public.event_inspiration_assets
  DROP COLUMN IF EXISTS source_render_id;

-- 'render_pick' leaves the vocabulary with its provenance — without the CHECK
-- above it would be a kind nobody can explain. Re-listed from its LATEST
-- definition (20271279311294, _v4), every other value kept.
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_kind_check_v4;
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_source_kind_check_v5;
ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_source_kind_check_v5
  CHECK (source_kind IN ('url_paste', 'file_upload', 'gallery_pick', 'supplier_suggestion'));

-- ── 2 · the render functions (signatures as live on prod 2026-10-26) ──────────
DROP FUNCTION IF EXISTS public.moodboard_begin_render(uuid, text, text, jsonb, text, integer, text, uuid[]);
DROP FUNCTION IF EXISTS public.moodboard_finish_render(uuid, text);
DROP FUNCTION IF EXISTS public.moodboard_fail_render(uuid, text);
DROP FUNCTION IF EXISTS public.moodboard_reserve_render_credits(uuid, integer);
DROP FUNCTION IF EXISTS public.moodboard_release_render_credits(uuid, integer);
DROP FUNCTION IF EXISTS public.moodboard_render_balance(uuid);
DROP FUNCTION IF EXISTS public.moodboard_set_share_consent(uuid, boolean);
DROP FUNCTION IF EXISTS public.moodboard_set_render_featured(uuid, boolean);
DROP FUNCTION IF EXISTS public.moodboard_set_render_reuse_blocked(uuid, boolean);
DROP FUNCTION IF EXISTS public.moodboard_admin_all_renders(integer, integer);
DROP FUNCTION IF EXISTS public.moodboard_attach_gallery_copy(uuid, text);
DROP FUNCTION IF EXISTS public.moodboard_inspiration_pool(uuid, text[], integer, integer, uuid);
DROP FUNCTION IF EXISTS public.moodboard_render_caller_may_view(uuid);
DROP FUNCTION IF EXISTS public.moodboard_render_caller_may_act(uuid);

-- ── 3 · the render tables, children first (their RLS policies go with them) ───
DROP TABLE IF EXISTS public.event_render_credit_usage;
DROP TABLE IF EXISTS public.event_render_credit_grants;
DROP TABLE IF EXISTS public.event_render_share_consent;
DROP TABLE IF EXISTS public.event_renders;
DROP TABLE IF EXISTS public.moodboard_render_config;
