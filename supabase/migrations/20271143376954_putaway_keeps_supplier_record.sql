-- putaway_keeps_supplier_record
--
-- A CELEBRATION PUT AWAY BY ITS COUPLE STILL COUNTS ON THE SUPPLIER'S RECORD.
--
-- Owner, 2026-08-16, asked directly and answered "yes": when a couple puts an
-- event away, the supplier's finished-jobs number and the review left for them
-- STAY. A customer tidying their own list must never shrink somebody else's
-- public history — that is another business's livelihood, and the person
-- pressing the button is not the person it costs.
--
-- WHY THIS EXISTS AT ALL: "put this away" shipped the day before (PR #4473)
-- after two years in which `events.archived` had no writer anywhere, so nothing
-- could ever set it. FOUR relations quietly filter `archived = FALSE` and none
-- derives from the others — so the first couple ever to press the new button
-- would have silently deducted their wedding from their photographer's public
-- count and dropped the review with it. Verified against production, not read
-- from a migration.
--
-- WHAT CHANGES: exactly one predicate is removed from each relation. In three of
-- them it sits inside an `EXISTS (SELECT 1 FROM events e WHERE e.event_id = ...)`
-- whose OTHER job is to prove the event exists — so only the archived line comes
-- out and the existence check is untouched. In the base view it is a JOIN
-- condition, same treatment. Every other predicate (voided-by-fraud, the
-- self-booking exclusions, comp grants) is preserved BYTE FOR BYTE: each block
-- below was EXTRACTED BY SCRIPT from the migration that currently defines it and
-- edited by script, never retyped.
--
-- DATA EFFECT TODAY: none. Production holds 0 archived events, so no count moves.
-- This is correctness ahead of the feature being used.
--
-- NOTE ON REFRESH: the three matviews have no cron — they are refreshed by hand
-- from the admin fraud screen, so a supplier's public numbers only move when an
-- operator refreshes. Pre-existing, NOT fixed here, named in the changelog.

-- ----------------------------------------------------------------------------
-- 1. vendor_completed_events — plain VIEW. CREATE OR REPLACE keeps its grants
--    (narrowed by 20271132024116); the column list is unchanged.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vendor_completed_events AS
SELECT vp.vendor_profile_id,
    ev.vendor_id,
    ev.event_id,
    e.event_type,
    e.event_date,
    COALESCE(ev.updated_at, e.event_date::timestamp with time zone) AS completed_at
   FROM vendor_profiles vp
     JOIN event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND (ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status]))
      AND ev.voided_by_fraud = false
     JOIN events e ON e.event_id = ev.event_id
  WHERE NOT (EXISTS ( SELECT 1
           FROM event_members em
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type AND em.user_id = vp.user_id))
    AND NOT (EXISTS ( SELECT 1
           FROM event_members em
             JOIN vendor_team_members vtm ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type))
    AND NOT (EXISTS ( SELECT 1
           FROM event_members em
             JOIN users u ON u.user_id = em.user_id
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type AND u.is_internal = true
            AND (u.user_id = vp.user_id OR (EXISTS ( SELECT 1
                   FROM vendor_team_members vtm2
                  WHERE vtm2.vendor_profile_id = vp.vendor_profile_id AND vtm2.user_id = u.user_id)))))
    AND NOT (EXISTS ( SELECT 1
           FROM comp_grants cg
          WHERE cg.vendor_profile_id = vp.vendor_profile_id AND cg.source = 'vendor_self_comp'::text
            AND (cg.order_id = ev.vendor_id OR (EXISTS ( SELECT 1
                   FROM event_members em3
                  WHERE em3.event_id = ev.event_id AND em3.member_type = 'couple'::member_type AND em3.user_id = cg.created_by_user_id)))));

COMMENT ON VIEW public.vendor_completed_events IS
  'Completed bookings behind a supplier''s public record. A couple putting their '
  'own celebration away does NOT remove it from here (owner 2026-08-16): tidying '
  'your own list must not shrink another business''s history.';

-- ----------------------------------------------------------------------------
-- 2. vendor_trusted_review_stats — MATERIALIZED VIEW. There is no CREATE OR
--    REPLACE for matviews, so DROP + CREATE; the unique index, the refresh and
--    the grants are restored exactly as the defining migration set them.
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_trusted_review_stats;
CREATE MATERIALIZED VIEW public.vendor_trusted_review_stats AS
SELECT
  vp.vendor_profile_id,
  COALESCE(AVG(vr.rating_overall)::NUMERIC(3,2), 0) AS trusted_avg_rating,
  COUNT(vr.review_id)::INT AS trusted_review_count
