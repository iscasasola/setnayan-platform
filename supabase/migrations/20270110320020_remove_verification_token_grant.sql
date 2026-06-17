-- =============================================================================
-- 20270108000000_remove_verification_token_grant.sql
-- Owner directive 2026-06-17: retire the 100-free-tokens-on-verification grant.
-- Marketing copy was already removed in PR #1446. This migration removes the
-- backend grant that fires when a vendor's verification_state → 'verified'.
--
-- What is removed:
--   • vendor_verified_bonus_trigger        (AFTER UPDATE on vendor_profiles)
--   • vendor_verified_bonus_trigger_insert (AFTER INSERT on vendor_profiles)
--   • grant_verified_vendor_bonus()        — trigger function body (no-op stub kept)
--   • grant_verified_vendor_bonus_on_insert() — trigger function body (no-op stub kept)
--
-- What is NOT touched:
--   • grant_admin_direct_tokens()        — still used for admin direct token grants
--   • grant_vendor_lifetime_tokens()     — still used for subscription bundle grants
--   • redeem_vendor_token_voucher()      — still used for vendor code redemption
--   • token_rewards_log / earned_token_vouchers / vendor_wallets — tables untouched
--
-- Historical token_rewards_log rows with service_code='VERIFIED_VENDOR_BONUS_100'
-- and earned_token_vouchers rows with grant_source='pilot_grant' that were already
-- issued to verified vendors are left in place (no retroactive clawback).
-- =============================================================================

BEGIN;

-- ---- Step 1: Drop the triggers so they no longer fire. ----------------------

DROP TRIGGER IF EXISTS vendor_verified_bonus_trigger        ON public.vendor_profiles;
DROP TRIGGER IF EXISTS vendor_verified_bonus_trigger_insert ON public.vendor_profiles;

-- ---- Step 2: Replace the trigger functions with no-op stubs. ----------------
-- Stubs are kept (not DROPped) to avoid pg_dump or cross-migration reference
-- errors. They return NEW immediately without touching any tables.

CREATE OR REPLACE FUNCTION public.grant_verified_vendor_bonus()
RETURNS TRIGGER AS $$
BEGIN
  -- RETIRED 2026-06-17: 100-token on-verification grant removed (PR #1446 + this migration).
  -- The triggers vendor_verified_bonus_trigger and vendor_verified_bonus_trigger_insert
  -- have been dropped; this stub is kept to avoid broken references if called directly.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.grant_verified_vendor_bonus() IS
  'RETIRED 2026-06-17 · was AFTER UPDATE trigger for 100-token verification bonus. '
  'Now a no-op stub. Trigger dropped by migration 20270108000000.';

CREATE OR REPLACE FUNCTION public.grant_verified_vendor_bonus_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- RETIRED 2026-06-17: 100-token on-verification grant removed (PR #1446 + this migration).
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.grant_verified_vendor_bonus_on_insert() IS
  'RETIRED 2026-06-17 · was AFTER INSERT trigger for 100-token verification bonus. '
  'Now a no-op stub. Trigger dropped by migration 20270108000000.';

COMMIT;

-- =============================================================================
-- POST-MIGRATION VERIFICATION (run in Supabase Studio):
--
-- -- (1) Confirm triggers are gone:
-- SELECT trigger_name
--   FROM information_schema.triggers
--  WHERE event_object_table = 'vendor_profiles'
--    AND trigger_name LIKE 'vendor_verified_bonus%';
-- -- Expected: 0 rows
--
-- -- (2) Confirm stub functions exist but do nothing:
-- SELECT proname FROM pg_proc
--  WHERE proname IN ('grant_verified_vendor_bonus', 'grant_verified_vendor_bonus_on_insert');
-- -- Expected: 2 rows (stubs retained)
--
-- -- (3) Verify a vendor via admin → check no new token_rewards_log row appears:
-- UPDATE vendor_profiles SET verification_state='verified'
--  WHERE vendor_profile_id='<test_vendor_id>';
-- SELECT * FROM token_rewards_log
--  WHERE vendor_id='<test_vendor_id>' AND service_code='VERIFIED_VENDOR_BONUS_100';
-- -- Expected: 0 rows (no new grant fired)
--
-- -- (4) Subscription bundle grant still works (leave unchanged):
-- SELECT public.grant_vendor_lifetime_tokens('<vendor_id>'::uuid, 50,
--   'admin_grant', '<admin_id>'::uuid, 'Test sub grant', 'test_sub:1');
-- -- Expected: returns a voucher UUID
-- =============================================================================
