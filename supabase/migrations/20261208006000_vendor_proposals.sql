-- ============================================================================
-- PROPOSAL AUTO-FILL — Vendor Portal data-link program ③
-- (corpus: 03_Strategy/Vendor_Portal_Event_Data_Link_2026-06-13.md § 3).
--
--   1. vendor_proposal_templates — a vendor's reusable proposal bodies with
--      {{merge_tokens}} ({{couple_name}}, {{event_date}}, {{guest_count}}…).
--   2. vendor_proposals — a rendered proposal for ONE booked event. Tokens
--      resolve server-side from data the vendor is ALREADY authorized to see
--      (the Brief + catering-metrics RPCs) — never a new privilege. Snapshot
--      freezes on send: later RSVP movement never mutates a sent proposal.
--   3. respond_vendor_proposal() — couple/delegate accept or decline.
--      Status-flip-never-delete (booking-ruleset convention). Accepting is a
--      SIGNAL, not a booking — money stays off-platform (RA 11967 posture).
--
-- V1 scope: BOOKED clients only (enforced at the DB gate below). Inquiry-
-- stage proposals are designed (§ 3.4 — they'd ride the burn-to-answer
-- unlock) but PARKED pending the owner's proposal=answer ruling.
--
-- Deterministic SQL/TS throughout — zero LLM. Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · vendor_proposal_templates
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_proposal_templates (
  template_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  template_name      TEXT NOT NULL CHECK (length(template_name) BETWEEN 1 AND 120),
  -- Free-form body with {{merge_tokens}}; resolved at proposal-create time.
  body               TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 20000),
  terms              TEXT NOT NULL DEFAULT '' CHECK (length(terms) <= 20000),
  default_package_id UUID REFERENCES public.vendor_packages(package_id) ON DELETE SET NULL,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_proposal_templates_vendor_idx
  ON public.vendor_proposal_templates(vendor_profile_id, created_at DESC);

ALTER TABLE public.vendor_proposal_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_proposal_templates_org_all ON public.vendor_proposal_templates;
CREATE POLICY vendor_proposal_templates_org_all
  ON public.vendor_proposal_templates FOR ALL TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- ----------------------------------------------------------------------------
-- 2 · vendor_proposals
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_proposals (
  proposal_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id          TEXT UNIQUE NOT NULL DEFAULT public.generate_public_id('J'),
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  event_id           UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  template_id        UUID REFERENCES public.vendor_proposal_templates(template_id) ON DELETE SET NULL,
  title              TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  -- Resolved merge data, frozen on send ("based on 142 confirmed as of …").
  merge_snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {body, terms} with tokens resolved; line_items [{label, detail, amount_centavos}].
  rendered_body      TEXT NOT NULL DEFAULT '',
  rendered_terms     TEXT NOT NULL DEFAULT '',
  line_items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_centavos     BIGINT NOT NULL DEFAULT 0 CHECK (total_centavos >= 0),
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  valid_until        DATE,
  sent_at            TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,
  resolved_by_user_id UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_proposals_vendor_idx
  ON public.vendor_proposals(vendor_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_proposals_event_idx
  ON public.vendor_proposals(event_id, status);

ALTER TABLE public.vendor_proposals ENABLE ROW LEVEL SECURITY;

-- Vendor org: create proposals only for events it is BOOKED on (the same
-- gate every data-link surface keys on), and only as drafts.
DROP POLICY IF EXISTS vendor_proposals_org_insert ON public.vendor_proposals;
CREATE POLICY vendor_proposals_org_insert
  ON public.vendor_proposals FOR INSERT TO authenticated
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
    AND status = 'draft'
  );

DROP POLICY IF EXISTS vendor_proposals_org_read ON public.vendor_proposals;
CREATE POLICY vendor_proposals_org_read
  ON public.vendor_proposals FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Vendor edits/deletes drafts only. "Send" is the draft→sent flip (the USING
-- clause sees the pre-update row). Sent proposals are immutable to the vendor
-- — the couple's copy can't shift under them.
DROP POLICY IF EXISTS vendor_proposals_org_update_draft ON public.vendor_proposals;
CREATE POLICY vendor_proposals_org_update_draft
  ON public.vendor_proposals FOR UPDATE TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND status = 'draft'
  )
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_proposals_org_delete_draft ON public.vendor_proposals;
CREATE POLICY vendor_proposals_org_delete_draft
  ON public.vendor_proposals FOR DELETE TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND status = 'draft'
  );

-- Couple + delegates read everything except drafts on their events.
DROP POLICY IF EXISTS vendor_proposals_couple_read ON public.vendor_proposals;
CREATE POLICY vendor_proposals_couple_read
  ON public.vendor_proposals FOR SELECT TO authenticated
  USING (
    status <> 'draft'
    AND (
      event_id IN (SELECT public.current_couple_event_ids())
      OR event_id IN (SELECT public.current_moderator_event_ids())
    )
  );

COMMENT ON TABLE public.vendor_proposals IS
  'Auto-filled vendor proposals (data-link program ③). Booked events only; tokens resolve from already-authorized aggregates; snapshot frozen on send; accepting = signal, never an on-platform payment.';

-- ----------------------------------------------------------------------------
-- 3 · respond_vendor_proposal — couple/delegate accept · decline
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.respond_vendor_proposal(
  p_proposal_id UUID,
  p_response    TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_status   TEXT;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'bad_response' USING ERRCODE = '22023';
  END IF;

  SELECT event_id, status INTO v_event_id, v_status
  FROM public.vendor_proposals WHERE proposal_id = p_proposal_id;
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
  WHERE proposal_id = p_proposal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_vendor_proposal(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_vendor_proposal(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_vendor_proposal(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.respond_vendor_proposal(UUID, TEXT) IS
  'Couple/delegate accepts or declines a sent vendor proposal (data-link program ③). Status-flip-never-delete; accepting is a signal, not a payment.';
