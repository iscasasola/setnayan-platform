# Apple in-app purchases — prices for the next build (4 Nov 2026)

Source: owner's final price sheet, 4 Nov 2026 — *"same price for both"* (DECISION_LOG
"FINAL PRICE SHEET — ONE PRICE, APPLE AND WEBSITE"). The App Store price of each product
is the SAME figure as the website price in Admin › catalogue (`platform_retail_catalog_v2`).
The app never types a price; it shows the price Apple returns. The code list is
`apps/web/lib/iap/products.ts`.

## Products on sale in the next build

| Product id | Apple type | Display name | PH price (= website) | Catalogue code |
|---|---|---|---|---|
| `com.setnayan.app.event_plus` | Consumable | Event Plus | ₱2,990 | `EVENT_PLUS` |
| `com.setnayan.app.event_pro` | Consumable | Event Pro | ₱5,690 | `COUPLE_WEBSITE_PRO` |
| `com.setnayan.app.papic_pack_150` | Consumable | Papic 150 | ₱99 | `PAPIC_GUEST_150` |
| `com.setnayan.app.papic_pack_1000` | Consumable | Papic 1000 | ₱499 | `PAPIC_GUEST_1K` |
| `com.setnayan.app.papic_pack_3000` | Consumable | Papic 3000 | ₱999 | `PAPIC_GUEST` |
| `com.setnayan.app.live_watch` | Consumable | Live Watch | ₱1,990 | `LIVE_STUDIO` |
| `com.setnayan.app.music_maker` | Consumable | Music Maker | ₱2,990 | `PAKANTA` |
| `com.setnayan.app.patiktok` | Consumable | Patiktok | ₱2,490 | `PATIKTOK_COMPILER` |

Why "consumable" for Plus and Pro: each is one purchase for ONE event. A non-consumable
can be bought only once per Apple ID for life, so a second event could never buy it.

What each includes (for the description): Event Plus = 100 Papic credits + Setnayan AI.
Event Pro = 1,000 Papic credits + everything in Event Plus.

## Supplier gift products (create now — NOT attached to sale until the supplier purchase is built)

Owner, 4 Nov: suppliers may buy gifts inside the app too. Price = the row's **gift price**
(`gift_price_php`, Admin › catalogue), what a Verified-and-up supplier pays. Listed in
`apps/web/lib/iap/products.ts` as `IAP_SUPPLIER_GIFT_PRODUCTS`.

| Product id | Apple type | Display name | PH price (= gift price) | Catalogue code |
|---|---|---|---|---|
| `com.setnayan.app.gift_papic_pack_150` | Consumable | Gift · Papic 150 | ₱90 | `PAPIC_GUEST_150` |
| `com.setnayan.app.gift_papic_pack_1000` | Consumable | Gift · Papic 1000 | ₱449 | `PAPIC_GUEST_1K` |
| `com.setnayan.app.gift_papic_pack_3000` | Consumable | Gift · Papic 3000 | ₱899 | `PAPIC_GUEST` |
| `com.setnayan.app.gift_event_plus` | Consumable | Gift · Event Plus | ₱2,690 | `EVENT_PLUS` |
| `com.setnayan.app.gift_event_pro` | Consumable | Gift · Event Pro | ₱5,190 | `COUPLE_WEBSITE_PRO` |
| `com.setnayan.app.gift_live_watch` | Consumable | Gift · Live Watch | ₱1,790 | `LIVE_STUDIO` |
| `com.setnayan.app.gift_music_maker` | Consumable | Gift · Music Maker | ₱2,690 | `PAKANTA` |
| `com.setnayan.app.gift_patiktok` | Consumable | Gift · Patiktok | ₱2,290 | `PATIKTOK_COMPILER` |

⚠ **Not sellable yet.** The app's purchase path is the couple's (one event, the couple's
own account). There is no supplier-buyer purchase, no "which couple receives it" step and
no gift delivery, so these ids are deliberately kept out of the app's product list. Create
them in App Store Connect but do **not** add them to a version until that is built. A Free
supplier pays the list price, which in the app is the couple product itself.

## ⚠ Each price must be an Apple PH price point

Apple only allows its own price points. In App Store Connect's price picker (Philippines
as the base country), check that **each** of these is offered exactly:
₱99 · ₱499 · ₱999 · ₱1,990 · ₱2,490 · ₱2,990 · ₱5,690 — and for the gifts
₱90 · ₱449 · ₱899 · ₱1,790 · ₱2,290 · ₱2,690 · ₱5,190.

If one is **not** offered, do not pick a nearby one — tell us which. One price everywhere
means the website must change to match. (The sale still goes through, but every App Store
sale whose price differs from the website price by ₱0.50 or more is logged as a fault.)

## Remove from sale (ids are forever — never delete or reuse them)

- `com.setnayan.app.event_hub_pro` (Event Hub Pro) — replaced by `event_pro`.
- `com.setnayan.app.setnayan_ai`, `…setnayan_ai_tier_b`, `…setnayan_ai_tier_c`,
  `…setnayan_ai_tier_d` (Setnayan AI) — no longer sold on its own; it comes with Event Plus
  and Event Pro.
- `com.setnayan.app.papic_credits_100`, `_500`, `_1000`, `_5000`, `_10000` (old Papic
  credits) — replaced by the three Papic packs.

Already-paid purchases of these still switch on: the server keeps them for delivery only.

## Steps in App Store Connect

1. Open App Store Connect › Apps › Setnayan › Monetization › In-App Purchases.
2. For `event_plus` and `event_pro` (and any Papic pack not made yet): create it if it is not
   there — type **Consumable**, the product id exactly as in the table.
3. On each product in the table: open **Price Schedule**, set the base country to
   **Philippines**, pick the price from the table. If it is not in the list, stop and tell us.
4. Set the **Display Name** exactly as in the table, and a one-line **Description**
   (e.g. "100 Papic credits and Setnayan AI for this event").
5. Add the **Review Screenshot** (the buy sheet in the app showing that product).
6. Open the app version for the next build › **In-App Purchases and Subscriptions** › add
   all eight products above.
7. For each product in "Remove from sale": open it › **Availability** › remove from sale
   (Remove from all countries). Do not delete it.
8. Upload the build, attach it to the version, and **Submit for Review** — the new products
   go to review together with the build.
9. After approval, check one sale in the app: the price shown must equal the website price.
