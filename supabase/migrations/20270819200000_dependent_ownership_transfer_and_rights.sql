-- ============================================================================
-- 20270819200000_dependent_ownership_transfer_and_rights.sql
--
-- Alaga rights gap-fix (follows 20270819114210). Four gaps found live:
--   (1) ON DELETE CASCADE on owner_user_id meant a guardian deleting their
--       account destroyed a CLAIMED adult's record — post-claim the data is
--       the adult's, not the guardian's.
--   (2) A claimed adult could read their profile but never erase it
--       (RA 10173 erasure right) — the freeze policies blocked everyone.
--   (3) A claimed adult couldn't see their own godparents (owner-only RLS on
--       an edge that is THEIR baptismal record).
--
-- Fix: make the claim a TRUE ownership transfer (the owner's model, applied
-- literally — "the account is the rightful owner ... can only be transferred").
-- On claim, owner_user_id MOVES to the claimant and the guardian is stamped
-- into handed_over_by_user_id:
--   • the row now lives and dies with the CLAIMANT's account (guardian
--     deletion no longer cascades over it — their FK is SET NULL);
--   • the claimant inherits the owner policies = full control, including
--     erasure — gap (2) closes structurally, no special-case policy;
--   • the guardian keeps READ-ONLY history via dependents_former_guardian_read
--     (the "keeps the memories, loses the pen" rule, now expressed by
--     ownership rather than a freeze);
--   • the handed_over_at freeze on owner UPDATE/DELETE is dropped — it existed
--     only because ownership used to stay with the guardian.
--
-- Godparents: adds a subject-read policy so the claimed adult can SELECT the
-- ninong/ninang edges on their own record (guardian keeps owner_all; the
-- subquery touches only dependents, which never references godparents — no
-- policy recursion).
--
-- Backfills any already-claimed rows (claim flow went live 2026-07-16).
-- Idempotent.
-- ============================================================================

BEGIN;

-- ── 1. Former-guardian stamp (survives guardian account deletion) ────────────
ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS handed_over_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill rows claimed under the pre-transfer model: move ownership to the
-- claimant, remember the guardian.
UPDATE public.dependents
SET handed_over_by_user_id = owner_user_id,
    owner_user_id          = claimed_user_id
WHERE handed_over_at IS NOT NULL
  AND claimed_user_id IS NOT NULL
  AND handed_over_by_user_id IS NULL
  AND owner_user_id <> claimed_user_id;

-- ── 2. Drop the hand-over freeze — ownership itself is the boundary now ──────
DROP POLICY IF EXISTS dependents_owner_update ON public.dependents;
CREATE POLICY dependents_owner_update
  ON public.dependents
  FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin())
  WITH CHECK (owner_user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS dependents_owner_delete ON public.dependents;
CREATE POLICY dependents_owner_delete
  ON public.dependents
  FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin());

-- ── 3. Former guardian keeps read-only history ───────────────────────────────
DROP POLICY IF EXISTS dependents_former_guardian_read ON public.dependents;
CREATE POLICY dependents_former_guardian_read
  ON public.dependents
  FOR SELECT
  TO authenticated
  USING (handed_over_by_user_id = auth.uid());

-- ── 4a. Godparent edges FOLLOW the claim ─────────────────────────────────────
-- godparents.owner_user_id is ON DELETE CASCADE — while guardian-owned, a
-- claimed adult's ninong/ninang edges would still die with the GUARDIAN's
-- account. Ownership of the edges moves with the profile (the claim action
-- does this for new claims; this backfills any already-claimed rows).
UPDATE public.godparents g
SET owner_user_id = d.claimed_user_id
FROM public.dependents d
WHERE g.dependent_id = d.dependent_id
  AND d.handed_over_at IS NOT NULL
  AND d.claimed_user_id IS NOT NULL
  AND g.owner_user_id <> d.claimed_user_id;

-- ── 4b. The claimed adult reads their own godparent edges ────────────────────
-- Belt-and-braces for any edge not yet transferred (e.g. a claim that raced
-- the godparent hand-off): the subject can always at least READ them.
DROP POLICY IF EXISTS godparents_subject_read ON public.godparents;
CREATE POLICY godparents_subject_read
  ON public.godparents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dependents d
      WHERE d.dependent_id = godparents.dependent_id
        AND d.claimed_user_id = auth.uid()
    )
  );

COMMENT ON COLUMN public.dependents.handed_over_by_user_id IS
  'The former guardian after a claim (ownership transferred to the claimant). Grants them read-only history via dependents_former_guardian_read; SET NULL on their account deletion — the claimed row itself now lives with the claimant.';

COMMIT;
