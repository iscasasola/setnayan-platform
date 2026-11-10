## 2026-11-10 · ci(bundle): the bundle size check counts what an app-router page actually downloads

Owner ruling 2026-11-10, answered "A": the required `bundle size check` must measure the shared client JS that app-router pages really download. The 202.3KB gzipped budget (CLAUDE.md 2026-05-22 KPI lock) is **unchanged**.

`apps/web/scripts/check-bundle-size.mjs` used to add build-manifest.json's pages-router lists (`/_app`, `/_error`) to the shared set, so it counted `framework-*` (58.5KB) and `main-*` (39.7KB). No page of this app downloads them: on the live site the home page and /maria-and-jose load `webpack-*` and `main-app-*` of those files and never `framework-*` or `main-*` (checked with `performance.getEntriesByType('resource')`). Main sat at 202.3/202.3KB, so PRs failed at random.

What it counts now (read from Next 15.5's own manifests, each chunk once, gzipped from disk):

- the chunks every app-router route lists (intersection over `app-build-manifest.json` `pages`);
- build-manifest.json `rootMainFiles`, which app-render bootstraps on every app page (the webpack runtime, the app-router core chunks, `main-app-*`). The old script read `rootMainFiles` from the app manifest, where Next does not write it;
- **the guard:** a pages-router chunk (anything in a build-manifest `pages` list, or named `framework-*`, `main-*` (not main-app), `pages/_app*`, `pages/_error*`) that shows up in **any** app route's load list is counted and flagged with a `⚠ GUARD` line.

Every run prints an `excluded (…)` line naming each chunk it leaves out, its size and the reason (pages router only, the pages router's client manifests, the nomodule polyfills), so nothing is hidden. The `Measured: X KB · Budget: 202.3KB` line and the Maker first-load step (`check-maker-js-budget.mjs`, same CI job) are unchanged. A build with no app-router routes in its manifest now fails loudly instead of passing with nothing measured.

Tests: new `apps/web/lib/the-bundle-check-counts-what-pages-load.test.ts` (13 tests, fixture manifests in the shape Next 15.5 writes, no build). I sabotage-checked both halves: turning the guard off fails 3 tests, and dropping `rootMainFiles` fails 1. Types for the test: `scripts/check-bundle-size.d.mts`.

SPEC IMPACT: DECISION_LOG "THE BUNDLE BUDGET MEASURES WHAT A PAGE ACTUALLY DOWNLOADS" (owner ruling 2026-11-10 "A"). The KPI number is unchanged. Only what the check counts changed.
