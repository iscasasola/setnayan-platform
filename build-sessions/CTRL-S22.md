# S22 · Four tiny truth fixes: SUP-53/58, SUP-54, SUP-92, SUP-73 (one PR each, in sequence)

> **Model: Sonnet 5 · effort: low.** DO NOT OPEN until the controller says so.

Source: the full register sweep, `build-sessions/REGISTER-SWEEP-2026-09-18.md` (PR #5590; until it merges, read it with `git show origin/claude/register-sweep-lau-launch-readiness:build-sessions/REGISTER-SWEEP-2026-09-18.md`). Every finding there is a hypothesis: re-measure first.

One worktree alive at a time; prune it before starting the next.
- **SUP-53/58:** remove `crew_shift` and `waitlist_pick` from `ANSWERS_THAT_DO_NOT_JOIN` (both fixed 2026-08-29). Add a test that fails if a "do not join" entry's cited defect no longer reproduces, if that can be made to execute rather than grep.
- **SUP-54:** `handshake_tokens_consumed` contradicts its own code comment. Make the DB write and the comment agree, and prove which one is true first.
- **SUP-92:** remove the stale "soon" label from Pro's Priority Support pitch (the feature is live; confirm it).
- **SUP-73:** the hard-coded "3 couples inquired" in a baked JPEG/demo mockup. Make it honest, or label it clearly as an example.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S22 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S22 <what>" && { <cmd>; rc=$?; "$L" release "S22 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S22 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
