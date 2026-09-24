# S14 · LAU-41: service-worker guest allowlist is missing 3 routes

> **Model: Sonnet 5 · effort: medium.** Session S14 of `build-sessions/CONTROLLER-PLAN-2026-09-18.md`. Source: the LAU re-measure in build-sessions/REGISTER-SWEEP-2026-09-18.md (on branch claude/register-sweep-lau-launch-readiness / PR #5590 until it merges).

`apps/web/public/sw.js` has a hand-maintained `RESERVED` set that is missing `creators`, `open-shop` and `tour`. Fix the root cause, not just those three: **derive** the set from the top-level `app/` directories (a build-time generation step or a guard test that diffs `sw.js` against `app/`). Prove the guard goes red when a new top-level route is added without updating the set.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S14 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S14 <what>" && { <cmd>; rc=$?; "$L" release "S14 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S14 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
