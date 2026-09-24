# S31 · The guest site on the day: RSVP stays reachable, photos in Usapan, the filling meter

> **Model: Opus 5 · effort: medium.** DO NOT OPEN until the controller says so (wave 4).

Source: `build-sessions/REGISTER-SWEEP-2026-09-18.md` on `main`. **Every row is a hypothesis: re-measure it first**, and skip it (saying so) if it is already done. Before building, search the corpus design for the feature (RULE 0: `ls ~/Documents/Claude/Projects/Setnayan/Design_*/`, `grep -n <noun> ~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`) and **extend what exists**. **One PR per item**, with one worktree alive at a time.

- **DAY-33:** the guest site's phase logic hides RSVP by date, and the only override is a host-only `?phase=` preview param. Add the couple-facing persistent setting "always show RSVP", stored on the event, respected by `getLifecyclePhase`.
- **DAY-24:** the `UsapanTab` form is text-only and `TABS` has no Memories entry. Let a guest attach a photo, reusing the existing Papic/R2 upload path (don't add a second upload pipe), and connect it to Memories.
- **DAY-4:** the "filling meter" (zero hits). Find its design in the corpus first. If no design exists, stop and report; don't invent it.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S31 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S31 <what>" && { <cmd>; rc=$?; "$L" release "S31 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S31 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
