# S8 · DAY-14 dead branch and LR-21 comment nit

> **Model: Sonnet 5 · effort: low.** Session S8 of the controller plan `build-sessions/CONTROLLER-PLAN-2026-09-18.md`.

Follow `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/PROMPTS/P7_small-and-honest.md` § 7b and § 7c. **Two separate PRs**, in two worktrees one after the other. For 7b, run `git log --diff-filter=D` and read the file's docblock before deleting. 7c changes comments only.

**Also (from the full sweep):** delete the retired `decideBroadcastWindow`-adjacent dead files (DSK/LS-LEGACY, DAY-13) and the unused `liveStudioControlLegacyPath()` helper as a third PR. Run `git log --diff-filter=D` and check importers first; LS6 deleted the broadcast-day model deliberately.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S8 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S8 <what>" && { <cmd>; rc=$?; "$L" release "S8 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S8 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
