# S5 · 'Update this quote': supersede and re-accept

> **Model: Fable 5.1 · effort: high.** Session S5 of the controller plan `build-sessions/CONTROLLER-PLAN-2026-09-18.md`.

**Precondition. Do not start until both of these print MERGED:**
```bash
gh pr view 5586 --json mergedAt -q '.mergedAt // "OPEN"'
gh pr list --head claude/accepting-a-quote-is-not-booking-it --state all --json state -q '.[0].state'
```
Then follow `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/PROMPTS/P1_update-this-quote.md` in full, together with the prototype in `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/PROTOTYPE/`. The owner chose option (a): the new proposal supersedes the old, the old stays visible as history, and acceptance resets to pending. **S3 also adds a migration and also edits `ugat/graph.ts`**, so do a real trial merge before you mark the PR ready.

**S6 finding for you (2026-09-18):** the thread's "Lock this deal" button exists only on an accepted *amendment*, not on an accepted *quote*. A couple who accepted a quote has to lock from `/dashboard/<event>/vendors`. Since you are building the revise → re-accept path in the thread, decide whether an accepted (latest, non-superseded) quote should also offer "Lock this deal" in the thread, and if so build it. Also note that in shipped code the COUPLE asks to lock and the SUPPLIER agrees.

**Owner-observed defect (2026-09-18, live, after #5586 served):** the quote card in the thread shows "₱10,170 · **Accepted**" and STILL shows the **"Review & accept"** button. An accepted quote must not offer accept again. Once your supersede flow exists, the live quote's button should reflect its real state: pending → Review & accept; accepted → no accept (Lock / "Accepted" state); superseded → a history marker. Fix this as part of S5 and prove it with a guard.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S5 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S5 <what>" && { <cmd>; rc=$?; "$L" release "S5 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S5 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
