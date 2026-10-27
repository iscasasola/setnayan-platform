## 2026-10-28 · feat(pricing): one price everywhere + a website-only welcome price (behind a switch, OFF)

Owner ruling 2026-10-28 (DECISION_LOG "ONE PRICE EVERYWHERE = THE APP STORE PRICE; A WEBSITE-ONLY WELCOME −40%").

- **Welcome price** (`lib/welcome-discount.ts` + `.server.ts`): an account's FIRST purchase, any catalogue product,
  on the website only, at the SHIPPED set-up rule — the house dial `platform_settings.onboarding_discount_pct` and
  the per-row `onboarding_price_php` overrides through `setupPricePhp` (cheaper wins, centavo rounding). "First" is
  read from `orders` (no new table): any couple-side row with a positive amount, no comp, status not draft/cancelled.
  Any platform counts, so the welcome is once per account; an app sign-up who has bought nothing gets it on the web.
- **Where:** the checkout drawer asks `quoteWelcomeAction` when it opens and shows "Welcome price · N% off your first
  purchase"; `submitOrderAction` decides the charge itself and refuses if the screen and the server disagree. It never
  stacks with a voucher or the Setnayan AI comeback offer. The create flow (onboarding services card, its one bill,
  the wedding paywall pricing) asks the same question (`setupPriceAppliesForCreateFlow`).
- **Switch:** `WELCOME_DISCOUNT_ENABLED` (server-side, held strict — only `'true'`), OFF. OFF = exactly as shipped
  (the set-up price during the create flow, on the web).
- **Never in the app** (Apple anti-steering), switch or not: `decideWelcome` refuses the store shell first;
  guard `lib/the-welcome-price-never-reaches-the-app.test.ts` (closed roster of every surface that can render a
  set-up/welcome price, each with a checked fence from the app).
- **One price:** the App Store fulfilment no longer checks the retired "web ÷ 0.85" floor (it would fault-log every
  sale under one price). It now checks that Apple's price EQUALS the website price (catalogue grossed by the effective
  VAT rate) within ₱0.50, and logs a mismatch either way (`appStorePriceMatchesWeb`, `lib/iap/products.ts`).
  No price changed.

SPEC IMPACT: Implements DECISION_LOG 2026-10-28 "ONE PRICE EVERYWHERE" (no corpus edit needed — the row already
records the ruling; open owner items listed in the PR).
