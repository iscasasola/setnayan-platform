**preflight** · `claude/wizardly-edison-abu9xn` @ `744f49f71` · base `origin/main` · 57 changed · wall 39m 16s · cheap faults clear

| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 46 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 1m 51s | | |
| eslint on changed files (24) | PASS | 2.6s |  | `(cd apps/web && npx next lint --file 'app/(shell)/articles/[slug]/page.tsx' --file 'app/_components/frontdoor/discover-in-six-parts.test.ts' --file 'app/_components/frontdoor/discover-six-parts-data.ts' …)` |
| tsc (24 changed + 33 of 33 importers) | PASS | 30.0s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 162 files, 1,320 tests | PASS | 8m 35s |  |  |
| whole-tree guard tests — 763 files, 5,343 tests | PASS | 16m 55s |  |  |
| DB tests that scan source — 35 files, 227 tests | PASS | 11m 57s |  |  |

Left to CI (not run locally): full typecheck — preflight compiled 57 file(s) · full eslint — preflight linted 24 changed file(s) · full unit suite — preflight ran 925 of 4518 test files (a test more than two imports away from a changed file is not woken) · full DB replay — preflight ran 35 of 643 DB tests (no migration changed, so the schema pins were not run) · production build · Vercel route count · shared bundle size · the Maker's first-load JS budget · lighthouse · playwright e2e · secret scan (gitleaks is not installed on this machine) · native encoder tests (src-tauri untouched)
