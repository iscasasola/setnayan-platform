# S15 · LAU-18: admin search finds taxonomy entities

> **Model: Sonnet 5 · effort: medium.** Session S15 of `build-sessions/CONTROLLER-PLAN-2026-09-18.md`. Source: the LAU re-measure in build-sessions/REGISTER-SWEEP-2026-09-18.md (on branch claude/register-sweep-lau-launch-readiness / PR #5590 until it merges).

Extend `fetchAdminRows()` in `admin-row-index.ts` beyond `platform_retail_catalog_v2`, so it also indexes categories, tiles, folders, event types and faiths by name. Follow RULE 0 first: check whether an admin search over those already exists somewhere under a different name.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S15 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S15 <what>" && { <cmd>; rc=$?; "$L" release "S15 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S15 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
