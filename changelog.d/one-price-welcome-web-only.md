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
- **The rest of the Papic web ladder × ~1.32** (owner on PR #7005, "Yes, ×1.32"): 200 ₱189 · 300 ₱282 · 400 ₱373 ·
  2K ₱1,845 · 3K (`PAPIC_GUEST`) ₱2,214 · 4K ₱2,952 · 6K ₱4,428 · 7K ₱5,166 · 20K ₱9,488 · 30K ₱14,232 · 50K ₱19,766 ·
  100K ₱31,625, in the same migration (25 rows, each asserted). The anchor seed, the ladder pin, the llms.txt fixture
  and the supplier-gift db numbers follow (gift floor ₱3,500 → ₱4,750 booking; cap ₱3.35M → ₱4.54M).
- **Event Hub Pro part-holders keep their full Pro** (owner, "Keep their full Pro"): migration
  `20271294362939_hub_pro_parts_keep_the_old_cap.sql` adds `event_hub_pro_legacy_part_lines` — the part lines bought
  before 2026-10-28 16:00 UTC and the old ₱5,000 cap (the only place either lives); `eventHubOwnership` applies it
  through `hubOwnershipFrom({ legacy })` with today's status rule. No order is rewritten.
- **Every Papic rung is typed** (owner, "No use the price agreed and what i inputed"): the admin ladder editor's anchor
  set is all seventeen priced rungs (`PAPIC_ANCHOR_SHOTS`, seed `PAPIC_ANCHORS_DEFAULT` = his prices), so a Save never
  recomputes them — the 500 and 1,000 rungs are App Store prices. The guard still asserts the editor's output equals
  the live ladder, to the peso.

SPEC IMPACT: Implements DECISION_LOG 2026-10-28 "ONE PRICE EVERYWHERE" + "THE ONE PRICE — APP STORE = WEBSITE"; corpus rows added 2026-10-28 for "THE REST OF THE PAPIC WEB LADDER × ~1.32" "EVENT HUB PRO PART-HOLDERS KEEP THEIR FULL PRO" and "EVERY PAPIC RUNG IS TYPED" (no corpus edit needed — the rows already
records the ruling; open owner items listed in the PR).
