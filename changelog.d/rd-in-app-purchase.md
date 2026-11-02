## 2026-10-18 · feat(iap): Apple In-App Purchase in the iPhone app — Papic credits, Event Hub Pro, Live Watch (flag-dark)

Owner 2026-10-18 (DECISION_LOG "IN-APP PURCHASE — THE FIVE DECISIONS"), prototype
`prototypes/in_app_purchase_screens_2026-10-17_fable.html`.

- **App** — `SetnayanStorePlugin.swift` (StoreKit 2, our own plugin): products with Apple's
  own price, purchase carrying our `appAccountToken`, finish only after our server confirms,
  unfinished transactions on launch, Restore (`AppStore.sync` + `Transaction.all`, consumables
  included via `SKIncludeConsumableInAppPurchaseHistory`). The iOS build appends `SetnayanIAP/1`.
- **Server** — Apple's signed JWS verified locally (x5c chain to the pinned Apple Root CA - G3,
  Apple purpose OIDs, ES256); the purchase becomes an ordinary `orders` row (platform `ios`) +
  `payments` row (channel `app_store`) through `orderRowFor` / `paymentRowFor`, matched +
  promoted under `PROMOTABLE_ORDER_STATUSES`, switched on by `activateOrderSku` (only the call
  that promoted). App Store Server Notifications v2 at `/api/iap/app-store-notifications`:
  `ONE_TIME_CHARGE` fulfils, `REFUND` → `refunded` → `deactivateOrderSku`. Idempotent on Apple's
  transaction id. New table `app_store_purchases` (migration `20271276386641`, service-role only).
- **UI** (only where all three hold: store shell + StoreKit build + `NEXT_PUBLIC_APPLE_IAP_ENABLED`):
  Event Hub Pro at ✓ Apply (Pro tried in the draft as on the web; Apple's sheet; held ◆ changes
  applied in the same tap), Home › Your services Papic · Buy more (5 Apple packs) and Live Watch ·
  Activate, Profile › Restore purchases; pending / cancelled / failed each say one true sentence.
  No web price, web link or GCash on any Apple surface.

SPEC IMPACT: DECISION_LOG row "IN-APP PURCHASE — BUILT, FLAG-DARK" (product ids, the owner's
App Store Connect steps). No locked decision changed.
