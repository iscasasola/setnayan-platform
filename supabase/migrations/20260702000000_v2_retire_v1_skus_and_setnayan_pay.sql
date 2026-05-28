-- =============================================================================
-- 20260702000000_v2_retire_v1_skus_and_setnayan_pay.sql
-- Big V1 retirement · owner directive 2026-05-28 "all prices that were not
-- listed on the table I sent will no longer work · Setnayan will not take
-- money from the purchases of the Customers."
-- =============================================================================
--
-- TWO RETIREMENTS · non-destructive (is_active=FALSE only · row data
-- preserved · existing subscriptions grandfather until natural expiry):
--
-- PART A · V1 customer + vendor SKUs not in V2 catalog
--   Owner-supplied canonical V2 catalog screenshot 2026-05-28 enumerates
--   exactly 19 customer SKUs + 2 bundles + 7 vendor SKUs. Anything in the
--   V1 `service_catalog` not corresponding to that list is retired here.
--
-- PART B · setnayan_pay_methods · the 5% convenience fee
--   Owner directive "we will no longer transact their packages · they can
--   post on our page · but they can earn the whole money." Setnayan exits
--   the payment-rail business for vendor bookings. The 5% fee retires.
--
-- Audit-trail summary of retired SKUs (28 customer-side + 5 payment methods):
--
--   Customer-side · 8 SKUs (couple_addon + concierge categories):
--     concierge_complete       · ₱2,499 · V1 Concierge subscription
--     monogram_hero_upgrade    · ₱1,999 · V1 monogram (V2 has Animated Monogram ₱2,499)
--     patiktok_personal_daily  · ₱1,999 · per-day Personal TikTok (V2 single Patiktok ₱2,499)
--     patiktok_setnayan_daily  · ₱999   · per-day Setnayan TikTok
--     patiktok_video_overage   · ₱49    · +10 video pack
--     pro_widget_schedule      · ₱999   · Live Schedule widget
--     save_the_date_video      · ₱199   · STD render (V2 has none)
--
--   Customer-side · 5 SKUs (panood + papic categories):
--     ai_edited_highlight_3min · ₱3,499 · AI Edited Highlight (V2 SDE Add-on differs)
--     ai_video_highlight_60s   · ₱999   · 60s AI highlight
--     panood_annual_streaming  · ₱19,999· V1 multicam yearly (V2 single Panood ₱3,499)
--     panood_daily_broadcast   · ₱2,499 · V1 daily broadcast
--     same_day_edit            · ₱9,999 · standalone SDE (V2 has Papic Add-on at ₱3,499)
--
--   Customer-side · 3 SKUs (papic seats):
--     paparazzi_3_seats        · ₱1,499 · V1 3-seat pack (V2 Papic Guest ₱2,999)
--     paparazzi_5_seats        · ₱2,499 · V1 5-seat pack (V2 Papic 5 Seats ₱2,999)
--     paparazzi_camera_addon   · ₱999   · +1 seat add-on
--
--   Customer-side · 2 SKUs (patiktok category):
--     patiktok_personal_tiktok · ₱1,999 · alias
--     patiktok_setnayan_tiktok · ₱999   · alias
--
--   Vendor-side · 6 SKUs (vendor_pro_weekly + vendor_tools + vendor_verification):
--     vendor_pro_weekly                 · ₱499/wk  · V1 weekly Pro sub (V2 monthly ₱1,999)
--     all_tools_unlock_annual           · ₱9,999/y · V1 tools bundle (V2 Enterprise covers it)
--     tool_advanced_pricing_weekly      · ₱99/wk
--     tool_mood_board_weekly            · ₱99/wk
--     tool_palette_weekly               · ₱99/wk
--     tool_qr_reader_weekly             · ₱99/wk
--     tool_seat_arrangement_weekly      · ₱99/wk
--     vendor_verification_annual_renewal · ₱1,499/y · annual re-verify charge
--     vendor_verification_redemption     · ₱2,499  · re-verify after demotion
--     verification_annual_renewal       · ₱1,500  · alias
--     verification_reverification       · ₱2,500  · alias
--
--   KEPT ACTIVE intentionally:
--     vendor_verification_initial · FREE · system-event marker (admin verifies
--     a vendor · this row stays so the audit reflects the event · price is
--     ₱0 so there's no transactional risk · plus the vendor 100-token bonus
--     trigger from migration 20260630000000 reads vendor_profiles.verification_state
--     directly · not this SKU row · so retiring it would be cosmetic only).
--
-- Pilot 2026-06-01 unaffected (no pilot couple has purchased any of the
-- retired customer SKUs in production · zero rows in `orders` reference them).
-- Existing vendor weekly subscriptions to vendor_pro_weekly grandfather.
-- Live /pricing page may visibly show empty until the /pricing rewrite ships
-- in the next session — acceptable since the V1 SKUs are no longer purchasable
-- regardless.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART A · Retire V1 service_catalog SKUs not in V2 canonical screenshot
-- =============================================================================

