-- ============================================================================
-- 20271028100000_payment_channel_enabled_and_cap.sql
--
-- A kill switch per manual payment channel, plus the monthly receiving cap
-- each one is subject to.
--
-- WHY. Setnayan receives on PERSONAL GCash and BDO accounts (owner 2026-08-01:
-- no business account yet). A personal GCash wallet has a MONTHLY RECEIVING
-- LIMIT — ₱500,000 as of 2026-08-01 — and when it is reached incoming
-- transfers FAIL rather than queue. There is no warning inside GCash's flow:
-- the first signal is a couple reporting a bounced payment.
--
-- So the owner needs two things this migration enables:
--   1. `*_enabled` — turn a channel OFF at checkout the moment its account is
--      at cap, so couples stop being offered a rail that cannot accept money.
--   2. `*_monthly_cap_php` — the figure the admin meter counts toward, so the
--      cliff is visible BEFORE it is hit rather than discovered afterwards.
--
-- The cap is a column rather than a constant because it is a bank policy that
-- changes without asking us, and differs per account tier. Hardcoding it would
-- silently drift the day GCash moves it.
--
-- Both channels default ENABLED, so applying this changes nothing on its own.
--
-- Grants: platform_settings carries TABLE-level `GRANT SELECT ... TO
-- authenticated` + `REVOKE ALL ... FROM anon` (20271014400000); new columns
-- inherit both. Re-asserted defensively below — idempotent.
--
-- ⚠ Adding readable columns widens the exposure surface, so
-- supabase/security/exposure-surface.baseline.txt is regenerated in the SAME
-- commit. A baseline refreshed later would rubber-stamp anything that drifted
-- in between.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS gcash_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS bdo_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS gcash_monthly_cap_php  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS bdo_monthly_cap_php    NUMERIC(12,2);

COMMENT ON COLUMN public.platform_settings.gcash_enabled IS
  'Owner kill switch — FALSE hides GCash at checkout and the server refuses orders on it. Flip OFF when the wallet reaches its monthly receiving cap, since GCash FAILS incoming transfers past the limit rather than queuing them.';

COMMENT ON COLUMN public.platform_settings.bdo_enabled IS
  'Owner kill switch for the BDO rail. Same contract as gcash_enabled.';

COMMENT ON COLUMN public.platform_settings.gcash_monthly_cap_php IS
  'Monthly RECEIVING limit of the GCash account (₱500,000 for a fully-verified personal wallet as of 2026-08-01). Drives the admin rolling-30-day meter. NULL = no meter shown. A column, not a constant: the bank changes this without asking us.';

COMMENT ON COLUMN public.platform_settings.bdo_monthly_cap_php IS
  'Monthly receiving limit of the BDO account, if any. NULL = no meter shown.';

-- Seed the GCash cap the owner stated. Only where unset, so a later admin
-- edit is never overwritten by a re-run.
UPDATE public.platform_settings
   SET gcash_monthly_cap_php = 500000.00
 WHERE id = 1
   AND gcash_monthly_cap_php IS NULL;

-- Defensive re-assert (table-level; new columns inherit these).
REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

COMMIT;
