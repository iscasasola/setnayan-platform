### Fixed
- **One badge list (walk 24 Nov, fix 5).** The Toolkit counted the badge shelf (Setnayan Verified + the five badges) while /for-suppliers counted only the five, so the two pages disagreed (live 179fc0e: 6 against 5). The shelf's list is now `SHELF_BADGE_KEYS` (`lib/shop-badge-shelf.ts`): the shelf builds its tiles from it, and the Toolkit's count, /for-suppliers' count (`toolkitCodeParts`) and its "See all" sheet (`toolkitShelves`, which now names Setnayan Verified) all read it.
- The second copies are gone: the badge page's adapter (`badge-sources.ts`) re-exports `lib/badge-tiers.ts` instead of a hand-typed mirror, and `rewardsOwed` (`lib/badge-rewards.ts`) loops `SHOP_BADGE_KEYS` instead of typing the five keys.
- Guard: `lib/one-badge-list.test.ts`. Re-pinned (not loosened): `badge-sources.test.ts` (1), `supplier-store.test.ts`, `the-redesign-builds-the-drawing.test.ts`.

SPEC IMPACT: None. No ruling changes: the shelf already drew Verified beside the five badges; /for-suppliers now counts what the Toolkit shows.
