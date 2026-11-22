# #7868 · proof (BUILD_RULES §4) · 22 Nov 2026

The head merges `origin/main` `e72c4f313` (`fd5877170`), then `d6a6eb803` (the migration moves forward) and
`bb3347582` (the lab switch).

## 0 · Every old event link still redirects (the controller asked for this list)

`route-audit.txt`, next to this file, is the raw output. It ran the PR's real functions (`bareNestingRewrite`,
`oldSubPageTarget`, `publicEventPath`, `legacyUserPrefixRedirect`) for every folder under `app/[slug]` on disk
after the merge, with the switch off and with it on. The event slug is `our-wedding`, the creator's username is
`ana`, and the query is `?invite=abc`.

**Switch OFF (today):** `publicEventPath` returns `/our-wedding`, and no old link forwards. Every address is the
same as on `main`.

**Switch ON:**

| old link | what happens |
|---|---|
| `/our-wedding` | 307 → `/ana/our-wedding`. This is the page's canonical forward; the query is kept, and `?invite=` redeems first. |
| `/our-wedding/avatar` · `everyone` · `find-my-table` · `find-seat` · `hub` · `invite` · `invite/enter` · `invite/reply` · `pabuya` · `print` · `recap` · `request` · `seat` · `venue` · `welcome` | 307 → `/ana/our-wedding/<same>?invite=abc` (the `[slug]` layout's `forwardOldSubPage`). |
| `/our-wedding/hub` | main's `/hub` forwarder → `/our-wedding?tab=…` → 307 → `/ana/our-wedding?tab=…`. Two hops, and the guest lands. |
| `/our-wedding/redeem` (printed QR) · `announcement` · `icon/*` · `live-pulse` · `live-wall` · `manifest.webmanifest` · `open-as-pass` · `sign-out` | Route handlers, which the layout does not wrap. They are **still served at the old address**, so nothing breaks. `redeem` sends the guest on through `publicEventPath`. |
| `/our-wedding/cached/*` | Never forwarded, never nested. It is the internal copy and stays refused. |
| `/u/ana/our-wedding` | 308 → `/ana/our-wedding` |
| `/ana/our-wedding/<any page above>` | rendered by the internal rewrite to `/our-wedding/<page>`. No page word is ever read as a username: `misread=no` for every row. |
| `{event}.setnayan.com`, custom domains | unchanged; the forward skips a non-Setnayan host. |

None of these breaks a shared or printed link without a redirect, so this does **not** need the owner.

Two pins hold it: `lib/an-event-lives-under-its-creator.test.ts` §2, which checks the second word against the
folders on disk, and §5, which pins `/cale-ice` and `/maria-and-jose`.

## 1 · Screenshots
See the `home-*` files. They come from `/dev/bar-lab/dashboard?made=1` with `NEXT_PUBLIC_U_NESTING_CUTOVER=true`:
Home's handle line reads `…/ana-mercado`, plus the once-only "We made this from your name. Change it". These are
lab fixtures; this builder has no database and never reads prod. With the switch off, no screen changes.

**Dark:** `/dashboard` is on `DARK_READY`, but the lab route is not, so the dark shot paints light.

**Fault found by the shot, and fixed:** at 375 px the notice sat at the tail of the handle line. That line is one
ellipsised row, so the notice was cut to "…". It was then stamped seen after that one render, so a person on a
phone would never have read it. It now has its own `line` under the name. The 375 shot shows it in full. The
public address in the handle line still truncates at 375; that is the same on `main` and not this PR.

## 2 · Drawing parity
There is no drawing. The source is the address map `ADDRESS_MOVE_MAP_2026-11-15_fable.md`. Still not built (named
in the PR body): handing the address to a co-host.

## 3 · Ways in walked
- Every event address (§0).
- Home's handle line (shot).
- The 46 hand-built links now go through `publicEventPath`. Guard §7 fails on any new hand-typed `` `/${event.slug}` ``. Main's one new link (`site-body.tsx` → `/find-my-table`) was converted in this merge.

## 4 · Guards (from `apps/web`)
**preflight** · `claude/address-move-events` @ `bb3347582` · base `origin/main` · 66 changed · wall 56m 49s · **5 FAILED**

| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 44 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 1m 03s | | |
| Unit-test the feature register check + price printout | FAIL | 433ms | # Subtest: SABOTAGE: a new page with no row fails, and is named | `node --test scripts/feature-register-check.test.mjs` |
| Root map is current and ratcheted | FAIL | 1m 06s | ::error::lib/ugat/screens.generated.json is stale — a screen or a door changed. | `node apps/web/scripts/check-ugat-screens.mjs` |
| eslint on changed files (52) | PASS | 12.5s |  | `(cd apps/web && npx next lint --file 'app/[slug]/_components/editorial/editorial-content.tsx' --file 'app/[slug]/_components/private-landing.tsx' --file 'app/[slug]/_components/site-body.tsx' …)` |
| tsc (54 changed + 40 of 139 importers) | PASS | 58.9s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| lib/ugat/screens-are-generated.test.ts  [imports a changed file] | FAIL | 8.4s | the committed screens map matches a fresh scan exactly — screens changed — run: pnpm --filter @setnayan/web ugat:screens | `(cd apps/web && npx tsx --test 'lib/ugat/screens-are-generated.test.ts')` |
| app/[slug]/_lib/the-day-hub-follows-the-stage.test.ts  [names site-body.tsx] | FAIL | 122ms | nothing the hub alone opened is lost: the venue map’s door now stands by the event page’s own seat block — the venue map lost its door beside the seat block | `(cd apps/web && npx tsx --test 'app/?slug?/_lib/the-day-hub-follows-the-stage.test.ts')` |
| tests that name or import a changed file — the other 398 files | PASS | 5m 39s |  |  |
| whole-tree guard tests — 704 files, 4,720 tests | PASS | 27m 08s |  |  |
| unit tests that replay the migrations — 6 files, 50 tests | PASS | 47.6s |  |  |
| tests/db/ugat-both-ends.db.test.ts  [names middleware.ts] | FAIL | 1m 40s | every connection has both ends — no NEW orphan beyond the ranked baseline — A connection is missing one of its ends. Both halves may be built; the join is not: — → [couple] result-dropped-silently  lib/public-event-url.ts · from:events.select | `(cd apps/web && npx tsx --test 'tests/db/ugat-both-ends.db.test.ts')` |
| DB tests: source scanners + schema pins — the other 50 files | PASS | 19m 47s |  |  |

Left to CI (not run locally): full typecheck — preflight compiled 94 file(s); 99 importer(s) of the changed files were not compiled · full eslint — preflight linted 52 changed file(s) · full unit suite — preflight ran 1110 of 4518 test files (a test more than two imports away from a changed file is not woken) — and 110 woken files over the cap of 400 were NOT run · full DB replay — preflight ran 51 of 644 DB tests · production build · Vercel route count · shared bundle size · the Maker's first-load JS budget · lighthouse · playwright e2e · secret scan (gitleaks is not installed on this machine) · native encoder tests (src-tauri untouched)

**The 5 red rows, one by one** (each was re-run on its own afterwards):
| row | cause | now |
|---|---|---|
| `the-day-hub-follows-the-stage.test.ts` | its anchor was the hand-typed venue-map door this merge moved onto `publicEventPath` | re-anchored, same rule (`d96b2932e`) · **7/7 PASS** |
| `tests/db/ugat-both-ends.db.test.ts` | `resolveEventOwnerSlug` answered null on a failed read without a trace | now logs it (`d96b2932e`) · **4/4 PASS** |
| `Root map is current` + `screens-are-generated.test.ts` | `screens.generated.json` is stale: only this PR's own doors and tables (21 rows; `/[slug]/everyone` and `/[slug]/seat` go no-door → connected, which the PR already took off `no-door.baseline.txt`); no new finding | **NOT regenerated (controller rule).** The train runs `pnpm -C apps/web ugat:screens`. Measured by running it and restoring the file. |
| `feature-register-check.test.mjs` #24 | runs only with the specs corpus on disk (CI skips); identical output on `origin/main` | pre-existing, not this PR |

After the run: `home-profile.tsx` changed (below). `home-is-the-profile`, `rw309-fits-375-and-presses-at-44`,
`the-memories-picker-counts-say-something`, `home-sections-keep-the-bar`: 22/22 PASS · eslint clean.

## 5 · Files overlapping other open PRs
Mostly generated files, which the controller regenerates once per train:
- `screens.generated.json`: 17 PRs.
- `port-control-baseline.json`: 18 PRs.
- `exposure-surface.baseline.txt`: #7585, #7881, #7920, #7968, #8019, #8057, #8088, #8095.
- `user-fk-behaviour.generated.txt`: #7585, #7881.
- `no-door.baseline.txt`: #7908, #7968, #8046, #8057, #8088, #8094.

Source files:
- #7908: `lib/request-key.test.ts`, `scripts/lint-events-column-grants.mjs`.
- #7988: `lib/face-tagging-rules.test.ts`.
- #8004: `[slug]/_components/editorial/editorial-content.tsx`, `[slug]/_lib/loaders.ts`, `website/widgets/page.tsx`.

## 6 · Rules I could not follow, and why
- **Generated files were NOT regenerated** (controller rule). Each conflict hunk takes main's side, and the PR's
  non-conflicting rows are kept. The FK and exposure header counts were recomputed by hand from the merged bodies
  (303 FKs, SET NULL 220; 8,271 facts, col 5,953). If a drift guard says `screens.generated.json` or
  `port-control-baseline.json` is behind, the train regenerates it.
- **The migration was renamed** `20271350564435` → `20271357986226` (with `pnpm migration:new`). It is unmerged, so
  nothing was applied anywhere. The reason is in the migration's own comment and in the changelog fragment.
