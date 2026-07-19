-- vendor_partnerships_mutual_accept
--
-- Phase 4 of the vendor-dashboard reorg: rip-and-replace the admin-verified
-- partnership model with a MUTUAL-ACCEPT handshake between the two vendors.
--
-- Before: a vendor declared a partnership (recommending → recommended) and it
-- stayed hidden until an admin two-eyes-verified it (admin_verified=true). The
-- recommended vendor had no say; visibility was gated on admin_verified.
--
-- After: the proposer creates the row (status='proposed'); the RECIPIENT (the
-- recommended vendor) accepts or declines; the PROPOSER may withdraw. Public
-- visibility (couple-facing badges) is gated on status='accepted', NOT on
-- admin_verified. Admins can still manage everything.
--
-- We DO NOT drop admin_verified — leaving it avoids breaking historical rows /
-- the admin queue during transition; we simply stop gating visibility on it.
--
-- IMPORTANT — status DEFAULT is 'accepted' so EVERY EXISTING ROW stays publicly
-- visible after this migration (existing partnerships were already live badges;
-- flipping them to 'proposed' would silently unpublish real relationships).
-- The proposer INSERT policy forces new rows to 'proposed'.
--
-- KEEP THIS MIGRATION IDEMPOTENT (see header rules).

-- ── 1. New columns ──────────────────────────────────────────────────────────
ALTER TABLE public.vendor_partnerships
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';

-- Named CHECK, added defensively (idempotent: drop-then-add).
ALTER TABLE public.vendor_partnerships
  DROP CONSTRAINT IF EXISTS vendor_partnerships_status_check;
ALTER TABLE public.vendor_partnerships
  ADD CONSTRAINT vendor_partnerships_status_check
  CHECK (status IN ('proposed', 'accepted', 'declined', 'withdrawn'));

ALTER TABLE public.vendor_partnerships
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- ── 2. Unordered-pair UNIQUE index ──────────────────────────────────────────
-- The original table has UNIQUE (recommending, recommended, relationship_type),
-- which lets A→B AND B→A coexist for the same relationship_type (a duplicate
-- reciprocal partnership). Add a UNIQUE index on the UNORDERED pair so only ONE
-- partnership of a given relationship_type can exist between two vendors,
-- regardless of who proposed it.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_partnerships_unordered_pair_uidx
  ON public.vendor_partnerships (
    LEAST(recommending_vendor_id, recommended_vendor_id),
    GREATEST(recommending_vendor_id, recommended_vendor_id),
    relationship_type
  );

-- Look-up index for a vendor's incoming proposals (recipient inbox).
CREATE INDEX IF NOT EXISTS vendor_partnerships_recipient_status_idx
  ON public.vendor_partnerships (recommended_vendor_id, status);

-- ── 3. RLS — replace the admin_verified visibility model with mutual-accept ──
-- (RLS is already ENABLED on this table from the original CREATE.)

-- 3a. PUBLIC READ — active + accepted only (couple-facing badges).
-- REPLACES the old "is_active AND admin_verified" gate. Existing rows default
-- to status='accepted' so they remain visible.
DROP POLICY IF EXISTS "public read verified vendor partnerships" ON public.vendor_partnerships;
DROP POLICY IF EXISTS "public read accepted vendor partnerships" ON public.vendor_partnerships;
CREATE POLICY "public read accepted vendor partnerships"
  ON public.vendor_partnerships
  FOR SELECT
  USING (is_active = true AND status = 'accepted');

-- 3b. PARTIES READ — a vendor can always see partnerships they are a party to,
-- in ANY status (so the proposer sees their pending/declined/withdrawn rows and
-- the recipient sees incoming 'proposed' rows in the inbox). Without this, an
-- authenticated vendor could only ever read 'accepted' rows via 3a.
DROP POLICY IF EXISTS "parties read own vendor partnerships" ON public.vendor_partnerships;
CREATE POLICY "parties read own vendor partnerships"
  ON public.vendor_partnerships
  FOR SELECT
  TO authenticated
  USING (
    recommending_vendor_id IN (SELECT public.current_vendor_profile_ids())
    OR recommended_vendor_id IN (SELECT public.current_vendor_profile_ids())
  );

