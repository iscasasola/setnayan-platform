## 2026-11-22 · feat(iap): a shop buys gifts in the iPhone app through Apple — the App Store submit list, build 9

Owner, 4 Nov ("they can purchase inside apple as well") and 22 Nov ("okay we submit after those 3"); controller brief
of 22 Nov.

- **A · The gift Apple button.** Inside the iPhone app (the three-part gate: `NEXT_PUBLIC_APPLE_IAP_ENABLED`, the
  store shell, a build that sells), a gift ticket's sheet keeps its picture and words and swaps ONLY its pay step: Add 1
  / Add 10 + 1 (the web's cart, paid into BDO) becomes one Apple purchase of one gift, with StoreKit's price on the
  button (`app/_components/iap/iap-gift-buy.tsx`). The gift lands in the shop's gift stock exactly like a web gift:
  `startAppStorePurchase` has a shop branch (the web gift buy's own checks: the signed-in owner or admin of their own
  shop, the gift on sale through the same catalogue reads, the Papic switch and tier), the intent names the shop
  (migration `20271358270977`, `app_store_purchases.vendor_profile_id`), and the fulfilment mints the web gift's order
  (`vendor_gift__<code>` on the shop, no event), writes its `shop_gift_purchases` row and runs the web gift's
  activation; Apple's refund runs the web gift's reversal. Never through the booking-fee order. The web is unchanged.
  Apple sells one at a time, so the 10 + 1 bundles stay on the web.
- **B · Clean-up.** The dead `hub_part_*` table and its two exports are gone (the 11 ids stay in the one retired list —
  ids are forever). `gift_music_maker` and `gift_patiktok` are retired; there is no `gift_live_watch` (Live Watch is not
  a gift on the web). The final list — id · name · price read from `platform_retail_catalog_v2`, with the ruling each
  price rests on, and what to detach in App Store Connect — is `build-sessions/APPLE-PRODUCTS-2026-11-22.md`.
- **C · Build number.** `CURRENT_PROJECT_VERSION` 6 → 9 (build 8 was already uploaded).
- Guards: `lib/iap/a-shop-gift-is-bought-like-a-web-gift.test.ts` (3 tests, each sabotaged red once),
  `tests/db/a-shop-gift-bought-through-apple-lands-like-a-web-gift.db.test.ts` (5 tests; two fulfilment sabotages red).

SPEC IMPACT: None in the corpus text — implements the 4 Nov "SUPPLIERS CAN BUY GIFTS INSIDE THE IPHONE APP TOO" row as
amended by the 14 / 17 Nov gift-price rows (list price) and the 21 Nov #8004 approval.