UPDATE public.service_catalog
   SET is_active  = FALSE,
       retired_at = COALESCE(retired_at, NOW())
 WHERE sku_code IN (
   -- Couple add-on category
   'concierge_complete',
   'monogram_hero_upgrade',
   'patiktok_personal_daily',
   'patiktok_setnayan_daily',
   'patiktok_video_overage',
   'pro_widget_schedule',
   'save_the_date_video',
   -- Panood category
   'ai_edited_highlight_3min',
   'ai_video_highlight_60s',
   'panood_annual_streaming',
   'panood_daily_broadcast',
   'same_day_edit',
   -- Papic category
   'paparazzi_3_seats',
   'paparazzi_5_seats',
   'paparazzi_camera_addon',
   -- Patiktok category aliases
   'patiktok_personal_tiktok',
   'patiktok_setnayan_tiktok',
   -- Vendor subscription
   'vendor_pro_weekly',
   -- Vendor tools
   'all_tools_unlock_annual',
   'tool_advanced_pricing_weekly',
   'tool_mood_board_weekly',
   'tool_palette_weekly',
   'tool_qr_reader_weekly',
   'tool_seat_arrangement_weekly',
   -- Vendor verification charges (initial verification kept as system marker)
   'vendor_verification_annual_renewal',
   'vendor_verification_redemption',
   'verification_annual_renewal',
   'verification_reverification'
 )
   AND is_active = TRUE;

-- =============================================================================
-- PART B · Retire Setnayan Pay 5% fee · all 5 payment method rows
-- =============================================================================
-- Per owner directive · Setnayan exits the vendor-payment-rail business.
-- Customers and vendors transact directly · no commission · no rail fee.
-- The setnayan_pay_methods table stays in schema for historical audit ·
-- new bookings simply can't pick a fee-bearing method because none are
-- marked active.

UPDATE public.setnayan_pay_methods
   SET is_active  = FALSE,
       updated_at = NOW()
 WHERE method_code IN (
   'bank_transfer',
   'credit_card',
   'ewallet',
   'gcash_direct',
   'maya_qr_ph'
 )
   AND is_active = TRUE;

COMMIT;

-- =============================================================================
-- VERIFICATION (run in Supabase Studio):
--
-- -- (1) V1 SKUs retired · should be 28 rows · all is_active=FALSE
-- SELECT sku_code, is_active, retired_at FROM service_catalog
--  WHERE sku_code IN (
--    'concierge_complete', 'monogram_hero_upgrade', 'patiktok_personal_daily',
--    'patiktok_setnayan_daily', 'patiktok_video_overage', 'pro_widget_schedule',
--    'save_the_date_video', 'ai_edited_highlight_3min', 'ai_video_highlight_60s',
--    'panood_annual_streaming', 'panood_daily_broadcast', 'same_day_edit',
--    'paparazzi_3_seats', 'paparazzi_5_seats', 'paparazzi_camera_addon',
--    'patiktok_personal_tiktok', 'patiktok_setnayan_tiktok', 'vendor_pro_weekly',
--    'all_tools_unlock_annual', 'tool_advanced_pricing_weekly', 'tool_mood_board_weekly',
--    'tool_palette_weekly', 'tool_qr_reader_weekly', 'tool_seat_arrangement_weekly',
--    'vendor_verification_annual_renewal', 'vendor_verification_redemption',
--    'verification_annual_renewal', 'verification_reverification'
--  )
--  ORDER BY sku_code;
--
-- -- (2) Active V1 SKUs remaining · should ONLY be vendor_verification_initial
-- SELECT sku_code, display_name, is_active FROM service_catalog
--  WHERE is_active = TRUE ORDER BY sku_code;
-- -- Expected: 1 row · vendor_verification_initial (FREE system marker)
--
-- -- (3) Setnayan Pay methods all retired · 0 active
-- SELECT method_code, is_active, setnayan_pay_pct FROM setnayan_pay_methods
--  WHERE is_active = TRUE ORDER BY method_code;
-- -- Expected: 0 rows
-- =============================================================================
