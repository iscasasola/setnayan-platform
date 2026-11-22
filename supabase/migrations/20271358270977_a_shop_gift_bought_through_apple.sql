-- 💝 A SHOP'S GIFT, BOUGHT THROUGH APPLE (owner 2026-11-04, "they can purchase inside apple as well"; controller
-- 22 Nov: the App Store submit waits on it).
--
-- `app_store_purchases` is the intent row whose key StoreKit signs into a purchase (`appAccountToken`). Until now
-- every intent was a COUPLE's, for ONE event (`event_id`). A shop's gift belongs to no event: it lands in the shop's
-- gift stock (`shop_gift_stock_entries`) exactly like a gift bought on the web, and the shop gives it later (Agree / a
-- quote; out when the couple's first payment clears). So the intent names the SHOP instead.
--
--   · `vendor_profile_id` — the shop a gift intent buys for. NULL on every couple intent (all existing rows).
--     Written only by `createPurchaseIntent` (lib/iap/fulfil.server.ts) with the shop the server read for the signed-in
--     owner — never a value the phone sent.
--   · ON DELETE SET NULL, like `event_id`: the intent is the record of what Apple charged and must outlive the shop.
--     A gift whose shop is gone is refused with its own reason ('no_shop') and logged, never landed elsewhere.
--   · No CHECK "event XOR shop": `event_id` is SET NULL when an event is deleted, so a couple row would break it.
--     The fulfilment holds the pairing instead (a gift product ⇔ a shop intent; lib/iap/fulfil.server.ts).
--
-- RLS and grants are unchanged: RLS on, no policy, service_role only (20271276386641). Additive and nullable — every
-- existing row and reader is untouched.

ALTER TABLE public.app_store_purchases
  ADD COLUMN IF NOT EXISTS vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_store_purchases_vendor_profile_idx
  ON public.app_store_purchases (vendor_profile_id)
  WHERE vendor_profile_id IS NOT NULL;

-- 📦 A 10 + 1 BUNDLE OF EVENT PLUS / PRO / ULTRA IS ONE UNIT OF ITS WHOLE COUNT (owner 2026-11-22: the in-app cart pays
-- line by line; a bundle line is its gift bought with quantity 10 and the catalogue's `bundle_quantity` lands). A Papic
-- bundle already is: `quantity` 1, `packs_each` 11, `credits_each` = the pack's credits × 11. An unlock bundle is the
-- same shape — `packs_each` 11, `credits_each` 11 (one unit per pack) — which `..._unlock_is_one_each` (credits_each = 1,
-- 20271319497337) refused. Loosened to ONE PER PACK: a single (packs_each NULL / 1) is still exactly 1, a bundle exactly
-- its packs. The stock moves by `quantity × credits_each` (lib/sku-activation.ts `grantShopGiftPurchase`) and is reversed
-- by its own bought entry, so a bundle lands — and a refund takes back — its whole count. Every existing row
-- (credits_each = 1, packs_each NULL or 1) still passes.
ALTER TABLE public.shop_gift_purchases
  DROP CONSTRAINT IF EXISTS shop_gift_purchases_unlock_is_one_each;
ALTER TABLE public.shop_gift_purchases
  DROP CONSTRAINT IF EXISTS shop_gift_purchases_unlock_is_one_per_pack;
ALTER TABLE public.shop_gift_purchases
  ADD CONSTRAINT shop_gift_purchases_unlock_is_one_per_pack
  CHECK (gift_kind = 'papic' OR credits_each = COALESCE(packs_each, 1));

COMMENT ON COLUMN public.app_store_purchases.vendor_profile_id IS
  'A shop''s gift bought through Apple: the shop whose gift stock it lands in (event_id is NULL). NULL on every '
  'couple purchase. Written only by createPurchaseIntent from the server-read shop; SET NULL if the shop is deleted '
  '(the gift is then refused as no_shop).';
