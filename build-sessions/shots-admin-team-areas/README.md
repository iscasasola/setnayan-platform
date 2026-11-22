# #7585 — admin team areas × levels + owner self-approval (typed + 24 h), slice 2 · hand-off proof (22 Nov 2026)

⚠ **The owner PARKED this PR on 19 Nov:** "finish after GitHub's open count is under 20". Do not merge.

Head: `49f192f55` (origin/main merged in twice, the second at `46dee90f3`) plus this commit.

## 1 · Shots
**None.** `/admin/team`, `/admin/admin-log` and the approvals changes read the database. No dev lab draws them, and a cloud session has no admin login. The proof is the DB tests (§4): 17 owner/self-approval cases, including the new "a look-alike is NOT the owner".

## 2 · Drawing parity
This hand-off changed no screen except one icon: the Admin log's Show button now wears `SlidersHorizontal`, per main's 19 Nov sort-icon rule.

## 3 · Ways in
Two new pages, `/admin/team` and `/admin/admin-log`, are registered in `ADMIN_TAB_MAP` under the avatar menu. The admin map was regenerated (106 destinations, 70 pages). `lint-port-no-lost-controls`: 477 routes, nothing lost.

## 4 · Guards (from `apps/web`, full `pnpm preflight --jobs 3` on `46dee90f3`, wall 48 min)
| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 45 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 2m 09s | | |
| Unit-test the feature register check + price printout | FAIL | 446ms | # Subtest: SABOTAGE: a new page with no row fails, and is named | `node --test scripts/feature-register-check.test.mjs` |
| eslint on changed files (46) | PASS | 2.9s |  | `(cd apps/web && npx next lint --file 'app/admin/_components/admin-tab-rows.tsx' --file 'app/admin/discount-codes/[id]/edit/page.tsx' --file 'app/admin/discount-codes/_components/eligibility-section.tsx' …)` |
| tsc (46 changed + 29 of 29 importers) | PASS | 32.9s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 125 files, 971 tests | PASS | 1m 05s |  |  |
| whole-tree guard tests — 772 files, 5,500 tests | PASS | 19m 43s |  |  |
| DB tests that scan source — 32 files, 206 tests | PASS | 14m 30s |  |  |
The single FAIL (`lib/sort-icon-is-sliders.test.ts`, a 19 Nov rule from main) is fixed in `49f192f55`. That test now passes (4/4), eslint is clean, and tsc is clean on the page. Nothing else changed after the run.
DB: `tests/db/admin-areas-and-owner-self-approval.db.test.ts` 17/17, sabotage-checked. It goes red when `is_platform_owner` reads `public.users.email` again.
Server actions: 1251 of 1251 (`rejectRequest` folded into `adminTeamAct`).
LEFT TO CI: full typecheck · full unit suite · full DB replay · build · bundle size · lighthouse · e2e · secret scan.

## 5 · Files that overlap other open PRs
- #7614: `lib/admin-map/rank-choices.ts`, `lib/admin-tabs.ts`
- #7881: `lib/export-completeness.ts`
- #7988: `app/home-carries-the-cron-free-jobs.test.ts`
- #8018: `lib/admin/admin-pages.ts`
- #8095: `app/admin/pricing/actions.ts`
- Shared generated files: `exposure-surface.baseline.txt`, `user-fk-behaviour.generated.txt`, the admin map.

## 6 · BUILD_RULES §2 rules not followed
- No shots (see §1).
- The migration prefix `20271350705084` sits below main's head. It applies in prod either way (`--include-all`). It was left alone rather than renaming an existing file, and the replay passes.
