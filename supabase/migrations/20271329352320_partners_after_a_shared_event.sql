-- partners_after_a_shared_event
-- Created via `pnpm migration:new`. Idempotent (CREATE OR REPLACE · DROP TRIGGER IF EXISTS).
--
-- ── THE RULING ──────────────────────────────────────────────────────────────
-- Owner, verbatim, 2026-11-06 (DECISION_LOG): "Suppliers can connect
-- partnerships with suppliers they have been with in events. cannot link until
-- they have served the same event." Partnerships stay free (2026-08-05).
--
-- "Served the same event" = BOTH shops have a BOOKED event_vendors row
-- (status contracted · deposit_paid · delivered · complete — the same four as
-- `BOOKED_VENDOR_STATUSES` in apps/web/lib/vendors.ts and
-- `current_vendor_booked_event_ids()`) whose marketplace_vendor_id is their
-- vendor_profile_id, on ONE event whose date has PASSED (Manila calendar).
-- A sample event never counts; a row voided for fraud or archived never counts.
--
-- ── WHAT THIS ADDS ──────────────────────────────────────────────────────────
--   1. public.vendor_served_together_rows(uuid) — the ONE definition. Internal:
--      EXECUTE revoked from every client role; called by 2 and 3 only.
--   2. public.partners_you_served_with(uuid) — the supplier's own read (the
--      propose picker + the Analytics "link up" door). Refuses a shop that is
--      not the caller's, rather than answering empty — an empty list here
--      means "nobody yet", and a refusal must not look like that.
--   3. A BEFORE INSERT trigger on vendor_partnerships that raises
--      NOT_SERVED_TOGETHER unless the pair shares a past booked event.
--
-- ── WHAT IT DOES NOT TOUCH ──────────────────────────────────────────────────
--   • Existing rows: the trigger is INSERT-only. A pending proposal made before
--     today can still be accepted (that is an UPDATE).
--   • RLS: no policy is changed.
--   • Re-propose (changePartnershipKind): withdraws an accepted row and inserts
--     the new wording. That is restating an EXISTING link, not making a new
--     one, so a pair that has ever been accepted (accepted_at IS NOT NULL on any
--     row between them, either direction) may insert again. Without this the
--     shipped Re-propose would be refused for every partnership that predates
--     the rule.

BEGIN;

