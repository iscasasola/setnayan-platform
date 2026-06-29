-- ============================================================================
-- 20270322883953_setnayan_ai_per_28d_billing_period.sql
--
-- Setnayan AI → flip the BILLING MODEL from a one-time ₱3,999 unlock to a
-- ₱499-per-28-day-cycle subscription, on the customer catalog.
--
-- Canonical decision (corpus Setnayan_AI_Subscription_Decisions_2026-06-29.md
-- Decision 1 · OWNER): "₱499 per 28-day cycle. Term passes = ₱499 × number of
-- 28-day cycles (matches the vendor 28-day billing cadence). Stored
-- admin-managed in platform_retail_catalog_v2 (never hardcoded)." The owner
-- build directive for THIS PR adds the access shape: the subscription "stays
-- active until the day of the event, auto-ends right after" (wedding-anchored).
--
-- WHAT THIS MIGRATION DOES (catalog + display only — see SCOPE below):
--   1. Adds a nullable `billing_period` column to platform_retail_catalog_v2,
--      DEFAULT 'one_time'. Every existing row keeps one-time semantics — the
--      display layer renders no "/period" suffix for them, byte-identical to
--      today.
--   2. Flips SETNAYAN_AI → billing_period='per_28d' AND retail_price_php=499 in
--      the SAME statement-set, so price + period change together. There is NO
--      window where ₱499 could render as a one-time fire-sale: the column lands
--      and the row flips inside one transaction.
--
-- The recurrence is the CATALOG's source of truth for both the number (499) and
-- the unit ("/ 28 days"); the app reads them together (lib/v2-catalog.ts) and
-- never hardcodes either.
--
-- ── ACCESS-WINDOW MODEL (wedding-anchored) ──────────────────────────────────
-- The access mechanism already exists: PR #2407 shipped
-- `public.user_ai_subscription(active_until …)` — a single per-user window;
-- while NOW() < active_until, Setnayan AI fans out to every event the user
-- hosts/co-hosts (computed read-side in lib/setnayan-ai.ts, lazily expired, no
-- cron). The owner's "active until the event day, then auto-ends" rule is a
-- RULE FOR WHAT active_until IS STAMPED TO at activation: it is anchored to
-- `events.event_date` (the wedding day), NOT an open-ended counted run.
--
-- This migration does NOT stamp active_until (no subscription is activated
-- here, and there is no consent-gated activation hook yet — that is a later PR,
-- gated by platform_settings.setnayan_ai_per_user_enabled, default OFF). It
-- records the anchor RULE as a column COMMENT on active_until so the activation
-- hook that lands later cannot drift from the owner directive. See the PR body
-- for the one honest limitation: a single per-user window vs many events with
-- different dates — documented, not silently resolved here.
--
-- ── SCOPE (out of this PR · flagged, not built) ─────────────────────────────
-- Actual recurring auto-CHARGING is NOT wired. Couples pay manual apply-then-pay
-- pre-launch; provider-run auto-renew (PayMongo / GCash subscriptions) is V1.5.
-- This migration only makes the PRICE + PERIOD + access-window RULE correct.
--
-- ADDITIVE + IDEMPOTENT. No drops, no destructive ALTERs. RLS/grants on
-- platform_retail_catalog_v2 are untouched (the public-read policy already
-- exposes the new column to anon read, same as every other catalog column).
-- ============================================================================

BEGIN;

-- ---- 1. the recurrence column (nullable · default one_time) -----------------
-- DEFAULT 'one_time' means every existing row is, and stays, a one-time SKU —
-- the display layer keys the "/period" suffix off a non-one_time value, so
-- nothing else in the catalog changes appearance.
ALTER TABLE public.platform_retail_catalog_v2
  ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'one_time'
    CHECK (billing_period IN ('one_time', 'per_28d'));

COMMENT ON COLUMN public.platform_retail_catalog_v2.billing_period IS
  'Recurrence of the catalog price. one_time (default · the price is a single '
  'charge · no period suffix rendered) or per_28d (the price is per 28-day '
  'cycle · rendered "₱X / 28 days", matching the vendor 28-day cadence). '
  'Admin-managed; the display layer reads price + period together and never '
  'hardcodes either. SETNAYAN_AI is the first per_28d SKU (₱499/28d · owner '
  '2026-06-29). Auto-charging is V1.5 (manual apply-then-pay today).';

-- ---- 2. flip SETNAYAN_AI: ₱3,999 one-time → ₱499 per 28-day cycle -----------
-- Price + period flip in ONE UPDATE so ₱499 never renders as a one-time price.
UPDATE public.platform_retail_catalog_v2
   SET retail_price_php = 499,
       billing_period   = 'per_28d',
       updated_at       = now()
 WHERE service_code = 'SETNAYAN_AI';

-- ---- 3. record the wedding-anchor RULE on the existing access window --------
-- No row is stamped here (activation is a later, flag-gated PR). This refines
-- the column comment from PR #2407 so the future activation hook anchors the
-- window to the event day per the owner directive, rather than to a counted run.
COMMENT ON COLUMN public.user_ai_subscription.active_until IS
  'Subscription expiry. Setnayan AI is on for the user while NOW() < '
  'active_until; lazily checked at read time (cron-free). WEDDING-ANCHORED '
  '(owner 2026-06-29): on activation the window is anchored to the user''s '
  'event day (events.event_date) so the subscription stays active until the '
  'event and auto-ends right after — NOT an open-ended counted run. Priced as '
  '₱499 per 28-day cycle (term passes = ₱499 × cycles). The stamping hook + '
  'recurring auto-charge land in a later flag-gated PR (V1.5).';

COMMIT;
