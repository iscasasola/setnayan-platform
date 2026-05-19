-- ============================================================================
-- 20260520000000_v1_sku_lock_papic_seat_packs.sql
--
-- Iteration 0012 Papic — V1 SKU seed (2026-05-17 reactivation · 2026-05-18
-- V1 promotion). Seeds the 6 canonical Papic V1 SKUs into service_catalog:
--
--   ACTIVE (HTML/browser capture · V1 ship now):
--     • paparazzi_3_seats           ₱1,499 · 3 seats + 5,000-credit pool
--     • paparazzi_5_seats           ₱2,499 · 5 seats + 10,000-credit pool
--     • paparazzi_camera_addon        ₱999 · +1 seat (multi-purchase stack)
--
--   COMING SOON (is_active=FALSE · cataloged but not purchasable):
--     • papic_cam_bridge_slot_day      ₱99 · DSLR per slot per day
--     • papic_cam_bridge_all_slots_day ₱249 · DSLR all slots per day
--     • papic_cam_bridge_all_slots_annual ₱2,499 · DSLR all slots/year
--
-- The Cam Bridge SKUs are cataloged as is_active=FALSE because they require
-- a Papic-binary native app + DSLR WiFi SDK access (Canon/Nikon/Sony/Fuji)
-- + Apple Developer + Google Play, all of which are gated by PH business
-- registration (DTI/BIR/Mayor's Permit). The 2026-05-18 pilot-first lock
-- deferred the DTI chain until the personal/family pilot wraps. A
-- follow-up migration flips them to is_active=TRUE once the native app +
-- SDK approvals land. Until then, admin can see them in the catalog as a
-- roadmap signal; the cart blocks purchase via the existing findSku()
-- isActive filter.
--
-- New category 'papic' (TypeScript union side updated in
-- apps/web/lib/sku-catalog.ts). Mirrors the 'panood' pattern for the
-- sibling live-streaming SKUs.
--
-- Idempotent. No drops. ON CONFLICT (sku_code) DO UPDATE so re-running
-- corrects any drift from the canonical values below.
-- ============================================================================

BEGIN;

-- ---- Papic phone seats · HTML browser capture · V1 ACTIVE ------------------

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('paparazzi_3_seats',
   '3-Paparazzi Pack',
   '3 paparazzi seats sharing a 5,000-captured-photo pool. HTML browser ' ||
   'capture via per-seat QR token — friend scans, claims a seat, captures ' ||
   'directly from their phone browser. Per-event one-time purchase.',
   'papic', 149900, 'event',
   FALSE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-17 V1 reactivation'),
  ('paparazzi_5_seats',
   '5-Paparazzi Pack',
   '5 paparazzi seats sharing a 10,000-captured-photo pool. HTML browser ' ||
   'capture via per-seat QR token. Per-event one-time purchase.',
   'papic', 249900, 'event',
   FALSE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-17 V1 reactivation'),
  ('paparazzi_camera_addon',
   'Camera Add-on (+1 seat)',
   'One additional paid paparazzi seat. Multi-purchase. Stacks on top of ' ||
   'the 3-pack or 5-pack base (no separate pool — adds to whichever the ' ||
   'couple already owns).',
   'papic', 99900, 'event',
   TRUE, FALSE, TRUE, 'couple', TRUE,
   '2026-05-17 V1 reactivation')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  multi_purchase = EXCLUDED.multi_purchase,
  subscription = EXCLUDED.subscription,
  refundable = EXCLUDED.refundable,
  purchaser_role = EXCLUDED.purchaser_role,
  is_active = EXCLUDED.is_active,
  spec_corpus_ref = EXCLUDED.spec_corpus_ref,
  updated_at = NOW();

-- ---- Papic Cam Bridge · DSLR pairing · COMING SOON (is_active=FALSE) -------

INSERT INTO public.service_catalog
  (sku_code, display_name, description, category, price_centavos, unit,
   multi_purchase, subscription, refundable, purchaser_role, is_active,
   spec_corpus_ref)
VALUES
  ('papic_cam_bridge_slot_day',
   'Cam Bridge (per slot · per day)',
   'DSLR-paired Papic seat for one event-day. Pair one Canon/Nikon/Sony/' ||
   'Fujifilm body via WiFi-SDK; the Papic-binary native app handles ' ||
   'metadata + upload while the DSLR provides the optical glass. ' ||
   'Multi-purchase. Activated post-pilot once native app + SDK approvals ' ||
   'land.',
   'papic', 9900, 'day',
   TRUE, FALSE, TRUE, 'couple', FALSE,
   '2026-05-17 V1 reactivation · pending pilot wrap'),
  ('papic_cam_bridge_all_slots_day',
   'Cam Bridge (all slots · per day)',
   'DSLR pairing for every Papic seat on one event-day. Flat rate; breaks ' ||
   'even vs per-slot at ≥3 DSLRs. Multi-purchase. Activated post-pilot.',
   'papic', 24900, 'day',
   TRUE, FALSE, TRUE, 'couple', FALSE,
   '2026-05-17 V1 reactivation · pending pilot wrap'),
  ('papic_cam_bridge_all_slots_annual',
   'Cam Bridge (all slots · annual)',
   'DSLR pairing for every Papic seat, unlimited events for one year. ' ||
   'Vendor / wedding-photographer subscription. Activated post-pilot.',
   'papic', 249900, 'year',
   FALSE, TRUE, TRUE, 'either', FALSE,
   '2026-05-17 V1 reactivation · pending pilot wrap')
ON CONFLICT (sku_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price_centavos = EXCLUDED.price_centavos,
  unit = EXCLUDED.unit,
  multi_purchase = EXCLUDED.multi_purchase,
  subscription = EXCLUDED.subscription,
  refundable = EXCLUDED.refundable,
  purchaser_role = EXCLUDED.purchaser_role,
  is_active = EXCLUDED.is_active,
  spec_corpus_ref = EXCLUDED.spec_corpus_ref,
  updated_at = NOW();

COMMIT;
