-- ============================================================================
-- Feature Reviews — App Store-style ratings for couple-facing add-ons.
--
-- Sibling of `vendor_reviews`. Where vendor_reviews rates a *vendor* on a
-- specific event, feature_reviews rates a *Setnayan feature* (the add-on
-- itself — Panood, Papic, Mood Board, etc.) the couple actually used on
-- their event. Surfaced on the add-on App Store detail page, aggregated
-- into the stat carousel, and linked from the "Ratings & Reviews ›" deep
-- link to `/dashboard/[eventId]/add-ons/[addon]/reviews`.
--
-- Source of truth: this migration + the App Store detail page rollout
-- (decision log 2026-05-17). Idempotent: re-runnable without drops on
-- existing data; RLS policies are DROP-then-CREATE.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. feature_reviews table
--
-- feature_key is a free-form text column — one row per add-on key in the
-- launcher manifest (see apps/web/app/dashboard/[eventId]/add-ons/page.tsx).
-- We deliberately do NOT enum this so a new iteration can register a
-- feature_key with zero schema churn.
--
-- A couple can review a given feature once per event; the UNIQUE constraint
-- enforces that. couple_user_id is nullable so that a couple deleting their
-- account does NOT scrub the rating numbers other couples are reading.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.feature_reviews (
  review_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id       TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('F'),
  feature_key     TEXT NOT NULL CHECK (length(feature_key) BETWEEN 1 AND 64),
  event_id        UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  couple_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (body IS NULL OR length(body) <= 4000),
  UNIQUE (feature_key, event_id, couple_user_id)
);

CREATE INDEX IF NOT EXISTS feature_reviews_feature_key_idx
  ON public.feature_reviews(feature_key);
CREATE INDEX IF NOT EXISTS feature_reviews_event_id_idx
  ON public.feature_reviews(event_id);
CREATE INDEX IF NOT EXISTS feature_reviews_created_at_idx
  ON public.feature_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS feature_reviews_rating_idx
  ON public.feature_reviews(feature_key, rating);

ALTER TABLE public.feature_reviews ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. RLS — public read, couple-only write tied to event ownership.
--
-- Purchase-gating ("must own at least one paid order against this feature")
-- is enforced in the app layer at write time, not via RLS. RLS guarantees
-- the couple owns the event; the app guarantees they used the feature.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS feature_reviews_public_read ON public.feature_reviews;
CREATE POLICY feature_reviews_public_read
  ON public.feature_reviews FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS feature_reviews_couple_insert ON public.feature_reviews;
CREATE POLICY feature_reviews_couple_insert
  ON public.feature_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    couple_user_id = auth.uid()
    AND event_id IN (SELECT public.current_couple_event_ids())
  );

DROP POLICY IF EXISTS feature_reviews_couple_update ON public.feature_reviews;
CREATE POLICY feature_reviews_couple_update
  ON public.feature_reviews FOR UPDATE
  TO authenticated
  USING (couple_user_id = auth.uid())
  WITH CHECK (
    couple_user_id = auth.uid()
    AND event_id IN (SELECT public.current_couple_event_ids())
  );

DROP POLICY IF EXISTS feature_reviews_couple_delete ON public.feature_reviews;
CREATE POLICY feature_reviews_couple_delete
  ON public.feature_reviews FOR DELETE
  TO authenticated
  USING (couple_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_feature_reviews_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_reviews_set_updated_at ON public.feature_reviews;
CREATE TRIGGER feature_reviews_set_updated_at
  BEFORE UPDATE ON public.feature_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_feature_reviews_set_updated_at();

COMMIT;
