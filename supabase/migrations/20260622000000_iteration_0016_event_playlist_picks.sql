-- ============================================================================
-- 20260622000000_iteration_0016_event_playlist_picks.sql
--
-- New table for the Playlist Builder add-on surface · couple-built song
-- list for the booked DJ/band. Free utility · synced to the booked Music
-- vendor's per-vendor workspace so they arrive knowing the lineup.
--
-- Owner directive 2026-05-24 (via AskUserQuestion): "create your song list"
-- = Playlist builder for the DJ/band (NOT Pakanta which is the custom
-- songwriter service). Couple specifies songs they want played at the
-- wedding by slot · processional · first dance · parents dance · cocktail
-- hour · dinner · open floor · banned songs.
--
-- ARCHITECTURE
--
--   /dashboard/[eventId]/add-ons/playlist  → main editor (couple writes)
--   /dashboard/[eventId]/vendors/[vendor]  → booked Music vendor's tab
--                                            shows the playlist read-only
--   /[eventSlug]                           → NOT exposed to guests; this
--                                            is private vendor-coordination
--                                            data, not landing-page content
--
--   Per-event scoped via event_id FK · ON DELETE CASCADE so if the couple
--   nukes the event their picks vanish with it.
--
-- WHY a dedicated table (not stuffed into wizard_state or notes):
--   1. Per-pick row enables drag-reorder + delete + edit per song without
--      JSONB diffing. sort_order is the canonical ordering field.
--   2. The booked Music vendor reads this via RLS · they need a clean
--      SQL surface, not a JSONB pull from wizard_state.
--   3. Future V1.1 extensions (per-song-vote · per-song-pricing if vendor
--      charges extra for niche requests · guest-suggestion mode) all live
--      on this row, not a JSONB blob.
--
-- WHY slot_type as an enum (not free-text):
--   Limits the slot universe to 7 canonical PH-wedding moments — couples
--   don't invent new slots ("during the food fight after dinner"), they
--   pick from the standard timeline. Enum gives Postgres-side type safety
--   + the UI gets a fixed sub-section list to render. Extending the enum
--   is a one-line ALTER TYPE if a new slot ever lands (e.g., 'sangeet' for
--   Indian-PH fusion weddings, 'henna_night' for Muslim cultural variants).
--
-- WHY banned_songs as a slot rather than a boolean column:
--   The host wants to LIST songs they do NOT want played (ex's wedding
--   song · cheesy-90s-ballads · whatever). Modeling as a slot means it
--   renders alongside the want-list with the same edit/delete UX. A
--   boolean `is_banned` would require a separate query path + separate
--   UI section. The slot approach is simpler.
--
-- RLS POSTURE
--   - couple read/write       → event_id IN (current_couple_event_ids())
--                                mirrors event_schedule_blocks RLS pattern
--   - music vendor read       → event_id IN (events where this vendor has
--                                an event_vendors row with category IN
--                                ('band_dj', 'host_emcee', 'choir',
--                                'string_quartet') AND status IN
--                                ('contracted','deposit_paid','delivered',
--                                'complete'))
--                                The vendor reads the playlist as a tab
--                                inside their per-vendor workspace at
--                                /dashboard/[eventId]/vendors/[vendor]
--                                Vendor cannot WRITE — couple-controlled.
--   - NO public read          → playlist data stays private between couple
--                                and booked Music vendor. Day-of guest
--                                pages (per [[Unified QR Code Lifecycle]])
--                                don't surface this.
--
-- IDEMPOTENT · safe to re-run.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- 1. enum: playlist_slot_type · 7 canonical PH-wedding song moments
-- ────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.playlist_slot_type AS ENUM (
    'processional',     -- bride's entrance music
    'ceremony',         -- during the ceremony · recessional · signing
    'cocktail_hour',    -- playlist for the cocktail window
    'first_dance',      -- couple's first dance song
    'parents_dance',    -- father-daughter + mother-son
    'dinner',           -- dinner-music playlist
    'open_floor',       -- main dance floor playlist · DJ set
    'banned_songs'      -- songs the couple does NOT want played
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────────────────
-- 2. table: event_playlist_picks
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_playlist_picks (
  pick_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id          TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('L'),
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  slot_type          public.playlist_slot_type NOT NULL,
  song_label         TEXT NOT NULL CHECK (length(song_label) BETWEEN 1 AND 200),
  artist             TEXT CHECK (artist IS NULL OR length(artist) <= 200),
  notes              TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  sort_order         INTEGER NOT NULL DEFAULT 100,
  created_by_user_id UUID NOT NULL REFERENCES public.users(user_id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_playlist_picks_event_id_idx
  ON public.event_playlist_picks(event_id);

CREATE INDEX IF NOT EXISTS event_playlist_picks_slot_order_idx
  ON public.event_playlist_picks(event_id, slot_type, sort_order);

ALTER TABLE public.event_playlist_picks ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────
-- 3. RLS · couple read + write
-- ────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS event_playlist_picks_couple_read ON public.event_playlist_picks;
CREATE POLICY event_playlist_picks_couple_read
  ON public.event_playlist_picks FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS event_playlist_picks_couple_write ON public.event_playlist_picks;
CREATE POLICY event_playlist_picks_couple_write
  ON public.event_playlist_picks FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()));

-- ────────────────────────────────────────────────────────────────────────
-- 4. RLS · booked Music vendor READ-ONLY
--
-- Vendor must (a) own a vendor_profiles row tied to the authenticated
-- user_id, AND (b) be locked on this event_id via event_vendors with one
-- of the four Music canonical categories AND a non-considering status.
-- ────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS event_playlist_picks_music_vendor_read ON public.event_playlist_picks;
CREATE POLICY event_playlist_picks_music_vendor_read
  ON public.event_playlist_picks FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT ev.event_id
      FROM public.event_vendors ev
      JOIN public.vendor_profiles vp
        ON vp.vendor_profile_id = ev.marketplace_vendor_id
      WHERE vp.user_id = auth.uid()
        AND ev.category IN ('band_dj', 'host_emcee', 'choir', 'string_quartet')
        AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
    )
  );

-- ────────────────────────────────────────────────────────────────────────
-- 5. updated_at trigger
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_event_playlist_picks_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_playlist_picks_updated_at_trigger
  ON public.event_playlist_picks;
CREATE TRIGGER event_playlist_picks_updated_at_trigger
  BEFORE UPDATE ON public.event_playlist_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_event_playlist_picks_set_updated_at();

COMMENT ON TABLE public.event_playlist_picks IS
  'Couple-built song list for the booked DJ/band (2026-05-24 owner directive). Free utility · synced to the booked Music vendor''s per-vendor workspace via the music-vendor-read RLS policy. 7 canonical slot types covering the PH wedding spine + a banned-songs slot for don''t-play requests.';

COMMENT ON COLUMN public.event_playlist_picks.slot_type IS
  'Which moment in the wedding-day timeline this song belongs to. 7 canonical values: processional · ceremony · cocktail_hour · first_dance · parents_dance · dinner · open_floor · banned_songs.';

COMMENT ON COLUMN public.event_playlist_picks.song_label IS
  'Human-readable song title. Couples type free-text; no Spotify/Apple Music lookup in V1 (couples want to see what they typed, not deal with auto-complete misses on obscure OPM tracks). V1.1 may add a Spotify track_id column.';

COMMIT;
