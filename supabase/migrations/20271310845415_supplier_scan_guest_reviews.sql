-- supplier scan guest reviews
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- 🎟⭐ THE SUPPLIER CLAIM SCANNER — slice 5: A GUEST'S OPTIONAL REVIEW AFTER "RECEIVED".
--
-- Owner ruling (DECISION_LOG 2026-09-25 "AFTER A GUEST RECEIVES A SUPPLIER'S ITEM, AN OPTIONAL REVIEW CAN POP UP ON
-- THEIR EVENT HUB"): *"after they receive the product, a review can pop up for the guest to fill up?"* → *"optional to
-- respond"*. ⇒ 1–5 stars + an optional line; skippable; ONE per guest per supplier service (not per unlimited scan);
-- verified by a real claim; the supplier never sees who wrote it; guest reviews are NEW and need their own store +
-- admin moderation (reuse admin/reviews).
--
-- ⭐ SEPARATE FROM THE COUPLE REVIEWS (owner 2026-11-05: "separate", the ruling's own recommendation). Only a rating
-- Setnayan PUBLISHED reaches the supplier's public page, in its own "Guest ratings" section — never merged into the
-- couple reviews' average, never naming the guest or the event (read server-side; no public grant on this table).
--
--   · supplier_scan_reviews: one row per (event, service, guest) — a rating, or a skip ("Not now" is an answer too,
--     so the card never asks twice); state pending → published | hidden, set by Setnayan admin;
--   · written ONLY by supplier_scan_review_submit(event, guest, service, stars, line) — SERVICE ROLE ONLY: a guest is
--     not an RLS user; the app calls it with the guest id from their verified pass, never from the browser. It
--     refuses unless that guest has a RECEIVED claim for that service at that event (a supplier claim, or the couple's
--     souvenir row a supplier's scanner wrote);
--   · RLS at CREATE: Setnayan admin reads and moderates. No supplier, couple or anon access at all.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.supplier_scan_reviews (
  review_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL,
  guest_id           UUID NOT NULL,
  coverage_id        BIGINT NOT NULL REFERENCES public.vendor_coverages (id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE CASCADE,
  stars              SMALLINT CHECK (stars IS NULL OR stars BETWEEN 1 AND 5),
  line               TEXT CHECK (line IS NULL OR char_length(line) <= 140),
  skipped            BOOLEAN NOT NULL DEFAULT FALSE,
  state              TEXT NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderated_at       TIMESTAMPTZ,
  moderated_by_user_id       UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  FOREIGN KEY (event_id, guest_id) REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE,
  UNIQUE (event_id, coverage_id, guest_id)
);

ALTER TABLE public.supplier_scan_reviews DROP CONSTRAINT IF EXISTS supplier_scan_reviews_state_check;
ALTER TABLE public.supplier_scan_reviews
  ADD CONSTRAINT supplier_scan_reviews_state_check CHECK (state IN ('pending', 'published', 'hidden'));
-- A skip carries no rating; a rating is never a skip.
ALTER TABLE public.supplier_scan_reviews DROP CONSTRAINT IF EXISTS supplier_scan_reviews_rating_or_skip;
ALTER TABLE public.supplier_scan_reviews
  ADD CONSTRAINT supplier_scan_reviews_rating_or_skip
  CHECK ((skipped AND stars IS NULL AND line IS NULL) OR (NOT skipped AND stars IS NOT NULL));

CREATE INDEX IF NOT EXISTS supplier_scan_reviews_vendor_idx ON public.supplier_scan_reviews (vendor_profile_id, state);
CREATE INDEX IF NOT EXISTS supplier_scan_reviews_coverage_idx ON public.supplier_scan_reviews (coverage_id);
CREATE INDEX IF NOT EXISTS supplier_scan_reviews_guest_idx ON public.supplier_scan_reviews (guest_id);
CREATE INDEX IF NOT EXISTS supplier_scan_reviews_pending_idx ON public.supplier_scan_reviews (created_at DESC) WHERE state = 'pending' AND NOT skipped;
CREATE INDEX IF NOT EXISTS supplier_scan_reviews_moderator_idx
  ON public.supplier_scan_reviews (moderated_by_user_id) WHERE moderated_by_user_id IS NOT NULL;

ALTER TABLE public.supplier_scan_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supplier_scan_reviews FROM anon;
-- Written only by supplier_scan_review_submit (service role); admin keeps SELECT + UPDATE (moderation, by policy).
REVOKE INSERT, DELETE ON public.supplier_scan_reviews FROM authenticated;

DROP POLICY IF EXISTS supplier_scan_reviews_admin_read ON public.supplier_scan_reviews;
CREATE POLICY supplier_scan_reviews_admin_read ON public.supplier_scan_reviews
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS supplier_scan_reviews_admin_moderate ON public.supplier_scan_reviews;
CREATE POLICY supplier_scan_reviews_admin_moderate ON public.supplier_scan_reviews
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

COMMENT ON TABLE public.supplier_scan_reviews IS
  'A guest''s optional review of a supplier service after a RECEIVED scanner claim: 1–5 stars + an optional line, or a skip. One per guest per service per event. Written only by supplier_scan_review_submit (service role); moderated by Setnayan admin (pending → published | hidden). Published ratings show on the supplier''s public page in their own section, never merged with couple reviews (owner 2026-11-05). The supplier never sees who wrote it.';

-- The guest's received claim for this service, or nothing. A supplier claim (state received) or the couple's souvenir
-- row a supplier's scanner wrote (coverage_id set).
CREATE OR REPLACE FUNCTION public.supplier_scan_review_submit(
  p_event_id UUID,
  p_guest_id UUID,
  p_coverage_id BIGINT,
  p_stars INTEGER,
  p_line TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID;
  v_line   TEXT := NULLIF(btrim(COALESCE(p_line, '')), '');
BEGIN
  SELECT c.vendor_profile_id INTO v_vendor
    FROM public.supplier_scan_claims c
   WHERE c.event_id = p_event_id AND c.guest_id = p_guest_id AND c.coverage_id = p_coverage_id AND c.state = 'received'
   LIMIT 1;
  IF v_vendor IS NULL THEN
    SELECT s.vendor_profile_id INTO v_vendor
      FROM public.guest_souvenir_claims s
     WHERE s.event_id = p_event_id AND s.guest_id = p_guest_id AND s.coverage_id = p_coverage_id
       AND s.vendor_profile_id IS NOT NULL
     LIMIT 1;
  END IF;
  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'no_received_claim' USING ERRCODE = '42501';
  END IF;
  IF p_stars IS NOT NULL AND (p_stars < 1 OR p_stars > 5) THEN
    RAISE EXCEPTION 'bad_stars' USING ERRCODE = '22023';
  END IF;
  IF v_line IS NOT NULL AND char_length(v_line) > 140 THEN
    RAISE EXCEPTION 'line_too_long' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.supplier_scan_reviews (event_id, guest_id, coverage_id, vendor_profile_id, stars, line, skipped)
  VALUES (
    p_event_id, p_guest_id, p_coverage_id, v_vendor,
    p_stars,
    CASE WHEN p_stars IS NULL THEN NULL ELSE v_line END,
    p_stars IS NULL
  )
  ON CONFLICT (event_id, coverage_id, guest_id) DO NOTHING;
  RETURN CASE WHEN FOUND THEN 'saved' ELSE 'already' END;
END;
$$;

REVOKE ALL ON FUNCTION public.supplier_scan_review_submit(UUID, UUID, BIGINT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_scan_review_submit(UUID, UUID, BIGINT, INTEGER, TEXT) TO service_role;

COMMIT;
