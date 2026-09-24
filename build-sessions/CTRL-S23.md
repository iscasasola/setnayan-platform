# S23 · DAY-32 #4: the guest login cookie is never extended

> **Model: Sonnet 5 · effort: medium.** DO NOT OPEN until the controller says so.

Source: the full register sweep, `build-sessions/REGISTER-SWEEP-2026-09-18.md` (PR #5590; until it merges, read it with `git show origin/claude/register-sweep-lau-launch-readiness:build-sessions/REGISTER-SWEEP-2026-09-18.md`). Every finding there is a hypothesis: re-measure first.

From the DAY-32 bundle (EVENT_WEBSITE_BUILD_PLAN), the one still-open item worth its own build: a guest's login cookie is never extended, so a guest can be logged out mid-event. Re-measure, then extend it on activity using the shared guest-session secret resolver. Do not touch LAU-40's live-wall cookie; S13 (#5593) owns that.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S23 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S23 <what>" && { <cmd>; rc=$?; "$L" release "S23 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S23 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
