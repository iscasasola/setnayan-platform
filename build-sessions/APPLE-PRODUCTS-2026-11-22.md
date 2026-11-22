# Apple in-app purchases: the final list for the App Store submission (22 Nov 2026)

**Prices** were read from `platform_retail_catalog_v2.retail_price_php` in production, SELECT only, at
2026-11-22 10:06 UTC. Nobody typed them. Re-measure before you act:

```sql
select service_code, title, retail_price_php, is_active
from platform_retail_catalog_v2
where service_code in ('EVENT_PLUS','COUPLE_WEBSITE_PRO','EVENT_ULTRA','LIVE_STUDIO',
                       'PAPIC_GUEST_150','PAPIC_GUEST_1K','PAPIC_GUEST');
```

**One price everywhere** (owner, 28 Oct and 4 Nov). The App Store price of each product is the Philippine price point
equal to the website figure. The app never shows a typed price; it shows what StoreKit returns.

**Which row decides each price (newest first):**
- **App = web, one price.** The 4 Nov "FINAL PRICE SHEET — ONE PRICE, APPLE AND WEBSITE" row superseded the same
  day's "APP PRICES APPROVED" (app costs more). The 10 Nov "APP STORE EVENT PRO = ₱5,690 — THE SAME AS THE WEB" row
  confirmed it.
- **Event Pro = ₱5,490.** Owner approved #8004 on 21 Nov ("OWNER READ THE THREE MONEY CARDS": Event Pro ₱5,490,
  Ultra ₱9,990, Plus ₱2,990, gift = list price). Production's catalogue still reads ₱5,690 until #8004 is deployed.
- **A gift costs the list price.** Rows: 14 Nov "SINGLE GIFTS STAY, AT LIST PRICE", 17 Nov "Gift prices: regular
  price + 10+1 bundles", 17 Nov "Event Ultra can be bought", 20 Nov "#8004 REVIEW" (Event Pro gift = ₱5,490), 21 Nov
  #8004 approval. These supersede the 4 Nov gift prices (₱90 · ₱449 · …). `gift_price_php` is not a price anywhere.
- **Who may gift:** any shop, Free or Verified. The 14 Nov row superseded "Verified pays the gift price", and the web
  store has no tier gate. An app gift follows the web.

**The code list** is `apps/web/lib/iap/products.ts`.

⚠ **Event Pro timing.** Each App Store sale is checked against the catalogue (`appStorePriceMatchesWeb`). If ASC is set
to ₱5,490 before #8004 is live, every Event Pro sale is logged as a price fault until it is. The sale still completes.

## Couple products (on sale)

| Product id | Display name | Catalogue code | Price (catalogue) |
|---|---|---|--:|
| `com.setnayan.app.event_plus` | Event Plus | `EVENT_PLUS` | ₱2,990 |
| `com.setnayan.app.event_pro` | Event Pro | `COUPLE_WEBSITE_PRO` | **₱5,490** (21 Nov; catalogue reads ₱5,690 until #8004 deploys) |
| `com.setnayan.app.event_ultra` | Event Ultra | `EVENT_ULTRA` | ₱9,990 |
| `com.setnayan.app.live_watch` | Live Watch | `LIVE_STUDIO` | ₱1,990 |
| `com.setnayan.app.papic_pack_150` | Papic 150 | `PAPIC_GUEST_150` | ₱99 |
| `com.setnayan.app.papic_pack_1000` | Papic 1000 | `PAPIC_GUEST_1K` | ₱499 |
| `com.setnayan.app.papic_pack_3000` | Papic 3000 | `PAPIC_GUEST` | ₱999 |

## Supplier gift products (on sale in this build: a shop buys gift stock in the app)

| Product id | Display name | Catalogue code | Price (catalogue list price) |
|---|---|---|--:|
| `com.setnayan.app.gift_event_plus` | Gift · Event Plus | `EVENT_PLUS` | ₱2,990 |
| `com.setnayan.app.gift_event_pro` | Gift · Event Pro | `COUPLE_WEBSITE_PRO` | **₱5,490** (as Event Pro) |
| `com.setnayan.app.gift_event_ultra` | Gift · Event Ultra | `EVENT_ULTRA` | ₱9,990 |
| `com.setnayan.app.gift_papic_pack_150` | Gift · Papic 150 | `PAPIC_GUEST_150` | ₱99 |
| `com.setnayan.app.gift_papic_pack_1000` | Gift · Papic 1000 | `PAPIC_GUEST_1K` | ₱499 |
| `com.setnayan.app.gift_papic_pack_3000` | Gift · Papic 3000 | `PAPIC_GUEST` | ₱999 |

⚠ **Owner action: re-point the gift prices.** On 4 Nov the gift price points were set from the old gift price
(₱90 · ₱449 · ₱899 · ₱1,790 · ₱2,690 · ₱5,190). Since 14 Nov a gift costs the list price, so each gift product's
Philippine price point must be changed to the figure in the table above. `gift_event_ultra` must be **created** if
it is not in App Store Connect yet: type Consumable, at ₱9,990.

⚠ **No `gift_live_watch`.** Live Watch is not a gift on the web (gifts are Papic, Plus, Pro and Ultra only), so the
app cannot sell one. Do not create it. If it already exists, detach it.

⚠ **Apple price points are not verified here.** Nobody in a session can see Apple's PH price list. In App Store
Connect, with the Philippines as the base country, each figure above must be offered exactly. If one is not, stop and
say which; never pick a nearby point (one price everywhere means the website would change instead).

## Detach in App Store Connect (remove from sale; ids are forever, so never delete or reuse them)

| Product id | Why |
|---|---|
| `com.setnayan.app.papic_credits_100` · `_500` · `_1000` · `_5000` · `_10000` | Replaced by the three Papic packs (3 Nov). Already-paid ones still deliver. |
| `com.setnayan.app.setnayan_ai` · `setnayan_ai_tier_b` · `_tier_c` · `_tier_d` | Setnayan AI comes with Event Plus and Event Pro (4 Nov). Already-paid ones still deliver. |
| `com.setnayan.app.event_hub_pro` | Replaced by `event_pro` (4 Nov). Already-paid ones still deliver. |
| `com.setnayan.app.music_maker` · `com.setnayan.app.patiktok` | Retired (owner, 20 Nov). Already-paid ones still deliver. |
| `com.setnayan.app.gift_music_maker` · `com.setnayan.app.gift_patiktok` | Left with their products (20 Nov). |
| `com.setnayan.app.gift_live_watch` (only if it was created) | Live Watch is not a gift. |
| `com.setnayan.app.papic_thank_you` | The Thank-You Video is free (26 Oct). |
| `com.setnayan.app.mood_board_renders_50` | Mood Board renders retired (26 Oct). |
| `com.setnayan.app.hub_part_*` (11) | Event Pro is sold whole (26 Oct). Never attached to a version. |

## Build number

`CURRENT_PROJECT_VERSION` is now **9** (build 8 was already uploaded). The owner confirms the last uploaded number in
App Store Connect. If it is higher than 8, bump again.
