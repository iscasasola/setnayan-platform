# S10 · Register sweep: measure, don't build

> **Model: Sonnet 5 · effort: high.** Session S10 of the controller plan `build-sessions/CONTROLLER-PLAN-2026-09-18.md`.

Follow `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/PROMPTS/P8_register-sweep.md`. **Order: LAU-* first** (launch readiness is the goal), then SUP-*, DAY-*, DSK-*. This is read-only: use a detached read worktree with no install and no heavy jobs. You may fan out Explore subagents, **at most 3 at a time**. For every row give: status (done / open / wrong-mechanism / unreachable) · the command or file:symbol that proves it · a size estimate. Write the result to `build-sessions/REGISTER-SWEEP-2026-09-18.md`, and end with a ranked list of open LAU rows as proposed prompts (model, effort, scope) for the controller.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S10 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S10 <what>" && { <cmd>; rc=$?; "$L" release "S10 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S10 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
