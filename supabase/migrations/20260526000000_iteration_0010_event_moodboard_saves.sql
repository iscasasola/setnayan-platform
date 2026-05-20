-- ============================================================================
-- 20260526000000_iteration_0010_event_moodboard_saves.sql
-- Iteration 0010 Moodboard — host-side save/lock mechanism for the
-- Visual preview pillars (Locked 2026-05-21 in 0010 § "Save / lock mechanism").
--
-- Hosts persist (pillar, pillar_slot, asset_id, palette_snapshot) pairings as
-- the event's pinned moodboard state. "Locked" = pinned current state, NOT
-- immutable — hosts can swap to a different asset, edit their palette, and
-- re-save anytime. Palette snapshot captured at save time triggers a re-render prompt
-- on the UI if the master palette shifts later.
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_moodboard_saves (
  save_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  pillar             TEXT NOT NULL CHECK (pillar IN ('location_feel', 'dress_codes')),
  pillar_slot        TEXT NOT NULL,                                     -- 'reception' | 'church' | 'cocktail' for location; 'bride' | 'bridesmaid' | 'guests' | etc. for dress codes
  asset_id           UUID NOT NULL REFERENCES public.moodboard_library_assets(asset_id),
  palette_snapshot   JSONB NOT NULL,                                    -- frozen palette at save time: { "1": "#a83b2d", "2": "#0e7f6a", ... }
  saved_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, pillar, pillar_slot)
);

CREATE INDEX IF NOT EXISTS idx_event_moodboard_saves_event
  ON public.event_moodboard_saves(event_id, saved_at DESC);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.event_moodboard_saves ENABLE ROW LEVEL SECURITY;

-- Host (event member) can manage their event's saves
DROP POLICY IF EXISTS event_moodboard_saves_owner_all ON public.event_moodboard_saves;
CREATE POLICY event_moodboard_saves_owner_all ON public.event_moodboard_saves
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = event_moodboard_saves.event_id
        AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members m
      WHERE m.event_id = event_moodboard_saves.event_id
        AND m.user_id = auth.uid()
    )
  );

-- Admin can read all saves (for support / debugging)
DROP POLICY IF EXISTS event_moodboard_saves_admin_read ON public.event_moodboard_saves;
CREATE POLICY event_moodboard_saves_admin_read ON public.event_moodboard_saves
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = auth.uid()
        AND (u.is_internal = true OR u.is_team_member = true OR u.account_type = 'admin')
    )
  );

COMMIT;
