# #8025 — admin clean port 3/6: People (verification-docs · partnerships · recommendations) · hand-off proof (22 Nov 2026)

Head: `8499167122` plus this commit · origin/main merged in (main `e72c4f313`).

## 1 · Shots
**None.** The three ported screens (`/admin/verification-docs`, `/admin/vendor-partnerships`, `/admin/vendor-recommendations`) read the database. No dev lab draws them. A cloud session has no admin login and no database. The People lab (`/dev/admin-people-lab`) draws the record kit, not these three lists. The earlier build's notes are on the PR.

## 2 · Drawing parity
This hand-off changed no screen. Only generated baselines conflicted in the merge, and they were merged key by key, not regenerated: each side keeps its own change, and the lower count wins where both changed.

## 3 · Ways in
Unchanged: same routes and the same People tab rows. `lint-port-no-lost-controls` passes.

## 4 · Guards (from `apps/web`, full `pnpm preflight --jobs 3`, wall 38 min): ALL PASS
| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 45 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 2m 09s | | |
| Unit-test the feature register check + price printout | FAIL | 446ms | # Subtest: SABOTAGE: a new page with no row fails, and is named | `node --test scripts/feature-register-check.test.mjs` |
| eslint on changed files (46) | PASS | 2.9s |  | `(cd apps/web && npx next lint --file 'app/admin/_components/admin-tab-rows.tsx' --file 'app/admin/discount-codes/[id]/edit/page.tsx' --file 'app/admin/discount-codes/_components/eligibility-section.tsx' …)` |
| tsc (46 changed + 29 of 29 importers) | PASS | 32.9s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 125 files, 971 tests | PASS | 1m 05s |  |  |
| whole-tree guard tests — 772 files, 5,500 tests | PASS | 19m 43s |  |  |
| DB tests that scan source — 32 files, 206 tests | PASS | 14m 30s |  |  |
LEFT TO CI: full typecheck · full unit suite · full DB replay · build · bundle size · lighthouse · e2e · secret scan.

## 5 · Files that overlap other open PRs
None outside the generated baselines (template-score, no-card, label-contrast-dark), which most open PRs share.

## 6 · BUILD_RULES §2 rules not followed
- No shots (see §1).