-- 3c. PROPOSER INSERT — a vendor proposes a partnership FROM one of their own
-- profiles. The row is FORCED to status='proposed' (a proposer can never insert
-- a pre-accepted row and self-publish a badge).
DROP POLICY IF EXISTS "vendors declare partnerships" ON public.vendor_partnerships;
DROP POLICY IF EXISTS "proposer inserts vendor partnership" ON public.vendor_partnerships;
CREATE POLICY "proposer inserts vendor partnership"
  ON public.vendor_partnerships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recommending_vendor_id IN (SELECT public.current_vendor_profile_ids())
    AND status = 'proposed'
  );

-- 3d. RECIPIENT UPDATE — the RECOMMENDED vendor accepts or declines. USING
-- selects only rows where the current user is the recipient; WITH CHECK ensures
-- the new status is 'accepted' or 'declined' AND the recipient identity is
-- preserved (they can't repoint recommended_vendor_id away from themselves).
DROP POLICY IF EXISTS "vendors deactivate own partnerships" ON public.vendor_partnerships;
DROP POLICY IF EXISTS "recipient responds to vendor partnership" ON public.vendor_partnerships;
CREATE POLICY "recipient responds to vendor partnership"
  ON public.vendor_partnerships
  FOR UPDATE
  TO authenticated
  USING (recommended_vendor_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (
    recommended_vendor_id IN (SELECT public.current_vendor_profile_ids())
    AND status IN ('accepted', 'declined')
  );

-- 3e. PROPOSER UPDATE — the RECOMMENDING vendor withdraws their own proposal.
-- USING selects only rows where the current user is the proposer; WITH CHECK
-- restricts the new status to 'withdrawn' AND preserves the proposer identity.
--
-- RLS COMBINATION NOTE: 3d + 3e are both PERMISSIVE UPDATE policies, so Postgres
-- OR-combines their USING (which rows are updatable) AND their WITH CHECK (is
-- the new row valid). Because the table enforces recommending <> recommended,
-- no single vendor profile is ever BOTH parties on the same row, so for any
-- given row exactly one of 3d/3e's USING passes. The OR-combined WITH CHECK is
-- still safe: a recipient trying status='withdrawn' fails BOTH checks (recipient
-- check requires accepted/declined; proposer check requires the recommending id
-- to be theirs), and a proposer trying status='accepted' fails BOTH checks —
-- so neither party can perform the other party's transition.
DROP POLICY IF EXISTS "proposer withdraws vendor partnership" ON public.vendor_partnerships;
CREATE POLICY "proposer withdraws vendor partnership"
  ON public.vendor_partnerships
  FOR UPDATE
  TO authenticated
  USING (recommending_vendor_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (
    recommending_vendor_id IN (SELECT public.current_vendor_profile_ids())
    AND status = 'withdrawn'
  );

-- 3f. ADMIN MANAGE — unchanged (full access, including any status transition).
DROP POLICY IF EXISTS "admins manage vendor partnerships" ON public.vendor_partnerships;
CREATE POLICY "admins manage vendor partnerships"
  ON public.vendor_partnerships
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 4. Derived "worked together" helper ─────────────────────────────────────
-- Two vendors "worked together" when they both have marketplace-linked
-- event_vendors rows sharing the same event_id. Surfaced as an ELIGIBILITY HINT
-- in the propose UI (not a hard block). SECURITY DEFINER + STABLE so the vendor
-- can call it for their own profile without needing broad event_vendors read
-- access; the function only ever answers a boolean about a specific pair.
CREATE OR REPLACE FUNCTION public.vendors_worked_together(
  vendor_a UUID,
  vendor_b UUID
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_vendors ea
    JOIN public.event_vendors eb
      ON eb.event_id = ea.event_id
    WHERE ea.marketplace_vendor_id = vendor_a
      AND eb.marketplace_vendor_id = vendor_b
      AND vendor_a <> vendor_b
  );
$$;

-- List the profile ids the given vendor has shared at least one event with
-- (marketplace co-occurrence). Used to render "worked together" hints in the
-- propose picker. SECURITY DEFINER, returns only vendor_profile_id UUIDs.
CREATE OR REPLACE FUNCTION public.vendor_worked_with_ids(
  for_vendor UUID
)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT eb.marketplace_vendor_id
  FROM public.event_vendors ea
  JOIN public.event_vendors eb
    ON eb.event_id = ea.event_id
  WHERE ea.marketplace_vendor_id = for_vendor
    AND eb.marketplace_vendor_id IS NOT NULL
    AND eb.marketplace_vendor_id <> for_vendor;
$$;

GRANT EXECUTE ON FUNCTION public.vendors_worked_together(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_worked_with_ids(UUID) TO authenticated;
