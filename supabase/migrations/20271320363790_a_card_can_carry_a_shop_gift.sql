-- a_card_can_carry_a_shop_gift
-- ============================================================================
-- A SERVICE CARD CAN CARRY ONE OF THE SHOP'S OWN GIFTS (owner, 2026-11-07).
--
-- ⚖ DECISION_LOG 2026-11-07 "THE FOUR MAKERS ARE APPROVED": the card maker's
--   shipped Setnayan-gift switch becomes ONE Gift dropdown — No gift · Setnayan
--   gift · the shop's own gifts (lib/shop-gifts.ts: Papic credits · Event Plus ·
--   Event Pro). Shop gifts were only on QUOTES until now
--   (vendor_proposal_shop_gifts); on a CARD they are new, so the card needs one
--   place to say which pack it offers.
--
-- WHAT THIS FILE DOES — one nullable column, nothing else:
--   `vendor_services.card_gift_code` — the catalogue `service_code` of the pack
--   the card offers (a PAPIC_GUEST* pack, EVENT_PLUS or COUPLE_WEBSITE_PRO — the
--   same three kinds `shopGiftKindOf` accepts). NULL = no shop gift (the default,
--   every existing card). No price and no credit count is stored: both are read
--   from platform_retail_catalog_v2 whenever they are shown.
--
--   The card ADVERTISES the gift. Stock still leaves only through the quote door
--   (the 2026-11-04 rulings): nothing here holds or moves stock.
--
-- RLS: unchanged and already on — vendor_services_manage (owner/manager writes)
-- and vendor_services_public_read cover a new column of the same row.
--
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file (CLAUDE.md).
-- ============================================================================

BEGIN;

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS card_gift_code text NULL;

ALTER TABLE public.vendor_services
  DROP CONSTRAINT IF EXISTS vendor_services_card_gift_code_is_a_gift;
ALTER TABLE public.vendor_services
  ADD CONSTRAINT vendor_services_card_gift_code_is_a_gift
  CHECK (
    card_gift_code IS NULL
    OR card_gift_code ~ '^PAPIC_GUEST(_[A-Z0-9]+)?$'
    OR card_gift_code IN ('EVENT_PLUS', 'COUPLE_WEBSITE_PRO')
  );

COMMENT ON COLUMN public.vendor_services.card_gift_code IS
  'The shop''s own gift this card offers — a platform_retail_catalog_v2.service_code (PAPIC_GUEST* · EVENT_PLUS · COUPLE_WEBSITE_PRO). NULL = none. Mutually exclusive with includes_setnayan_gift in the maker (one Gift dropdown). Price and count are read from the catalogue, never stored here.';

COMMIT;
