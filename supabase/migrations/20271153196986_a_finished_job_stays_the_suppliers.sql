-- ═══════════════════════════════════════════════════════════════════════════
-- A FINISHED JOB STAYS THE SUPPLIER'S — slice 2 of "vendors get to keep it"
--
-- Owner, 2026-08-21: "statistics and data for the vendor stays… that the vendor
-- needs for their website." And: "vendors get to keep it." Test: DID THE
-- SUPPLIER TAKE PART IN IT?
--
-- `event_vendors` is the root of the supplier's entire public track record —
-- completed-job counts, the quality score that SORTS the marketplace, the
-- verified median price. `vendor_completed_events` is a VIEW over it and
-- `vendor_public_completed_events_stats` a materialised view over that: there is
-- NO independent record of a completed booking anywhere in the schema. The row
-- CASCADED, so a couple pressing delete erased the supplier's history of a job
-- they actually did.
--
-- ⚠ THIS TABLE IS NOT LIKE `vendor_reviews`. It holds the couple's PRIVATE
-- PLANNING and their real bookings in the same rows. Preserving it wholesale
-- would hand a supplier the couple's shortlist — who they considered and who
-- they rejected — which is the opposite harm and is NOT what the owner ruled.
-- Prod today: 32 `considering` rows and 0 of them linked to anybody.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · A booking may outlive its event ─────────────────────────────────────
ALTER TABLE public.event_vendors
  ALTER COLUMN event_id DROP NOT NULL;

-- ── 2 · …and must carry the facts it needs to still MEAN something ──────────
-- 🚨 PRESERVING THE ROW IS NOT ENOUGH, AND THIS IS WHAT THE CLASSIFICATION
-- CALLS "STORED DOES NOT MEAN SURVIVES". `vendor_completed_events` reads
-- `e.event_type` and `e.event_date` FROM THE EVENT and joins to it — so an
-- orphaned booking drops out of the view entirely and the supplier's count
-- still falls to zero. The row must bring its own copy or the fix is theatre.
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS event_type_at_delete text,
  ADD COLUMN IF NOT EXISTS event_date_at_delete date;

COMMENT ON COLUMN public.event_vendors.event_type_at_delete IS
  'The kind of celebration this job was for, copied here ONLY when the couple '
  'deleted the event. NULL while the event exists — read `events.event_type` '
  'then. Exists because the supplier''s public track record is a view that '
  'reads the event, and an orphaned booking has no event left to read.';

COMMENT ON COLUMN public.event_vendors.event_date_at_delete IS
  'The day this job was for, copied here ONLY when the couple deleted the '
  'event. NULL while the event exists. See event_type_at_delete.';

-- ── 3 · Keep only what the supplier actually took part in ───────────────────
CREATE OR REPLACE FUNCTION public.keep_supplier_bookings_on_event_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  /*
    Rows that survive are detached from the event HERE, in a BEFORE DELETE, so
    the cascade that follows no longer sees them. Everything not matched below
    still cascades — which is the couple's planning going, exactly as ruled.

    THREE CONDITIONS, AND EVERY ONE OF THEM IS LOad-BEARING:

    1. STATUS — `contracted`/`deposit_paid`/`delivered`/`complete`. This is the
       set `lib/event-deletion-gate.ts` already exports as
       BOOKED_VENDOR_STATUSES, commented "states that mean really booked, not
       merely being considered". `considering` and `shortlisted` are the
       couple's private list and MUST go; preserving them would tell a supplier
       they were considered and rejected.

    2. `marketplace_vendor_id IS NOT NULL` — NOT `linked_vendor_profile_id`.
       A row with neither is a NAME THE COUPLE TYPED: there is no supplier
       account to keep it for, so preserving it would retain the couple's data
       with no beneficiary at all. And the choice between the two link columns
       is not cosmetic — `lib/reusable-bookings.server.ts` lets the COUPLE'S own
       action stamp `linked_vendor_profile_id`, so keying on it would let a
       couple manufacture a preserved "booking" against any supplier and inflate
       their public numbers. This is the same rule `vendor_agree_to_lock`
       already states: an ownership predicate may not key on a column the
       counterparty controls — and here the counterparty IS the person deleting.

    3. NOT SELF-DEALT — and this one is a hole the naive fix CREATES.
       `vendor_completed_events` excludes a booking whose supplier is also a
       couple member of that event (directly, or via a team member). Those
       checks read `event_members`, which CASCADES on delete. So after the event
       is gone the guards can no longer run and every one of them passes
       permissively: deleting the event would LAUNDER a vendor's own self-booked
       job into a countable one, permanently. The guard has to be evaluated now,
       while the members still exist, or not at all.
  */
  UPDATE public.event_vendors ev
     SET event_id             = NULL,
         event_type_at_delete = OLD.event_type,
         event_date_at_delete = OLD.event_date
   WHERE ev.event_id = OLD.event_id
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND ev.marketplace_vendor_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.event_members em
         JOIN public.vendor_profiles vp
           ON vp.vendor_profile_id = ev.marketplace_vendor_id
        WHERE em.event_id = OLD.event_id
          AND em.member_type = 'couple'
          AND (
            em.user_id = vp.user_id
            OR EXISTS (
              SELECT 1 FROM public.vendor_team_members vtm
               WHERE vtm.vendor_profile_id = vp.vendor_profile_id
                 AND vtm.user_id = em.user_id
            )
          )
     );

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.keep_supplier_bookings_on_event_delete() IS
  'BEFORE DELETE on events: detaches the bookings a supplier genuinely took '
  'part in so they outlive the celebration (owner 2026-08-21, "vendors get to '
  'keep it"), and lets everything else cascade. Deliberately NOT a blanket '
  'preserve: `event_vendors` also holds the couple''s private shortlist.';

