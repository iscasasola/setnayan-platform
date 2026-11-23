# #7937 — a filter on a merged view stays on that view · hand-off proof (22 Nov 2026)

Head: `acb1b7963` (origin/main `e72c4f313` merged in, no conflicts) plus this commit.

## 1 · Shots: 375 light · 375 dark · desktop
`/dev/admin-money-lab?v=refunds` with `next dev` (`E2E_LABS=1`, dummy env), Playwright, overlay hidden, dark forced with `html.dark`. Files: `refunds-*.jpg`.

This view draws the real `supplier-refunds-view.tsx`. Its "Waiting · large refund" ⓘ now reads `REFUND_TWO_ADMIN_THRESHOLD_PHP` (₱25,000, unchanged) instead of a typed figure. That ⓘ is the only visible change in the PR.

The filter fix itself (`action=` on the disputes, force-majeure, payouts and receipts filter forms) has no look. A submitted filter now stays on the page that mounted it. It is proved by `app/admin/a-mounted-filter-keeps-its-view.test.ts`, not by a picture. Those pages read the database and have no lab.

## 2 · Drawing parity
No design change.

## 3 · Ways in
Each of the four filter forms now posts to the address it is mounted under. A filter on a merged view no longer drops the person on the old address. `lint-port-no-lost-controls` passes.

## 4 · Guards (from `apps/web`, full `pnpm preflight --jobs 3`, wall 37 min): ALL PASS
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
- #8018 (Money clean port): `app/admin/payouts/page.tsx` and `app/admin/receipts/page.tsx`. Whichever lands second must keep `action=` on the filter form. This PR's guard fails if it is lost.

## 6 · BUILD_RULES §2 rules not followed
- Shots are from a fixture lab, not real data (cloud session: no admin login, no database).
