## 2026-11-22 · feat(iap): a shop buys gifts in the iPhone app through Apple, line by line — the App Store submit list, build 9

Owner, 4 Nov ("they can purchase inside apple as well"), 22 Nov ("okay we submit after those 3") and 22 Nov (relayed by
the controller: the in-app gift cart pays LINE BY LINE, one Apple payment per cart line); controller brief of 22 Nov.

- **A · The gift store in the app, paid line by line through Apple.** Inside the iPhone app (the three-part gate:
  `NEXT_PUBLIC_APPLE_IAP_ENABLED`, the store shell, a build that sells — AND a build whose plugin passes a quantity,
  `SetnayanIAP/3`), the gifts section keeps its tickets, sheets and store exactly as drawn, and swaps only the money:
  every price is StoreKit's `displayPrice`, and the cart's foot is a list of its lines, each with its OWN Apple purchase
  (`apple-gift-cart.tsx`, `app/_components/iap/iap-gift-buy.tsx`). A line is its gift bought with a quantity 1–10
  (StoreKit's limit): singles stop at 9 (the web store's rule); a 10 + 1 bundle is the gift bought with its paid count
  (10), and Setnayan lands the catalogue's `bundle_quantity` (11) — no Apple product per bundle. No money ceiling in the
  app: Apple charges each line by itself. The website cart is unchanged — one order, one BDO payment.
- **Delivery follows the quantity APPLE SIGNED** (`lib/iap/apple-gift-lines.ts`): `readAppleTransaction` takes 1–10 for a
  gift and exactly 1 for a couple product; what Apple charged is its unit price × the quantity. A signed quantity equal
  to a live bundle's paid count lands that bundle (recorded as a bundle, exactly as the web store records one); any
  other quantity lands that many singles at the list price. The gift lands in the shop's gift stock like a web gift:
  `startAppStorePurchase` has a shop branch (the web gift buy's own checks), the intent names the shop (migration
  `20271358270977`, `app_store_purchases.vendor_profile_id`), and the fulfilment mints the web gift's order
  (`vendor_gift__<code>` on the shop, no event), writes its `shop_gift_purchases` row and runs the web gift's
  activation; Apple's refund runs the web gift's reversal and takes the whole line back. Never through the booking-fee
  order. The same migration loosens `shop_gift_purchases_unlock_is_one_each` to `..._unlock_is_one_per_pack`
  (`credits_each = COALESCE(packs_each, 1)`) so an Event Plus / Pro / Ultra bundle is one unit of its whole count, as a
  Papic bundle already is; every existing row still passes.
- **The phone:** `SetnayanStorePlugin.purchase` takes an optional `quantity` (1–10, refused otherwise, never clamped) and
  passes it to StoreKit; the iOS user-agent announces `SetnayanIAP/3`. `/2` builds still sell couple products and are
  never shown the gift store (`hasStoreQuantity`, `getIapGate().iapQuantity`).
- **B · Clean-up.** The dead `hub_part_*` table and its two exports are gone (the 11 ids stay in the one retired list —
  ids are forever). `gift_music_maker` and `gift_patiktok` are retired; there is no `gift_live_watch` (Live Watch is not
  a gift on the web). The final list — id · name · price read from `platform_retail_catalog_v2`, with the ruling each
  price rests on, and what to detach in App Store Connect — is `build-sessions/APPLE-PRODUCTS-2026-11-22.md`.
- **C · Build number.** `CURRENT_PROJECT_VERSION` 6 → 9 (build 8 was already uploaded).
- Test harness: `tests/db/supabase-over-pglite.ts` models `.like()` and `.not(col, 'is', null)` (the gift catalogue
  readers use both).
- Guards: `lib/iap/a-shop-gift-is-bought-like-a-web-gift.test.ts` (4 tests, each sabotaged red once),
  `tests/db/a-shop-gift-bought-through-apple-lands-like-a-web-gift.db.test.ts` (6 tests; three fulfilment sabotages red).

SPEC IMPACT: None in the corpus text — implements the 4 Nov "SUPPLIERS CAN BUY GIFTS INSIDE THE IPHONE APP TOO" row as
amended by the 14 / 17 Nov gift-price rows (list price), the 21 Nov #8004 approval and the 22 Nov line-by-line ruling.

Ship fix: `.gitleaksignore` pins the secret-scan false positive on the catalogue code `PAPIC_GUEST_150` in `build-sessions/APPLE-PRODUCTS-2026-11-22.md` (a product identifier, not a credential).
