-- guest_signup_join_method
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

-- Adds 'guest_signup' to the join_method enum so a guest who links their
-- guest session to a new account at signup is distinguishable (analytics +
-- provenance) from invite_claim / qr_scan joins. Idempotent.
--
-- The new value is consumed only at RUNTIME (by lib/link-guest-account.ts),
-- never inside this migration's own statement, so PG's "can't use a new enum
-- value in the same transaction" rule is never tripped. Matches the
-- 20261102000000 'invite_claim' precedent (ADD VALUE outside any BEGIN block).
ALTER TYPE public.join_method ADD VALUE IF NOT EXISTS 'guest_signup';
