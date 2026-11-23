# #8018 — Money's 13 screens on the clean template · hand-off proof (22 Nov 2026)

Head: `301d12f74` plus this commit · origin/main merged in at `8b69109b8` (main `e72c4f313`).

## 1 · Shots: 375 light · 375 dark · desktop
Taken with `next dev` (`E2E_LABS=1`, dummy Supabase env) and Playwright at deviceScaleFactor 1. The dev overlay is hidden. Dark is forced with `html.dark`.

| Screen | Lab URL | Files |
|---|---|---|
| Money · To confirm (the real `desk.tsx`) | `/dev/admin-money-lab?v=desk` | `money-desk-*.jpg` |
| Money · Refunds (the real `supplier-refunds-view.tsx`) | `/dev/admin-money-lab?v=refunds` | `money-refunds-*.jpg` |
| Money tab shell (body is a placeholder) | `/dev/admin-shell-lab?at=/admin/money` | `money-shell-*.jpg` |

⚠ **These are not real-data shots.** A cloud session has no admin login and no database. The other ported screens (pricing, booking-fees, gifts, launch-offer, receipts, payouts, subscriptions, discount codes, founder seats, payment options) read the database, and no lab draws them. Their 390 px before/after from the original build are in `../before` and `../after`.

## 2 · Drawing parity
This hand-off changed no design. The merge took main's newer copy and money facts into the ported layout:
- the booking fee's lock, every-Nth free fee and new-client months, as template sublines;
- Launch offer's "Special tools · Pro and up" date, as a TemplateSection;
- the gift bundle line.

No price was moved or retyped. Every figure is read from settings or the catalogue, as on main.

## 3 · Ways in
Unchanged by this hand-off: same routes, same Money tab rows. `lint-port-no-lost-controls` reports 475 routes / 1,584 controls with nothing lost. That includes the two "Comp this …" links on Gifts, which an intermediate commit hid and `301d12f74` restored.

## 4 · Guards (from `apps/web`, full `pnpm preflight --jobs 3`, wall 37 min)
| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 45 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 2m 09s | | |
| Unit-test the feature register check + price printout | FAIL | 446ms | # Subtest: SABOTAGE: a new page with no row fails, and is named | `node --test scripts/feature-register-check.test.mjs` |
| eslint on changed files (46) | PASS | 2.9s |  | `(cd apps/web && npx next lint --file 'app/admin/_components/admin-tab-rows.tsx' --file 'app/admin/discount-codes/[id]/edit/page.tsx' --file 'app/admin/discount-codes/_components/eligibility-section.tsx' …)` |
| tsc (46 changed + 29 of 29 importers) | PASS | 32.9s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 125 files, 971 tests | PASS | 1m 05s |  |  |
| whole-tree guard tests — 772 files, 5,500 tests | PASS | 19m 43s |  |  |
| DB tests that scan source — 32 files, 206 tests | PASS | 14m 30s |  |  |

The single FAIL is corpus-only. It runs only when the spec repo is cloned next to this one. It fails the same way on origin/main (23 routes and 18 pointers missing from FEATURE_REGISTER.md), and CI skips it.
LEFT TO CI: full typecheck · full unit suite · full DB replay · build · bundle size · lighthouse · e2e · secret scan.

## 5 · Files that overlap other open PRs
- #7937: `app/admin/payouts/page.tsx` and `app/admin/receipts/page.tsx`. #7937 adds `action=` to the filter forms; whichever lands second keeps it.
- #8095: `app/admin/pricing/_components/catalog-editor.tsx` and `app/admin/pricing/_surfaces/pricing-surface.tsx`.
- #7585: `lib/admin/admin-pages.ts`.
- The generated baselines (template-score, no-card, label-contrast-dark, port-control) are shared with most open PRs.

## 6 · BUILD_RULES §2 rules not followed
- Shots are not from real data (see §1).
- The one deviation the original builder listed stands: the supplier box sits in the Show & filter sheet, not the thumb-row box, because the thumb-row box is the console's one search.
