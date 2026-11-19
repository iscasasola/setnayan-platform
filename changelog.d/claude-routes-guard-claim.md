## 2026-11-18 · test(routes): the route-integrity guard routes.ts promised now exists

`lib/routes.ts` claimed "the route-integrity guard (scripts/lint-routes.mjs) fails the build if
a builder points at a folder that does not exist … or a route folder lacks a builder". That script
never existed in git history. New guard `lib/every-route-builder-reaches-a-page.test.ts` calls every
builder and resolves its path against `app/` (a literal segment must match a literal folder; only a
builder argument may fill a `[dynamic]` folder). It found six dead builders, all with zero callers,
now deleted: `venue.detail`, `venues.index`, `venues.detail`, `explore.index`, `sitemapVenuesXml`,
`dashboard.addOns.suppliesMarketplace`. The orphan half ("every route folder has a builder") is
false today (250+ pages have none) and is not enforced, so the docblock now says exactly that.
Sabotage: a planted `/admin/no-such-page/:id` builder, a restored `/venues` builder, and a moved
`app/admin/disputes` folder each turn the guard red. No UI change.

SPEC IMPACT: None
