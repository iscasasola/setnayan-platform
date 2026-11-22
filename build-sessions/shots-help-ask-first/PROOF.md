# Help asks first — §4 proof (BUILD_RULES.md), 22 Nov 2026

Branch `claude/help-ask-first` merged with `origin/main` at `e72c4f313`. Main had not moved at hand-off.

## 1 · Screenshots: 375 px light and dark, plus desktop
`help-start-*`, `help-answer-*` (`?q=how do guests upload photos`), `help-no-answer-*` (`?q=can i bring my dog`),
`help-prefilled-door-*` (main's Card Maker door, `?role=vendor&topic=vendor&subject=…#contact`) ×
`375-light` · `375-dark` · `desktop`. **Signed out, local `next dev` with no database.** This cloud session has
no Supabase credentials and must not touch production, so there are no shots of signed-in coverage
(account / shop / guest) or of `/admin/help/guides`. The 13–18 Nov shots in this folder (`now-*`, `pair-*`,
`proposed-*`) are the earlier set, kept.

## 2 · Drawing parity (`prototypes/approved_2026-11-13/help-page-fable.html` v5)
Unchanged from the 18 Nov reviews; this pass changed no layout. Two things differ from the drawing:
- Main's prefilled contact form is kept (`?subject=&body=&topic=`). It came after the drawing.
- On a phone, the signed-out "Sign in for your own event or shop" sits on its own line with no "·". The
  wrap stranded the dot.

## 3 · Every way in, walked
- `/help` signed out: start · best answer · no answer · Browse topics · contact form. Walked; see shots.
- Main's "Need your own form?" (Card Maker, `custom-form-ask.tsx`) → `/help?…#contact`, prefilled. Walked.
- Account sheet Help row: Setnayan HQ → `/admin/help/guides`; a shop's sheet → `/help?for=shop`; others →
  `/help` (`account-switcher.tsx`). Read in code, not walked (needs a signed-in session).
- Supplier settings "Message Setnayan" → `/help?for=shop#contact` (`settings-rows.ts`). Read in code.
- Admin › Work › Help (`admin-tabs.ts`) → `/admin/help/guides`. Read in code.

## 4 · Guards from `apps/web` (full `pnpm preflight`)
52 of 53 rows passed. The one red row was `tests/db/ugat-both-ends.db.test.ts`:
`app/help/actions.ts · from:users.select` dropped its error silently. Fixed by logging the reason, while still
failing closed. After the fix, that test passes (4/4) and the quick preflight passes (49 checks). The table
below is the full run from before the fix.

## 5 · Files that overlap other open PRs
`apps/web/lib/admin-map/rank-choices.ts` and `apps/web/lib/admin-tabs.ts`: both also touched by #7585. Beyond
those, only generated files and baselines.

## 6 · BUILD_RULES §2/§3 rules not followed
- "Screenshots from real data": signed-out local dev only (see 1).
- §3 "A migration ships only on the owner's own go": `20271350667658_help_questions_nobody_answered_yet.sql`
  (new table `help_asks`, RLS on, no browser grant) needs that go before the ship controller merges.
- `screens.generated.json` was hand-merged (main's plus this PR's doors). It matched a fresh scan except for door
  order, so it carries the scanner's order. Nothing else was regenerated except the admin map.

## Preflight table (full run, before the `ugat-both-ends` fix)
**preflight** · `claude/help-ask-first` @ `248a5c43c` · base `origin/main` · 50 changed · wall 58m 44s · **1 FAILED**

| check | result | time | first failing line | re-run |
|---|---|--:|---|---|
| 46 cheap CI guards (every `node …mjs` step of ci.yml) | PASS | 2m 21s | | |
| eslint on changed files (25) | PASS | 3.6s |  | `(cd apps/web && npx next lint --file 'app/(shell)/help/page.tsx' --file 'app/_components/account-switcher/account-switcher.tsx' --file 'app/_components/account-switcher/the-supplier-sheet-order.test.ts' …)` |
| tsc (26 changed + 40 of 54 importers) | PASS | 1m 03s |  | `(cd apps/web && pnpm typecheck)   # the full compile, under the heavy lock — or let CI run it` |
| tests that name or import a changed file — 95 files, 727 tests | PASS | 1m 47s |  |  |
| whole-tree guard tests — 784 files, 5,549 tests | PASS | 32m 55s |  |  |
| unit tests that replay the migrations — 6 files, 50 tests | PASS | 58.0s |  |  |
| tests/db/ugat-both-ends.db.test.ts  [scans source] | FAIL | 1m 50s | every connection has both ends — no NEW orphan beyond the ranked baseline — A connection is missing one of its ends. Both halves may be built; the join is not: — → [other] result-dropped-silently  app/help/actions.ts · from:users.select | `(cd apps/web && npx tsx --test 'tests/db/ugat-both-ends.db.test.ts')` |
| DB tests: source scanners + schema pins — the other 44 files | PASS | 19m 23s |  |  |

Left to CI (not run locally): full typecheck — preflight compiled 66 file(s); 14 importer(s) of the changed files were not compiled · full eslint — preflight linted 25 changed file(s) · full unit suite — preflight ran 885 of 4518 test files (a test more than two imports away from a changed file is not woken) · full DB replay — preflight ran 45 of 644 DB tests · production build · Vercel route count · shared bundle size · the Maker's first-load JS budget · lighthouse · playwright e2e · secret scan (gitleaks is not installed on this machine) · native encoder tests (src-tauri untouched)
