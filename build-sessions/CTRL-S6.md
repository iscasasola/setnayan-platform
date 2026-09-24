# S6 · End-to-end booking run, steps 4 to 6, with the owner

> **Model: Fable 5.1 · effort: high.** Session S6 of the controller plan `build-sessions/CONTROLLER-PLAN-2026-09-18.md`.

**Precondition:** #5586 has merged **and served**: `git merge-base --is-ancestor <mergeCommit> <sha from /api/health>`.

Follow `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/PROMPTS/P2_end-to-end-run.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/03_END_TO_END.md`. The owner drives. You confirm each step by SQL, read-only. Step 6 cannot complete until the owner sets `BOOKING_FEE_RAIL_LIVE` in Vercel Production. Check with `vercel env ls production | grep BOOKING_FEE` (absence is decisive), and if it is missing, ask the owner. For every defect the run exposes, open a small PR only if it lies **outside** `proposal*`/quote files (S5 owns those). Otherwise report it to the controller. List every finding in your final message.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S6 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S6 <what>" && { <cmd>; rc=$?; "$L" release "S6 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S6 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
