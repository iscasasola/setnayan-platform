-- ============================================================================
-- 20260703600000_vendor_token_grants_legacy_backfill.sql
-- Legacy founder-bonus backfill · follow-up to 20260703500000_vendor_token_
-- grants.sql · CLAUDE.md 2026-05-29 vendor token grants audit row.
-- ============================================================================
--
-- WHY THIS MIGRATION EXISTS
--
-- Vendors who got verified BETWEEN the original trigger migration
-- (20260630000000_verified_vendor_token_bonus_trigger.sql) and the updated
-- trigger from PART 4 of 20260703500000_vendor_token_grants.sql received the
-- LEGACY treatment:
--
--   (a) vendor_wallets.earned_tokens += 100 (direct increment, no expiry)
--   (b) token_rewards_log row with service_code='VERIFIED_VENDOR_BONUS_100'
--   (c) NO earned_token_vouchers row (the per-voucher expiry table didn't
--       exist until 20260703000000 and the trigger didn't write to it until
--       my migration 20260703500000)
--
-- THE BUG · evaluate_earned_token_expiry() (function from migration
-- 20260703000000) OVERWRITES vendor_wallets.earned_tokens with the SUM of
-- earned_token_vouchers.tokens_remaining for non-expired rows. For these
-- legacy vendors, the sum is 0 (no voucher rows) so the next call would
-- zero out their wallet.
--
-- TRIGGERS for evaluate_earned_token_expiry():
--   1. grant_admin_direct_tokens(...) PERFORMs it at the end of every grant
--   2. consume_vendor_assets_per_voucher(...) PERFORMs it at the start of
--      every burn (V1.x token-spending UI · not shipped yet)
--   3. App code on wallet reads — currently none in our codebase (the new
--      vendor-side surfaces read vendor_wallets directly without an expiry
--      refresh, so the bug latches only on the NEXT grant for that vendor)
--
-- BACKFILL · for each vendor with a legacy VERIFIED_VENDOR_BONUS_100 row in
-- token_rewards_log but no matching earned_token_vouchers row (grant_source
-- = 'pilot_grant'), insert a voucher row with:
--   - tokens_granted   = the legacy 100
--   - tokens_remaining = 100 (V1.x token-spending UI hasn't shipped · the
--                              legacy tokens haven't been burned)
--   - expires_at       = NOW() + 45 days · matches the founder-bonus
--                        convention promised by the v2.1 brief
--   - grant_source     = 'pilot_grant' · same as new flow
--   - grant_metadata   = JSONB tag marking these as backfilled
--
-- After the INSERT, we call evaluate_earned_token_expiry() for each
-- backfilled vendor to proactively sync vendor_wallets.earned_tokens with
-- the new voucher sum (preserves the visible 100 balance · prevents the
-- zero-out bug from firing on next grant).
--
-- IDEMPOTENT · re-running the migration is a no-op:
--   - INSERT uses NOT EXISTS predicate keyed on vendor_id + grant_source
--   - evaluate_earned_token_expiry is itself idempotent (recomputes sum)
--
-- PILOT IMPACT
--   - Pilot launches 2026-06-01 (3 days). Family vendors aren't verified
--     yet pre-pilot, so this migration is most likely a 0-row no-op for
--     pilot vendors. Ship anyway as defense-in-depth — costs nothing if
--     no legacy vendors exist, fixes the edge case if any do.
--   - Founder bonus expiry promise (45 days) gets honored retroactively
--     for any pre-existing verified vendors.
-- ============================================================================

BEGIN;

-- Step 1 · INSERT voucher rows for any vendor with the legacy bonus log row
-- but no backing voucher. Keys on (trl.vendor_id, trl.service_code).
INSERT INTO public.earned_token_vouchers (
  vendor_id,
  tokens_granted,
  tokens_remaining,
  expires_at,
  grant_source,
  grant_metadata
)
SELECT
  trl.vendor_id,
  trl.tokens_awarded,
  trl.tokens_awarded,  -- V1.x burn UI not shipped, tokens haven't moved
  NOW() + INTERVAL '45 days',
  'pilot_grant',
  jsonb_build_object(
    'rationale', 'Founder-bonus backfill · pre-20260703500000 verified vendors',
    'backfilled_at', NOW(),
    'source_migration', '20260703600000_vendor_token_grants_legacy_backfill.sql'
  )
FROM public.token_rewards_log trl
WHERE trl.service_code = 'VERIFIED_VENDOR_BONUS_100'
  AND NOT EXISTS (
    SELECT 1
      FROM public.earned_token_vouchers etv
     WHERE etv.vendor_id = trl.vendor_id
       AND etv.grant_source = 'pilot_grant'
  );

-- Step 2 · Refresh wallet caches for affected vendors so their wallet
-- earned_tokens column matches the new voucher sum proactively. Without
-- this, the wallet would still show the legacy value until the next
-- grant_admin_direct_tokens or consume_vendor_assets_per_voucher call.
-- Idempotent — recomputes sum either way.
DO $$
DECLARE
  v_vendor_id UUID;
BEGIN
  FOR v_vendor_id IN
    SELECT DISTINCT trl.vendor_id
      FROM public.token_rewards_log trl
     WHERE trl.service_code = 'VERIFIED_VENDOR_BONUS_100'
  LOOP
    PERFORM public.evaluate_earned_token_expiry(v_vendor_id);
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Supabase Studio SQL editor):
--
-- -- (1) How many vouchers were backfilled?
-- SELECT COUNT(*) AS backfilled_voucher_count
--   FROM public.earned_token_vouchers
--  WHERE grant_metadata->>'source_migration' =
--        '20260703600000_vendor_token_grants_legacy_backfill.sql';
--
-- -- (2) Sanity · every legacy log row now has at least one voucher row:
-- SELECT trl.vendor_id, trl.tokens_awarded,
--        (SELECT COUNT(*) FROM public.earned_token_vouchers etv
--          WHERE etv.vendor_id = trl.vendor_id
--            AND etv.grant_source = 'pilot_grant') AS voucher_count
--   FROM public.token_rewards_log trl
--  WHERE trl.service_code = 'VERIFIED_VENDOR_BONUS_100'
--    AND NOT EXISTS (
--      SELECT 1 FROM public.earned_token_vouchers etv
--       WHERE etv.vendor_id = trl.vendor_id
--         AND etv.grant_source = 'pilot_grant'
--    );
-- -- Expected: zero rows (every legacy bonus now has a voucher).
--
-- -- (3) Sanity · vendor_wallets.earned_tokens matches voucher sum:
-- SELECT vw.vendor_id, vw.earned_tokens AS wallet_balance,
--        (SELECT COALESCE(SUM(tokens_remaining), 0)
--           FROM public.earned_token_vouchers etv
--          WHERE etv.vendor_id = vw.vendor_id
--            AND etv.expires_at > NOW()
--            AND etv.tokens_remaining > 0) AS voucher_sum
--   FROM public.vendor_wallets vw
--  WHERE EXISTS (
--    SELECT 1 FROM public.token_rewards_log trl
--     WHERE trl.vendor_id = vw.vendor_id
--       AND trl.service_code = 'VERIFIED_VENDOR_BONUS_100'
--  );
-- -- Expected: wallet_balance == voucher_sum for every row.
-- ============================================================================
