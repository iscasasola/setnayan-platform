## 2026-11-13 · feat(gifts): Event Ultra as a supplier gift and a badge reward kind (owner, in session, 13 Nov 2026)

Owner: *"Gifting Ultra: yes, add it to shop gifts and badge rewards"*. An Ultra gift reaching an event that already holds Plus or Pro **gives full Ultra**; badge rewards: **Ultra is a kind, no step pays it yet**.
- Migration `20271345709071_supplier_gifts_event_ultra.sql` (via `pnpm migration:new`) extends the Plus/Pro gift and badge-reward migrations with a fourth kind, `event_ultra`. Every function is copied from its latest definition, and each change is marked 💎:
  - **Kind accepted everywhere:** the gift-table, given-unlock and reward-kind CHECKs; the stock and reward-stock readers; the badge reward door.
  - **Delivery:** the door gives Ultra lines first, gives full `EVENT_ULTRA` on a Plus/Pro event, and gives nothing on an Ultra event (the unit stays in stock). Like buying it, it turns AI on and tops up the row's included credits.
  - **What a gifted Ultra unlocks:** the gifted-access readers make it also answer for what Ultra grants (`COUPLE_WEBSITE_PRO`, `LIVE_STUDIO`, `PATIKTOK_COMPILER` — the app's aliases read orders only).
  - **Originals clock:** the clock counts a gifted plan's `fullres_extra_keep_days`.
- App: `ShopGiftKind` / `SHOP_GIFT_KINDS` / `SHOP_GIFT_UNLOCK_CODE` gain Ultra. `EventHolds` gains `'ultra'`, and the new `eventCanTake` is the one take rule. `fetchEventGiftHolds` reads Ultra first. Ultra also reaches the quote menu's refusal words, the shop's Promote stock rows, the admin gifts ledger, the gift-buy action, the gift kind words, the reward names and the reward kind. No badge step pays Ultra.
- `lib/iap/products.ts`: `gift_event_ultra` is declared beside the other gift products. It is not sellable, like the rest; the owner creates it in App Store Connect.
- What a shop pays for an Ultra gift is the `EVENT_ULTRA` row's LIST price (`retail_price_php`) — nothing typed. (Superseded in the same PR by G1's one-price rule, 14 Nov: `gift_price_php` is not a price anywhere.)
- Tests: DB case 6 in `a-supplier-gift-lands-once.db.test.ts` (executed against the replay). New `lib/event-ultra-is-a-gift.test.ts` covers the take table, the verdict, "no step pays Ultra", and that the SQL Ultra list equals `EVENT_ULTRA_GRANTS`. The shop-gift, badge-reward and IAP tests are updated for the fourth kind.

SPEC IMPACT: DECISION_LOG row due — "Event Ultra is a supplier gift (full Ultra on a Plus/Pro event) and a badge reward kind with no step yet (owner 2026-11-13)". The corpus is not reachable from this cloud session; recorded here for the Controller to apply.
