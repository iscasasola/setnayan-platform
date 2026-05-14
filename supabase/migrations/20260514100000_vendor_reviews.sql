-- ============================================================================
-- 20260514100000_vendor_reviews.sql
-- Phase 2 — Public marketplace + reviews infrastructure.
--
-- Couples leave a review of a vendor once that vendor's service has been
-- marked delivered/complete on the couple's event_vendors row. Reviews are
-- public (anyone, including anon, can read them) and weight the marketplace
-- sort. Vendors can post a one-time public reply per review.
--
-- This migration adds:
--   1. `vendor_reviews` — one row per (vendor_profile, event, couple) tuple.
--      5-axis ratings (overall, communication, quality, value, on-time) +
--      free-text body + optional one-time vendor_reply.
--   2. RLS:
--        • Public SELECT for everyone (anon + authenticated)
--        • Couple INSERT only when they own the event AND a matching
--          event_vendors row exists with status in ('delivered','complete')
--        • Couple UPDATE limited to their own row, body/ratings editable
--          (V1 lets couples fix typos; vendor_reply column is locked to the
--          vendor via WITH CHECK below)
--        • Vendor UPDATE only to set vendor_reply once (locked once set)
--   3. `vendor_review_stats` — materialized view with avg rating, total,
--      per-star counts. Refreshed by trigger on INSERT/UPDATE/DELETE.
--   4. `notification_type` enum gets a new `review_request` value so the
--      review-request notification from the post-delivered emit type-checks
--      against the existing notifications table.
--   5. `vendor_profiles` gains a public SELECT policy so the marketplace can
--      read published vendor cards without the service-role client. The
--      existing owner-only policy still covers owner edit/read of
--      unpublished rows.
--
-- Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. notification_type — add review_request
--    ALTER TYPE … ADD VALUE cannot run inside an explicit transaction block,
--    so this part lives outside the BEGIN/COMMIT below. IF NOT EXISTS keeps
--    the migration idempotent.
-- ----------------------------------------------------------------------------

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_request';

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_reviews
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_reviews (
  review_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id            TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('R'),
  vendor_profile_id    UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id             UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  couple_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating_overall       SMALLINT NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_communication SMALLINT NOT NULL CHECK (rating_communication BETWEEN 1 AND 5),
  rating_quality       SMALLINT NOT NULL CHECK (rating_quality BETWEEN 1 AND 5),
  rating_value         SMALLINT NOT NULL CHECK (rating_value BETWEEN 1 AND 5),
  rating_on_time       SMALLINT NOT NULL CHECK (rating_on_time BETWEEN 1 AND 5),
  body                 TEXT,
  vendor_reply         TEXT,
  vendor_reply_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (body IS NULL OR length(body) <= 4000),
  CHECK (vendor_reply IS NULL OR length(vendor_reply) <= 2000),
  -- A couple can only review a given vendor once per event.
  UNIQUE (vendor_profile_id, event_id, couple_user_id)
);

CREATE INDEX IF NOT EXISTS vendor_reviews_vendor_profile_id_idx
  ON public.vendor_reviews(vendor_profile_id);
CREATE INDEX IF NOT EXISTS vendor_reviews_event_id_idx
  ON public.vendor_reviews(event_id);
CREATE INDEX IF NOT EXISTS vendor_reviews_couple_user_id_idx
  ON public.vendor_reviews(couple_user_id) WHERE couple_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendor_reviews_created_at_idx
  ON public.vendor_reviews(created_at DESC);

ALTER TABLE public.vendor_reviews ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. RLS — vendor_reviews
-- ----------------------------------------------------------------------------

-- Public read: anyone (including anon) can read all review rows. The columns
-- the marketplace + landing page surface are the rating fields + body +
-- vendor_reply + created_at; we don't expose couple_user_id by column-level
-- policy (handled in the lib by selecting only the safe columns).
DROP POLICY IF EXISTS vendor_reviews_public_read ON public.vendor_reviews;
CREATE POLICY vendor_reviews_public_read
  ON public.vendor_reviews FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Couple INSERT: must own the event AND the vendor must have a
-- delivered/complete event_vendors row on that same event.
DROP POLICY IF EXISTS vendor_reviews_couple_insert ON public.vendor_reviews;
CREATE POLICY vendor_reviews_couple_insert
  ON public.vendor_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    couple_user_id = auth.uid()
    AND event_id IN (SELECT public.current_couple_event_ids())
    AND EXISTS (
      SELECT 1 FROM public.event_vendors ev
      WHERE ev.event_id = vendor_reviews.event_id
        AND ev.status IN ('delivered', 'complete')
    )
  );