-- ── 1 · the one definition ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vendor_served_together_rows(p_vendor uuid)
RETURNS TABLE (
  other_vendor_profile_id uuid,
  event_id uuid,
  event_type text,
  event_date date,
  event_date_precision text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT
         theirs.marketplace_vendor_id AS other_vendor_profile_id,
         e.event_id,
         e.event_type,
         e.event_date,
         e.event_date_precision
    FROM public.event_vendors mine
    JOIN public.events e
      ON e.event_id = mine.event_id
    JOIN public.event_vendors theirs
      ON theirs.event_id = mine.event_id
   WHERE mine.marketplace_vendor_id = p_vendor
     AND theirs.marketplace_vendor_id IS NOT NULL
     AND theirs.marketplace_vendor_id <> p_vendor
     AND mine.status   IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND theirs.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
     AND mine.archived_at IS NULL
     AND theirs.archived_at IS NULL
     AND COALESCE(mine.voided_by_fraud, false) = false
     AND COALESCE(theirs.voided_by_fraud, false) = false
     AND COALESCE(e.is_sample, false) = false
     AND e.event_date IS NOT NULL
     -- "Has passed" = the LAST day the stored date could mean is before today
     -- in Manila. A month- or year-precision date is not over until its whole
     -- month / year is.
     AND (CASE e.event_date_precision
            WHEN 'day'   THEN e.event_date
            WHEN 'month' THEN (date_trunc('month', e.event_date) + interval '1 month' - interval '1 day')::date
            WHEN 'year'  THEN (date_trunc('year',  e.event_date) + interval '1 year'  - interval '1 day')::date
          END) < (now() AT TIME ZONE 'Asia/Manila')::date;
$$;

REVOKE ALL ON FUNCTION public.vendor_served_together_rows(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.vendor_served_together_rows(uuid) IS
  'Owner 2026-11-06: suppliers link up only after serving the same event. One row per (other shop, event) where both '
  'shops were BOOKED (contracted/deposit_paid/delivered/complete) on a non-sample event whose date has passed (Manila). '
  'Internal — read through partners_you_served_with() or the vendor_partnerships insert trigger.';

-- ── 2 · the supplier's own read ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.partners_you_served_with(p_vendor uuid)
RETURNS TABLE (
  other_vendor_profile_id uuid,
  business_name text,
  is_live boolean,
  event_type text,
  event_date date,
  event_date_precision text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_vendor IS NULL
     OR NOT (p_vendor IN (SELECT public.current_vendor_profile_ids()) OR public.is_admin()) THEN
    RAISE EXCEPTION 'not_your_shop' USING ERRCODE = '42501';
  END IF;

  -- Event type + date only — never the event's name, never the couple. The
  -- picker shows "Served together · ‹type› · ‹Mon YYYY›".
  RETURN QUERY
    SELECT r.other_vendor_profile_id,
           vp.business_name,
           (vp.public_visibility = 'verified' AND vp.verification_state = 'verified') AS is_live,
           r.event_type,
           r.event_date,
           r.event_date_precision
      FROM public.vendor_served_together_rows(p_vendor) r
      JOIN public.vendor_profiles vp
        ON vp.vendor_profile_id = r.other_vendor_profile_id
     ORDER BY r.event_date DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.partners_you_served_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partners_you_served_with(uuid) TO authenticated;

COMMENT ON FUNCTION public.partners_you_served_with(uuid) IS
  'The shops this supplier may propose a partnership to (owner 2026-11-06: only after serving the same past event). '
  'Caller must own p_vendor (or be admin) — refuses with not_your_shop instead of answering empty.';

-- ── 3 · the database refuses a link without a shared past event ────────────
CREATE OR REPLACE FUNCTION public.vendor_partnerships_need_a_shared_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Restating an existing link (Re-propose) is not a new link.
  IF EXISTS (
    SELECT 1
      FROM public.vendor_partnerships p
     WHERE p.accepted_at IS NOT NULL
       AND (   (p.recommending_vendor_id = NEW.recommending_vendor_id AND p.recommended_vendor_id = NEW.recommended_vendor_id)
            OR (p.recommending_vendor_id = NEW.recommended_vendor_id  AND p.recommended_vendor_id = NEW.recommending_vendor_id))
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.vendor_served_together_rows(NEW.recommending_vendor_id) r
     WHERE r.other_vendor_profile_id = NEW.recommended_vendor_id
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'NOT_SERVED_TOGETHER'
    USING ERRCODE = 'P0001',
          HINT = 'Suppliers can link up after they have both served the same event (owner 2026-11-06).';
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_partnerships_need_a_shared_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_vendor_partnerships_need_a_shared_event ON public.vendor_partnerships;
CREATE TRIGGER trg_vendor_partnerships_need_a_shared_event
  BEFORE INSERT ON public.vendor_partnerships
  FOR EACH ROW
  EXECUTE FUNCTION public.vendor_partnerships_need_a_shared_event();

-- ── 4 · the old "worked together" hint is superseded ───────────────────────
-- vendor_worked_with_ids(uuid) fed the old picker's ordering hint ("listed
-- first"). Its only caller, /vendor-dashboard/partnerships, now reads
-- partners_you_served_with() instead, so it would be an orphan. It also
-- answered for ANY vendor id an authenticated caller passed, and counted any
-- co-occurrence (a shortlist, a past "considering") — the looser notion this
-- ruling replaces. Dropped, not left beside the real rule as a second one.
DROP FUNCTION IF EXISTS public.vendor_worked_with_ids(uuid);

COMMIT;
