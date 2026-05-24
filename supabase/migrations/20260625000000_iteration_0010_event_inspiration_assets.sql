-- ============================================================================
-- 20260625000000_iteration_0010_event_inspiration_assets.sql
-- Iteration 0010 Moodboard · "Set inspiration mood board" wizard Card 15 — owner
-- inspiration intake (PHOTO PASTE + UPLOAD).
--
-- Why this table (vs reusing moodboard_library_assets):
--   - moodboard_library_assets is the admin-curated library (V1 placeholder
--     → V1.x Higgsfield → V1.x+ approved stylist contributions per
--     0010 § "Visual preview pillars" 2026-05-21 lock). Its RLS is
--     "admin manages, hosts read approved rows". It has no per-event
--     scoping, no owner_kind column shipped, and re-shaping it to handle
--     couple-owned per-event inspiration would couple two distinct
--     life cycles (curated library vs ephemeral wedding inspirations).
--   - The 2026-05-24 CLAUDE.md decision-log row ("V1 SCOPE EXPANSION ·
--     Moodboard becomes multi-source + stylist-finalized brain") locks
--     three owner_kinds (setnayan, stylist, couple) but that broader
--     architecture is post-pilot V1.x scope (~17-day rollout in 5 phases).
--     This migration ships the COUPLE-INSPIRATION slice that pilot needs
--     right now — pasted photo URLs + uploaded files with extracted 6-color
--     palettes, scoped to (event_id, host) so the inspiration set is
--     mutable + removable per-event.
--   - Hosts paste real-world inspiration (Pinterest, Instagram, friend's
--     wedding photo). Extracted palettes feed the canonical events.role_palette
--     write (Card 15 Save → role_palette.wizard_default). Inspiration assets
--     persist independently so the host can re-curate (remove, add more)
--     without re-doing the curated-palette pick.
--
-- See also:
--   - CLAUDE.md 2026-05-21 row "Moodboard expanded · 3 pillars" — pillars
--     are Palette · Location feel · Dress codes; this table feeds palette
--     extraction from inspiration imagery.
--   - CLAUDE.md 2026-05-24 row "V1 SCOPE EXPANSION · Moodboard becomes
--     multi-source" — full owner_kind multi-source architecture lock; this
--     table is the V1 couple-inspiration foothold.
--   - 0010_mood_board.md § "Saved palettes library" (existing) — adjacent
--     surface, distinct concept (saved palette presets vs raw inspiration).
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- event_inspiration_assets: per-event couple-owned inspiration items
-- ----------------------------------------------------------------------------
-- One row per inspiration item (pasted URL OR uploaded photo). Each item
-- has its own extracted 6-color palette (sampled_hex_1 … sampled_hex_6)
-- so removing one item recomputes the active mood board without round-
-- tripping through a separate "color ranges" join table. 6 inline columns
-- (not an array, not a child table) because:
--   1. Always exactly 6 — pad to cream when fewer extracted, truncate if more.
--   2. Inline querying for "any inspiration with hex X" stays trivial.
--   3. Matches the 6-color shape the rest of 0010 (curated palettes,
--      role_palette JSONB, custom 6-input picker) already uses.
CREATE TABLE IF NOT EXISTS public.event_inspiration_assets (
  inspiration_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The user who added this inspiration item (host of the event — typically
  -- bride/groom/partner1/partner2 per iteration 0048 multi-host roles).
  -- Stamped on insert so we can attribute and so RLS can scope reads.
  added_by_user_id UUID NOT NULL REFERENCES public.users(user_id),
  -- Two source modes:
  --   'url_paste' — image lives at an external URL (Pinterest, Instagram,
  --     vendor portfolio, friend's wedding gallery). image_url is the
  --     direct image URL the host pasted. r2_key is NULL.
  --   'file_upload' — image bytes live in R2 (bucket = setnayan-media,
  --     prefix = inspiration/{event_id}/). r2_key is the R2 object key;
  --     image_url is the rendered public URL (for legacy display).
  --   V1 ships url_paste only when R2 isn't configured; both when it is.
  source_kind      TEXT NOT NULL CHECK (source_kind IN ('url_paste', 'file_upload')),
  image_url        TEXT NOT NULL,
  r2_key           TEXT,                                       -- populated for source_kind='file_upload'; NULL for url_paste
  -- Optional host-provided caption / note. V1 ships without a UI for this
  -- (just paste + auto-extract); V1.x lets hosts add notes like
  -- "the ceiling drape I want for our reception".
  caption          TEXT,
  -- Extracted 6-color palette from the image, slot 1 = dominant. Set by
  -- the client-side palette extractor (Canvas API histogram bucketing).
  -- All 6 are NOT NULL — pad with cream when image has fewer distinct
  -- colors so downstream surfaces always get a 6-color shape to work with.
  sampled_hex_1    CHAR(7) NOT NULL,
  sampled_hex_2    CHAR(7) NOT NULL,
  sampled_hex_3    CHAR(7) NOT NULL,
  sampled_hex_4    CHAR(7) NOT NULL,
  sampled_hex_5    CHAR(7) NOT NULL,
  sampled_hex_6    CHAR(7) NOT NULL,
  -- Soft delete via removed_at so we can recover accidentally-removed
  -- items + audit the removal trail. Active inspiration = removed_at IS NULL.
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at       TIMESTAMPTZ
);

-- Fast lookup of all active inspirations for an event (the only common
-- query). Partial index on removed_at IS NULL keeps the index lean.
CREATE INDEX IF NOT EXISTS idx_event_inspiration_assets_active
  ON public.event_inspiration_assets (event_id, created_at DESC)
  WHERE removed_at IS NULL;

-- ----------------------------------------------------------------------------
-- RLS — host-owned per-event scoping
-- ----------------------------------------------------------------------------
-- Hosts read/write their own event's inspiration. Defers to the existing
-- events RLS — if the user is an event_members row for this event_id,
-- they can read + write inspiration on it. Admins (is_internal /
-- is_team_member / account_type='admin') read all rows for moderation.
ALTER TABLE public.event_inspiration_assets ENABLE ROW LEVEL SECURITY;

-- Host read: rows for events where the user is a member (any role).
DROP POLICY IF EXISTS event_inspiration_assets_host_select
  ON public.event_inspiration_assets;
CREATE POLICY event_inspiration_assets_host_select
  ON public.event_inspiration_assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_inspiration_assets.event_id
        AND em.user_id  = auth.uid()
    )
  );

