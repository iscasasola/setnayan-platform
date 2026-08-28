-- a_shop_sees_the_work_it_could_claim
-- ============================================================================
-- CREW SHIFTS: A HOST CAN POST ONE, A BOOKED SHOP CAN SEE IT, AND CLAIM IT.
--
-- ── WHAT WAS ACTUALLY WRONG — FIVE WALLS, MEASURED IN PRODUCTION ───────────
-- The screen says "open gigs appear here once a host you serve posts one". It
-- was on a list as one dead read. It is five, stacked, and each one alone is
-- enough to make the whole feature silent:
--
--   1 · `manpower_gigs.vendor_profile_id` is **NOT NULL in production** while
--       the repo's own CREATE TABLE declares it nullable. The app's entire
--       model is "an open gig has a NULL vendor", so an open gig CANNOT EXIST.
--       (A `CREATE TABLE IF NOT EXISTS` no-op'd against a pre-existing prod
--       table of a different shape — the same drift `20271011120000` already
--       had to repair for `posted_by_user_id` on this very table.)
--   2 · **ZERO INSERT policies.** The host cannot post one. `postManpowerGig`'s
--       own comment asserts "the policy model is INSERT-allowed-for-
--       authenticated" — there is no such policy. A docblock describing a
--       mechanism that does not exist.
--   3 · **No SELECT policy matches an OPEN gig.** All three vendor-side reads
--       key on `vendor_profile_id` being the caller's own shop, and NULL
--       matches none of them.
--   4 · The surface's `event_vendors` gate reads on the vendor's own session,
--       and that table admits no vendor — so the open-gig query never even ran.
--       (Fixed in the app, not here; fourth site of that bug.)
--   5 · **ZERO UPDATE policies.** Nobody but an admin could claim one.
--
-- 🔑 THE PLAN THIS CAME FROM SAYS "not four missing policies, it is a SCHEMA
-- DRIFT". That is half right and the half it gets wrong costs a re-diagnosis:
-- it is the drift **AND** the missing policies **AND** the dead gate. Repairing
-- only the drift leaves the feature exactly as silent.
--
-- ── THE CLAIM IS AN RPC, NOT AN UPDATE POLICY, AND THAT IS DELIBERATE ──────
-- 🔒 THE ROW IS YOURS, THE FIELD IS NOT. `authenticated` holds UPDATE on every
-- column of this table, so a permissive UPDATE policy wide enough to let a shop
-- claim a gig is also wide enough to let it rewrite `cash_amount_php_centavos`
-- — editing what it is about to be paid. Claiming is therefore a SECURITY
-- DEFINER single-winner function and this migration adds NO update policy at
-- all. It is also the shape the shipped action already assumed: its own comment
-- describes a race where "another vendor claimed it between our reads".
--
-- 🔢 SAFE BY ARITHMETIC. `manpower_gigs` holds ZERO rows — none ever posted,
-- none open, none pending (measured 2026-08-29). Dropping NOT NULL cannot
-- invalidate an existing row, and every policy below is new reach into a table
-- that is empty.
--
-- ⚠ AND THE REPLAY CANNOT PROVE ANY OF THIS. `apps/web/tests/db/` builds from
-- the REPO file, which already has the nullable column — so a db test passes
-- there and says nothing about production. This migration was dry-run against
-- PROD inside `BEGIN…ROLLBACK` and the transcript is in the PR.
--
-- BARE migration (no BEGIN/COMMIT): idempotent + re-run safe throughout.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1 · THE DRIFT. Make production agree with the repo, not the other way round.
-- ----------------------------------------------------------------------------
ALTER TABLE public.manpower_gigs
  ALTER COLUMN vendor_profile_id DROP NOT NULL;

COMMENT ON COLUMN public.manpower_gigs.vendor_profile_id IS
  'The shop that CLAIMED this shift, NULL while it is still open. Nullable is the whole model: a host posts a gig with no shop attached and a booked shop claims it. Production carried NOT NULL until 20271179151893 -- a CREATE TABLE IF NOT EXISTS that no-op''d against a pre-existing table of a different shape -- which made an open gig impossible to create at all. Only claim_manpower_gig() ever sets it.';

