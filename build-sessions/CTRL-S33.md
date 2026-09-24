# S33 · Couple ↔ supplier relationship states and the duplicate quote launcher

> **Model: Opus 5 · effort: medium.** DO NOT OPEN until S18 (#5614) has MERGED. It touches the chat tray S18 is rewriting.

Source: `build-sessions/REGISTER-SWEEP-2026-09-18.md` on `main`. **Every row is a hypothesis: re-measure it first**, and skip it (saying so) if it is already done. Before building, search the corpus design for the feature (RULE 0: `ls ~/Documents/Claude/Projects/Setnayan/Design_*/`, `grep -n <noun> ~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`) and **extend what exists**. **One PR per item**, with one worktree alive at a time.

- **SUP-H:** the supplier rail still has two separate launchers, `'send-proposal'` and `'build-quote'`. Collapse them into one entry inside S18's one-frame tray (read #5614 first).
- **SUP-2:** `relationship_depth` has only 4 values. Add the missing, real states the product already produces (meeting confirmed, guest count changed), derived from existing rows rather than typed by hand.
- **SUP-69:** `askedCount` is always 0 while `isExploreReplanEnabled` is off, but that flag is **ON in prod** (memory: *explore-replan-flag-is-on-in-prod*). Re-measure what actually renders, then make "asked" distinguishable from "not asked" so other screens stop nagging a couple to "go book" a supplier they've already asked.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S33 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S33 <what>" && { <cmd>; rc=$?; "$L" release "S33 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S33 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
