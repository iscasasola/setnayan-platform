-- ============================================================================
-- 20271291565921_service_card_verdicts.sql
--
-- 🃏 SERVICE CARD CHECKS — the admin verdicts (PR 3 of the PLAN's order).
-- Owner 2026-10-26 (DECISION_LOG "APPROVED — SERVICE CARD CHECKS AS DRAWN"):
-- claim words are "admin-editable, per-shop allowance"; a held card goes live on
-- the admin's Approve. Lands WITH Integrity watch › Cards, which writes and calls
-- both — a table nobody writes, or a function nobody calls, is a wish (ugat
-- both-ends).
--
--   1. `card_claim_word_allowances` — "Not a problem — stop flagging “…” for this
--      shop". RLS at CREATE: admin only; the save's check reads it with the
--      service role.
--   2. `approve_service_card(flag, reviewer, note)` — closes the holding flag as
--      `approved` and puts the card live in ONE transaction through the
--      `app.service_card_verdict` door the publish gate already honours
--      (20271290013489). service_role only.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================

BEGIN;

-- ── 1 · the per-shop allowance ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.card_claim_word_allowances (
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  phrase            TEXT NOT NULL
                      REFERENCES public.card_claim_words(phrase) ON DELETE CASCADE ON UPDATE CASCADE,
  allowed_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, phrase)
);
ALTER TABLE public.card_claim_word_allowances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS card_claim_word_allowances_admin_all ON public.card_claim_word_allowances;
CREATE POLICY card_claim_word_allowances_admin_all ON public.card_claim_word_allowances
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON public.card_claim_word_allowances FROM anon;

COMMENT ON TABLE public.card_claim_word_allowances IS
  '"Not a problem — stop flagging “…” for this shop" (owner 2026-10-26: claim '
  'words are admin-editable with a per-shop allowance). Written from an open '
  'card on Integrity watch › Cards. Removing the word removes its allowances.';

-- ── 2 · Approve — the one door ──────────────────────────────────────────────
-- Closes the holding flag as `approved` and puts the card live, in ONE
-- transaction, so a card can never be approved-but-hidden or live-but-held.
-- The cover · price · what's-included gate still runs on the flip: an Approve
-- cannot publish a card the gate would refuse. Returns FALSE (and changes
-- nothing) when the flag is not holding any more — a stale second click.
CREATE OR REPLACE FUNCTION public.approve_service_card(
  p_flag_id  BIGINT,
  p_reviewer UUID,
  p_note     TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service UUID;
BEGIN
  UPDATE public.integrity_flags
     SET status           = 'approved',
         resolution_notes = COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), 'Approved — the card is live.'),
         reviewed_by      = p_reviewer,
         reviewed_at      = NOW()
   WHERE id = p_flag_id
     AND kind = 'service_card'
     AND status IN ('open', 'asked_to_fix', 'rejected')
  RETURNING subject_service_id INTO v_service;

  IF v_service IS NULL THEN
    RETURN FALSE;
  END IF;

  -- `true` = LOCAL: the door dies with this transaction (connections are
  -- pooled), and is shut again explicitly right after the one flip.
  PERFORM set_config('app.service_card_verdict', 'approve', true);
  UPDATE public.vendor_services
     SET is_active = TRUE, updated_at = NOW()
   WHERE vendor_service_id = v_service;
  PERFORM set_config('app.service_card_verdict', '', true);

  RETURN TRUE;
END;
$function$;

COMMENT ON FUNCTION public.approve_service_card(BIGINT, UUID, TEXT) IS
  'Integrity watch › Cards › Approve: closes a holding service_card flag as '
  'approved and puts the card live in one transaction (the publish gate''s '
  'cover · price · inclusions arms still apply). service_role only — called by '
  'the admin action after requireAdmin().';

REVOKE ALL ON FUNCTION public.approve_service_card(BIGINT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_service_card(BIGINT, UUID, TEXT) TO service_role;

COMMIT;
