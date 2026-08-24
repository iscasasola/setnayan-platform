-- ═══════════════════════════════════════════════════════════════════════════
-- THE PUBLIC NUMBERS KEEP THE RECORD THE SLICES PRESERVED
--
-- Owner, 2026-08-21: "vendors get to keep it."
--
-- Slices 1–6 made a supplier's review, booking, contract, payment, quote and
-- amendment SURVIVE a couple deleting their celebration. Measured in production
-- 2026-08-24 in a rolled-back transaction, EVERY PUBLISHED NUMBER STILL WENT TO
-- ZERO:
--
--     review row              1 → 1     ✅ (slice 1)
--     booking row             survives  ✅ (slice 2)
--     dated Track Record list 1 → 1     ✅ (the view was fixed)
--     trusted_review_count    1 → 0     🚨  THE public star rating
--     public_completed_count  1 → 0     🚨  the experience tier badge
--     full_completed_count    1 → 0     🚨  the supplier's own finished-jobs count
--
-- 🔑 THE ROWS SURVIVED AND THE RELATIONS THAT PUBLISH THEM DID NOT. All three
-- matviews carry `EXISTS (SELECT 1 FROM events e WHERE e.event_id = x.event_id)`.
-- Once the column is NULL that predicate is FALSE — `NULL = NULL` is never true
-- — so the preserved row is filtered out of the very number it was preserved
-- for. This is the fourth costume of "stored does not mean survives": not
-- VANISHED (slice 2), not ANONYMOUS (slice 3), not a BROKEN URL (slice 5), but
-- CONTRADICTED — the dated list shows the job while the count above it says the
-- supplier has never worked.
--
-- ── 1 · WHY THE SELF-DEALING GUARDS ARE HANDLED FIRST, NOT AFTERWARDS ───────
-- Each matview also carries NOT EXISTS guards that read `event_members`, which
-- CASCADES. Relaxing the events predicate ALONE would let those guards pass
-- vacuously for an orphan and LAUNDER a vendor's own self-booked job into a
-- public number forever — the doc's own warning: "any guard that reads a
-- cascading table must be evaluated AT DELETION TIME."
--
-- Slice 2 already solved this for BOOKINGS the right way round: its preserve
-- runs the self-dealing test as a PRECONDITION, so a self-dealt booking is
-- never orphaned in the first place and "orphan ⇒ arm's-length" holds by
-- construction. Reviews had no such gate — the FK's SET NULL orphans every
-- review indiscriminately.
--
-- ⚖ SO REVIEWS GET THE SAME SHAPE, NOT A NEW ONE. A self-dealt review is
-- DELETED at deletion time, exactly as it is destroyed by the cascade today —
-- **no behaviour changes for those rows** — and only arm's-length reviews are
-- left for the FK to orphan. That is why no stamp column is added: a column
-- would be a second copy of a fact the trigger can simply guarantee, and it
-- would publish a new field on a table `anon` reads.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A · ONLY AN ARM'S-LENGTH REVIEW IS ALLOWED TO OUTLIVE ITS EVENT ─────────
CREATE OR REPLACE FUNCTION public.keep_only_arms_length_reviews_on_event_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  /*
    Runs while `event_members` and `comp_grants` still exist — the only moment
    the question can be answered at all. After the delete there is nothing left
    to ask.

    The four tests are the SAME four the public matviews apply to a live review,
    copied deliberately rather than referenced: reviewer is the vendor owner ·
    reviewer is on the vendor's team · an internal Setnayan account · a
    `vendor_self_comp` grant. A review failing any of them is destroyed here,
    which is precisely what the cascade does to it today.
  */
  DELETE FROM public.vendor_reviews vr
   USING public.vendor_profiles vp
   WHERE vr.event_id = OLD.event_id
     AND vp.vendor_profile_id = vr.vendor_profile_id
     AND (
       EXISTS (
         SELECT 1 FROM public.event_members em
          WHERE em.event_id = vr.event_id
            AND em.member_type = 'couple'
            AND em.user_id = vp.user_id
       )
       OR EXISTS (
         SELECT 1 FROM public.event_members em
           JOIN public.vendor_team_members vtm
             ON vtm.user_id = em.user_id
            AND vtm.vendor_profile_id = vp.vendor_profile_id
          WHERE em.event_id = vr.event_id
            AND em.member_type = 'couple'
       )
       OR EXISTS (
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
       OR EXISTS (
         SELECT 1 FROM public.comp_grants cg
          WHERE cg.vendor_profile_id = vp.vendor_profile_id
            AND cg.source = 'vendor_self_comp'
            AND EXISTS (
              SELECT 1 FROM public.event_members em3
               WHERE em3.event_id = vr.event_id
                 AND em3.member_type = 'couple'
                 AND em3.user_id = cg.created_by_user_id
            )
       )
     );

  RETURN OLD;
END;
$function$;

-- 🔑 A SECURITY DEFINER FUNCTION IS EXECUTABLE BY PUBLIC BY DEFAULT, and a
-- trigger function needs no EXECUTE grant at all. `anon-rpc-surface.db.test.ts`
-- flags one that keeps it.
REVOKE ALL ON FUNCTION public.keep_only_arms_length_reviews_on_event_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.keep_only_arms_length_reviews_on_event_delete() FROM anon;
REVOKE ALL ON FUNCTION public.keep_only_arms_length_reviews_on_event_delete() FROM authenticated;

-- ⚠ NAMED `events_arms_length_...` ON PURPOSE. Postgres fires BEFORE triggers in
-- ALPHABETICAL order, and this must run before the FK's own SET NULL (which
-- happens at the delete itself, after every BEFORE trigger) — it does, but the
-- name also keeps it ahead of `events_keep_supplier_*`, so a future reader
-- adding a preserve step meets this one first.
DROP TRIGGER IF EXISTS events_arms_length_reviews_on_delete ON public.events;
CREATE TRIGGER events_arms_length_reviews_on_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.keep_only_arms_length_reviews_on_event_delete();

