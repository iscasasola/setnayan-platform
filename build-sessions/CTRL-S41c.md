# S41c · SILENT FAILURES, the remaining tiers: SUPPLIER (72) + ADMIN (17) + unclassified (35)

> **Model: Opus 5 · effort: high.** Released by the controller.

Source: S26's orphan baseline `apps/web/tests/db/ugat-both-ends.baseline.txt` (PR #5625; before it merges, read it with `git show origin/claude/every-connection-has-both-ends:apps/web/tests/db/ugat-both-ends.baseline.txt`). For each orphan, re-measure it and then choose ONE, saying which in the PR: **(a) join the missing end** or **(b) delete the end nobody needs** (check `changelog.d/`, `DECISION_LOG.md`, `git log --diff-filter=D`). ⚠ Before any DROP TABLE, check the live row count (read-only SQL). **If a table holds rows, stop and report.** One PR per item or tight group.

The `result-dropped-silently` class (about 420 sites) is the project's oldest disease: **a failure that renders identically to success or to emptiness.** The booking-fee ledger stayed empty today for exactly this reason: a fail-open branch returned `skipped` and discarded the reason.

1. S41 already finished the MONEY tier (64/69; the 5 left are booking-fee, owned by S6/S34) and the BOOKING tier (80/80) in PRs #5650 #5652–#5654 #5656–#5660. **Copy their pattern exactly**: read #5650 and #5656 first. Now do the **SUPPLIER tier (72 sites), then ADMIN (17), then unclassified (35)**, as reported by the scanner in `lib/ugat/both-ends.ts` / `lib/supabase-unread-error-scan.ts` (PR #5625).
2. **Priority: where a couple SEES the result.** A failed read that renders as "none", "no guests", "no vendors", "₱0", or a card that silently disappears must render an honest "couldn't load" state instead (pattern: `apps/web/lib/guests.ts` + `guests-read-is-honest.test.ts`). 🔑 **A log line never changed a pixel.** Logging-only is acceptable only where nothing is shown.
3. Known on-screen supplier cases to include: the supplier pending-inquiry badge reads 0 when its read fails; the Overview feed drops disputed handovers; the band's song-request inbox shows "no requests" on a refused read (S41b left it).
4. Skip `actions.ts` deny-paths. Batches of about 15 sites per PR, grouped by surface. Each PR adds a refusing-fake-DB test and is sabotage-proven. Before opening each PR, check open PRs for shared files (`gh pr list`) so you don't fight the chat PR #5614 or the budget PRs #5623 / #5629.
5. Stop when all three tiers are done, or after 8 PRs, and report the counts left.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S41c -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S41c <what>" && { <cmd>; rc=$?; "$L" release "S41c <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S41c · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