FROM public.vendor_profiles vp
LEFT JOIN public.vendor_reviews vr
       ON vr.vendor_profile_id = vp.vendor_profile_id
      AND vr.booked_through_setnayan = TRUE
      -- Anti-fraud Phase 4: voided reviews never count.
      AND vr.voided_by_fraud = FALSE
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.event_id = vr.event_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = vr.event_id
          AND em.member_type = 'couple'
          AND em.user_id = vp.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        JOIN public.vendor_team_members vtm
          ON vtm.user_id = em.user_id
         AND vtm.vendor_profile_id = vp.vendor_profile_id
        WHERE em.event_id = vr.event_id
          AND em.member_type = 'couple'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        JOIN public.users u ON u.user_id = em.user_id
        WHERE em.event_id = vr.event_id
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
        SELECT 1 FROM public.comp_grants cg
        WHERE cg.vendor_profile_id = vp.vendor_profile_id
          AND cg.source = 'vendor_self_comp'
          AND (
            EXISTS (
              SELECT 1 FROM public.event_members em3
              WHERE em3.event_id = vr.event_id
                AND em3.member_type = 'couple'
                AND em3.user_id = cg.created_by_user_id
            )
          )
      )
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_trusted_review_stats_vendor_profile_id_uidx
  ON public.vendor_trusted_review_stats(vendor_profile_id);

REFRESH MATERIALIZED VIEW public.vendor_trusted_review_stats;
GRANT SELECT ON public.vendor_trusted_review_stats TO anon, authenticated;

COMMENT ON MATERIALIZED VIEW public.vendor_trusted_review_stats IS
  'Vetted review stats. A review on a celebration the couple later put away still '
  'counts (owner 2026-08-16). Refreshed by hand — there is no cron.';

-- ----------------------------------------------------------------------------
-- 3. vendor_public_completed_events_stats — MATERIALIZED VIEW.
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_public_completed_events_stats;
CREATE MATERIALIZED VIEW public.vendor_public_completed_events_stats AS
SELECT
  vp.vendor_profile_id,
  COUNT(ev.vendor_id)::INT AS public_completed_count
FROM public.vendor_profiles vp
LEFT JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND ev.status IN ('delivered', 'complete')
      -- Anti-fraud Phase 4: voided bookings never count.
      AND ev.voided_by_fraud = FALSE
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.event_id = ev.event_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
          AND em.user_id = vp.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        JOIN public.vendor_team_members vtm
          ON vtm.user_id = em.user_id
         AND vtm.vendor_profile_id = vp.vendor_profile_id
        WHERE em.event_id = ev.event_id
          AND em.member_type = 'couple'
      )
      AND NOT EXISTS (
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
      )
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_public_completed_events_stats_pk
  ON public.vendor_public_completed_events_stats(vendor_profile_id);

REFRESH MATERIALIZED VIEW public.vendor_public_completed_events_stats;
GRANT SELECT ON public.vendor_public_completed_events_stats TO anon, authenticated;

COMMENT ON MATERIALIZED VIEW public.vendor_public_completed_events_stats IS
  'Public finished-jobs count. A celebration put away by its couple still counts '
  '(owner 2026-08-16). Refreshed by hand — there is no cron.';

-- ----------------------------------------------------------------------------
-- 4. vendor_full_completed_events_stats — MATERIALIZED VIEW (internal figure).
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS public.vendor_full_completed_events_stats;
CREATE MATERIALIZED VIEW public.vendor_full_completed_events_stats AS
SELECT
  vp.vendor_profile_id,
  COUNT(ev.vendor_id)::INT AS full_completed_count
FROM public.vendor_profiles vp
LEFT JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND ev.status IN ('delivered', 'complete')
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.event_id = ev.event_id
      )
GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_full_completed_events_stats_pk
  ON public.vendor_full_completed_events_stats(vendor_profile_id);

REFRESH MATERIALIZED VIEW public.vendor_full_completed_events_stats;
-- ⚠ `authenticated` ONLY — NOT `anon`. Recreating a matview resets its grants, and
-- this line originally read "TO anon, authenticated", copied from the view's FIRST
-- creation rather than its CURRENT state. That silently undid
-- 20271132024116_anon_view_grants_narrow.sql, which revoked `anon` on purpose:
-- this is the deliberately-UNREDACTED twin of vendor_public_completed_events_stats,
-- so a stranger could read both and subtract to learn how many of a supplier's
-- finished jobs we wrote off as fake or internal.
-- 🔑 DROP + CREATE IS NOT AN EDIT — IT IS A RESET. Every grant, and every later
-- narrowing of one, is discarded. Re-read the CURRENT acl (pg_class.relacl) before
-- re-granting; never copy the grant line out of the original migration.
-- Caught by the exposure freeze, which is the only reason this is not a leak.
-- 🚨 THE REVOKE IS LOAD-BEARING, AND A NARROWER GRANT ALONE DOES NOT WORK.
-- This database carries ALTER DEFAULT PRIVILEGES that grant `anon` on newly
-- created objects, so DROP + CREATE hands `anon` back BY ITSELF — before any
-- GRANT in this file runs. Simply writing "TO authenticated" leaves the leak
-- wide open, which is exactly what the freeze proved when I tried it.
REVOKE ALL ON public.vendor_full_completed_events_stats FROM anon;
REVOKE ALL ON public.vendor_full_completed_events_stats FROM authenticated;
GRANT SELECT ON public.vendor_full_completed_events_stats TO authenticated;

COMMENT ON MATERIALIZED VIEW public.vendor_full_completed_events_stats IS
  'Full finished-jobs count. A celebration put away by its couple still counts '
  '(owner 2026-08-16). Refreshed by hand — there is no cron.';