-- ----------------------------------------------------------------------------
-- 2 · THE HOST CAN POST ONE.
--
--     Pinned hard, because `authenticated` holds INSERT on every column: the
--     host may only create an OPEN, PENDING gig on their OWN celebration, in
--     their own name. Without the `vendor_profile_id IS NULL` clause a host
--     could post a gig pre-assigned to a shop that never agreed to it.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS manpower_gigs_host_posts_open ON public.manpower_gigs;
CREATE POLICY manpower_gigs_host_posts_open
  ON public.manpower_gigs FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    AND posted_by_user_id = auth.uid()
    AND vendor_profile_id IS NULL
    AND status = 'pending'
  );

-- ----------------------------------------------------------------------------
-- 3 · A BOOKED SHOP CAN SEE THE OPEN ONES.
--
--     Scoped to celebrations the shop is genuinely booked on -- the same helper
--     the schedule-block read uses -- and to gigs that are still CLAIMABLE.
--     ⛔ It deliberately does NOT expose a gig somebody else has taken: once
--     claimed, `vendor_profile_id` is set and the existing owner-read policy is
--     the only thing that admits it. A shop sees work it can take, never a
--     record of what a rival was paid.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS manpower_gigs_booked_vendor_sees_open ON public.manpower_gigs;
CREATE POLICY manpower_gigs_booked_vendor_sees_open
  ON public.manpower_gigs FOR SELECT TO authenticated
  USING (
    vendor_profile_id IS NULL
    AND status = 'pending'
    AND event_id IN (SELECT public.current_vendor_booked_event_ids())
  );

-- ----------------------------------------------------------------------------
-- 4 · AND CAN CLAIM ONE. Single-winner, idempotent, ownership-gated.
--
--     Modelled on withdraw_vendor_payment_ask / accept_change_order:
--     SELECT … FOR UPDATE -> precondition -> atomic UPDATE repeating the
--     precondition in the WHERE -> ROW_COUNT -> a lost race reports itself
--     rather than erroring.
--
--     🔑 GATED ON `auth.uid()`, SO IT MUST BE CALLED ON THE CALLER'S OWN
--     SESSION. On the service-role client auth.uid() is NULL, every ownership
--     test fails, and the feature would refuse every claim while looking
--     finished.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_manpower_gig(p_gig_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_status     TEXT;
  v_claimed_by UUID;
  v_mine       UUID;
  v_rows       INT;
BEGIN
  IF p_gig_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT g.event_id, g.status, g.vendor_profile_id
    INTO v_event_id, v_status, v_claimed_by
  FROM public.manpower_gigs g
  WHERE g.gig_id = p_gig_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- WHICH of the caller's shops is booked on this celebration. A shop may hold
  -- several profiles; the claim is stamped with the one that is actually there.
  SELECT ev.marketplace_vendor_id
    INTO v_mine
  FROM public.event_vendors ev
  WHERE ev.event_id = v_event_id
    AND ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())
    AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
    AND ev.archived_at IS NULL
  LIMIT 1;

  IF v_mine IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_booked_here');
  END IF;

  -- Already taken. Says WHO only when it is the caller, so a lost race never
  -- discloses which rival won it.
  IF v_claimed_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', v_claimed_by = v_mine,
      'reason', CASE WHEN v_claimed_by = v_mine THEN 'already_yours' ELSE 'already_claimed' END);
  END IF;

  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_open');
  END IF;

  UPDATE public.manpower_gigs
     SET vendor_profile_id = v_mine,
         status            = 'accepted',
         accepted_at       = NOW()
   WHERE gig_id = p_gig_id
     AND vendor_profile_id IS NULL
     AND status = 'pending';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- Somebody won it between the SELECT and here.
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'claimed', 'event_id', v_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_manpower_gig(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_manpower_gig(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_manpower_gig(UUID) TO authenticated;

COMMENT ON FUNCTION public.claim_manpower_gig(UUID) IS
  'A booked shop claims an OPEN crew shift. The ONLY writer of manpower_gigs.vendor_profile_id from a user session -- there is deliberately NO vendor UPDATE policy, because authenticated holds UPDATE on every column and any policy wide enough to permit a claim would also permit rewriting cash_amount_php_centavos. Single-winner (SELECT FOR UPDATE + the open precondition repeated in the UPDATE WHERE) and honest about a lost race. Ownership resolves from auth.uid() via a CONFIRMED event_vendors booking, so it must be called on the caller''s own session; on service_role auth.uid() is NULL and every claim is refused. A lost race never names the rival that won.';
