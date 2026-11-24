# App Store submit: Setnayan 1.0 (build 9), ready after the last merge (25 Nov 2026)

This doc replaces the 22 Nov pre-submit list (`APPLE-SUBMIT-2026-11-22.md`). Every item was measured on `origin/main` @ `d94351d584` and on the live site (`/api/health` served `320a764`), 24 Nov 2026 ~21:30–23:00 PH.

**Verdict: not ready yet. One code PR must be live first, then the owner's steps.**
- The code PR is **#8292**. It gives Event Pro and Event Ultra a door in the app, and keeps the supplier plans out of 1.0.
- Then the owner does the steps in section 3, in order.

---

## 1 · The list, item by item

| # | Item | State | Evidence |
|---|---|---|---|
| 1 | Supplier sign-up redo | Does not block | Owner, 22 Nov: it does not gate the submit. |
| 2 | Gift Apple button; `hub_part_*` and retired ids gone; build number 9 | **DONE, LIVE** | #8164 merged 22 Nov 14:43 UTC (`339a22ec07`). It is inside the served `320a764`. Details below. |
| 3 | App Store Connect products match the code | **NOT DONE** (owner) | No session can see App Store Connect. The exact list and prices are in section 3, step 3. |
| 4 | `NEXT_PUBLIC_APPLE_IAP_ENABLED` ON in Vercel | **UNKNOWN** (owner) | Vercel refused this session's env read (403). Sign that no buy button ever reached a reviewer: `app_store_purchases` on prod has **0 rows, ever** (SELECT, 24 Nov). |
| 5 | Review screenshots, one per product | **NOT DONE** (owner) | Owner only. Take them after step 6 in section 3. |
| 6 | Build: build 9 | **Build 9 is REQUIRED** | `CURRENT_PROJECT_VERSION = 9` on main (Debug and Release). A native change landed after build 8. Details below. |
| 7 | Review notes | **DONE** (text below) | Section 2, ready to paste. Music Maker, Patiktok and Setnayan AI are dropped. |
| 8 | Submit, Release set to Manual | **NOT DONE** (owner) | Section 3, step 10. |
| **9 (new)** | Event Pro and Event Ultra can be bought in the app | **NOT DONE, a code fix is open** | Today drew the "Event services" row, but the app still blocked the route (`IAP_OPENED_ROUTE` in `lib/store-shell.ts`). The row landed on /web-only. No other screen sells `event_pro` or `event_ultra`. Fixed in **#8292**. |
| **10 (new)** | Supplier plans are not offered in 1.0 | **NOT DONE, the same code fix** | #8166 drew Subscribe buttons at Shop ⚙ › Plan and billing wherever the switch is on, build 9 included. But 1.0 does not carry those subscriptions (22 Nov list; specs `SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md`). Fixed in **#8292**: they need `SetnayanIAP/4`, and build 9 announces `/3`. |
| **11 (new)** | Demo account has events to buy on | **NOT DONE** (owner) | The 5 Nov notes' event "Marco & Marga" **no longer exists on prod** (SELECT on `events`, 24 Nov). The app also sells **one plan per event** (details below), so the reviewer needs three host events. |
| **12 (new)** | Live Watch costs the same on Apple and the web | **NOT DONE** (owner) | The owner ruled Live Watch ₱3,990 on 23 Nov (DECISION_LOG "EVENT PLANS ARE PACKAGES"). The catalogue still reads **₱1,990** (`platform_retail_catalog_v2.LIVE_STUDIO`, SELECT 24 Nov). Each Apple sale is checked against the catalogue (`appStorePriceMatchesWeb`). |

### Item 2 in detail: the gift products
- **Wired:** `IAP_SUPPLIER_GIFT_PRODUCTS` (6 gifts) is sold by:
  - `app/_components/iap/iap-gift-buy.tsx`
  - `vendor-dashboard/shop/promote/_components/apple-gift-cart.tsx` and `shop-gifts-section.tsx`
  - `lib/iap/iap-actions.ts` (`startShopGiftPurchase`), and delivered by `lib/iap/products-delivery.ts`.
- **`gift_music_maker` / `gift_patiktok`:** `git grep` finds 3 matches in `products.ts`. All 3 are retired, not live:
  - 1 is a comment in the gift list ("left with their products").
  - 2 sit in `RETIRED_IAP_PRODUCT_IDS`, which is never sold and never asked of StoreKit.
  - Guard: `lib/iap/a-shop-gift-is-bought-like-a-web-gift.test.ts` test 2.
- **`hub_part_*`:** these 11 ids live only in `RETIRED_IAP_PRODUCT_IDS`.
- **No `gift_live_watch`.** Live Watch is not a gift on the web.

