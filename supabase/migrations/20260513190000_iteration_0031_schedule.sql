-- ============================================================================
-- 20260513190000_iteration_0031_schedule.sql
-- Iteration 0031 Day-of-Guest MVP — event schedule blocks.
--
-- Couples define a timeline of their wedding day (ceremony, cocktails,
-- reception, dinner, dancing, send-off). Guests see the same schedule on
-- their personal invitation site at /[slug], with a "happening now"
-- highlight that updates client-side every minute.
--
-- Pattern B RLS for couple-side writes; public read for the invitation
-- site goes through the existing public-render flow which uses the anon
-- key. Adds a separate read policy granting anon SELECT on rows whose
-- is_public flag is TRUE.
--
-- Deferred:
--   • Guest message wall + photo wall (waits on R2 upload UI)
--   • Live status banner the couple can broadcast
--   • Per-block RSVP (currently `invited_to_blocks` on guests captures
--     a subset of this; full mapping is a follow-on)
--
-- Idempotent.
-- ============================================================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE public.schedule_block_type AS ENUM (
    'pre_ceremony',
    'ceremony',
    'cocktails',
    'reception',
    'dinner',
    'program',
    'dancing',
    'send_off',
    'after_party',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.event_schedule_blocks (
  block_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id       TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('K'),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  label           TEXT NOT NULL CHECK (length(label) > 0 AND length(label) <= 120),
  block_type      public.schedule_block_type NOT NULL DEFAULT 'custom',
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  location        TEXT,
  notes           TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at IS NULL OR end_at > start_at)
);

CREATE INDEX IF NOT EXISTS event_schedule_blocks_event_id_idx
  ON public.event_schedule_blocks(event_id);
CREATE INDEX IF NOT EXISTS event_schedule_blocks_start_at_idx
  ON public.event_schedule_blocks(start_at);

ALTER TABLE public.event_schedule_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_schedule_blocks_couple_read ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_couple_read
  ON public.event_schedule_blocks FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_schedule_blocks_couple_write ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_couple_write
  ON public.event_schedule_blocks FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- Public visibility: anon role can SELECT only is_public=true rows. The
-- /[slug] invitation site reads via the anon-key supabase client; this
-- lets it fetch the schedule without an authenticated session.
DROP POLICY IF EXISTS event_schedule_blocks_public_read ON public.event_schedule_blocks;
CREATE POLICY event_schedule_blocks_public_read
  ON public.event_schedule_blocks FOR SELECT
  TO anon
  USING (is_public = TRUE);

COMMIT;
