# S41 · SILENT FAILURES: errors dropped on money and booking paths (the 420 'result-dropped-silently' sites, worst first)

> **Model: Opus 5 · effort: high.** Released by the controller.

Source: S26's orphan baseline `apps/web/tests/db/ugat-both-ends.baseline.txt` (PR #5625; before it merges, read it with `git show origin/claude/every-connection-has-both-ends:apps/web/tests/db/ugat-both-ends.baseline.txt`). For each orphan, re-measure it and then choose ONE, saying which in the PR: **(a) join the missing end** or **(b) delete the end nobody needs** (check `changelog.d/`, `DECISION_LOG.md`, `git log --diff-filter=D`). ⚠ Before any DROP TABLE, check the live row count (read-only SQL). **If a table holds rows, stop and report.** One PR per item or tight group.

The `result-dropped-silently` class (about 420 sites) is the project's oldest disease: **a failure that renders identically to success or to emptiness.** The booking-fee ledger stayed empty today for exactly this reason: a fail-open branch returned `skipped` and discarded the reason.

1. Take the sites in the **MONEY and BOOKING tiers first**, then couple-facing. Skip `actions.ts` deny-paths (there, an absence DENIES, and failing closed is correct), and skip `lib/booking-fee-*` (S6 #5615 and S34 own those).
2. For each: make the failure **reach the render or a record**: an honest "couldn't load" state (copy the pattern in `apps/web/lib/guests.ts` + `guests-read-is-honest.test.ts`, and `vendor-dashboard/reads-are-honest.test.ts`), or a logged reason. 🔑 **A log line never changed a pixel.** Where a person sees the result, fix what they see.
3. Do it in batches of about 15 sites per PR, grouped by surface. Each batch pays its lines off the baseline.
4. Stop after the money and booking tiers and report the count left per tier, so the controller can release the next batch.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S41 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S41 <what>" && { <cmd>; rc=$?; "$L" release "S41 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S41 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
