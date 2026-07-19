-- custom plan lapse sweep
-- Extends the canonical login-driven lapse sweep public.sweep_vendor_tier_expiry
-- (originally supabase/migrations/20261010000000_vendor_subscription_checkout.sql)
-- so that a lapsed CUSTOM tier is reverted AND its active vendor_custom_plans row
-- is demoted — the same downgrade-only, idempotent, cron-free pattern used for
-- Pro/Enterprise. Custom's paid 28-day window is now stamped on
-- vendor_profiles.tier_expires_at at pay-activation (lib/sku-activation.ts), so
-- this sweep can act on it. The comp/off-platform lever leaves tier_expires_at
-- NULL (never lapses) — NULL is intentionally excluded by the past-due predicate.
--
-- Why the plan demotion: fetchEffectiveCaps (lib/vendor-effective-caps.ts) and
-- resolveApiVendor (lib/enterprise-vendor-gate.ts) both gate on an ACTIVE custom
-- plan (status='active'), NOT on tier_state alone. Reverting the tier disables
-- the caps overlay + tier checks; demoting the plan is the second guard that also
-- cuts the api_access grant + the composition overlay. active→lapsed removes the
-- row from the one-active partial unique index (…WHERE status='active'), so there
-- is no unique-index conflict.

CREATE OR REPLACE FUNCTION public.sweep_vendor_tier_expiry(p_vendor_id UUID)
RETURNS VOID AS $$
DECLARE
  v_was_custom BOOLEAN := FALSE;
BEGIN
  -- Lock + inspect the profile row IFF it is past-due in a sweepable tier. The
  -- FOR UPDATE serialises this against a concurrent (re)activation write.
  SELECT (tier_state = 'custom')
    INTO v_was_custom
    FROM public.vendor_profiles
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('pro', 'enterprise', 'custom')
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now()
   FOR UPDATE;

  -- No past-due sweepable row → nothing to do (SELECT found nothing).
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Revert the tier: keep earned verification, else drop to free. Clear the
  -- expiry + billing cycle. Same expression as the original Pro/Enterprise sweep.
  UPDATE public.vendor_profiles
     SET tier_state = (
           CASE WHEN verification_state = 'verified'
                THEN 'verified' ELSE 'free' END
         )::public.vendor_tier_state,
         tier_expires_at    = NULL,
         tier_billing_cycle = NULL
   WHERE vendor_profile_id = p_vendor_id
     AND tier_state IN ('pro', 'enterprise', 'custom')
     AND tier_expires_at IS NOT NULL
     AND tier_expires_at < now();

  -- If the lapsed vendor was Custom, demote its active plan so the caps overlay
  -- + api_access grant (both keyed on status='active') switch off.
  IF v_was_custom THEN
    UPDATE public.vendor_custom_plans
       SET status = 'lapsed', updated_at = now()
     WHERE vendor_profile_id = p_vendor_id
       AND status = 'active';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants are preserved by CREATE OR REPLACE; re-assert them for idempotence.
REVOKE ALL ON FUNCTION public.sweep_vendor_tier_expiry(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_vendor_tier_expiry(UUID) TO authenticated;

COMMENT ON FUNCTION public.sweep_vendor_tier_expiry(UUID) IS
  'Login-driven (cron-free) lapse downgrade: an expired pro/enterprise/CUSTOM tier reverts to verified (if still verified) else free, clearing tier_expires_at + tier_billing_cycle; a lapsed custom vendor also has its active vendor_custom_plans row demoted to lapsed. Over-cap data left intact in V1. Idempotent + downgrade-only. NULL tier_expires_at (comp/off-platform custom deals) never lapses.';
