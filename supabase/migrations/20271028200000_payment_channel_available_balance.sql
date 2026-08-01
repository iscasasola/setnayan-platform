-- ============================================================================
-- 20271028200000_payment_channel_available_balance.sql
--
-- Owner-entered AVAILABLE BALANCE per rail, so the cap meter computes from a
-- real figure instead of a fixed ceiling.
--
-- WHY. 20271028100000 gave each rail a static monthly cap (₱500,000 on GCash)
-- and measured Setnayan order inflow against it. That meter is structurally
-- optimistic: the bank's limit counts EVERYTHING the account receives,
-- including the owner's personal transfers, which Setnayan cannot see. The
-- meter could read 60% while the wallet was actually at 95%.
--
-- Owner 2026-08-01: *"i can update my account's available balance to accept
-- for the month? so it can compute rather than locking a single amount.
-- whatever I update for that month will be the actual balance. and it resets
-- every month back to 500,000."*
--
-- So: the owner opens GCash, reads the real remaining headroom, and types it
-- in. From that moment the meter counts Setnayan inflow DOWN from that figure
-- — which is why `_as_of` exists. Without the timestamp we could not know
-- which orders had already been deducted by the owner's own reading, and would
-- double-count every one of them.
--
-- RESET is derived, not scheduled — no cron, no job to fail silently. An
-- override belongs to the calendar month it was entered in; once the month
-- turns, `_as_of` is no longer in the current month and the meter falls back
-- to `_cap_php` on its own. See channelHeadroom() in lib/payment-channels.ts.
--
-- Both columns NULL = no override; behaviour is exactly 20271028100000's.
--
-- Grants: table-level GRANT SELECT TO authenticated + REVOKE ALL FROM anon
-- (20271014400000) are inherited. Re-asserted defensively; idempotent.
--
-- ⚠ Readable new columns widen the exposure surface —
-- supabase/security/exposure-surface.baseline.txt is regenerated in the SAME
-- commit.
-- ============================================================================

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS gcash_available_php    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS gcash_available_as_of  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bdo_available_php      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS bdo_available_as_of    TIMESTAMPTZ;

COMMENT ON COLUMN public.platform_settings.gcash_available_php IS
  'Owner-entered REMAINING receiving headroom on the GCash wallet, read from the GCash app. The meter counts Setnayan inflow down from this instead of from gcash_monthly_cap_php, so personal transfers (invisible to us) are accounted for. NULL = no override; falls back to the cap.';

COMMENT ON COLUMN public.platform_settings.gcash_available_as_of IS
  'When gcash_available_php was entered. Load-bearing: only Setnayan payments recorded AFTER this instant are deducted, because everything before it is already reflected in the figure the owner read. Also drives the monthly reset — an override whose _as_of falls outside the current calendar month is ignored and the cap applies again.';

COMMENT ON COLUMN public.platform_settings.bdo_available_php IS
  'Owner-entered remaining headroom on the BDO account. Same contract as gcash_available_php.';

COMMENT ON COLUMN public.platform_settings.bdo_available_as_of IS
  'When bdo_available_php was entered. Same contract as gcash_available_as_of.';

-- Defensive re-assert (table-level; new columns inherit these).
REVOKE ALL ON TABLE public.platform_settings FROM anon;
GRANT SELECT ON TABLE public.platform_settings TO authenticated;

COMMIT;