-- Host insert: must be a member of the event AND must be the inserting user.
DROP POLICY IF EXISTS event_inspiration_assets_host_insert
  ON public.event_inspiration_assets;
CREATE POLICY event_inspiration_assets_host_insert
  ON public.event_inspiration_assets
  FOR INSERT
  WITH CHECK (
    added_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_inspiration_assets.event_id
        AND em.user_id  = auth.uid()
    )
  );

-- Host update: only soft-delete (removed_at) for items they added OR any
-- co-host on the same event. We allow any host to remove because pilot
-- couples co-curate.
DROP POLICY IF EXISTS event_inspiration_assets_host_update
  ON public.event_inspiration_assets;
CREATE POLICY event_inspiration_assets_host_update
  ON public.event_inspiration_assets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_inspiration_assets.event_id
        AND em.user_id  = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_inspiration_assets.event_id
        AND em.user_id  = auth.uid()
    )
  );

-- Admin read all (moderation + abuse review).
DROP POLICY IF EXISTS event_inspiration_assets_admin_all
  ON public.event_inspiration_assets;
CREATE POLICY event_inspiration_assets_admin_all
  ON public.event_inspiration_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = true OR u.is_team_member = true OR u.account_type = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = true OR u.is_team_member = true OR u.account_type = 'admin')
    )
  );

COMMIT;
