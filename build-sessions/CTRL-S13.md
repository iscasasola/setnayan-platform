# S13 · Four tiny LAU fixes (LAU-30, LAU-40, LAU-45, LAU-49): one PR each, done one after another

> **Model: Sonnet 5 · effort: low.** Session S13 of `build-sessions/CONTROLLER-PLAN-2026-09-18.md`. Source: the LAU re-measure in build-sessions/REGISTER-SWEEP-2026-09-18.md (on branch claude/register-sweep-lau-launch-readiness / PR #5590 until it merges).

Do these **one after another, one PR each**. Only one worktree may be alive at a time: prune it before starting the next.
- **LAU-30:** in `apps/web/app/dashboard/(account)/profile/concierge/actions.ts`, the `concierge_abuse_flags` insert swallows its error. Destructure `{ error }` and surface it the same way the two calls beside it do. (⚠ This is an `actions.ts`, so a failure here should DENY or log, never pretend success.)
- **LAU-40:** `setWallDisplayCookie` in `apps/web/lib/live-wall.ts` has its own `getSecret()`. Switch it to the shared `resolveGuestSessionSecret`.
- **LAU-45:** add `/alaala` to whatever generates `sitemap-static.xml`.
- **LAU-49:** `apps/web/lib/seo/health-checks.ts` should also trust DNS-TXT verification, not only the env var.
Re-measure each one first (the S10 finding is a hypothesis). If one turns out to be already done, skip it and say so.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S13 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S13 <what>" && { <cmd>; rc=$?; "$L" release "S13 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S13 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
