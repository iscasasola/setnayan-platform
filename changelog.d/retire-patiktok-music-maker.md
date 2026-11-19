## 2026-11-20 · feat(catalog): Patiktok and Music Maker are retired — no longer sold or described

Owner, verbatim: *"Retire Patiktok and Music Maker ( we do not want to serve this anymore)"*. Measured in prod
first: zero purchases of either (`event_software_activations_v2`, `onboarding_order_items`, `shop_gift_purchases`
all empty for `PATIKTOK_COMPILER` and `PAKANTA`).

- **Migration `20271352393877_retire_patiktok_and_music_maker`** — both catalogue rows `is_active = false`,
  `retired_at` stamped, `retirement_reason` quoting the owner. Idempotent; rows kept. Checkout already refuses an
  inactive SKU (`resolveServiceSellability`), and every catalogue-driven list (/pricing rows, the plan quiz, the
  supplier gift store) drops them on its own.
- **One list:** `lib/retired-products.ts` (codes, add-on keys, feature slugs, public paths, names). Read by
  `addOnSellableNow` (never sellable), `buildOurServices` (no card / More row unless the event already has it),
  `studio-rail` (no sidebar row), the About route (redirect to the event), `FEATURE_PAGES` (no page, no
  "works with"), `/features/<slug>` (redirect to the hub) and llms.txt (never described).
- **In-app pages** `/studio/patiktok` (+ booth, templates) and `/studio/pakanta` send an event that does not own the
  product to its dashboard (`lib/retired-products.server.ts`); an owner — including an Event Ultra event, which
  still gets Patiktok — keeps the page. A failed ownership read lets them in rather than locking an owner out.
- **Public:** `/patiktok` and `/pakanta` redirect to `/features`; removed from the sitemap, the front-door add-on
  tiles, the site description, the homepage + layout JSON-LD, /about (EN + TL), the /features "how it works" and
  rows, /help (three articles), the Today tour, a blog line and two real-wedding service tags.
- **App Store:** `music_maker` and `patiktok` leave `IAP_PRODUCTS` for the delivery-only retired list.
- **Onboarding:** the two quiz personas no longer suggest Music Maker.
- **Guard:** `lib/retired-products-stay-retired.test.ts` — fails if either becomes buyable or is described in public
  again. Sabotage-tested (re-adding the App Store product, reopening the buy gate, re-adding the front-door tile
  each failed it).
- **Event Ultra's copy** no longer lists Patiktok (front door, the in-app plan offer, /pricing, /features, /help) —
  owner *"Keep ₱9,990"*: Ultra loses Patiktok and keeps its price. Its read-side grant (`EVENT_ULTRA_GRANTS` + the
  two gifted-Ultra SQL functions that mirror it) is NOT changed here — a follow-up; prod had zero Ultra orders.
- **/pricing** never prices a retired code even before the row retirement is applied (`ourPricesFrom`).
- **Kept on purpose:** the engines, routes, tables, admin delivery queues, and the privacy / cookie / sub-processor
  disclosures (data already collected is still described).

SPEC IMPACT: None new — the corpus already records both rulings (DECISION_LOG 2026-11-20 "PATIKTOK AND MUSIC MAKER
RETIRED" and "EVENT ULTRA STAYS ₱9,990 WITH PATIKTOK RETIRED"; Pricing.md already applied). This PR builds them.
