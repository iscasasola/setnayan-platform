## 2026-11-14 · feat(gifts): G1 — buy-10-get-1 bundles, Papic counted in packs, one price per gift, Event Ultra at list

Owner rulings, DECISION_LOG 2026-11-14: "BUY 10, GET 1 FREE" · "COUNTED IN PACKS" · "CONFIRMED — THE ONLY GIFT
DISCOUNT IS THE 10+1" · "GIFT DESIGN APPROVED — WITH FABLE'S EIGHT PICKS" · "EVENT ULTRA BECOMES A SUPPLIER GIFT
OPTION". Approved drawing: artifact QSMD9BaefarMRNQAnMFiND §1–5. Extends the shipped gift system; supersedes #7652
(its Event Ultra kind is merged in, priced at list only).

- 📦 Three gift bundles are admin-managed catalogue rows (`GIFT_BUNDLE_PAPIC_150/1K/3000`, ₱990 / ₱4,990 / ₱9,990),
  each saying which pack it holds and how many (`bundle_of_service_code`, `bundle_quantity`, migration
  `20271346218077_gift_bundles_and_papic_packs`). The app reads them (`fetchShopGiftBundles` → `shopGiftBundlesFrom`);
  the free pack and Admin › Pricing's "10 at today's list price · 1 free" note are worked out from the catalogue.
  Every shop may buy bundles (pick 4); each pack still goes on a quote one at a time at list price (pick 5).
- 💸 `gift_price_php` is not a price anywhere (kept in the table, never dropped): every single gift — Papic packs, Event
  Plus / Pro / Ultra — is at `retail_price_php`, from stock or on the booking fee. `giftUnitPrice`, `tierPaysGiftPrice`,
  `fetchVendorPaysGiftPrice`, `giftChargeAtGiftPrice` are gone; SQL `vendor_pays_gift_price` answers FALSE, so the
  Setnayan gift on the booking-fee bill is charged at list for every shop (TS mirror agrees).
- 🔢 Papic gift stock is counted in PACKS: `shop_gift_stock_entries.pack_code/packs`, `shop_gift_pack_stock_status`,
  and `shop_gift_deliver_for_booking` gives per pack (refuses when THAT pack is short). Badge-reward Papic rows become
  Papic 150 packs (trigger + one backfill of the 5 prod rows).
- 💎 Event Ultra gift (from #7652) at list price; an Ultra gift upgrades a Plus/Pro event (pick 1); Plus + Pro never
  make Ultra (pick 2); at most one plan gift per recommended set (pick 3, `recommendGifts`).
- Screens: Shop › Promote › Your gifts (one row per Papic pack, bundle purchases) + Buy gifts sheet (bundles first,
  singles at one price, "Free in this bundle", no struck "Price couples pay") · Offer Maker gift line + recommended
  sets (one total) · quote "Gifts from you" (packs, Ultra lines/messages) · couple's quote gift note ("1 × Papic 1000 ·
  Event Ultra") · Admin › Pricing (gift bundles under Bundles) · Admin › Gifts ledger (packs) · /for-suppliers plan
  table (gifts at list price on every plan).
- Guards: `lib/the-only-gift-discount-is-the-bundle.test.ts` (no `gift_price_php` read as a price; bundle counts from
  the catalogue; the SQL bill agrees). DB: `a-supplier-gift-lands-once` tests 7–8, `the-gift-reaches-the-couple` ②.

SPEC IMPACT: None — implements the 2026-11-14 DECISION_LOG rows above; no new ruling. Owner action surfaced in the PR:
App Store Connect price points for the (not yet sellable) supplier gift IAP products were set from the retired gift
price and should equal the list price.