### Item 6 in detail: why build 9
- Build 8 went to Apple on 5 Nov. After that, `d79115df9a` (22 Nov) changed native code:
  - `SetnayanStorePlugin.swift` now passes a quantity, 1 to 10.
  - `capacitor.config.ts` now announces `SetnayanIAP/3`.
- The gift store opens only for `/3` (`hasStoreQuantity`). **Build 8 cannot sell gifts.**
- `7511a21863` set the number to 9.
- The only other change in `apps/mobile` is `8736727ac8` (24 Nov), a `package-lock.json` dev-dependency bump. It is not native.
- Supnayan (#8289) is a draft, open and parked, and is not in main.
- **#8292 changes no native file.**

### Item 11 in detail: one plan per event
`startAppStorePurchase` (`lib/iap/iap-actions.ts`) works like this:
- After Plus, Pro and Ultra are refused (`not_on_sale`).
- After Pro, Plus is refused (owned) and Ultra too (`not_on_sale`).
- After Ultra, Pro and Plus are refused (owned).
- Live Watch is hidden on an Ultra event, because Ultra includes it.

So the reviewer buys each plan on its own event.

### Was 1.0 already submitted? I cannot tell for certain.
What I found:
- **27 Oct:** 1.0 build 7 was submitted with 13 old products (DECISION_LOG, "APPLE 1.0 (BUILD 7) … SUBMITTED").
- **5 Nov:** the reply to Apple (`APPLE-REPLY-2026-11-05.md`) answers a review where "no purchases were offered". It says the submission "now carries build 8".
- **22 Nov:** the list says "No submit today". The store listing says Live Watch "was rejected with the old submission". So the 5 Nov round ended in at least a rejection of the products.
- **24 Nov:** the DECISION_LOG row "Three iOS apps" says "com.setnayan.app, in Apple review now". That is a side note in a row about Supnayan and Chatnayan. It is not an owner quote, and it names no date or build. **No row records a submit after 5 Nov**, and build 9 has never been archived as far as any note says.
- **Prod:** `app_store_purchases` is empty. No reviewer purchase ever reached the server.

My best reading: if anything sits in review, it is the **5 Nov build 8 submission with the old products**, not build 9. **The owner checks** App Store Connect › Setnayan › iOS App 1.0, the status at the top. Section 3, step 1 says what to do for each status.

### Residual risks (controller's call; not blocking the submit)
- **3.1.3(b):** on the web, Event services also sells an "Event Hub" single and a "Setnayan AI" single (₱2,790 each, 23 Nov). They have no Apple product, so the app hides them. If a reviewer reads 3.1.3(b) strictly, a web-bought single that works in the app needs an Apple twin. The same applies to the supplier plans (web-only in 1.0).
- **First real purchase:** no App Store purchase has ever completed on prod (0 rows). Step 7 of section 3 is one sandbox purchase on TestFlight before submitting, so the first one is not the reviewer's.
- **Gift quantity price:** one sandbox gift line of 2 or more should confirm that Apple signs the price per unit (plans-builder note 22 Nov). If Apple signs the total, the gift still lands, and a "price differs" log fires.

---

## 2 · App Review notes (paste into App Store Connect › App Review Information › Notes)

Before you paste, replace the three event names if you name the events differently in step 5.

```
Hello, and thank you for reviewing Setnayan.

SIGN IN
Use the demo account above (email and password, not Google). In-App Purchases are offered only to an event's host, and only in this iOS app. The demo account is the host of three events, so that each event plan can be bought once: "Ana & Ben" (Event Plus), "Carla & Dan" (Event Pro) and "Ella & Fred" (Event Ultra). One event holds one plan. The demo account also runs the supplier shop "Review Shop", which buys the gift items.

WHAT THE APP IS
Setnayan is an event planning tool for weddings, debuts, birthdays and other celebrations: guests and RSVP, seating, a schedule, a budget, suppliers and chat, and the event's own page for guests. The app loads our web application with native Sign in with Apple, camera, photos, NFC and In-App Purchase.

IN-APP PURCHASES (13 consumable items, each bought for one event, or for the supplier's gift stock)

1. Event Plus, Event Pro, Event Ultra (event_plus, event_pro, event_ultra)
Home > open the event > Today > Your services > Event services (the last row) > under "Pick a pack" tap the plan > Pay > Apple's purchase sheet.
Buy Event Plus on "Ana & Ben", Event Pro on "Carla & Dan", Event Ultra on "Ella & Fred". Once an event has a plan, the page offers no other plan for it.

2. Live Watch (live_watch)
On "Ana & Ben" or "Carla & Dan": Today > Your services > Live stream > Activate > tick the box > Add Live Watch.
(Event Ultra includes Live Watch, so "Ella & Fred" shows it as on.)

3. Papic photo credits: Papic 150, Papic 1000, Papic 3000 (papic_pack_150, papic_pack_1000, papic_pack_3000)
On any of the three events: Memories (bottom bar) > Papic > Add more > use - / + to choose 150, 1,000 or 3,000 > Buy. Packs can be bought again.

4. Supplier gifts: Gift · Papic 150 / 1000 / 3000, Gift · Event Plus / Pro / Ultra (gift_papic_pack_150, gift_papic_pack_1000, gift_papic_pack_3000, gift_event_plus, gift_event_pro, gift_event_ultra)
A supplier buys gifts to give to a client's event. Home > Shop > Shop dashboard > Shop > Promote > Your gifts > Buy more > add a gift with + > each line in the cart has its own Buy button, and each line is its own Apple payment (quantity 1 to 10).

Restore purchases: the round account button (top right) > Profile & settings > Restore purchases > Restore.

NOTES
- All 13 items are consumables, configured for the sandbox. The Paid Apps Agreement is active.
- Purchases are not limited by storefront or device.
- The same items can be bought on our website, and a website purchase also works in the app (3.1.3(b)). The app shows no website prices and no links to buy outside the app.
- Supplier booking fees pay for real-world services (photography, catering, venues) and are paid on the website only (3.1.3(e)). Supplier plans are not offered in this version of the app.

DELETING AN ACCOUNT (5.1.1(v))
Signed in: the account button > Profile & settings > at the bottom, "Delete my account": type DELETE and submit. The request is filed inside the app and completed within 24 hours.

TRACKING (5.1.2(i))
The app does not track users and shows no tracking prompt. App Privacy: "Data Not Used to Track You". The app asks for no location.

CAMERA, MICROPHONE, PHOTOS
Used only when a host or guest chooses to capture or pick a photo for their own event.

NFC (demo video attached: setnayan-nfc-demo.mp4)
On an iPhone: Guests > a guest > "Write to NFC" writes that guest's invitation link to a blank NDEF tag (NTAG213). Tapping the tag opens the guest's invitation; staff use the same tap at check-in.

This submission carries build 9.

Thank you,
Setnayan
```

**Before pasting, check two lines on your own walk (step 8 of section 3).** I traced every path in code but could not tap them on a device. These two have the most steps:
- the gift path "Home > Shop > Shop dashboard > Shop > Promote";
- the NFC path.

"Profile & settings" → Restore purchases and Delete my account are confirmed in code (the account sheet's cover band opens `/dashboard/profile`, which holds both rows). If a label reads differently on screen, change the note to match the screen.

---

## 3 · The owner's steps, in order

1. **Look at what Apple has now.** App Store Connect › Setnayan › iOS App 1.0, the status at the top:
   - **Waiting for Review or In Review** (the old build 8): press **Remove from Review**, then go on.
   - **Rejected or Developer Rejected:** go on; you resubmit at step 10.
   - **Prepare for Submission:** go on.
2. **Wait until #8292 is live.** The controller confirms it, or open `https://setnayan.com/api/health` and check that its version is the merge commit or later. It must be live before steps 7 and 8.
3. **App Store Connect › In-App Purchases: make the products match the code.**
   - **On sale: exactly these 13. All Consumable, each priced at the Philippine price point equal to the website price.** Prices were read from the live catalogue on 24 Nov 13:4x UTC.

     | Product ID (`com.setnayan.app.` + …) | Display name | Price, Philippines |
     |---|---|---|
     | `event_plus` | Event Plus | ₱2,990 |
     | `event_pro` | Event Pro | ₱5,490 |
     | `event_ultra` | Event Ultra | ₱9,990 |
     | `live_watch` | Live Watch | **see step 4** |
     | `papic_pack_150` | Papic 150 | ₱99 |
     | `papic_pack_1000` | Papic 1000 | ₱499 |
     | `papic_pack_3000` | Papic 3000 | ₱999 |
     | `gift_papic_pack_150` | Gift · Papic 150 | ₱99 |
     | `gift_papic_pack_1000` | Gift · Papic 1000 | ₱499 |
     | `gift_papic_pack_3000` | Gift · Papic 3000 | ₱999 |
     | `gift_event_plus` | Gift · Event Plus | ₱2,990 |
     | `gift_event_pro` | Gift · Event Pro | ₱5,490 |
     | `gift_event_ultra` | Gift · Event Ultra | ₱9,990 |

   - **Gifts already made on 4 Nov still carry the old gift prices** (₱90 · ₱449 · ₱899 · ₱2,690 · ₱5,190). Change each one to the price in the table. A gift costs the same as what it gifts.
   - **Detach from version 1.0, and never delete or reuse the ids:**
     - `papic_credits_100`, `_500`, `_1000`, `_5000`, `_10000`
     - `setnayan_ai`, `setnayan_ai_tier_b`, `_tier_c`, `_tier_d`
     - `event_hub_pro`, `music_maker`, `patiktok`
     - `gift_music_maker`, `gift_patiktok`, `gift_live_watch` (if it exists)
     - `papic_thank_you`, `mood_board_renders_50`, every `hub_part_*`
   - **Do NOT attach the supplier subscriptions** (`supplier_plus_monthly`, `supplier_pro_monthly`, `supplier_ultra_monthly`). They ship with the next version.
   - Each of the 13 needs its Review screenshot (step 8) before it can be added.
   - If a figure in the table is not offered as an Apple price point, **stop and tell the controller**. Never pick a nearby one.
4. **Live Watch: one price on both sides.** You ruled ₱3,990 on 23 Nov, but the website still charges ₱1,990.
   - **Recommended:** Admin › Pricing › Live Watch → 3,990 and save. It is live on save since #8177. Then set `live_watch` to ₱3,990 in App Store Connect.
   - **Or** keep ₱1,990 for now and set App Store Connect to ₱1,990.
   - Never leave them different.
5. **Set up the demo account for the reviewer** (signed in as the demo account, on the website or the app):
   - Create three host events, any type with a date in 2027: "Ana & Ben", "Carla & Dan", "Ella & Fred". If you pick other names, change them in the notes.
   - Open a free supplier shop named "Review Shop" (For suppliers › Open your shop). Any plan works for gifts.
   - Buy nothing on these events.
6. **Vercel: turn the switch ON.** Project `setnayan-platform-web` › Settings › Environment Variables › `NEXT_PUBLIC_APPLE_IAP_ENABLED` = `true` for Production, then **Redeploy** the current production deployment. A `NEXT_PUBLIC_` value is read at build time.
   - Only builds 6 and later (`SetnayanIAP/2`+) sell. The web and the desktop app never see Apple.
7. **Xcode: archive and upload build 9**, after tonight's last merge:
   - Pull `main` into a fresh worktree. In `apps/mobile`: `npm ci`, then `npx cap sync ios`.
   - Open `apps/mobile/ios/App/App.xcworkspace`. Scheme **App**, destination **Any iOS Device**.
   - Check Version **1.0** and Build **9** (already on main). If App Store Connect › TestFlight already shows a build 9, set **10** by hand.
   - Product › Archive › Distribute App › App Store Connect › Upload.
   - When it shows in TestFlight, install it on your iPhone and **buy Papic 150 once on your own test event**. TestFlight purchases run in Apple's sandbox and charge nothing, and the server accepts sandbox purchases (`lib/iap/apple-transaction.ts`). That proves the whole path works before the reviewer tries. "150 credits added" is the pass. If it fails, stop and send the controller a screenshot.
8. **Review screenshots** (one per product, Apple's own purchase sheet showing), from the TestFlight build on **your own test event and test shop, never the demo account's three events**:
   - the 3 plans (Event services › Pay);
   - Live Watch;
   - the 3 Papic packs;
   - the 6 gifts (Promote › Your gifts › Buy more › Buy).

   Take the shot while Apple's sheet is open, then press **Cancel**, so one test event serves every plan. Upload each to its product's Review Information. While you walk, confirm the two paths flagged under section 2.
   - **Separate from these:** the store screenshots (iPhone 1206×2622, plus iPad 13" 2064×2752, which is required) were due for a retake once the redesigns are live (`APPLE-STORE-LISTING-2026-11-22.md`). If you retake them, shoot only screens that `/api/health` shows live.
9. **Version 1.0 page:**
   - Pick **build 9** (or 10).
   - Under In-App Purchases and Subscriptions, add the 13 products and **no** subscription.
   - App Review Information: sign-in ON, the demo account's email and password (you type them), your contact, and the **Notes from section 2**. Attach `setnayan-nfc-demo.mp4`.
10. **Submit:** Version Release = **Manually release this version**, then **Add for Review** › **Submit**.
11. **Tell the controller it is submitted.** Supnayan stays parked until Apple approves this one.

---

*Measured by the apple-submit-prep session, 24 Nov 2026. Code PR #8292. Re-checked at `origin/main` @ `87d9ab68d5`: the 12 newer commits are audit docs and scripts and touch no Apple, app or catalogue file.*
