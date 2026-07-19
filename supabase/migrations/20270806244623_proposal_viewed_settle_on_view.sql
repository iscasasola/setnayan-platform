-- proposal viewed → settle-on-view (Vendor_Token_Settlement_and_Lifecycle_2026-07-13 §2.1)
--
-- The couple OPENING a delivered quotation is value consumed → it settles the
-- vendor's held lead-token (closes the free-quote-extraction hole: a couple can't
-- take the price, comparison-shop off-app, ghost, and cost the vendor a token).
--
-- vendor_proposals.status already reserves 'viewed' (20261208006000) and the
-- accept RPC already tolerates it — but NOTHING ever sets it. This adds:
--   1. a viewed_at stamp,
--   2. mark_proposal_viewed(public_id, viewer_user_id): a service-role transition
--      sent→viewed, gated to a CUSTOMER-SIDE member of the event (couple/coordinator,
--      never the vendor viewing their own proposal). Returns the (vendor,event) so
--      the app can consume the hold with reason 'proposal_viewed'.
-- The token CONSUME itself stays app-gated by NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED
-- (like settle-on-reply at chat-send.ts), reusing consume_lead_token_hold_for.

ALTER TABLE public.vendor_proposals
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

-- Transition a SENT proposal to VIEWED when a customer-side member of its event
-- opens it. SECURITY DEFINER + explicit membership check (the caller is passed in
-- so the app can run it from `after()` on the admin client, off the request path).
-- Idempotent: only 'sent' → 'viewed' transitions; re-opening a 'viewed'/'accepted'
-- proposal returns transitioned=false but still yields the (vendor,event) ids.
CREATE OR REPLACE FUNCTION public.mark_proposal_viewed(
  p_public_id       TEXT,
  p_viewer_user_id  UUID
) RETURNS JSONB AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT proposal_id, event_id, vendor_profile_id, status
    INTO r
    FROM public.vendor_proposals
   WHERE public_id = p_public_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('transitioned', false);
  END IF;

  -- The viewer must be a CUSTOMER-SIDE member of the event (couple or their
  -- coordinator/delegate) — never the vendor (a vendor is not an event_member;
  -- and a vendor previewing its own sent quote must not settle the token).
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members
     WHERE event_id = r.event_id
       AND user_id = p_viewer_user_id
       AND member_type IN ('couple', 'coordinator')
  ) THEN
    RETURN jsonb_build_object('transitioned', false);
  END IF;

  IF r.status <> 'sent' THEN
    RETURN jsonb_build_object(
      'transitioned', false,
      'vendor_profile_id', r.vendor_profile_id,
      'event_id', r.event_id
    );
  END IF;

  UPDATE public.vendor_proposals
     SET status = 'viewed', viewed_at = now(), updated_at = now()
   WHERE proposal_id = r.proposal_id
     AND status = 'sent';

  RETURN jsonb_build_object(
    'transitioned', true,
    'vendor_profile_id', r.vendor_profile_id,
    'event_id', r.event_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Service-role only (called from the app's admin client in `after()`), matching
-- the consume_lead_token_hold_for grant pattern.
REVOKE ALL ON FUNCTION public.mark_proposal_viewed(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_proposal_viewed(TEXT, UUID) TO service_role;
