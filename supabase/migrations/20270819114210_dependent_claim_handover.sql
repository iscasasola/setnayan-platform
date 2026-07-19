-- ============================================================================
-- 20270819114210_dependent_claim_handover.sql
--
-- The Alaga CLAIM / HAND-OVER flow (Phase 3 family graph). The ownership rule
-- (owner-locked 2026-07-16): the guardian account is the RIGHTFUL OWNER of an
-- alaga profile; a PERSON's profile can transfer to the person's own account
-- only once their birthday reaches the age of majority — 18 for everyone
-- (RA 6809). A pet/other profile never becomes an account; it can only be
-- REHOMED to another guardian.
--
-- Mechanism: the guardian mints a single-use claim link (token on the row, one
-- active link per alaga, 7-day expiry, revocable). The recipient signs in (or
-- up) and redeems it:
--   • purpose 'claim'  (person, age ≥ 18): stamps handed_over_at +
--     claimed_user_id. The row STAYS with the guardian as read-only history —
--     the person now owns their data (dependents_claimed_read below); the
--     guardian keeps the memory, loses the pen.
--   • purpose 'rehome' (pet/other): owner_user_id moves to the redeemer; the
--     old guardian loses the row entirely (care transferred).
-- Redemption runs through the service-role client as ONE conditional UPDATE
-- (WHERE token + unexpired + not-yet-handed-over + age proof) — atomic, so two
-- concurrent redeems can't both win. Age proof for 'claim' = stored birth_date
-- ≤ (today − 18 years), computed by the action in Manila time.
--
-- RLS: splits the old owner FOR ALL policy so a handed-over row becomes
-- READ-ONLY to its guardian (no more edits/erasure of what is now the adult's
-- own data — their RA 10173 rights attach at majority) while the claimant
-- gains SELECT on their own claimed record. Spouse-read (PR-G) unchanged.
-- Admin override retained for support.
--
-- Flag posture: NEXT_PUBLIC_DEPENDENT_PEOPLE was flipped ON by the owner
-- 2026-07-16 (pre-G1; owner = DPO). This migration must therefore be applied
-- to prod BEFORE the feature code deploys. Additive + idempotent.
-- ============================================================================

BEGIN;

-- ── 1. Claim-link columns (one active link per alaga) ────────────────────────
ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS claim_token            TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS claim_token_purpose    TEXT,
  ADD COLUMN IF NOT EXISTS claim_token_expires_at TIMESTAMPTZ;

ALTER TABLE public.dependents DROP CONSTRAINT IF EXISTS dependents_claim_purpose_check;
ALTER TABLE public.dependents
  ADD CONSTRAINT dependents_claim_purpose_check
  CHECK (claim_token_purpose IS NULL OR claim_token_purpose IN ('claim', 'rehome'));

-- ── 2. RLS: hand-over freezes the guardian's pen ─────────────────────────────
-- Replace the single FOR ALL owner policy with per-command policies so UPDATE/
-- DELETE exclude handed-over rows. SELECT + INSERT behavior is unchanged.
DROP POLICY IF EXISTS dependents_owner_all ON public.dependents;

DROP POLICY IF EXISTS dependents_owner_read ON public.dependents;
CREATE POLICY dependents_owner_read
  ON public.dependents
  FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS dependents_owner_insert ON public.dependents;
CREATE POLICY dependents_owner_insert
  ON public.dependents
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR public.is_admin());

-- A handed-over record belongs to the adult now — the guardian can still SEE
-- it (history) but can no longer edit or erase it. Admin keeps support access.
DROP POLICY IF EXISTS dependents_owner_update ON public.dependents;
CREATE POLICY dependents_owner_update
  ON public.dependents
  FOR UPDATE
  TO authenticated
  USING ((owner_user_id = auth.uid() AND handed_over_at IS NULL) OR public.is_admin())
  WITH CHECK ((owner_user_id = auth.uid() AND handed_over_at IS NULL) OR public.is_admin());

DROP POLICY IF EXISTS dependents_owner_delete ON public.dependents;
CREATE POLICY dependents_owner_delete
  ON public.dependents
  FOR DELETE
  TO authenticated
  USING ((owner_user_id = auth.uid() AND handed_over_at IS NULL) OR public.is_admin());

-- The claimant reads their own claimed record (their data now).
DROP POLICY IF EXISTS dependents_claimed_read ON public.dependents;
CREATE POLICY dependents_claimed_read
  ON public.dependents
  FOR SELECT
  TO authenticated
  USING (claimed_user_id = auth.uid());

COMMENT ON COLUMN public.dependents.claim_token IS
  'Single-use hand-over/rehome link token (one active per alaga; 7-day expiry; guardian-revocable). Redeemed atomically by the claim action via service role.';
COMMENT ON COLUMN public.dependents.claim_token_purpose IS
  '''claim'' = person takes ownership of their own profile at ≥18 (stamps handed_over_at + claimed_user_id; row goes read-only to the guardian). ''rehome'' = pet/other care transfers owner_user_id to the redeemer.';

COMMIT;
