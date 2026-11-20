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
-- (`tier_expires_at = NULL`) in ONE update, clears the hatch again, and writes
-- the lapse's audit row — which HOLDS the paid plan's days (held_tier,
-- held_ms) — in the SAME transaction, so a drop can never commit without its
-- hold. It re-checks the lapse itself (verified · not yet stamped ·
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
  v_row     RECORD;
  v_held_ms BIGINT;
BEGIN
  IF p_plan IS NULL OR p_plan NOT IN ('none', 'free_drop', 'hold') THEN
    RAISE EXCEPTION 'stamp_papers_lapse: unknown plan %', p_plan USING ERRCODE = '22023';
  END IF;

  -- The lapse, re-checked here (the hatch cannot lower any other shop), and the row locked so the plan read below
  -- is the plan that is dropped.
  SELECT vp.user_id, vp.tier_state::text AS tier_state, vp.tier_expires_at, vp.next_renewal_due_at
    INTO v_row
    FROM public.vendor_profiles vp
   WHERE vp.vendor_profile_id = p_vendor_profile_id
     AND vp.verification_state = 'verified'
     AND vp.papers_lapsed_at IS NULL
     AND vp.next_renewal_due_at IS NOT NULL
     AND vp.next_renewal_due_at < p_now
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- A hold is only for a paid plan that is still running (planHoldAtLapse). Anything else is a caller that read a
  -- stale row: refuse rather than drop a plan whose days would not be held.
  IF p_plan = 'hold' THEN
    IF v_row.tier_state IN ('free', 'verified')
       OR (v_row.tier_expires_at IS NOT NULL AND v_row.tier_expires_at <= p_now) THEN
      RAISE EXCEPTION 'stamp_papers_lapse: % on % (until %) is not a plan to hold',
        p_plan, v_row.tier_state, v_row.tier_expires_at USING ERRCODE = '22023';
    END IF;
    -- NULL = a plan with no clock: it waits whole and comes back whole (planBackAtRenewal).
    v_held_ms := CASE WHEN v_row.tier_expires_at IS NULL THEN NULL
                      ELSE floor(extract(epoch FROM (v_row.tier_expires_at - p_now)) * 1000)::bigint END;
  END IF;

  -- The deliberate downgrade, for THIS transaction only (is_local = true).
  IF p_plan <> 'none' THEN
    PERFORM set_config('setnayan.allow_tier_downgrade', 'on', true);
  END IF;

  UPDATE public.vendor_profiles vp
     SET papers_lapsed_at = p_now,
         -- free_drop: the free "verified" plan becomes "free".
         -- hold: a paid plan becomes "free" with its clock stopped; the days left are held in the audit row below.
         tier_state = CASE
           WHEN p_plan = 'free_drop' AND vp.tier_state = 'verified' THEN 'free'::public.vendor_tier_state
           WHEN p_plan = 'hold' THEN 'free'::public.vendor_tier_state
           ELSE vp.tier_state
         END,
         tier_expires_at = CASE WHEN p_plan = 'hold' THEN NULL ELSE vp.tier_expires_at END,
         updated_at = p_now
   WHERE vp.vendor_profile_id = p_vendor_profile_id;

  -- Closed again at once, so nothing later in the transaction inherits it.
  PERFORM set_config('setnayan.allow_tier_downgrade', '', true);

  -- 💸 THE HELD DAYS LIVE HERE, IN THE SAME TRANSACTION AS THE DROP. Renewal reads the latest
  -- 'vendor_papers_lapsed' row for held_tier / held_ms (heldPlanBack in lib/verification-decision.server.ts). Written
  -- by a separate call after the drop, a failed insert would lose a paid shop's days for good: the stamp stops a
  -- re-run and renewal finds no hold. If this insert fails, the drop rolls back with it.
  INSERT INTO public.admin_audit_log (action, target_table, target_id, actor_user_id, metadata)
  VALUES (
    'vendor_papers_lapsed',
    'vendor_profiles',
    p_vendor_profile_id::text,
    NULL,
    jsonb_build_object(
      'deadline', v_row.next_renewal_due_at,
      'lapsed_at', p_now,
      'tier_before', v_row.tier_state,
      'tier_after', CASE
        WHEN p_plan = 'hold' OR (p_plan = 'free_drop' AND v_row.tier_state = 'verified') THEN 'free'
        ELSE v_row.tier_state
      END,
      'notified', v_row.user_id IS NOT NULL
    ) || CASE WHEN p_plan = 'hold' THEN jsonb_build_object(
      'held_tier', v_row.tier_state,
      'held_ms', v_held_ms,
      'tier_expires_at_before', v_row.tier_expires_at
    ) ELSE '{}'::jsonb END
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.stamp_papers_lapse(UUID, TEXT, TIMESTAMPTZ) IS
  'The 30 March papers lapse, in one write: stamps papers_lapsed_at and, per p_plan (planHoldAtLapse in '
  'lib/papers-renewal.ts), drops a free "verified" plan to free (free_drop) or a paid plan to free with its clock '
  'stopped (hold, tier_expires_at NULL), and writes the vendor_papers_lapsed audit row holding the paid plan''s '
  'days (held_tier, held_ms) in the same transaction. Sets setnayan.allow_tier_downgrade for its own transaction only, so '
  'guard_vendor_tier_no_silent_downgrade lets THIS downgrade through and still refuses every other. Re-checks the '
  'lapse (verified, unstamped, renewal day passed). Returns true when the row was stamped. Service role only; '
  'called by lib/papers-lapse.server.ts.';
