-- Couple referral program — owner master toggle.
--
-- The referral engine (migration 20270416213000) ships inert-at-₱0-reward, but
-- the couple-facing "Refer a couple" surface would still show and the
-- signup/qualify engine would still record redemptions. Owner decision
-- (2026-07-01): gate the WHOLE program behind an admin master switch — OFF by
-- default. When off: the Refer surface is hidden and applyReferralAtSignup /
-- qualifyReferralOnFirstPaidOrder no-op. An admin flips this on from
-- /admin/referrals to run the program (separate from referral_reward_php).
--
-- Additive ALTER on the singleton platform_settings row (RLS already enabled;
-- public-read / admin-write policies unchanged).

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS referral_program_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.platform_settings.referral_program_enabled IS
  'Owner master switch for the couple referral program. FALSE by default — the Refer surface + signup/qualify engine stay inert until an admin turns it on.';
