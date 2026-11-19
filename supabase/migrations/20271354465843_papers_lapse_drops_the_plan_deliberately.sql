-- papers_lapse_drops_the_plan_deliberately
-- ============================================================================
-- THE 30 MARCH LAPSE MUST ACTUALLY DROP THE PLAN — through the one door the
-- downgrade guard leaves open, and through nothing else.
--
-- 🚨 THE LATENT FAULT THIS CLOSES (found reviewing #7979, before it could bite).
-- `stampLapsedPapers` (apps/web/lib/papers-lapse.server.ts) wrote
-- `tier_state = 'free'` with a plain PostgREST update. The trigger
-- `vendor_tier_no_silent_downgrade` (20271115090000) refuses every update that
-- LOWERS a shop still inside its tier unless `setnayan.allow_tier_downgrade` is
-- on for the transaction — and a PostgREST update cannot set it. Both lapse
-- writes were refused:
--   · free_drop — a free "verified" plan has no end date, so it is always live;
--   · hold      — a paid plan with days left is, by definition, live.
-- The refusal reached only a console line (the pass NEVER THROWS), so on
-- 31 March every lapsed shop would have stayed stamped-not, findable, and on
-- its plan, with nothing red anywhere.
--
-- ✅ THE FIX: one SECURITY DEFINER function that sets the escape hatch for its
-- own transaction, writes the stamp, the lower plan and the stopped clock
-- (`tier_expires_at = NULL`, the held days) in ONE update, and clears the
-- hatch again. It re-checks the lapse itself (verified · not yet stamped ·
-- renewal day passed), so the hatch cannot be borrowed to lower any other shop.
-- The guard trigger is NOT touched — a plain downgrade from anywhere else is
-- still refused (tests/db/papers-lapse-drops-the-plan.db.test.ts).
--
-- ADD-ONLY: one function. Service role only.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.stamp_papers_lapse(
  p_vendor_profile_id UUID,
  p_plan TEXT,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_changed INTEGER;
BEGIN
  IF p_plan IS NULL OR p_plan NOT IN ('none', 'free_drop', 'hold') THEN
    RAISE EXCEPTION 'stamp_papers_lapse: unknown plan %', p_plan USING ERRCODE = '22023';
  END IF;

  -- The deliberate downgrade, for THIS transaction only (is_local = true).
  IF p_plan <> 'none' THEN
    PERFORM set_config('setnayan.allow_tier_downgrade', 'on', true);
  END IF;

  UPDATE public.vendor_profiles vp
     SET papers_lapsed_at = p_now,
         -- free_drop: the free "verified" plan becomes "free".
         -- hold: a paid plan becomes "free" with its clock stopped; the days
         -- left wait in the lapse's audit row (planHoldAtLapse / planBackAtRenewal).
         tier_state = CASE
           WHEN p_plan = 'free_drop' AND vp.tier_state = 'verified' THEN 'free'::public.vendor_tier_state
           WHEN p_plan = 'hold' THEN 'free'::public.vendor_tier_state
           ELSE vp.tier_state
         END,
         tier_expires_at = CASE WHEN p_plan = 'hold' THEN NULL ELSE vp.tier_expires_at END,
         updated_at = p_now
   WHERE vp.vendor_profile_id = p_vendor_profile_id
     -- The lapse, re-checked here: the hatch cannot lower any other shop.
     AND vp.verification_state = 'verified'
     AND vp.papers_lapsed_at IS NULL
     AND vp.next_renewal_due_at IS NOT NULL
     AND vp.next_renewal_due_at < p_now;
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  -- Closed again at once, so nothing later in the transaction inherits it.
  PERFORM set_config('setnayan.allow_tier_downgrade', '', true);

  RETURN v_changed = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) IS
  'The 30 March papers lapse, in one write: stamps papers_lapsed_at and, per p_plan (planHoldAtLapse in '
  'lib/papers-renewal.ts), drops a free "verified" plan to free (free_drop) or a paid plan to free with its clock '
  'stopped (hold, tier_expires_at NULL). Sets setnayan.allow_tier_downgrade for its own transaction only, so '
  'guard_vendor_tier_no_silent_downgrade lets THIS downgrade through and still refuses every other. Re-checks the '
  'lapse (verified, unstamped, renewal day passed). Returns true when the row was stamped. Service role only; '
  'called by lib/papers-lapse.server.ts.';
