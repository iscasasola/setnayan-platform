# Settings v2 step 1 — §4 proof (BUILD_RULES.md), 22 Nov 2026

Branch `claude/settings-v2-shell` merged with `origin/main` at `e72c4f313`. Main had not moved at hand-off.

## 1 · Screenshots: 375 px light and dark, plus desktop
`today-settings-*`, `hub-settings-*`, `shop-settings-*` × `375-light` · `375-dark` · `desktop` (1280).
Taken from the supplier lab (`/dev/supplier-lab?easy=normal`, `?s=hub`, `?s=shop-tab`) on its **fixtures**, not
real data. This cloud session has no Supabase credentials and must not touch production, so real-account shots
were not possible. Dark is the app's own `.dark` class (signed-in Appearance), set on the lab page.
`hub-settings.png` / `shop-settings.png` are the earlier Now-beside-Proposed shots (16 Nov), kept.

## 2 · Drawing parity (`prototypes/approved_2026-11-13/settings-shell-fable.html` v3)
- One section heading (`SettingsSection`, the shipped `home-k2`): Today, Hub, Shop. Matches §2/§7/§8.
- A short supplier screen ends with "More settings" doors (Today, Hub). Matches §8.
- Shop ⚙: Your page · Plan and team · Papers · Notifications, no icon tiles. Matches §7.
- **Differs from the drawing (main wins):** the rise is main's **Stack** (`FULL_SCREEN_MAP.edit`), not the
  13 Nov grow. MOTION_STANDARD 2026-11-18 / HOUSE_DESIGN_STANDARD: "Fill in / edit → Stack".
- **Not matched:** the Undo · Apply bar and the save seat are wired (`state`, `thumb`) but no screen in this
  step passes them; the couple ⚙ bodies are step 2 (see the PR body).
- The Push notifications card is the shipped `PushToggle` (framed), unchanged by this PR.

## 3 · Every way in, walked (supplier)
- Today ⚙ on Today's cover → Today settings (risen). Its doors → `/vendor-dashboard/shop?gear=1`,
  `/vendor-dashboard/customers?gear=1`. Both deep links are still honoured on main (`shop-settings.tsx`
  reads `gear === '1'`; `customers/page.tsx` draws `CustomersSettingsBody` on `gear === '1'`).
- Hub ⚙ on the Hub's pinned row → Hub settings (risen), same two doors.
- Shop ⚙ on the pinned row and the cover → Shop settings (risen); `#notifications` anchor kept.
- Picked client ⚙ → rises (main bf8998a1); `inLayer` has zero callers (guard 1 of `settings-v2-one-shell`).
- Every other ⚙ (couple Home, Guests, Memories, Suppliers, People, Customers, Portfolio, Admin) now rises
  instead of opening a sheet — rows unchanged.

## 4 · Guards from `apps/web` (full `pnpm preflight`)
See the table below. The two `lint-*-dir` rows failed only because this session's #7614 worktree sat
inside the checkout; after moving it out both pass (`✓ lint-changelog-dir`, `✓ lint-migrations-dir`).

## 5 · Files that overlap other open PRs
None outside generated files/baselines (`screens.generated.json`, `port-control-baseline.json`,
admin map), which most open PRs touch.

## 6 · BUILD_RULES §2 rules not followed
- "Screenshots from real data": fixtures only (see 1).
- Baselines: `port-control-baseline.json` and `screens.generated.json` were hand-merged, not regenerated, per
  the controller's rule; the ship controller regenerates once per batch.

## Preflight table
**preflight** · `claude/settings-v2-shell` @ `b4698f3e5` · base `origin/main` · 33 changed · wall 49m 08s · **2 FAILED**

| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 44 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 2m 12s | | |
| Lint changelog fragment dir | FAIL | 105ms | ✗ lint-changelog-dir: 1 changelog.d directory outside the repo root: | `node apps/web/scripts/lint-changelog-dir.mjs` |
| Lint migrations dir | FAIL | 99ms | ✗ lint-migrations-dir: 1 supabase/migrations directory outside the repo root: | `node apps/web/scripts/lint-migrations-dir.mjs` |
| eslint on changed files (17) | PASS | 3.3s |  | `(cd apps/web && npx next lint --file 'app/_components/menu-settings-button.tsx' --file 'app/_components/picked/picked-shell.tsx' --file 'app/_components/rise/rise-screen.tsx' …)` |
| tsc (17 changed + 40 of 144 importers) | PASS | 51.9s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 156 files, 1,113 tests | PASS | 3m 25s |  |  |
| whole-tree guard tests — 765 files, 5,382 tests | PASS | 28m 12s |  |  |
| DB tests that scan source — 33 files, 211 tests | PASS | 15m 04s |  |  |

Left to CI (not run locally): full typecheck — preflight compiled 57 file(s); 104 importer(s) of the changed files were not compiled · full eslint — preflight linted 17 changed file(s) · full unit suite — preflight ran 921 of 4517 test files (a test more than two imports away from a changed file is not woken) · full DB replay — preflight ran 33 of 643 DB tests (no migration changed, so the schema pins were not run) · production build · Vercel route count · shared bundle size · the Maker's first-load JS budget · lighthouse · playwright e2e · secret scan (gitleaks is not installed on this machine) · native encoder tests (src-tauri untouched)
