## 2026-11-17 · fix(supplier-shop): a shop that failed to load is never told to "Set up my shop"

From the supplier dashboard audit (Shop):
- My Shop's `data === null` branch is reached only when `loadShopData()` threw, because a proven "no shop" has already redirected to `/open-shop`. It used to say "Set up your business profile first" and offer a **Set up my shop** link to the wizard, which invited a supplier who has a shop to start a second one. It now shows the shared `CouldNotLoad` line and a **Try again** link back to Shop.
- The guard `the-open-shop-redirect-is-a-proven-absence.test.ts` now also fails if My Shop ever links to `/open-shop`.
- Two cover links now meet the 44 px floor: the "★ rating · reviews" link, and "Open in browser" on Your page.

SPEC IMPACT: None.
