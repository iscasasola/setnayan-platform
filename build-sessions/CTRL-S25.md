# S25 · main is red: song_request must leave ANSWERS_THAT_DO_NOT_JOIN (URGENT, blocks every open PR)

> **Model: Sonnet 5 · effort: medium.** Released by the controller. **Top priority: every open PR fails until this merges.**

## What happened
Two correct PRs collided on `main`:
- **#5603 (S22)** added a guard in `apps/web/lib/answers-desk.test.ts`: *"song_request stays withheld only while its cited defect is real"*. It fails once any app file calls the song-request RPCs.
- **#5601 (S7)** wired guest song requests (`app/[slug]/_components/song-request-card.tsx`, `app/api/song-requests/route.ts`).

The failure, verbatim: `an application file now calls the song-request RPCs (…song-request-card.tsx, …/api/song-requests/route.ts) — song_request's reason in ANSWERS_THAT_DO_NOT_JOIN is stale, update lib/answers-desk.ts` (`2 !== 0`).

## Do
1. **The guard is right. Do NOT weaken it.** Remove `song_request` from `ANSWERS_THAT_DO_NOT_JOIN` in `lib/answers-desk.ts`, and read what that list means first: if leaving it lets song requests join the Answers Desk, make sure that surface actually handles a `song_request` answer correctly (read S7's PR #5601 body for the shape). If something more than the list edit is needed, do it, or say plainly what's missing.
2. Run `cd apps/web && npx tsx --test lib/answers-desk.test.ts` (targeted; no heavy lock needed), and confirm it passes and still fails if you re-add the entry.
3. Also update the register row **SUP-52 from "parked" to "done"** in `build-sessions/REGISTER-SWEEP-2026-09-18.md` (and `HANDOFF-2026-09-18/REFERENCE/ONE_REGISTER.md` if it's tracked), with a one-line note citing #5601.
4. Open the PR, enable auto-merge, and tell the controller the PR number fast. Other PRs are waiting on it.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S25 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S25 <what>" && { <cmd>; rc=$?; "$L" release "S25 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S25 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
