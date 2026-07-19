## 2026-07-09 · feat(vendors): reason-labeled sort on the Shortlist bench

Added a sort lens + a "why it's here" reason pill to the couple **Services / Shortlist** bench (`ShortlistCategories`) — the deferred "reason-labeled shortlist re-filter" item from `unify-vendor-tabs.md`, and owner ask (d) ("follow and filter and sort").

A pill segmented control (Best fit · Lowest price · Top rated, default **Best fit**) reorders every category's considered-vendor carousel, and each card gains a corner ribbon explaining its position under the active lens:

- **Best fit** — ranks by how many live fit-checks (reach + budget, from the PR-1 fields) the vendor passes, then rating, then price. Leader → "Best fit"; a 2-of-2 pass → "Strong fit"; 1-of-2 → "Fair fit"; 0 → no pill (calm by default).
- **Lowest price** — cheapest leads, labeled "Lowest price"; unpriced vendors sink.
- **Top rated** — highest rated leads ("Top rated"); the rest show a quiet "N.N★" readout.

The pure sort+label logic lives in a new framework-free lib (`lib/bench-sort.ts` · `sortWithReasons` / `fitScore` / `BENCH_SORTS`) so it's unit-tested (6 tests: lens order, fit ranking, price/rating leaders, unpriced/unrated handling, no-mutation) and reusable by the two-column workspace (PR-4). Ribbon + toggle styled in the wine/gold brand (databerry energy: pill toggle like the inspiration's "Brand addition / Upcoming" segments, corner ribbon as color-as-status). Client-side only — no server or query change. Behind `BUDGET_BUILD_ENABLED` with the rest of the takeover.

Files: `apps/web/lib/bench-sort.ts`, `apps/web/lib/bench-sort.test.ts`, `apps/web/app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx`.

SPEC IMPACT: None — client-side ordering + labeling over existing data; no schema, pricing, SKU, or engine change. (Advances the "reason-labeled shortlist re-filter" item the corpus tracked as deferred.)