-- ── B · THE THREE PUBLISHED COUNTS STOP FILTERING OUT WHAT WAS PRESERVED ────
-- Matviews have no CREATE OR REPLACE, so each is dropped and rebuilt. The ONLY
-- change to each body is the events predicate; every other clause is carried
-- over byte-for-byte from `pg_get_viewdef` read out of production 2026-08-24.
--
-- 🔒 GRANTS AND INDEXES ARE RESTORED EXPLICITLY AND EXACTLY, read from
-- `pg_class.relacl` in prod. A DROP takes both with it, and re-granting from
-- memory is how a relation silently widens: note that
-- `vendor_full_completed_events_stats` has NO anon/authenticated grant and must
-- NOT be given one — it is the supplier's own count, not a public one.

DROP MATERIALIZED VIEW IF EXISTS public.vendor_trusted_review_stats;
CREATE MATERIALIZED VIEW public.vendor_trusted_review_stats AS
 SELECT vp.vendor_profile_id,
    COALESCE(avg(vr.rating_overall)::numeric(3,2), 0::numeric) AS trusted_avg_rating,
    count(vr.review_id)::integer AS trusted_review_count
   FROM public.vendor_profiles vp
     LEFT JOIN public.vendor_reviews vr
       ON vr.vendor_profile_id = vp.vendor_profile_id
      AND vr.booked_through_setnayan = true
      AND vr.voided_by_fraud = false
      -- ⬇ THE CHANGE. An orphaned review is one the couple deleted the event
      --   for; it is arm's-length by construction (trigger A above).
      AND (vr.event_id IS NULL OR EXISTS (
            SELECT 1 FROM public.events e WHERE e.event_id = vr.event_id))
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND em.user_id = vp.user_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.vendor_team_members vtm
                ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple')
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.users u ON u.user_id = em.user_id
             WHERE em.event_id = vr.event_id AND em.member_type = 'couple'
               AND u.is_internal = true
               AND (u.user_id = vp.user_id OR EXISTS (
                     SELECT 1 FROM public.vendor_team_members vtm2
                      WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                        AND vtm2.user_id = u.user_id)))
      AND NOT EXISTS (
            SELECT 1 FROM public.comp_grants cg
             WHERE cg.vendor_profile_id = vp.vendor_profile_id
               AND cg.source = 'vendor_self_comp'
               AND EXISTS (
                     SELECT 1 FROM public.event_members em3
                      WHERE em3.event_id = vr.event_id AND em3.member_type = 'couple'
                        AND em3.user_id = cg.created_by_user_id))
  GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX vendor_trusted_review_stats_vendor_profile_id_uidx
  ON public.vendor_trusted_review_stats USING btree (vendor_profile_id);
-- 🚨 REVOKE FIRST, ALWAYS. Prod carries `ALTER DEFAULT PRIVILEGES IN SCHEMA
-- public GRANT ALL ON TABLES TO anon, authenticated` (read from `pg_default_acl`
-- 2026-08-24), so a freshly-created relation is born with anon = arwdDxtm —
-- INSERT, UPDATE, DELETE and TRUNCATE included. Prod's live ACL for this view is
-- `anon=r` ONLY, so recreating it without this REVOKE would silently UPGRADE the
-- public internet from read to write on the supplier's headline rating.
-- 🔑 The same trap as "recreating a policy discards its TO clause", one level
-- down: the DROP takes the grant with it and the DEFAULT PRIVILEGE writes back a
-- WIDER one than the one that was there.
REVOKE ALL ON public.vendor_trusted_review_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_trusted_review_stats TO anon, authenticated;
GRANT ALL    ON public.vendor_trusted_review_stats TO service_role;

