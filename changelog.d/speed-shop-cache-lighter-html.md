## 2026-11-10 · perf(shop,html): a stranger's shop page is served from the cache; every page drops ~31 KB of nav registry

Pre-Build-5 speed item. Nothing on screen changes.

**1. The public shop page `/v/{slug}` is cached (ISR).** Before this, every open was a `force-dynamic` full server render (`cache-control: private, no-store`). It now follows the same shape as the cached Event Hub (EV1):
- `middleware.ts` rewrites a stranger's request to the new `app/v/[slug]/cached/page.tsx` (`lib/shop-view.ts` → `shopRequestShape`). A stranger means: no session, no demo cookie, no native shell, no query the page reads.
- That route renders the same `renderVendorBySlug` and reads nothing from the request. `onTheCachedHub()` now also answers for `CACHED_SHOP_ROUTE`.
- Freshness:
  - the shop's tag (`revalidateShopPage`, `lib/shop-page-cache.ts`), called by every supplier and admin save that changes a `vendor_*` row the page reads. About 40 action files.
  - the slug's tag.
  - a 60 s backstop.
- The view count moves from `after()` to a client beacon (`ShopViewBeacon`), which uses the same `recordVendorProfileView`. Signed-in, demo, app and `?service=`/`?event=`… requests keep the live render.
- Kill switch: `SHOP_CACHE_DISABLED=1`.

**2. HTML weight.** Production, measured 10 Nov:
- `/` was 298,188 B; `/vendors` → `/for-suppliers` was 411,171 B.
- The root layout handed `<SiteChrome>` the whole nav registry (190 slots, ~31 KB of RSC) for a nav that reads four labels. The doorway rail sent the same map a second time.
- Both now get only the slots they read (`lib/nav-slot-pick.ts`): 28.5 KB → 1.4 KB for the site nav, 0.3 KB for the rail.
- Expected: ~35 KB off every public page's HTML, ~70 KB off `/for-suppliers`. This comes from payload analysis. There was no local prod build, because the registry needs the real DB.

Guards (each sabotage-checked):
- `lib/the-shop-page-stays-cacheable.test.ts`:
  - no unguarded request read in the cached tree
  - every query param classified
  - middleware order
  - every shop-table save reaches `revalidateShopPage`
- `lib/a-nav-gets-only-the-slots-it-reads.test.ts`: the picks, plus a byte budget.

Follow-ups, not in this PR:
- the bare `/{slug}` shop address still renders live
- the signed-in layouts (admin, supplier, couple) still ship the full nav map

SPEC IMPACT: None.
