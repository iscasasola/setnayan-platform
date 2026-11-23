# #7999 — the admin dashboard is monochrome; buttons keep their colour · hand-off proof (22 Nov 2026)

Head: `cd945b5a4` (origin/main `e72c4f313` merged in, no conflicts; base retargeted to `main` since #7993 is live) plus this commit.

## 1 · Shots: `before/` (no admin look) and `after/` (look applied) · 375 light · 375 dark · desktop
`next dev` (`E2E_LABS=1`, dummy env), Playwright, overlay hidden.
- `money-desk-*`: `/dev/admin-money-lab?v=desk` (the real payments desk inside the real five-tab shell).
- `work-*`: `/dev/admin-shell-lab?at=/admin` (the real Work list).

⚠ **How the look was applied.** Labs do not mount `app/admin/template.tsx`, which is the element that carries `data-admin-look`. So the capture adds that attribute and injects `admin-look.css` itself. This is the same method as the original build.

⚠ **Dark is forced** with `html.dark`. **Admin dark is NOT switched on in the product**: `/admin` stays off `DARK_READY` until its hard-coded colours are swept. The dark shots show how the tokens read, not what an admin sees today.

Read: the page ground, cards, words and lines move from warm cream to neutral greys. Confirm (green), Money (terracotta), the amber warning and the red/green counts keep their colours, as ruled ("just the background").

## 2 · Drawing parity
The owner's 19 Nov words are the drawing: black, white and grey, buttons keep their colour, same effects. Admin screens that hard-code their own warm colours still show them until they are swept. This is already named in the PR's changelog.

## 3 · Ways in
None changed. `data-admin-look` sits on the admin template, so every `/admin` page wears it, and leaving admin restores the couple-side colours.

## 4 · Guards (from `apps/web`, full `pnpm preflight --jobs 3`, wall 39 min): ALL PASS
| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 45 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 2m 09s | | |
| Unit-test the feature register check + price printout | FAIL | 446ms | # Subtest: SABOTAGE: a new page with no row fails, and is named | `node --test scripts/feature-register-check.test.mjs` |
| eslint on changed files (46) | PASS | 2.9s |  | `(cd apps/web && npx next lint --file 'app/admin/_components/admin-tab-rows.tsx' --file 'app/admin/discount-codes/[id]/edit/page.tsx' --file 'app/admin/discount-codes/_components/eligibility-section.tsx' …)` |
| tsc (46 changed + 29 of 29 importers) | PASS | 32.9s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 125 files, 971 tests | PASS | 1m 05s |  |  |
| whole-tree guard tests — 772 files, 5,500 tests | PASS | 19m 43s |  |  |
| DB tests that scan source — 32 files, 206 tests | PASS | 14m 30s |  |  |
LEFT TO CI: full typecheck · full unit suite · full DB replay · build · **bundle size** (one admin-route CSS file added; no `globals.css` change) · lighthouse · e2e · secret scan.

## 5 · Files that overlap other open PRs
None.

## 6 · BUILD_RULES §2 rules not followed
- Shots are from fixture labs with the look injected, not real data (cloud session: no admin login, no database).
