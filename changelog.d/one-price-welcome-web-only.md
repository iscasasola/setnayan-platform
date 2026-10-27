## 2026-10-28 · feat(pricing): one price everywhere + a website-only welcome price (behind a switch, OFF)

Owner ruling 2026-10-28 (DECISION_LOG "ONE PRICE EVERYWHERE = THE APP STORE PRICE; A WEBSITE-ONLY WELCOME −40%").

- **Welcome price** (`lib/welcome-discount.ts` + `.server.ts`): an account's FIRST purchase, any catalogue product,
  on the website only, at the SHIPPED set-up rule — the house dial `platform_settings.onboarding_discount_pct` and
  the per-row `onboarding_price_php` overrides through `setupPricePhp` (cheaper wins, centavo rounding). "First" is
  read from `orders` (no new table): any couple-side row with a positive amount, no comp, status not draft/cancelled.
  Any platform counts, so the welcome is once per account; an app sign-up who has bought nothing gets it on the web.
- **Where:** the checkout drawer asks for it when it opens (through the existing price-check action `applyVoucherAction`, `intent=welcome_quote` — no new server action; the budget is full) and shows "Welcome price · N% off your first
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

### + The one price itself (owner 2026-10-28, DECISION_LOG "THE ONE PRICE — APP STORE = WEBSITE")

- Migration `20271293510457_one_price_app_store_equals_website.sql` sets `retail_price_php` on 13 rows to the owner's
  App Store prices (Pro ₱6,590 · Live Watch ₱3,300 · Papic 100/500/1K/5K/10K ₱95/465/929/3,690/5,950 · Setnayan AI
  ₱3,300 / B ₱1,980 / C ₱1,190 / D ₱265 · Music Maker ₱3,300 · Patiktok ₱1,980); every UPDATE asserts exactly one row
  (a zero-row update raises); `is_active` untouched. Sign-up copies follow the shipped model: the Papic rungs and AI
  bands store `signupPriceFor(new, dial)` (whole peso, ties down); Pro, Live Watch, Music Maker, Patiktok are cleared
  (NULL → the dial prices them live). Ships WITH the App Store equality check above.
- The typed AI fallback ladders (regular 3300/1980/1190/265, sign-up 1980/1188/714/159), the llms.txt fixture, the
  Papic ladder pin and the Music Maker demo figure follow the catalogue.

SPEC IMPACT: Implements DECISION_LOG 2026-10-28 "ONE PRICE EVERYWHERE" + "THE ONE PRICE — APP STORE = WEBSITE" (no corpus edit needed — the rows already
records the ruling; open owner items listed in the PR).
