### Fixed
- **One badge list (walk 24 Nov, fix 5).** The Toolkit counted the badge shelf (Setnayan Verified + the five badges) while /for-suppliers counted only the five, so the two pages disagreed (live 179fc0e: 6 against 5). The shelf's list is now `SHELF_BADGE_KEYS` (`lib/shop-badge-shelf.ts`): the shelf builds its tiles from it, and the Toolkit's count, /for-suppliers' count (`toolkitCodeParts`) and its "See all" sheet (`toolkitShelves`, which now names Setnayan Verified) all read it.
- The second copies are gone: the badge page's adapter (`badge-sources.ts`) re-exports `lib/badge-tiers.ts` instead of a hand-typed mirror, and `rewardsOwed` (`lib/badge-rewards.ts`) loops `SHOP_BADGE_KEYS` instead of typing the five keys.
- Guard: `lib/one-badge-list.test.ts`. Re-pinned (not loosened): `badge-sources.test.ts` (1), `supplier-store.test.ts`, `the-redesign-builds-the-drawing.test.ts`.

SPEC IMPACT: None. No ruling changes: the shelf already drew Verified beside the five badges; /for-suppliers now counts what the Toolkit shows.

### Fixed (re-walk on live 307925d, controller GO)
- **The door pages link the site directly.** On supplier.setnayan.com and coordinator.setnayan.com, every Open your shop, Get verified, plan and Start link was relative, so each tap made a 308 hop to the site first (0.12–0.44 s measured). They are now absolute: `onSiteHref` (`lib/doors.ts`) joins `siteOrigin()` and the door map's `doorOpenShopHref`. The coordinator door keeps `?as=coordinator`, and each plan keeps its `?plan=`. Guard: `lib/door-pages-link-the-site-directly.test.ts`.
- **"No guest count yet" is words, not a figure.** In the quote maker, "On their list" set it at figure size, and both rows wrapped onto 2 lines at 375 px. It is now body size, on one line, in both rows. Guard: `app/_components/no-guest-count-is-words-not-a-figure.test.ts`.
- Re-pinned guards (none loosened): `every-guest-count-says-which-count`, `the-client-workspace-says-what-is-true`, `the-invite-button-reaches-the-invite`, `the-redesign-builds-the-drawing`, `for-coordinators-says-what-ships`, `get-verified-carries-the-choice`.
