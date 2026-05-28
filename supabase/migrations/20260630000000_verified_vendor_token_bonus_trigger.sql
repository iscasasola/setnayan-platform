-- =============================================================================
-- 20260630000000_verified_vendor_token_bonus_trigger.sql
-- Owner directive 2026-05-28: "only give the complementary 100 tokens once
-- the vendor is verified."
-- =============================================================================
--
-- Grant 100 earned_tokens to a vendor's wallet exactly once, the moment
-- vendor_profiles.verification_state transitions INTO 'verified'.
--
-- Idempotency: checked via token_rewards_log existence with the well-known
-- service_code 'VERIFIED_VENDOR_BONUS_100'. If a vendor goes verified →
-- demoted → re-verified, the grant does NOT fire again (one bonus per
-- vendor lifetime).
--
-- Wallet auto-create: if the vendor has no row in vendor_wallets yet, the
-- function INSERTs one with the 100-token credit. Otherwise UPSERT adds
-- 100 to existing earned_tokens.
--
-- Sentinel event_id: token_rewards_log.event_id is NOT NULL, but this
-- bonus isn't event-tied. Use the all-zeros UUID
-- '00000000-0000-0000-0000-000000000000' as the canonical "no event"
-- sentinel · the consumer query for vendor wallet history filters on
-- service_code='VERIFIED_VENDOR_BONUS_100' so the placeholder UUID is
-- invisible to UI surfaces.
--
-- Pilot 2026-06-01 safe: no V1 surface touched. Only fires on the V1
-- vendor_profiles.verification_state column the admin verification queue
-- already mutates. The pilot cohort (currently all `unverified`) gets the
-- bonus naturally the moment owner verifies them.
--
-- V2 cutover plan: this is Phase I (Task #11) "100-token pilot grant"
-- per V2_Cutover_Plan_2026-05-28.md but reframed per owner clarification
-- 2026-05-28 — the grant is per-vendor-on-verification, not cutover-day
-- bulk-grant.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.grant_verified_vendor_bonus()
RETURNS TRIGGER AS $$
DECLARE
  v_bonus_amount  INT := 100;
  v_already_paid  BOOLEAN;
  v_sentinel_evt  UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Only fire on transition INTO 'verified' state (not on every UPDATE).
  IF NEW.verification_state = 'verified'
     AND (OLD.verification_state IS NULL OR OLD.verification_state != 'verified')
  THEN
    -- Idempotency · skip if this vendor already received the bonus.
    SELECT EXISTS(
      SELECT 1 FROM public.token_rewards_log
       WHERE vendor_id = NEW.vendor_profile_id
         AND service_code = 'VERIFIED_VENDOR_BONUS_100'
    ) INTO v_already_paid;

    IF v_already_paid THEN
      RETURN NEW;
    END IF;

    -- Ensure wallet exists · credit 100 earned_tokens atomically.
    INSERT INTO public.vendor_wallets
      (vendor_id, purchased_tokens, earned_tokens, updated_at)
    VALUES
      (NEW.vendor_profile_id, 0, v_bonus_amount, NOW())
    ON CONFLICT (vendor_id) DO UPDATE
      SET earned_tokens = vendor_wallets.earned_tokens + v_bonus_amount,
          updated_at    = NOW();

    -- Audit row · the wallet history surfaces this as "Verified vendor
    -- bonus · 100 tokens" via the well-known service_code marker.
    INSERT INTO public.token_rewards_log
      (vendor_id, event_id, service_code, tokens_awarded)
    VALUES
      (NEW.vendor_profile_id, v_sentinel_evt, 'VERIFIED_VENDOR_BONUS_100', v_bonus_amount);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop + recreate the trigger to ensure clean state on re-apply.
DROP TRIGGER IF EXISTS vendor_verified_bonus_trigger ON public.vendor_profiles;
CREATE TRIGGER vendor_verified_bonus_trigger
  AFTER UPDATE OF verification_state ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_verified_vendor_bonus();

-- Also fire on INSERT in case a vendor is created directly into 'verified'
-- state (admin batch import path). Same idempotency check via the audit row.
CREATE OR REPLACE FUNCTION public.grant_verified_vendor_bonus_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_bonus_amount  INT := 100;
  v_already_paid  BOOLEAN;
  v_sentinel_evt  UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF NEW.verification_state = 'verified' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.token_rewards_log
       WHERE vendor_id = NEW.vendor_profile_id
         AND service_code = 'VERIFIED_VENDOR_BONUS_100'
    ) INTO v_already_paid;

    IF v_already_paid THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.vendor_wallets
      (vendor_id, purchased_tokens, earned_tokens, updated_at)
    VALUES
      (NEW.vendor_profile_id, 0, v_bonus_amount, NOW())
    ON CONFLICT (vendor_id) DO UPDATE
      SET earned_tokens = vendor_wallets.earned_tokens + v_bonus_amount,
          updated_at    = NOW();

    INSERT INTO public.token_rewards_log
      (vendor_id, event_id, service_code, tokens_awarded)
    VALUES
      (NEW.vendor_profile_id, v_sentinel_evt, 'VERIFIED_VENDOR_BONUS_100', v_bonus_amount);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendor_verified_bonus_trigger_insert ON public.vendor_profiles;
CREATE TRIGGER vendor_verified_bonus_trigger_insert
  AFTER INSERT ON public.vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_verified_vendor_bonus_on_insert();

COMMIT;

-- =============================================================================
-- VERIFICATION (run in Supabase Studio):
--
-- -- (1) Triggers installed:
-- SELECT trigger_name, event_manipulation, action_timing
--   FROM information_schema.triggers
--  WHERE event_object_table='vendor_profiles'
--    AND trigger_name LIKE 'vendor_verified_bonus%';
-- -- Expected: 2 rows · vendor_verified_bonus_trigger (UPDATE)
-- --                  · vendor_verified_bonus_trigger_insert (INSERT)
--
-- -- (2) Function exists:
-- SELECT proname FROM pg_proc WHERE proname LIKE 'grant_verified_vendor_bonus%';
-- -- Expected: 2 rows
--
-- -- (3) Test fire (use a real vendor_profile_id from your prod):
-- -- UPDATE vendor_profiles SET verification_state='verified'
-- --  WHERE vendor_profile_id='<your_test_uuid>';
-- -- SELECT vendor_id, earned_tokens FROM vendor_wallets
-- --  WHERE vendor_id='<your_test_uuid>';
-- -- -- Expected: earned_tokens=100
-- -- SELECT service_code, tokens_awarded FROM token_rewards_log
-- --  WHERE vendor_id='<your_test_uuid>' AND service_code='VERIFIED_VENDOR_BONUS_100';
-- -- -- Expected: 1 row · tokens_awarded=100
--
-- -- (4) Idempotency test (re-run the same UPDATE):
-- -- UPDATE vendor_profiles SET verification_state='verified' WHERE vendor_profile_id='<test>';
-- -- SELECT earned_tokens FROM vendor_wallets WHERE vendor_id='<test>';
-- -- -- Expected: STILL 100 (not 200) · trigger early-returns on existing audit row
-- =============================================================================
