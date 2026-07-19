-- #6 (money bug-hunt 2026-06-26): when a couple ACCEPTS a vendor proposal,
-- respond_vendor_proposal overwrites event_vendors.total_cost_php but left the
-- pax-surcharge bookkeeping (pax_surcharge_php / pax_quote_base / cost_basis_pax)
-- stale — so the NEXT guest-count surcharge confirm charged against the new total
-- using the OLD base, a wrong amount. Re-baseline on accept: the proposal's total
-- is the price for the pax it was quoted at (merge_snapshot.confirmed_guests), so
-- zero the applied surcharge, set the quote base to that pax (kept if the snapshot
-- has no usable count), and clear cost_basis_pax so the next confirm re-evaluates.
-- Full CREATE OR REPLACE (unchanged body except the accept-UPDATE/INSERT) so the
-- prior guards (FOR UPDATE single-winner, couple-membership, status precondition,
-- priced-pick upsert) are preserved verbatim. Already applied to prod
-- (apply_migration: money_proposal_accept_pax_rebaseline); repo record. Idempotent.
CREATE OR REPLACE FUNCTION public.respond_vendor_proposal(
  p_proposal_id uuid,
  p_response text,
  p_coarse_category text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id          UUID;
  v_status            TEXT;
  v_vendor_profile_id UUID;
  v_total_centavos    BIGINT;
  v_confirmed_guests  INT;
  v_rows              INTEGER;
  v_existing_id       UUID;
  v_existing_status   public.vendor_status;
  v_vendor_name       TEXT;
  v_category          public.vendor_category;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'bad_response' USING ERRCODE = '22023';
  END IF;

  SELECT event_id, status, vendor_profile_id, total_centavos,
         NULLIF(merge_snapshot->>'confirmed_guests', '')::int
    INTO v_event_id, v_status, v_vendor_profile_id, v_total_centavos, v_confirmed_guests
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

  IF p_response = 'accepted' THEN
    SELECT vendor_id, status
      INTO v_existing_id, v_existing_status
    FROM public.event_vendors
    WHERE event_id = v_event_id
      AND marketplace_vendor_id = v_vendor_profile_id
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.event_vendors
      SET total_cost_php = v_total_centavos::numeric / 100.0,
          status = CASE WHEN v_existing_status = 'considering'
                        THEN 'shortlisted'::public.vendor_status
                        ELSE status END,
          -- #6: the accepted total re-baselines the pax surcharge to the
          -- proposal's pax so the stale surcharge doesn't apply to the new base.
          pax_surcharge_php = 0,
          pax_quote_base = COALESCE(NULLIF(v_confirmed_guests, 0), pax_quote_base),
          cost_basis_pax = NULL,
          updated_at = NOW()
      WHERE vendor_id = v_existing_id;
    ELSE
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
        pax_quote_base,
        source
      ) VALUES (
        v_event_id,
        v_vendor_profile_id,
        v_vendor_profile_id,
        v_category,
        COALESCE(v_vendor_name, 'Vendor'),
        'shortlisted'::public.vendor_status,
        v_total_centavos::numeric / 100.0,
        NULLIF(v_confirmed_guests, 0),
        'proposal_accept'
      );
    END IF;
  END IF;
END;
$function$;