DROP MATERIALIZED VIEW IF EXISTS public.vendor_public_completed_events_stats;
CREATE MATERIALIZED VIEW public.vendor_public_completed_events_stats AS
 SELECT vp.vendor_profile_id,
    count(ev.vendor_id)::integer AS public_completed_count
   FROM public.vendor_profiles vp
     LEFT JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND (ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status]))
      AND ev.voided_by_fraud = false
      -- ⬇ THE CHANGE. Slice 2 only ever orphans a booking that passed its own
      --   self-dealing test, so an orphan here is arm's-length by construction.
      AND (ev.event_id IS NULL OR EXISTS (
            SELECT 1 FROM public.events e WHERE e.event_id = ev.event_id))
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
             WHERE em.event_id = ev.event_id AND em.member_type = 'couple'
               AND em.user_id = vp.user_id)
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.vendor_team_members vtm
                ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
             WHERE em.event_id = ev.event_id AND em.member_type = 'couple')
      AND NOT EXISTS (
            SELECT 1 FROM public.event_members em
              JOIN public.users u ON u.user_id = em.user_id
             WHERE em.event_id = ev.event_id AND em.member_type = 'couple'
               AND u.is_internal = true
               AND (u.user_id = vp.user_id OR EXISTS (
                     SELECT 1 FROM public.vendor_team_members vtm2
                      WHERE vtm2.vendor_profile_id = vp.vendor_profile_id
                        AND vtm2.user_id = u.user_id)))
      AND NOT EXISTS (
            SELECT 1 FROM public.comp_grants cg
             WHERE cg.vendor_profile_id = vp.vendor_profile_id
               AND cg.source = 'vendor_self_comp'
               AND (cg.order_id = ev.vendor_id OR EXISTS (
                     SELECT 1 FROM public.event_members em3
                      WHERE em3.event_id = ev.event_id AND em3.member_type = 'couple'
                        AND em3.user_id = cg.created_by_user_id)))
  GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX vendor_public_completed_events_stats_pk
  ON public.vendor_public_completed_events_stats USING btree (vendor_profile_id);
REVOKE ALL ON public.vendor_public_completed_events_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vendor_public_completed_events_stats TO anon, authenticated;
GRANT ALL    ON public.vendor_public_completed_events_stats TO service_role;

DROP MATERIALIZED VIEW IF EXISTS public.vendor_full_completed_events_stats;
CREATE MATERIALIZED VIEW public.vendor_full_completed_events_stats AS
 SELECT vp.vendor_profile_id,
    count(ev.vendor_id)::integer AS full_completed_count
   FROM public.vendor_profiles vp
     LEFT JOIN public.event_vendors ev
       ON ev.linked_vendor_profile_id = vp.vendor_profile_id
      AND (ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status]))
      AND (ev.event_id IS NULL OR EXISTS (
            SELECT 1 FROM public.events e WHERE e.event_id = ev.event_id))
  GROUP BY vp.vendor_profile_id;

CREATE UNIQUE INDEX vendor_full_completed_events_stats_pk
  ON public.vendor_full_completed_events_stats USING btree (vendor_profile_id);
-- ⚠ THE REVOKE IS NOT OPTIONAL AND IS NOT SYMMETRY — IT IS THE WHOLE CONTROL.
--   Prod grants this view to service_role ONLY. Because the default privilege
--   above hands `anon` everything at CREATE time, omitting this line does not
--   leave the view unreadable — it PUBLISHES it. This count deliberately does
--   NOT exclude self-dealt or fraud-voided jobs, so it is the supplier's own
--   figure and must never reach the marketplace.
REVOKE ALL ON public.vendor_full_completed_events_stats FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vendor_full_completed_events_stats TO service_role;

COMMENT ON MATERIALIZED VIEW public.vendor_trusted_review_stats IS
  'THE public headline rating. Counts a review whose event still exists OR that '
  'was orphaned by the couple deleting their celebration (slice 1). Orphans are '
  'arm''s-length by construction: keep_only_arms_length_reviews_on_event_delete() '
  'destroys a self-dealt review before the FK can orphan it.';
COMMENT ON MATERIALIZED VIEW public.vendor_public_completed_events_stats IS
  'The public finished-jobs count behind the experience tier. Counts a booking '
  'whose event still exists OR that slice 2 preserved — and slice 2 only ever '
  'preserves an arm''s-length, really-booked, marketplace-linked row.';
