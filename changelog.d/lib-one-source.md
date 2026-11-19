## 2026-11-18 · chore(lib): one source per fact — three orphans gone, the money formatter read from its home

Code only; no screen changes.

- **(a) Orphans.** An import-graph scan of every `apps/web/lib` file (static, dynamic, `require`,
  `new URL(…, import.meta.url)`, and every repo-wide mention including tests, scripts and baselines)
  found 16 files with no importer. Three were true orphans and are deleted:
  `lib/route-meta.ts` (marked SUPERSEDED by `lib/nav-registry-defaults.ts`, zero importers),
  `lib/keep-a-degraded-render-briefly.ts` and `lib/stories-search-config.ts` (both left behind when
  9ea1db29 retired the blog and Real Stories). The `route-meta.ts` line in
  `share-buttons-use-one-icon.test.ts` is dropped as that test asks ("allow-listed but gone").
  The other 13 are kept: read as text by a guard test, run as a worker or harness, a compile-time
  guard, or a flag the owner parked on purpose.
- **(b) Spotlights / free tools — no change, by decision.** The 14 `SPOTLIGHTS` lists share no entry;
  each is its page's own copy, already drawn by the one shared `Spotlights` component. Owner (2026-11-18):
  leave them per page. `FREE_TOOLS` already has one source (`onboarding-shell.tsx`, used once).
- **(c) Catalogue.** `formatCentavosPhp` is imported from `lib/php.ts` by the admin pricing table and
  the pricing report instead of through `lib/sku-catalog.ts`'s re-export, which is removed. Same
  function, same output.

SPEC IMPACT: None
