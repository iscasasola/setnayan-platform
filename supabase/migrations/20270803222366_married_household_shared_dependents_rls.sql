-- ============================================================================
-- 20270803222366_married_household_shared_dependents_rls.sql
--
-- PR-G · MARRIED HOUSEHOLD (date-anchor · Phase 3 family graph · COUNSEL-GATED).
-- Two spouses who co-host a wedding form a household; their JOINT children are
-- shared between them (a joint Year view), while each spouse's OWN relatives stay
-- private unless explicitly shared. Consent asymmetry (owner rule B6):
--   • relationship = 'child'  → shared with the spouse BY DEFAULT (auto-shared)
--   • anyone else (parent/sibling/grandparent/other) → PRIVATE, opt-in only
--
-- ⚠ This WIDENS RLS on `dependents` — the most sensitive table on the platform
-- (a minor's birthdate + religion + sex). It is INERT in production: dependents
-- are only ever inserted through the flag-gated add action, so the table is EMPTY
-- until the DPO clears G1 (which explicitly covers the household consent model)
-- and flips NEXT_PUBLIC_DEPENDENT_PEOPLE. Merging this stores/reveals nothing.
-- The consent-asymmetry design is owner + counsel sign-off (B6, feeds G1).
--
-- DISSOLUTION / CO-PARENTING: the spouse link is derived from co-hosting the
-- wedding and is NOT filtered by archived — so if the marriage event is later
-- archived (annulment/separation), co-parents KEEP access to their shared kids.
-- That is deliberate (B6 dissolution co-parenting rule), not an oversight.
--
-- Idempotent.
-- ============================================================================

BEGIN;

-- ── 1. Sharing flag (default PRIVATE; the add action sets TRUE for children) ──
ALTER TABLE public.dependents
  ADD COLUMN IF NOT EXISTS shared_with_spouse BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill the consent-asymmetry default for any pre-existing rows (none in prod
-- — the table is empty behind the flag; correct for dev/seed rows).
UPDATE public.dependents SET shared_with_spouse = TRUE
  WHERE relationship = 'child' AND shared_with_spouse = FALSE;

CREATE INDEX IF NOT EXISTS dependents_shared_idx
  ON public.dependents(owner_user_id) WHERE shared_with_spouse;

-- ── 2. Spouse resolution ──────────────────────────────────────────────────────
-- The other user(s) who co-host a WEDDING with the caller as member_type='couple'.
-- SECURITY DEFINER so the policy can resolve the link without the caller needing
-- direct RLS read on every event_members row (and to avoid policy recursion).
CREATE OR REPLACE FUNCTION public.current_spouse_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT other.user_id
  FROM public.event_members me
  JOIN public.events e
    ON e.event_id = me.event_id AND e.event_type = 'wedding'
  JOIN public.event_members other
    ON other.event_id = me.event_id
  WHERE me.user_id = auth.uid()
    AND me.member_type = 'couple'
    AND other.member_type = 'couple'
    AND other.user_id <> auth.uid();
$$;

COMMENT ON FUNCTION public.current_spouse_user_ids() IS
  'The caller''s spouse user_id(s): other member_type=couple co-hosts of a wedding they co-host. Not archived-filtered (dissolution co-parenting persists). Used by the dependents spouse-read policy.';

-- ── 3. Spouse READ policy (additive to the owner FOR ALL policy) ──────────────
-- A spouse may READ (never write) a dependent the other spouse marked shared.
-- The existing dependents_owner_all policy still governs all writes + own reads.
DROP POLICY IF EXISTS dependents_spouse_read ON public.dependents;
CREATE POLICY dependents_spouse_read
  ON public.dependents
  FOR SELECT
  TO authenticated
  USING (
    shared_with_spouse = TRUE
    AND owner_user_id IN (SELECT public.current_spouse_user_ids())
  );

COMMIT;
