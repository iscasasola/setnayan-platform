# S27 · Supplier offer ↔ marketplace: a service card must reach where couples look

> **Model: Opus 5 · effort: high.** Released by the controller. Theme: **make everything connect properly** (owner, 2026-09-18).

Source: `build-sessions/REGISTER-SWEEP-2026-09-18.md` on `main` (the full 456-row sweep, merged in #5590). **Every row is a hypothesis: re-measure it first**, and skip it (saying so) if it is already done. **One PR per item**, in sequence, with one worktree alive at a time. Prune each before starting the next.

The couple-facing half of the supplier's offer is disconnected in several places:
1. **SUP-41:** a published service card's record never appears on the marketplace. Connect it.
2. **SUP-4 (first half):** `ServiceCardFace` renders only in chat and the vendor's own preview, never on `app/v/[slug]` or `/explore`. Use the same face there, not a second design.
3. **SUP-40:** the ★ customization options can't be copied between cards (see the `lib/vendor-card-copy.ts` docblock). Build the copy.
4. **SUP-10:** a side-by-side desktop preview in the card maker, so the supplier sees what the couple sees while editing.
Note: the only published shop is the FIXTURE and there are 2 active services. Verify with the fixture plus the db tests, and say plainly what you could not see live.
⚠ **Skip SUP-H** (duplicate send-proposal/build-quote launchers). It touches the chat tray that S18 (#5614) is rewriting. List it for the controller instead.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S27 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S27 <what>" && { <cmd>; rc=$?; "$L" release "S27 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S27 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
