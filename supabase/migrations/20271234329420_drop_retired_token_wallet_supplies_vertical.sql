-- Drop the leftover ends of two retired features: the token wallet (RETIRED
-- 2026-05-11, locked decision) and the Setnayan Supplies vertical schema
-- (0018), which never got a live caller. Source: S26's ranked orphan
-- baseline (`apps/web/tests/db/ugat-both-ends.baseline.txt`, PR #5625) —
-- each of these RPCs and tables has "no caller in 3846 app files" and, for
-- the tables, "0 rows after replay". Row counts re-verified live in prod
-- immediately before writing this migration: all five tables hold 0 rows.
--
-- NOT dropped, and why:
--   • confirm_vendor_subscription_by_reference — subscriptions are LIVE.
--     This is a deliberately-built future webhook entry point for the live
--     subscription flow (see apps/web/app/vendor-dashboard/subscription/
--     actions.ts docblock: "a future Maya / PayMongo webhook hits via
--     confirm_vendor_subscription_by_reference — automating later is a
--     webhook handler, not a rebuild"). It has no caller today because the
--     webhook doesn't exist yet, not because the feature is retired.
--   • components/billing/ManualCheckoutModal.tsx — a recorded decision in
--     changelog.d/manual-checkout-modal-fit.md says it is "the client half
--     of the deliberately-parked manual-QR gateway... Parked pending KYC,
--     not decayed." That decision stands; not touched here.
--   • notification_type enum values 'vendor_token_purchase_pending' /
--     'vendor_tokens_credited' — Postgres cannot drop a single enum value
--     without recreating the whole type, and 2 historical notification rows
--     already carry 'vendor_token_purchase_pending'. Removed from the app's
--     NotificationType union instead (apps/web/lib/notifications.ts), which
--     is what the orphan detector actually flags ("never passed as a type
--     in any app file"). The DB enum value is left as inert history.

-- ── 1 · vendor_payouts still has a live FK into supplies_orders ────────────
-- 0018 extended vendor_payouts with a 'wholesale' payout_type + a nullable
-- supplies_order_id FK. vendor_payouts holds 0 rows of any payout_type
-- (verified live), so this FK never fired. Drop it so supplies_orders can go;
-- the payout_type CHECK/XOR constraint and the now-orphaned nullable column
-- are left on vendor_payouts (a live, active table) — reducing THAT table's
-- shape further is out of scope for this cleanup.
ALTER TABLE public.vendor_payouts
  DROP CONSTRAINT IF EXISTS vendor_payouts_supplies_order_id_fkey;

-- ── 2 · the eight retired token-wallet RPCs ────────────────────────────────
DROP FUNCTION IF EXISTS public.approve_vendor_token_purchase(uuid);
DROP FUNCTION IF EXISTS public.confirm_vendor_token_purchase_by_reference(text);
DROP FUNCTION IF EXISTS public.consume_lead_token_hold_for(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.create_vendor_token_purchase(text, uuid);
DROP FUNCTION IF EXISTS public.grant_member_purchased_tokens(uuid, uuid, integer, uuid, text, text);
DROP FUNCTION IF EXISTS public.grant_vendor_lifetime_tokens(uuid, integer, text, uuid, text, text);
DROP FUNCTION IF EXISTS public.redeem_vendor_token_voucher(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.reject_vendor_token_purchase(uuid, text);

-- ── 3 · the token-wallet and Supplies (0018) tables ────────────────────────
-- Child tables first so no CASCADE is needed to satisfy internal FKs.
DROP TABLE IF EXISTS public.supplies_order_line_items;
DROP TABLE IF EXISTS public.supplier_vendor_sku_pricing;
DROP TABLE IF EXISTS public.supplies_orders;
DROP TABLE IF EXISTS public.supplier_vendor_skus;
DROP TABLE IF EXISTS public.vendor_token_boosters;
