## 2026-10-22 · feat(iap,pro): Event Hub Pro parts in the iPhone app 1.1 (flag-dark) + the Animated Monogram reads as Logo & QR

PR3 of "Event Hub Pro, part by part" (owner 2026-10-22, "yes to all").

- **The 11 parts are Apple products** (`lib/iap/products.ts`, `com.setnayan.app.hub_part_<id>`, consumable, floor = web ÷ 0.85),
  behind the one IAP gate (`SetnayanIAP/2` + `NEXT_PUBLIC_APPLE_IAP_ENABLED`) — build 5 (1.0) never sells.
- **The app's ✓ Apply sheet** names the parts with no web figure; "Everything" is offered only while the event owns nothing.
  `/apple-pro?buy=<parts>` lists each part at StoreKit's `displayPrice` and buys them one after another; owned parts are
  dropped, and Everything is not sold once any part is owned (server: `startAppStorePurchase` refuses `not_on_sale`).
- **An in-app part counts its web value toward the cap** (the cap reads the catalogue, never Apple's price).
- **The standalone Animated Monogram is retired from sale** (migration `20271283592608`, `is_active = FALSE`); its owners own
  Logo & QR (`SKU_OWNERSHIP_ALIASES` both ways) and what they paid counts toward the cap (`HUB_PART_PAID_CODES`). Every surface
  that sold or priced it now reads the Logo & QR part: the monogram page's one button, the Live Studio setup card, the
  /features invite price, the app-store demo literal, llms.txt. The onboarding wedding in-app card drops it (₱0 hazard, same as
  live_background).
- Guards: `lib/pro-parts-in-the-app.test.ts` (5 sabotages, each red); the cap db test gains the monogram case.

SPEC IMPACT: `~/Documents/Claude/Projects/shots-2026-10-21/iap-1-1/OWNER-STEPS-1.1.md` — 18 products (the 11 parts + floors,
"Everything hidden once a part is owned", Sandbox steps). DECISION_LOG row "EVENT HUB PRO, PART BY PART" already landed (fad62e64).
