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

**Gifts** are priced at the LIST price (since 14 Nov). `gift_price_php` is no longer a price anywhere.

**The code list** is `apps/web/lib/iap/products.ts`.

⚠ **Open PR #8004** would change Event Pro to ₱5,490. If it merges first, set Event Pro and Gift · Event Pro to that
figure instead. The catalogue is always the answer.

## Couple products (on sale)

| Product id | Display name | Catalogue code | Price (catalogue) |
|---|---|---|--:|
| `com.setnayan.app.event_plus` | Event Plus | `EVENT_PLUS` | ₱2,990 |
| `com.setnayan.app.event_pro` | Event Pro | `COUPLE_WEBSITE_PRO` | ₱5,690 |
| `com.setnayan.app.event_ultra` | Event Ultra | `EVENT_ULTRA` | ₱9,990 |
| `com.setnayan.app.live_watch` | Live Watch | `LIVE_STUDIO` | ₱1,990 |
| `com.setnayan.app.papic_pack_150` | Papic 150 | `PAPIC_GUEST_150` | ₱99 |
| `com.setnayan.app.papic_pack_1000` | Papic 1000 | `PAPIC_GUEST_1K` | ₱499 |
| `com.setnayan.app.papic_pack_3000` | Papic 3000 | `PAPIC_GUEST` | ₱999 |

## Supplier gift products (on sale in this build: a Verified-and-up supplier gifts a couple)

| Product id | Display name | Catalogue code | Price (catalogue list price) |
|---|---|---|--:|
| `com.setnayan.app.gift_event_plus` | Gift · Event Plus | `EVENT_PLUS` | ₱2,990 |
| `com.setnayan.app.gift_event_pro` | Gift · Event Pro | `COUPLE_WEBSITE_PRO` | ₱5,690 |
| `com.setnayan.app.gift_event_ultra` | Gift · Event Ultra | `EVENT_ULTRA` | ₱9,990 |
| `com.setnayan.app.gift_live_watch` | Gift · Live Watch | `LIVE_STUDIO` | ₱1,990 |
| `com.setnayan.app.gift_papic_pack_150` | Gift · Papic 150 | `PAPIC_GUEST_150` | ₱99 |
| `com.setnayan.app.gift_papic_pack_1000` | Gift · Papic 1000 | `PAPIC_GUEST_1K` | ₱499 |
| `com.setnayan.app.gift_papic_pack_3000` | Gift · Papic 3000 | `PAPIC_GUEST` | ₱999 |

⚠ **Owner action: re-point the gift prices.** On 4 Nov the gift price points were set from the old gift price
(₱90 · ₱449 · ₱899 · ₱1,790 · ₱2,690 · ₱5,190). Since 14 Nov a gift costs the list price, so each gift product's
Philippine price point must be changed to the figure in the table above. `gift_event_ultra` must be **created** if
it is not in App Store Connect yet: type Consumable, at ₱9,990.

## Detach in App Store Connect (remove from sale; ids are forever, so never delete or reuse them)

| Product id | Why |
|---|---|
| `com.setnayan.app.papic_credits_100` · `_500` · `_1000` · `_5000` · `_10000` | Replaced by the three Papic packs (3 Nov). Already-paid ones still deliver. |
| `com.setnayan.app.setnayan_ai` · `setnayan_ai_tier_b` · `_tier_c` · `_tier_d` | Setnayan AI comes with Event Plus and Event Pro (4 Nov). Already-paid ones still deliver. |
| `com.setnayan.app.event_hub_pro` | Replaced by `event_pro` (4 Nov). Already-paid ones still deliver. |
| `com.setnayan.app.music_maker` · `com.setnayan.app.patiktok` | Retired (owner, 20 Nov). Already-paid ones still deliver. |
| `com.setnayan.app.gift_music_maker` · `com.setnayan.app.gift_patiktok` | Left with their products (20 Nov). |
| `com.setnayan.app.papic_thank_you` | The Thank-You Video is free (26 Oct). |
| `com.setnayan.app.mood_board_renders_50` | Mood Board renders retired (26 Oct). |
| `com.setnayan.app.hub_part_*` (11) | Event Pro is sold whole (26 Oct). Never attached to a version. |

## Build number

`CURRENT_PROJECT_VERSION` is now **9** (build 8 was already uploaded). The owner confirms the last uploaded number in
App Store Connect. If it is higher than 8, bump again.
