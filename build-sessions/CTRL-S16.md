# S16 · LAU-31: guard against try/catch around a Supabase call that cannot throw

> **Model: Opus 5 · effort: medium.** Session S16 of `build-sessions/CONTROLLER-PLAN-2026-09-18.md`. Source: the LAU re-measure in build-sessions/REGISTER-SWEEP-2026-09-18.md (on branch claude/register-sweep-lau-launch-readiness / PR #5590 until it merges).

Supabase calls return `{ error }`; they do not throw. A try/catch around them with the result's `error` ignored is a silent failure (that is exactly how LAU-30 happened). Build an **executable guard** (a test under `apps/web/lib/` in the style of the repo's other source guards) that finds a Supabase call whose `error` is never read. Start with a baseline file of existing violations, so the guard is green on day one and fails on any NEW one. Sabotage-prove it. Read the memories *two-ways-a-guard-passes-without-proving-anything* and *a-guard-on-the-call-cannot-see-the-argument* before designing it.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S16 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S16 <what>" && { <cmd>; rc=$?; "$L" release "S16 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S16 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
