-- ============================================================================
-- 20260522080000_iteration_0034_launch_promo_until_jan_30_2027.sql
--
-- Iteration 0034 · Task #4 from the 2026-05-22 sprint board.
--
-- ----------------------------------------------------------------------------
-- WHY
-- ----------------------------------------------------------------------------
-- Closes a code-vs-DB drift surfaced by the 2026-05-22 10-sweep audit
-- (Sweep 4 + Sweep 5 row 18). The TypeScript constant
--   apps/web/lib/sku-catalog.ts:64   LAUNCH_PROMO_UNTIL
-- already reads 2027-01-30T23:59:59+08:00 per the CLAUDE.md decision-log row
-- 2026-05-20 ("15-month → 8-month launch promo locked: FREE Pro + 50km radius
-- for all new vendors until Jan 30, 2027 — seasonal alignment with the end of
-- peak Filipino wedding-search season Jan-Mar"). The DB column
-- `service_catalog.launch_promo_until` was still seeded to 2027-03-31 by the
-- original lock migration
--   20260518100000_launch_promo_until_mar_2027.sql
-- so the UI on /pricing + /for-vendors says "free until Jan 30, 2027" while
-- the cron sweep would have kept SKUs free for an extra 60 days. Without
-- this fix the 14 active launch-promo SKUs (see list below) would over-grant
-- free pricing between 2027-01-30 and 2027-03-31.
--
-- ----------------------------------------------------------------------------
-- BEHAVIOR
-- ----------------------------------------------------------------------------
-- Re-stamps `launch_promo_until` to 2027-01-30 23:59:59 +08:00 (PH local) for
-- every SKU in the original 2026-05-18 lock list. Uses an explicit SKU list
-- (not a date-equality filter on the prior 2027-03-31 value) so that:
--   • Future audits read the SKU set straight from the migration without
--     having to cross-reference the prior migration's WHERE clause.
--   • Any manual admin override applied between the original seed and this
--     migration is intentionally overwritten back to the canonical 2027-01-30
--     end date (operator-level corrections route through 0023 admin console,
--     not through ad-hoc SQL).
--   • Re-running this migration is idempotent — UPDATE is a no-op when the
--     value already matches, and the `AND launch_promo_until IS NOT NULL`
--     guard skips the two SKUs (panood_camera_sync · panood_annual_streaming_plus)
--     that were retired by 20260519400000_v1_sku_pricing_corrections_2026_05_17.sql
--     (their column was set to NULL and is intentionally not re-promoted).
--
-- ----------------------------------------------------------------------------
-- AFFECTED SKUs (14 active · 2 retired·skipped via NULL guard)
-- ----------------------------------------------------------------------------
-- Couple-side (7 active):
--   pro_widget_schedule · save_the_date_video · panood_daily_broadcast
--   panood_annual_streaming · patiktok_setnayan_tiktok · patiktok_personal_tiktok
--   patiktok_video_overage
--
-- Vendor-side (7 active):
--   vendor_pro_weekly · all_tools_unlock_annual · tool_mood_board_weekly
--   tool_seat_arrangement_weekly · tool_palette_weekly · tool_qr_reader_weekly
--   tool_advanced_pricing_weekly
--
-- Retired (NULL · not touched by this migration):
--   panood_camera_sync · panood_annual_streaming_plus
--
-- ----------------------------------------------------------------------------
-- HEAD-OF-RAIL CONSISTENCY
-- ----------------------------------------------------------------------------
-- A defensive same-end-state migration exists at
--   20260523010000_launch_promo_until_jan_2027_relock.sql
-- which flips any row still at 2027-03-31 → 2027-01-30. After this migration
-- applies, that May-23 migration becomes a no-op (no rows match its WHERE
-- clause). Both migrations converge to the same state; keeping both in
-- place preserves the audit trail and is safe under any apply order.
--
-- ----------------------------------------------------------------------------
-- CROSS-REFERENCES
-- ----------------------------------------------------------------------------
-- CLAUDE.md decision log row 2026-05-22 (this fix · Task #4)
-- CLAUDE.md decision log row 2026-05-20 (15-month → 8-month relock)
-- CLAUDE.md decision log row 2026-05-18 first (original 16-SKU promo lock)
-- apps/web/lib/sku-catalog.ts:64 (LAUNCH_PROMO_UNTIL constant — code source of truth)
--
-- Idempotent. No new columns, no drops.
-- ============================================================================

BEGIN;

UPDATE public.service_catalog
   SET launch_promo_until = '2027-01-30 23:59:59+08'::TIMESTAMPTZ,
       updated_at = NOW()
 WHERE sku_code IN (
   -- Couple-side (9 original · 7 active after 2026-05-17 Panood retirements)
   'pro_widget_schedule',
   'save_the_date_video',
   'panood_daily_broadcast',
   'panood_camera_sync',               -- retired · NULL guard skips
   'panood_annual_streaming',
   'panood_annual_streaming_plus',     -- retired · NULL guard skips
   'patiktok_setnayan_tiktok',
   'patiktok_personal_tiktok',
   'patiktok_video_overage',

   -- Vendor-side (7 active)
   'vendor_pro_weekly',
   'all_tools_unlock_annual',
   'tool_mood_board_weekly',
   'tool_seat_arrangement_weekly',
   'tool_palette_weekly',
   'tool_qr_reader_weekly',
   'tool_advanced_pricing_weekly'
 )
 AND launch_promo_until IS NOT NULL;

COMMENT ON COLUMN public.service_catalog.launch_promo_until IS
  'Launch promo end timestamp. NULL = SKU is paid as usual; NOT NULL = SKU is '
  'FREE until this timestamp and reverts to price_centavos once NOW() >= '
  'launch_promo_until. Current value 2027-01-30 23:59:59+08 (PH local) per '
  'CLAUDE.md decision-log row 2026-05-20 (15-month → 8-month relock to align '
  'with end of peak Filipino wedding-search season Jan-Mar). DB-vs-code drift '
  'closed by migration 20260522080000_iteration_0034_launch_promo_until_jan_30_2027.sql '
  '(2026-05-22 audit · Task #4). Must match apps/web/lib/sku-catalog.ts:64 '
  'LAUNCH_PROMO_UNTIL constant.';

COMMIT;
