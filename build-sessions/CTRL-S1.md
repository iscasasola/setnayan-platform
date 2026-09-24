# S1 · Ship the orphaned 'accepting a quote is not booking it' copy fix

> **Model: Sonnet 5 · effort: medium.** Session S1 of the controller plan `build-sessions/CONTROLLER-PLAN-2026-09-18.md`.

The worktree `~/Documents/Claude/Projects/wt-accept` (branch `claude/accepting-a-quote-is-not-booking-it`, based on `d06327376`) holds **uncommitted, never-pushed** work from an earlier session:
- `apps/web/app/_components/proposal-maker.tsx`: supplier-facing copy
- `apps/web/lib/proposal-send.ts`: the default couple-facing quote body
- `apps/web/lib/accepting-a-quote-is-not-booking-it.test.ts`: a guard that no copy says accepting fills the plan

Owner ruling (2026-09-18): *"Plan should only fill at lock. not when accepted."*

Do this:
1. Use THAT worktree. Do not create a new one. Read the diff and the guard.
2. Rebase onto current `origin/main` and resolve anything that conflicts. Then run the guard alone and prove it catches a sabotage: put the old sentence back, watch the guard go red, then restore it.
3. Commit, push, open the PR and enable auto-merge. **This must merge before S5 starts**, because S5 edits the same two files.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. **Exception for S1: use the existing `wt-accept` worktree, as stated above.**
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S1 <what>" && { <cmd>; rc=$?; "$L" release "S1 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S1 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
