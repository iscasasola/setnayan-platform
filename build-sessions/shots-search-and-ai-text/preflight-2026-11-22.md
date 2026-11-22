**preflight** · `claude/search-and-ai-text` @ `be8d9d084` · base `origin/main` · 12 changed · wall 38m 57s · cheap faults clear

| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 46 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 1m 42s | | |
| eslint on changed files (10) | PASS | 3.2s |  | `(cd apps/web && npx next lint --file 'app/layout.tsx' --file 'lib/help/topics-existing.ts' --file 'lib/help/user-2.ts' …)` |
| tsc (10 changed + 14 of 14 importers) | PASS | 11.0s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 84 files, 628 tests | PASS | 8m 20s |  |  |
| whole-tree guard tests — 781 files, 5,488 tests | PASS | 17m 39s |  |  |
| DB tests that scan source — 34 files, 216 tests | PASS | 11m 35s |  |  |

Left to CI (not run locally): full typecheck — preflight compiled 24 file(s) · full eslint — preflight linted 10 changed file(s) · full unit suite — preflight ran 865 of 4517 test files (a test more than two imports away from a changed file is not woken) · full DB replay — preflight ran 34 of 643 DB tests (no migration changed, so the schema pins were not run) · production build · Vercel route count · shared bundle size · the Maker's first-load JS budget · lighthouse · playwright e2e · secret scan (gitleaks is not installed on this machine) · native encoder tests (src-tauri untouched)
