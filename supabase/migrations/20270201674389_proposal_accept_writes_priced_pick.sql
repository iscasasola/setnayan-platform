-- ============================================================================
-- 20270201674389_proposal_accept_writes_priced_pick.sql
--
-- VENDOR TRANSACTION LIFECYCLE — Phase 1 · PR3
-- (corpus: Vendor_Transaction_Lifecycle_2026-06-20.md Phase 1 PR3).
--
-- PROBLEM
--   Accepting a vendor_proposals row only flips status='accepted'
--   (respond_vendor_proposal — last-defined in 20261209000000_concurrency_
--   guards.sql). "Accepting is a SIGNAL, not a booking" — so nothing writes a
--   PRICED event_vendors row, and the couple's Build / Compare tabs show
--   nothing after they accept. The only price-writer today is the manual
--   QuoteBridge "Log as service price" button on the per-vendor workspace,
--   which stays as a fallback.
--
-- FIX
--   CREATE OR REPLACE respond_vendor_proposal with the EXACT live body from
--   20261209000000 (FOR UPDATE serialization + status-precondition UPDATE +
--   rowcount guard, all preserved) PLUS one optional trailing param
--   (p_coarse_category) and, on accept only, an UPSERT of the couple's
--   event_vendors row keyed (event_id, vendor_profile_id):
--
--     • FOUND  → set total_cost_php = proposal.total_centavos / 100; bump
--                status considering → shortlisted ONLY (never downgrade a
--                shortlisted/contracted/deposit_paid/delivered/complete row);
--                DO NOT touch category (set correctly at Save time).
--     • ABSENT → INSERT a priced shortlisted row (proposal accepted before any
--                Save), category = COALESCE(p_coarse_category, 'misc'),
--                vendor_name resolved from vendor_profiles.business_name,
--                source = 'proposal_accept'.
--
--   There is NO UNIQUE constraint on (event_id, marketplace_vendor_id) — only
--   plain indexes (20260519200000) — so the upsert is an explicit
--   SELECT ... FOR UPDATE → UPDATE-else-INSERT inside the SECURITY DEFINER
--   function (atomic + RLS-safe). Idempotent: the existing accept guard gates
--   on status IN ('sent','viewed'), so a second accept no-ops before the
--   upsert is ever reached.
--
--   CREATE OR REPLACE is idempotent — safe to re-run. Signature stays
--   backward-compatible (new param is the last, with a DEFAULT), so the lone
--   caller (respondToProposal) and any future caller keep working.
-- ============================================================================

BEGIN;

-- Adding a DEFAULTed trailing param creates an OVERLOAD rather than replacing
-- the 2-arg function in place, so drop the old 2-arg version first. Otherwise
-- both signatures coexist and a future 2-arg caller would silently skip the
-- new event_vendors bridge (and PostgREST overload resolution gets ambiguous).
DROP FUNCTION IF EXISTS public.respond_vendor_proposal(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.respond_vendor_proposal(
  p_proposal_id     UUID,
  p_response        TEXT,
  p_coarse_category TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id          UUID;
  v_status            TEXT;
  v_vendor_profile_id UUID;
  v_total_centavos    BIGINT;
  v_rows              INTEGER;
  v_existing_id       UUID;
  v_existing_status   public.vendor_status;
  v_vendor_name       TEXT;
  v_category          public.vendor_category;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'bad_response' USING ERRCODE = '22023';
  END IF;

  -- FOR UPDATE serializes concurrent responders (two accepts, or
  -- accept-vs-decline): the second waits, then re-reads the now-resolved
  -- status and is rejected by the guard below.
  SELECT event_id, status, vendor_profile_id, total_centavos
    INTO v_event_id, v_status, v_vendor_profile_id, v_total_centavos
  FROM public.vendor_proposals WHERE proposal_id = p_proposal_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_event_id NOT IN (SELECT public.current_couple_event_ids())
     AND v_event_id NOT IN (SELECT public.current_moderator_event_ids()) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  IF v_status NOT IN ('sent', 'viewed') THEN
    RAISE EXCEPTION 'already_resolved' USING ERRCODE = '22023';
  END IF;

  -- Status precondition in the WHERE (defense in depth alongside FOR UPDATE):
  -- the transition is atomically single-winner even if the lock above is ever
  -- removed.
  UPDATE public.vendor_proposals
  SET status = p_response,
      resolved_at = NOW(),
      resolved_by_user_id = auth.uid(),
      updated_at = NOW()
  WHERE proposal_id = p_proposal_id
    AND status IN ('sent', 'viewed');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'already_resolved' USING ERRCODE = '22023';
  END IF;

  -- ----------------------------------------------------------------------------
  -- PR3 · accept-a-proposal posts a PRICED shortlist pick to the couple's plan.
  -- Decline writes nothing. Only reached after the single-winner UPDATE above,
  -- so it cannot double-write on a re-accept.
  -- ----------------------------------------------------------------------------
  IF p_response = 'accepted' THEN
    -- Find the couple's existing pick for this vendor (the same natural key
    -- saveVendorToPicks uses). FOR UPDATE locks it so the price/status bump is
    -- serialized against a concurrent manual edit.
    SELECT vendor_id, status
      INTO v_existing_id, v_existing_status
    FROM public.event_vendors
    WHERE event_id = v_event_id
      AND marketplace_vendor_id = v_vendor_profile_id
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      -- Price always reflects the accepted proposal. Status only climbs
      -- considering → shortlisted; never downgrade a shortlisted-or-deeper
      -- (booked / paid / delivered) row.
      UPDATE public.event_vendors
      SET total_cost_php = v_total_centavos::numeric / 100.0,
          status = CASE WHEN v_existing_status = 'considering'
                        THEN 'shortlisted'::public.vendor_status
                        ELSE status END,
          updated_at = NOW()
      WHERE vendor_id = v_existing_id;
    ELSE
      -- No prior Save: insert a priced shortlisted row from scratch. Resolve
      -- vendor_name (NOT NULL, no default) from the marketplace profile;
      -- category from the TS-resolved coarse hint, else 'misc'.
      SELECT NULLIF(TRIM(business_name), '')
        INTO v_vendor_name
      FROM public.vendor_profiles
      WHERE vendor_profile_id = v_vendor_profile_id;

      v_category := COALESCE(
        NULLIF(p_coarse_category, '')::public.vendor_category,
        'misc'::public.vendor_category
      );

      INSERT INTO public.event_vendors (
        event_id,
        marketplace_vendor_id,
        linked_vendor_profile_id,
        category,
        vendor_name,
        status,
        total_cost_php,
        source
      ) VALUES (
        v_event_id,
        v_vendor_profile_id,
        v_vendor_profile_id,
        v_category,
        COALESCE(v_vendor_name, 'Vendor'),
        'shortlisted'::public.vendor_status,
        v_total_centavos::numeric / 100.0,
        'proposal_accept'
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_vendor_proposal(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_vendor_proposal(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_vendor_proposal(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.respond_vendor_proposal(UUID, TEXT, TEXT) IS
  'Couple/delegate accepts or declines a sent vendor proposal (data-link program ③). Serialized via SELECT FOR UPDATE + status-precondition UPDATE so concurrent accept/decline is single-winner. On accept, upserts the couple''s priced event_vendors pick (Vendor Transaction Lifecycle Phase 1 PR3): bumps an existing row''s price + considering→shortlisted (never downgrades a booked row, never touches category), or inserts a priced shortlisted row when none exists. Status-flip-never-delete; accepting is a signal, not a payment.';

COMMIT;