-- Couple UPDATE: can edit their own ratings + body, but not vendor_reply.
-- The WITH CHECK enforces vendor_reply stays NULL when the couple updates.
DROP POLICY IF EXISTS vendor_reviews_couple_update ON public.vendor_reviews;
CREATE POLICY vendor_reviews_couple_update
  ON public.vendor_reviews FOR UPDATE
  TO authenticated
  USING (couple_user_id = auth.uid())
  WITH CHECK (
    couple_user_id = auth.uid()
    AND vendor_reply IS NULL
    AND vendor_reply_at IS NULL
  );

-- Couple DELETE: lets a couple retract a review they posted by mistake. V1
-- only — admin moderation is a follow-on.
DROP POLICY IF EXISTS vendor_reviews_couple_delete ON public.vendor_reviews;
CREATE POLICY vendor_reviews_couple_delete
  ON public.vendor_reviews FOR DELETE
  TO authenticated
  USING (couple_user_id = auth.uid());

-- Vendor UPDATE: only the vendor profile owner can post a reply, and only
-- once (vendor_reply column is locked once non-null per the trigger below).
DROP POLICY IF EXISTS vendor_reviews_vendor_reply ON public.vendor_reviews;
CREATE POLICY vendor_reviews_vendor_reply
  ON public.vendor_reviews FOR UPDATE
  TO authenticated
  USING (
    vendor_profile_id IN (
      SELECT vp.vendor_profile_id FROM public.vendor_profiles vp
      WHERE vp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_profile_id IN (
      SELECT vp.vendor_profile_id FROM public.vendor_profiles vp
      WHERE vp.user_id = auth.uid()
    )
  );

-- Lock vendor_reply once set. The trigger keeps the column immutable after
-- the first non-null write — applies regardless of who is doing the update,
-- so vendor edits and couple edits both bounce.
CREATE OR REPLACE FUNCTION public.lock_vendor_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.vendor_reply IS NOT NULL
     AND (NEW.vendor_reply IS DISTINCT FROM OLD.vendor_reply
          OR NEW.vendor_reply_at IS DISTINCT FROM OLD.vendor_reply_at) THEN
    RAISE EXCEPTION 'vendor_reply is locked once set';
  END IF;
  -- Stamp vendor_reply_at when the reply is first written and the action
  -- didn't supply a timestamp explicitly.
  IF NEW.vendor_reply IS NOT NULL AND OLD.vendor_reply IS NULL
     AND NEW.vendor_reply_at IS NULL THEN
    NEW.vendor_reply_at := NOW();
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_reviews_lock_reply ON public.vendor_reviews;
CREATE TRIGGER vendor_reviews_lock_reply
  BEFORE UPDATE ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.lock_vendor_reply();

-- ----------------------------------------------------------------------------
-- 3. vendor_review_stats — materialized view + refresh trigger
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_review_stats;
CREATE MATERIALIZED VIEW public.vendor_review_stats AS
SELECT
  vp.vendor_profile_id,
  COALESCE(AVG(vr.rating_overall)::NUMERIC(3,2), 0) AS avg_rating_overall,
  COUNT(vr.review_id)::INT AS total_count,
  COUNT(*) FILTER (WHERE vr.rating_overall = 5)::INT AS count_5_star,
  COUNT(*) FILTER (WHERE vr.rating_overall = 4)::INT AS count_4_star,
  COUNT(*) FILTER (WHERE vr.rating_overall = 3)::INT AS count_3_star,
  COUNT(*) FILTER (WHERE vr.rating_overall = 2)::INT AS count_2_star,
  COUNT(*) FILTER (WHERE vr.rating_overall = 1)::INT AS count_1_star
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_reviews vr ON vr.vendor_profile_id = vp.vendor_profile_id
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_review_stats_vendor_profile_id_uidx
  ON public.vendor_review_stats(vendor_profile_id);

-- Refresh trigger — concurrent so reads aren't blocked. Returns the trigger
-- payload so we can wire it to AFTER INSERT/UPDATE/DELETE in one shot.
CREATE OR REPLACE FUNCTION public.refresh_vendor_review_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.vendor_review_stats;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- A failing refresh must not roll back the underlying review write.
  RAISE WARNING 'refresh_vendor_review_stats failed: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS vendor_reviews_refresh_stats ON public.vendor_reviews;
CREATE TRIGGER vendor_reviews_refresh_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_vendor_review_stats();

-- Anon role must SELECT the view for the public marketplace to render
-- without going through service-role.
GRANT SELECT ON public.vendor_review_stats TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. vendor_profiles — public read for published rows
-- ----------------------------------------------------------------------------

-- The owner policy stays as-is. We add a public SELECT scoped to is_published
-- so anon + authenticated browsers can read the marketplace cards directly.
DROP POLICY IF EXISTS vendor_profiles_public_read ON public.vendor_profiles;
CREATE POLICY vendor_profiles_public_read
  ON public.vendor_profiles FOR SELECT
  TO anon, authenticated
  USING (is_published = TRUE);

COMMIT;
