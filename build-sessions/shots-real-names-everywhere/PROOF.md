# #7903 · proof (BUILD_RULES §4) · 22 Nov 2026

Head checked: `3d82af2d4`, which already holds `origin/main` `e72c4f313`.

## 1 · Screenshots (375 px light + dark, desktop)

These are taken from the dev labs, which draw the REAL components on fixture rows. This builder has no
database and never reads prod, so "real data" here means the real `threadSupplierName` output for each row shape
that `couple_thread_supplier_names` returns.

| file | what it shows |
|---|---|
| `chat-list-*.png` | `/dev/chat-lab`, the couple's Chats. "Mirasol Events" is a not-yet-verified shop and now shows its **real name**. "Cebu Florist #2003" has no business name on file, so it shows its screen name. "Couldn't load name" is a failed read, which says so. |
| `chat-thread-*.png` | `/dev/chat-lab/t/…a1`: the thread head with the shop's name. |
| `shop-partners-*.png` | `/dev/shop-end-lab`: a shop page's "Trusted by" partners, with their names and faces. |

**Dark:** the dark shots paint light. That is correct, not a miss. Messages, the shortlist and the shop page are not on
`DARK_READY` (`lib/appearance.ts`), so they stay light even for a person who chose Dark. Nobody may meet a
half-dark screen.

**Not shot:** the shortlist card logo (`/dashboard/[eventId]/vendors`) and the supplier sheet photos. Neither
has a lab, and both read the database.

## 2 · Drawing parity
There is no drawing. This PR carries a ruling (owner 2026-11-16, ruling 15: "real shop name everywhere"). It
changes no layout, only which name and logo fill the existing slots.

## 3 · Ways in walked (couple role)
- The chat list row and the thread head: same function (`threadSupplierName`), shot above.
- Shortlist card logo, supplier sheet photos and Share link, shop partners: read in code, gate removed (PR body table).
- Notifications carry no shop logo. The bench search card logo still waits on #7898 (see the PR body).

## 4 · Guards (from `apps/web`)
**preflight** · `claude/real-names-everywhere` @ `3d82af2d4` · base `origin/main` · 18 changed · wall 56m 30s · **1 FAILED**

| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 45 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 2m 11s | | |
| Unit-test the feature register check + price printout | FAIL | 521ms | # Subtest: SABOTAGE: a new page with no row fails, and is named | `node --test scripts/feature-register-check.test.mjs` |
| eslint on changed files (15) | PASS | 3.5s |  | `(cd apps/web && npx next lint --file 'app/_components/chat-message-stream.tsx' --file 'app/dashboard/[eventId]/messages/[threadId]/page.tsx' --file 'app/dashboard/[eventId]/messages/page.tsx' …)` |
| tsc (16 changed + 26 of 26 importers) | PASS | 1m 18s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 194 files, 1,647 tests | PASS | 2m 14s |  |  |
| whole-tree guard tests — 774 files, 5,340 tests | PASS | 31m 17s |  |  |
| unit tests that replay the migrations — 6 files, 50 tests | PASS | 49.4s |  |  |
| DB tests: source scanners + schema pins — 44 files, 300 tests | PASS | 19m 17s |  |  |

Left to CI (not run locally): full typecheck — preflight compiled 42 file(s) · full eslint — preflight linted 15 changed file(s) · full unit suite — preflight ran 974 of 4516 test files (a test more than two imports away from a changed file is not woken) · full DB replay — preflight ran 44 of 643 DB tests · production build · Vercel route count · shared bundle size · the Maker's first-load JS budget · lighthouse · playwright e2e · secret scan (gitleaks is not installed on this machine) · native encoder tests (src-tauri untouched)

**The one red row is not this PR.** `feature-register-check.test.mjs` test 24 runs only when the specs corpus is on
disk. This machine has it cloned at `../setnayan-specs`; CI does not, and skips the test. `node
scripts/feature-register-check.mjs` prints byte-identical output on `origin/main` `e72c4f313` (58 lines: routes
missing from `FEATURE_REGISTER.md`, none from this PR). The fix is a corpus edit, not this PR.

## 5 · Files overlapping other open PRs
- `lib/admin-map/admin-routes.generated.ts`: #7585, #7614, #7860 (a generated header).
- `app/dashboard/[eventId]/vendors/page.tsx`: #7920, #8094.
- `vendors/_actions/bench-marketplace-search.ts` and `lib/vendor-trusted-by.ts`: #8087.

## 6 · §2 rules not followed
None that this PR touches. The screenshots are from fixtures, not prod, and the reason is given above.
