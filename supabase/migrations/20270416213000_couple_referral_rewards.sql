-- ============================================================================
-- 20270416213000_couple_referral_rewards.sql
--
-- Couple referral rewards — "Happy couples refer; when their referral books
-- you, both get a perk." Rides the SHIPPED voucher rail (public.discount_codes
-- + the calculate.ts pct_off_capped math) rather than inventing a new
-- discount primitive.
--
-- This migration owns:
--   1. referral_codes           — one code per couple ACCOUNT (owner_user_id).
--                                 The share handle a couple gives out.
--   2. referral_redemptions      — one row per REFERRED account (UNIQUE), tying
--                                 referrer → referred with a lifecycle
--                                 (open → qualified → rewarded). Self-referral
--                                 is blocked at both CHECK and trigger level.
--   3. platform_settings.referral_reward_php — ADMIN-MANAGED reward amount, in
--                                 whole pesos, DEFAULT 0. When 0 the engine is
--                                 LIVE but INERT (qualification still records,
--                                 but NO discount_codes are minted) until the
--                                 owner sets a reward.
--
-- QUALIFYING EVENT = the referred couple's FIRST PAID ORDER (per the copy
-- "when their referral books you"). The paid-order handler (approvePayment)
-- fires a best-effort after()-hook that marks the open redemption `qualified`
-- and mints TWO single-use pct_off_capped vouchers (referrer + referred). That
-- side-effect lives in application code (lib/referrals.ts) — this migration is
-- just the substrate + the structural guarantees.
--
-- Conventions mirrored from recent migrations:
--   • RLS ENABLED at CREATE TABLE time (Pattern A/B per RLS_Policy_Pattern.md).
--   • Canonical public ids via public.generate_public_id (20260512000000).
--   • Admin gate matches discount_codes_admin_all (users.account_type='admin').
--   • Owner-scoped reads via auth.uid() equality (couple-account scoping).
--   • self-referral BLOCKED (CHECK referrer<>referred + BEFORE INSERT trigger
--     that also blocks a referred account already referred — belt+suspenders
--     with the UNIQUE(referred_user_id)).
--
-- Idempotent (IF NOT EXISTS / DO blocks / CREATE OR REPLACE).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. platform_settings.referral_reward_php — admin-managed reward (whole pesos)
--    Singleton row id=1 already exists; RLS already enabled on the table
--    (public read / service-role write) so this column inherits it — no new
--    policy. DEFAULT 0 keeps the engine inert until the owner sets a value.
-- ----------------------------------------------------------------------------

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS referral_reward_php INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'platform_settings_referral_reward_nonneg'
      AND conrelid = 'public.platform_settings'::regclass
  ) THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT platform_settings_referral_reward_nonneg
        CHECK (referral_reward_php >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.platform_settings.referral_reward_php IS
  'Admin-managed couple-referral reward in whole pesos (both referrer + referred get a single-use voucher of this value on the referred couple''s first paid order). 0 = engine live but inert (no vouchers minted). Set via /admin/settings or /admin/referrals.';

-- ----------------------------------------------------------------------------
-- 2. referral_codes — one code per couple ACCOUNT.
--    owner_user_id is UNIQUE so generateReferralCode() is an idempotent
--    "mint-or-return". The `code` is a canonical S89R-<10> public id.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.referral_codes (
  referral_code_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Canonical public id (S89R-<10-char Crockford>). Shared in the ?refc= link.
  code              TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('R'),
  -- The couple account that owns / shares this code. One code per account.
  owner_user_id     UUID NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner
  ON public.referral_codes (owner_user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Owner reads own code; admins read all (for the /admin/referrals list).
DROP POLICY IF EXISTS referral_codes_owner_or_admin_read ON public.referral_codes;
CREATE POLICY referral_codes_owner_or_admin_read
  ON public.referral_codes FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid()
        AND account_type = 'admin'
    )
  );

-- Owner mints their own code (generateReferralCode server action, running as
-- the signed-in couple). owner_user_id must be the caller — a couple can't
-- mint a code owned by someone else.
DROP POLICY IF EXISTS referral_codes_owner_insert ON public.referral_codes;
CREATE POLICY referral_codes_owner_insert
  ON public.referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. referral_redemptions — one row per REFERRED account.
--    UNIQUE(referred_user_id) → an account is referred at most once.
--    status lifecycle: open → qualified → rewarded.
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.referral_status AS ENUM ('open', 'qualified', 'rewarded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  referral_redemption_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id        UUID NOT NULL REFERENCES public.referral_codes(referral_code_id) ON DELETE CASCADE,
  -- The couple who shared the code.
  referrer_user_id        UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- The new account that signed up with ?refc=<code>. Referred once, ever.
  referred_user_id        UUID NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
  status                  public.referral_status NOT NULL DEFAULT 'open',
  qualified_at            TIMESTAMPTZ,
  rewarded_at             TIMESTAMPTZ,
  -- The two single-use vouchers minted at qualification (NULL until rewarded).
  referrer_reward_code    TEXT,
  referred_reward_code    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Self-referral is nonsense — you can't refer yourself. Structural guard
  -- (the applyReferralAtSignup action also checks, this is defense-in-depth).
  CONSTRAINT referral_no_self CHECK (referrer_user_id <> referred_user_id),
  -- Lifecycle coherence: qualified/rewarded imply their timestamps.
  CONSTRAINT referral_status_coherence CHECK (
    (status = 'open'      AND qualified_at IS NULL AND rewarded_at IS NULL) OR
    (status = 'qualified' AND qualified_at IS NOT NULL) OR
    (status = 'rewarded'  AND qualified_at IS NOT NULL AND rewarded_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referrer
  ON public.referral_redemptions (referrer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referred
  ON public.referral_redemptions (referred_user_id);
-- The paid-order hook looks up "does this buyer have an OPEN redemption?".
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referred_open
  ON public.referral_redemptions (referred_user_id)
  WHERE status = 'open';

ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

-- BLOCKING trigger — a last-line guard against a forged self-referral or a
-- double-referral slipping past the app layer + the CHECK/UNIQUE (e.g. a
-- future service-role writer). Raises rather than silently dropping so bad
-- writes surface loudly in logs.
CREATE OR REPLACE FUNCTION public.referral_redemption_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referrer_user_id = NEW.referred_user_id THEN
    RAISE EXCEPTION 'Self-referral is not allowed (referrer = referred = %)', NEW.referred_user_id;
  END IF;
  -- Attribution integrity: the referrer MUST own the referral_code being
  -- redeemed. Without this, the referred couple's INSERT (which only has to
  -- prove referred_user_id = auth.uid()) could credit an ARBITRARY referrer
  -- against a code they don't own — attribution pollution / griefing. Bind
  -- referrer to the code owner server-side (runs on INSERT and UPDATE; the
  -- service-role qualify/reward UPDATE never changes these two columns).
  IF NEW.referrer_user_id <> (
    SELECT owner_user_id FROM public.referral_codes
    WHERE referral_code_id = NEW.referral_code_id
  ) THEN
    RAISE EXCEPTION 'Referrer % is not the owner of referral_code %',
      NEW.referrer_user_id, NEW.referral_code_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.referral_redemption_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_redemption_guard() TO authenticated;

DROP TRIGGER IF EXISTS trg_referral_redemption_guard ON public.referral_redemptions;
CREATE TRIGGER trg_referral_redemption_guard
  BEFORE INSERT OR UPDATE ON public.referral_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.referral_redemption_guard();

-- Referrer OR referred OR admin can read a redemption row (both parties see
-- the status on their dashboards; admin sees all for /admin/referrals).
DROP POLICY IF EXISTS referral_redemptions_party_or_admin_read ON public.referral_redemptions;
CREATE POLICY referral_redemptions_party_or_admin_read
  ON public.referral_redemptions FOR SELECT
  TO authenticated
  USING (
    referrer_user_id = auth.uid()
    OR referred_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = auth.uid()
        AND account_type = 'admin'
    )
  );

-- The referred account creates its own OPEN redemption at signup
-- (applyReferralAtSignup, running as the just-created couple). referred_user_id
-- must be the caller — you can only record that YOU were referred, and the
-- CHECK/trigger block naming yourself as the referrer.
DROP POLICY IF EXISTS referral_redemptions_referred_insert ON public.referral_redemptions;
CREATE POLICY referral_redemptions_referred_insert
  ON public.referral_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    referred_user_id = auth.uid()
    -- Only an OPEN, unrewarded, uncoded redemption may be self-inserted — a
    -- couple can't seed a row already 'rewarded' or carrying voucher codes /
    -- qualify timestamps. The qualify→reward transition is service-role only.
    AND status = 'open'
    AND qualified_at IS NULL
    AND rewarded_at IS NULL
    AND referrer_reward_code IS NULL
    AND referred_reward_code IS NULL
  );

-- No couple-facing UPDATE/DELETE policy — the qualify→reward transition runs
-- through the service-role admin client in the paid-order hook (which bypasses
-- RLS), matching the discount_codes apply-time pattern.

COMMIT;
