## 2026-11-24 · perf(supplier): Shop and Toolkit reads in one round

The supplier walk (24 Nov, live 7247a56, signed in) measured `/vendor-dashboard/shop` at first byte 0.58–0.85 s and a full stream of 1.48–2.42 s, over the owner's 0.7 s rule.

**The Shop's size was not the cost.** The 618 KB of HTML is 79 KB on the wire, compressed. The extra second came from read chains on the server:

- **The service list (`VendorServicesManager`)** made about twelve trips one after another. The first was a fresh `supabase.auth.getUser()` that the request had already answered.
- **The Analytics carousel (`OneAnalyticsSection`)** ran its reads in about seven rounds: role, then plan, then Batch A, then the partnership count, then Batch B.
- **Both started late.** Each began only after the cover's whole batch was back.

What changed (no new reads, no new writes, no screen change):

- **The service list** reads in one round through a per-request `cache()` (`readServicesManager`). The only chains left are the true ones: the per-card reads wait for the card ids, and the medals and branches wait for the plan row. It takes the session from the cached `getCurrentUser`.
- **The carousel** reads through one per-request `cache()` (`readOneAnalytics`):
  - the plan read starts with the role read;
  - Batch B, the partnership count, the Store's twelve graphs and the verified median start beside Batch A;
  - the five new graphs start at once, and only the card-sells graph waits for the card list (`readNewGraphs` takes the cards as a promise).
- **The Shop starts both parts' reads with its own batch** (`preloadServicesManager`, `preloadOneAnalytics`), so they are already running when they render.
- **The Toolkit facts** no longer wait for the layout read to start (`readStoreToolFacts` takes its promise). The hub-tool overrides read the category names through the foreign key in one round, instead of a second read (`readHubOverrides`). This helps the Shop, every Toolkit page and the chat's widget share.
- **Every read keeps its honest-failure shape.** An unread value stays null or `ok: false`, and the page says so.

New guard: `app/vendor-dashboard/shop/the-shop-streams-in-one-round.test.ts`. Three sabotages went red, then were restored: the carousel preload removed, `auth.getUser()` put back, and the plan read moved behind the role read.

SPEC IMPACT: None. This is speed only, toward HOUSE_DESIGN_STANDARD Part G (G1, loads under 0.7 s).
