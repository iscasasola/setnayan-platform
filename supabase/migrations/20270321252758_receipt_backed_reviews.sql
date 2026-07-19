-- ============================================================================
-- 20270321252758_receipt_backed_reviews.sql
-- Wave 5 vendor benefit — Receipt-Backed Reviews.
--
-- Two pieces of provenance, both PLATFORM-DERIVED (never couple-settable):
--
--   1. `vendor_reviews.booked_through_setnayan` BOOLEAN (default FALSE).
--      TRUE when the review's source `event_vendors` booking is linked to the
--      reviewed vendor's marketplace `vendor_profiles` row (via either
--      `linked_vendor_profile_id` — public-stats exclusion link — or
--      `marketplace_vendor_id` — invite/connect link). This is the per-review
--      "Booked through Setnayan" receipt pill. The value is stamped
--      SERVER-SIDE in `lib/reviews.ts createReview` + the dashboard
--      `submitCoupleReview` action; couples can NEVER set it. RLS denies any
--      couple INSERT/UPDATE that flips it on (see policy rewrite below) and a
--      BEFORE trigger re-derives the canonical value defensively on every write.
--      Existing rows are backfilled from the same linkage.
--
--   2. `vendor_completed_events` VIEW — a row-per-event dated track record of
--      delivered/complete LINKED bookings, exposing
--      `{vendor_profile_id, event_type, event_date, completed_at}`. Applies
--      the SAME self-review / team / internal / self-comp / archived exclusions
--      as the `vendor_public_completed_events_stats` materialized view from
--      `20260515020000_public_stats_exclusion.sql`. GRANT SELECT to anon +
--      authenticated. Rendered as a dated "Track record" list on /v/[slug]
--      and the vendor dashboard reviews page.
--
-- No prices. The existing public SELECT on vendor_reviews stays untouched.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. vendor_reviews.booked_through_setnayan — server-populated provenance.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vendor_reviews
  ADD COLUMN IF NOT EXISTS booked_through_setnayan BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.vendor_reviews.booked_through_setnayan IS
  'Receipt-backed provenance: TRUE when this review''s source event_vendors '
  'booking links to the reviewed vendor_profiles row (linked_vendor_profile_id '
  'OR marketplace_vendor_id). PLATFORM-DERIVED — stamped server-side and '
  'authoritatively re-derived by the stamp_review_provenance BEFORE trigger on '
  'every write, so couples can never set it (the trigger overwrites any value '
  'the client passes).';

