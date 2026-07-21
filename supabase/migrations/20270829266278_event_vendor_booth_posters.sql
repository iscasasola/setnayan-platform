-- Per-event booth POSTER — the vendor's own design for ONE couple's event.
--
-- Owner directive 2026-07-21: "we want a place where they can upload their
-- banner/design for that event, and their official logo will also show."
--
-- Two distinct surfaces, deliberately kept apart:
--   • LOGO   — global, from their account (vendor_profiles.logo_url), already
--              rendered on the 3D booth's BoothSign since v8 lit up tier.
--   • POSTER — per (vendor, event), stored here. Designed FOR that wedding.
--
-- WHY ITS OWN TABLE, not a column on event_vendors: a vendor can hold SEVERAL
-- event_vendors rows for one event (one per booked service/category), but the
-- poster is one artwork per vendor per event. A column would duplicate it N
-- times and leave "which row wins?" undefined. UNIQUE (event_id,
-- vendor_profile_id) states the real cardinality.
--
-- WHY PER-EVENT IS ALSO THE AESTHETIC GUARD: a vendor designing for THIS couple
-- produces a different artifact than one pasting a house ad, so no structured
-- template system is needed to keep a booth from shouting in someone's wedding.
--
-- poster_ref holds the RAW stored ref (r2://bucket/key) exactly like
-- vendor_profiles.logo_url; scene assembly resolves it to a display URL. Not
-- presigned at rest — resolution is the reader's job.

CREATE TABLE IF NOT EXISTS public.event_vendor_booth_posters (
  id                BIGSERIAL PRIMARY KEY,
  event_id          UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- Raw stored ref (r2://bucket/key) or a legacy absolute URL.
  poster_ref        TEXT NOT NULL CHECK (char_length(btrim(poster_ref)) BETWEEN 1 AND 500),
  updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, vendor_profile_id)
);

-- RLS at CREATE TABLE time (house rule).
ALTER TABLE public.event_vendor_booth_posters ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS event_vendor_booth_posters_event_idx
  ON public.event_vendor_booth_posters (event_id);

-- Read: the owning vendor (profile owner or team member) and console admins.
-- The COUPLE needs no policy here — every couple-facing read path goes through
-- a SECURITY DEFINER scene RPC / admin client, matching how booth vendor
-- identity already reaches the 3D surfaces.
-- Writes have NO policy on purpose: they go through vendor_set_booth_poster
-- below, which carries the booked-vendor gate.
DROP POLICY IF EXISTS event_vendor_booth_posters_vendor_read ON public.event_vendor_booth_posters;
CREATE POLICY event_vendor_booth_posters_vendor_read
  ON public.event_vendor_booth_posters FOR SELECT
  USING (
    public.is_admin()
    OR vendor_profile_id IN (
      SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
      UNION
      SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.event_vendor_booth_posters IS
  'One vendor-authored poster per (event, vendor_profile) — the design a booked '
  'vendor uploads FOR that couple''s event, rendered on their 3D booth beside '
  'the account-level logo (vendor_profiles.logo_url). poster_ref is a RAW '
  'stored ref (r2://bucket/key); scene assembly resolves it to a display URL. '
  'Writes go exclusively through vendor_set_booth_poster (booked-vendor gate).';

-- ---------------------------------------------------------------------------
-- vendor_set_booth_poster — the only write path.
--
-- Gate mirrors _cocktail_vendor_caps' first two checks (is a vendor; is BOOKED
-- on this event) but deliberately NOT its cocktail-specific ones: the poster
-- belongs to the vendor's presence at the event, not to the cocktail room, so
-- it must not depend on cocktail_enabled / cocktail_vendor_edit or the
-- arrange/booth category split. A booked vendor with a booth anywhere can dress
-- it.
--
-- p_poster_ref NULL / blank CLEARS the poster (deletes the row) — one entry
-- point for set and clear, so the client needs no second action.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_set_booth_poster(
  p_event_id UUID,
  p_poster_ref TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_ids UUID[];
  v_profile_id  UUID;
  v_ref         TEXT;
BEGIN
  SELECT ARRAY(
    SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid()
    UNION
    SELECT tm.vendor_profile_id FROM public.vendor_team_members tm WHERE tm.user_id = auth.uid()
  ) INTO v_profile_ids;
  IF v_profile_ids IS NULL OR COALESCE(array_length(v_profile_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'not_a_vendor' USING ERRCODE = '42501';
  END IF;

  -- Booked on THIS event — same status set the cocktail gate uses.
  SELECT ev.marketplace_vendor_id INTO v_profile_id
  FROM public.event_vendors ev
  WHERE ev.event_id = p_event_id
    AND ev.marketplace_vendor_id = ANY (v_profile_ids)
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_booked' USING ERRCODE = '42501';
  END IF;

  v_ref := NULLIF(btrim(COALESCE(p_poster_ref, '')), '');

  IF v_ref IS NULL THEN
    DELETE FROM public.event_vendor_booth_posters
    WHERE event_id = p_event_id AND vendor_profile_id = v_profile_id;
    RETURN;
  END IF;

  IF char_length(v_ref) > 500 THEN
    RAISE EXCEPTION 'poster_ref_too_long' USING ERRCODE = '22001';
  END IF;

  INSERT INTO public.event_vendor_booth_posters
    (event_id, vendor_profile_id, poster_ref, updated_by)
  VALUES (p_event_id, v_profile_id, v_ref, auth.uid())
  ON CONFLICT (event_id, vendor_profile_id) DO UPDATE
    SET poster_ref = EXCLUDED.poster_ref,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_set_booth_poster(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_set_booth_poster(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.vendor_set_booth_poster(UUID, TEXT) IS
  'Set (or clear, with NULL/blank) the calling vendor''s per-event booth poster. '
  'SECURITY DEFINER; gate = caller owns/belongs to a vendor_profile AND that '
  'profile is BOOKED on the event (contracted/deposit_paid/delivered/complete). '
  'Deliberately independent of the cocktail-room gates — the poster belongs to '
  'the vendor''s presence at the event, not to one room.';
