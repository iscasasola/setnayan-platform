## 2026-11-05 · feat(supplier-gifts): slice 2 — Event Plus and Event Pro as supplier gifts

Owner rulings DECISION_LOG 2026-11-04 ("SUPPLIER GIFTS: BOUGHT IN QUANTITY, KEPT AS STOCK", "GIFT PRICES") and the
2026-11-05 answers on #7279, among them (E) *"yes, the second event plus will auto upgrade event pro"*. Stacked on
slice 1 (`claude/supplier-gifts-e28b08`, #7279). Prices are the catalogue's (`EVENT_PLUS` and `COUPLE_WEBSITE_PRO`
rows of `platform_retail_catalog_v2`, `retail_price_php` / `gift_price_php` from #7262); nothing is typed in code.

- **Migration `supplier_gifts_event_plus_and_pro`**: the three gift tables take two more kinds, `event_plus` and
  `event_pro`, counted in units (one per pack, CHECKed). `shop_gift_stock_entries.unlocks_sku` records what a given
  unlock became. `shop_gift_stock_status` answers one row per kind; an unlock on a quote stops being held once that
  booking's first payment has cleared. New door `shop_gift_deliver_unlocks_for_booking(event_vendor_id, event_has)`
  (service role only, same per-shop lock): Pro lines first, then Plus; a Plus on an event that holds Plus becomes Pro;
  an event that already holds Pro takes nothing and the unit stays in stock; each unlock turns Setnayan AI on and tops
  up the included Papic credits like buying it does. `event_has_comp_for_sku` / `event_comp_active_skus` also answer for
  a supplier-gifted unlock, so every paywall and `event_entitlement_facts` see it with no app change.
- **Supplier · Plan › Your gifts**: Event Plus and Event Pro rows (counts) under Papic credits; the Buy sheet sells them
  ("You get 3 × Event Plus"). They are not Papic, so the Papic switch no longer hides gifts that are not Papic.
- **Supplier · the quote › Gifts from you**: Plus and Pro in the same "＋ Add a gift" menu, judged against their own
  stock and the same 40% limit at the price couples pay. On an event with Event Plus a Plus line says "this makes it
  Event Pro"; on an event with Event Pro neither can be added (and `writeQuoteShopGifts` refuses it on send).
- **Couple · the quote page**: "Gift from <shop> 🎁 · 150 Papic credits · Event Plus" — "Unlocked on your event when your
  first payment is confirmed".
- **The first payment** (`runDepositAcknowledgedEffects`): after the Papic door, `deliverShopGiftUnlocksForBooking`
  asks the full entitlement chain what the event holds (approved only) and hands it to the door. Logged every time,
  Sentry on `short` / `error`.
- **Admin › Gifts & comps › Supplier gifts**: the ledger shows units for Plus/Pro ("−1 Event Plus · their second Plus,
  so Event Pro"); "On quotes" lists credits, Plus and Pro.
- Labs: `/dev/supplier-plan-lab?s=gifts` (counts), `?s=gifts-couple&unlock=1`, `?s=gifts-admin`;
  `/dev/supplier-chat-lab?m=quote&gifts=plus|pro`.
- Tests: `lib/shop-gifts.test.ts` (+5), `tests/db/a-supplier-gift-lands-once.db.test.ts` test 5.

Not in this slice: a gifted Event Plus does not count toward the "pay only the difference" price of Event Pro
(`eventHubOwnership` counts a PAID Plus order only); returning a gift after it was given.

SPEC IMPACT: None — implements rulings already in DECISION_LOG (2026-11-04 rows and the 2026-11-05 answers).