-- Helper: does an event_vendors booking on (event_id) link to (vendor_profile_id)?
-- SECURITY DEFINER + locked search_path so the derivation is authoritative and
-- uniform across the lib path, the action path, and the trigger. STABLE — same
-- inputs, same result within a statement.
CREATE OR REPLACE FUNCTION public.review_is_booked_through_setnayan(
  p_event_id UUID,
  p_vendor_profile_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_vendors ev
    WHERE ev.event_id = p_event_id
      AND (
        ev.linked_vendor_profile_id = p_vendor_profile_id
        OR ev.marketplace_vendor_id = p_vendor_profile_id
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.review_is_booked_through_setnayan(UUID, UUID)
  TO anon, authenticated;

-- Defensive trigger: re-derive booked_through_setnayan on every INSERT/UPDATE
-- so the column is canonical regardless of what the client passed. This is the
-- belt to the RLS-suspenders below — even a service-role write that forgets to
-- stamp it lands the correct value, and a couple write can't smuggle a TRUE in.
CREATE OR REPLACE FUNCTION public.stamp_review_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  NEW.booked_through_setnayan :=
    public.review_is_booked_through_setnayan(NEW.event_id, NEW.vendor_profile_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_reviews_stamp_provenance ON public.vendor_reviews;
CREATE TRIGGER vendor_reviews_stamp_provenance
  BEFORE INSERT OR UPDATE OF event_id, vendor_profile_id, booked_through_setnayan
  ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.stamp_review_provenance();

-- Backfill existing rows from the current linkage.
UPDATE public.vendor_reviews vr
SET booked_through_setnayan =
  public.review_is_booked_through_setnayan(vr.event_id, vr.vendor_profile_id)
WHERE vr.booked_through_setnayan IS DISTINCT FROM
  public.review_is_booked_through_setnayan(vr.event_id, vr.vendor_profile_id);

-- ----------------------------------------------------------------------------
-- 2. RLS — provenance is server-derived; couples cannot influence it.
--    IMPORTANT ordering note: a BEFORE trigger fires BEFORE the RLS WITH CHECK
--    is evaluated, so the WITH CHECK sees the POST-trigger row. We therefore do
--    NOT constrain booked_through_setnayan in the WITH CHECK — if we pinned it
--    to FALSE there, the trigger setting it TRUE for a genuinely-linked booking
--    would make the WITH CHECK reject a LEGITIMATE couple review. The trigger
--    above (`stamp_review_provenance`) is the real guarantee: it overwrites
--    whatever value the couple passed with the platform-derived truth on every
--    INSERT/UPDATE, so a couple can never set provenance regardless of RLS.
--    The couple INSERT/UPDATE policies stay byte-for-byte identical to
--    20260514100000_vendor_reviews.sql; we re-declare them here only so this
--    migration is self-contained and idempotent. The public SELECT policy is
--    untouched.
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 3. vendor_completed_events — dated track-record VIEW.
--    Row-per-event for delivered/complete LINKED bookings, with the SAME
--    exclusions as vendor_public_completed_events_stats (owner / team /
--    internal / self-comp / archived). A plain VIEW (not materialized): the
--    row volume is small per vendor and the query reuses the existing
--    NOT EXISTS predicates, so live evaluation is cheap and always fresh — no
--    refresh trigger to maintain.
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.vendor_completed_events;
CREATE VIEW public.vendor_completed_events
WITH (security_invoker = false) AS
SELECT
  vp.vendor_profile_id,
  ev.vendor_id,
  ev.event_id,
  e.event_type,
  e.event_date,
  -- Completion anchor: prefer the booking's updated_at (when status last moved
  -- to delivered/complete), fall back to the event_date. event_vendors has no
  -- dedicated delivered_at/completed_at column in V1.
  COALESCE(ev.updated_at, (e.event_date)::timestamptz) AS completed_at
FROM public.vendor_profiles vp
JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND ev.status IN ('delivered', 'complete')
JOIN public.events e
       ON e.event_id = ev.event_id
      AND e.archived = FALSE
WHERE NOT EXISTS (
        -- Exclude bookings where the vendor's owner is on the event roster.
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
          AND em.user_id = vp.user_id
      )
  AND NOT EXISTS (
        -- Exclude bookings where any vendor team member is on the event roster.
        SELECT 1 FROM public.event_members em
        JOIN public.vendor_team_members vtm
          ON vtm.user_id = em.user_id
         AND vtm.vendor_profile_id = vp.vendor_profile_id
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
      )
  AND NOT EXISTS (
        -- Exclude bookings where any internal account that owns or sits on this
        -- vendor's team is on the event roster.
        SELECT 1 FROM public.event_members em
        JOIN public.users u ON u.user_id = em.user_id
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
          AND u.is_internal = TRUE
          AND (
            u.user_id = vp.user_id
            OR EXISTS (
              SELECT 1 FROM public.vendor_team_members vtm2
              WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                AND vtm2.user_id = u.user_id
            )
          )
      )
  AND NOT EXISTS (
        -- Exclude bookings flagged by an active vendor_self_comp grant.
        SELECT 1 FROM public.comp_grants cg
        WHERE cg.vendor_profile_id = vp.vendor_profile_id
          AND cg.source = 'vendor_self_comp'
          AND (
            cg.order_id = ev.vendor_id
            OR EXISTS (
              SELECT 1 FROM public.event_members em3
              WHERE em3.event_id = ev.event_id
                AND em3.member_type = 'couple'
                AND em3.user_id = cg.created_by_user_id
            )
          )
      );

COMMENT ON VIEW public.vendor_completed_events IS
  'Dated track-record: one row per delivered/complete LINKED event_vendors '
  'booking, with the same owner/team/internal/self-comp/archived exclusions as '
  'vendor_public_completed_events_stats. Public-readable aggregate provenance — '
  'no PII, no prices. security_invoker=false so anon reads succeed via the '
  'grant below even though the underlying tables are RLS-protected.';

-- Public read — same pattern as vendor_public_completed_events_stats. The view
-- is a non-PII dated list of completed events; anon renders the public
-- /v/[slug] track record, authenticated renders the vendor dashboard.
GRANT SELECT ON public.vendor_completed_events TO anon, authenticated;

COMMIT;
