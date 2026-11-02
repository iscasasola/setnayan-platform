## 2026-09-20 · test(s41c): convert exact per-file log-site counts to per-site anchors with a floor

The `s41c-*-reads-are-honest.test.ts` family (and two siblings) pinned an **exact** `[supabase-error]`
occurrence count per file — a `LOG_SITE_COUNTS` table with `expected: N`, or an equivalent
`assert.equal(count, N)` on a generic per-file marker. That shape broke `main` once and PRs three
times on 2026-09-19: whenever a legitimate, DISTINCT new log site was added to one of these files
(a real fix logging a different call site), the total occurrence count grew past the pinned
`expected`, and CI turned red for a change that made nothing worse.

Converted every such count in six files to a per-NAMED-SITE anchor with a FLOOR (`>=` the current
count), never an exact match:

- `lib/s41c-supplier-batch-a-reads-are-honest.test.ts` — `frontdoor/data.ts` (3 sites),
  `vendors/page.tsx` (2 sites on `vendor_market_stats`), `inline-docs-actions.ts` (3 sites)
- `lib/s41c-supplier-batch-b-reads-are-honest.test.ts` — `live-studio-channel-grants.ts` (floor 2)
- `lib/s41c-supplier-batch-c-reads-are-honest.test.ts` — the `LOG_SITE_COUNTS` table (16 files)
  rebuilt as `LOG_SITE_FLOORS`: every finding's call-site label is its own anchor, plus a per-file
  aggregate floor as a backstop
- `lib/s41c-supplier-batch-d-reads-are-honest.test.ts` — `verification-checks-server.ts` (2 named
  functions on the same table)
- `lib/s41c-unclassified-batch-f-reads-are-honest.test.ts` — `consent-veto.ts`'s "count is exactly 2"
  narrowed to the exact templated marker + floor
- `lib/s41c-unclassified-batch-g-reads-are-honest.test.ts` — `panood-moments.ts`, `panood-screens.ts`,
  `promo-free-windows.ts`, `venue-recommendations.ts` (each site anchored individually)

Each anchor still catches a real regression: deleting a named site's log call drops that anchor's
own count below its floor (red), and where two call sites emit an identical string (`vendor-counts.ts`,
`vendor-dayof-config.ts`), the floor is 2 so losing either one still fails. Adding a new, distinct
site — the thing that kept breaking `main` — no longer moves any of these tests, because a floor
check (`>=`) only rejects a decrease.

Sabotage-proven on three files (`batch-a`, `batch-c`, `batch-g`), each three ways: deleting a named
site's handling → red; adding a new, correct, distinct site → stays green; removing the
floor-reaching occurrence of a multi-site anchor → red. Restored after each check; no source files
changed, only the six test files. `npx tsx --test lib/s41c-*-reads-are-honest.test.ts` → 86/86 pass.
`node scripts/lint-one-comment-stripper.mjs` → clean (all six files already used `stripComments`
from `lib/strip-comments.ts`, unchanged by this PR).

SPEC IMPACT: None