-- 🚨 A SECURITY DEFINER FUNCTION IS EXECUTABLE BY **PUBLIC** BY DEFAULT.
-- `anon-rpc-surface.db.test.ts` caught this: the function was added to the
-- anon-callable SECURITY DEFINER surface simply by existing. A TRIGGER function
-- needs no EXECUTE grant to anybody — Postgres runs it as part of the DELETE
-- regardless — so the grant is pure surface with no purpose. Revoke it.
--
-- 🔑 The same is true of every trigger function in the remaining slices: write
-- the REVOKE in the SAME migration, not as a follow-up.
REVOKE ALL ON FUNCTION public.keep_supplier_bookings_on_event_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.keep_supplier_bookings_on_event_delete() FROM anon;
REVOKE ALL ON FUNCTION public.keep_supplier_bookings_on_event_delete() FROM authenticated;

DROP TRIGGER IF EXISTS events_keep_supplier_bookings_on_delete ON public.events;
CREATE TRIGGER events_keep_supplier_bookings_on_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_supplier_bookings_on_event_delete();

-- ── 4 · The track record must still be able to COUNT an orphaned job ────────
-- The only changes to this view are the LEFT JOIN and the two COALESCEs; every
-- self-dealing exclusion below is reproduced verbatim from the shipped
-- definition. They are trivially TRUE for an orphan (the join key is NULL, so
-- nothing matches) — which is safe ONLY because the trigger above refuses to
-- preserve a self-dealt row in the first place. The guard moved earlier; it was
-- not dropped.
CREATE OR REPLACE VIEW public.vendor_completed_events AS
 SELECT vp.vendor_profile_id,
    ev.vendor_id,
    ev.event_id,
    COALESCE(e.event_type, ev.event_type_at_delete) AS event_type,
    COALESCE(e.event_date, ev.event_date_at_delete) AS event_date,
    COALESCE(ev.updated_at, COALESCE(e.event_date, ev.event_date_at_delete)::timestamp with time zone) AS completed_at
   FROM vendor_profiles vp
     JOIN event_vendors ev ON ev.linked_vendor_profile_id = vp.vendor_profile_id
       AND (ev.status = ANY (ARRAY['delivered'::vendor_status, 'complete'::vendor_status]))
       AND ev.voided_by_fraud = false
     LEFT JOIN events e ON e.event_id = ev.event_id
  WHERE NOT (EXISTS ( SELECT 1
           FROM event_members em
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type AND em.user_id = vp.user_id)) AND NOT (EXISTS ( SELECT 1
           FROM event_members em
             JOIN vendor_team_members vtm ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = vp.vendor_profile_id
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type)) AND NOT (EXISTS ( SELECT 1
           FROM event_members em
             JOIN users u ON u.user_id = em.user_id
          WHERE em.event_id = ev.event_id AND em.member_type = 'couple'::member_type AND u.is_internal = true AND (u.user_id = vp.user_id OR (EXISTS ( SELECT 1
                   FROM vendor_team_members vtm2
                  WHERE vtm2.vendor_profile_id = vp.vendor_profile_id AND vtm2.user_id = u.user_id))))) AND NOT (EXISTS ( SELECT 1
           FROM comp_grants cg
          WHERE cg.vendor_profile_id = vp.vendor_profile_id AND cg.source = 'vendor_self_comp'::text AND (cg.order_id = ev.vendor_id OR (EXISTS ( SELECT 1
                   FROM event_members em3
                  WHERE em3.event_id = ev.event_id AND em3.member_type = 'couple'::member_type AND em3.user_id = cg.created_by_user_id)))));

COMMENT ON COLUMN public.event_vendors.event_id IS
  'The celebration this booking belongs to, or NULL once the couple deleted it '
  'AND the supplier had genuinely taken part (owner 2026-08-21). NULL is a real '
  'expected value: all four RLS policies on this table key on event_id, so an '
  'orphaned booking is automatically invisible to every couple and moderator '
  'while remaining readable through the supplier-side SECURITY DEFINER paths.';
