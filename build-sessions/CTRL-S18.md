# S18 · One chat box everywhere: the supplier's client page (and any other place the chat is embedded)

> **Model: Fable 5.1 · effort: high.** DO NOT OPEN until the controller says so (after S5 merges; both touch the chat).

## Why
Owner, 2026-09-18, after #5586 served: **"why did the chatbox never change?"** Because #5586 converted only the two dedicated THREAD pages (`/dashboard/[eventId]/messages/[threadId]` and `/vendor-dashboard/messages/[threadId]`). The page the supplier actually lands on, **`/vendor-dashboard/clients/[eventId]`**, still embeds the old chat with **two navigation rows** (buttons: Open chat · New quote · Contract · Files · Schedule · Log payment, then tabs: Chat · Quote · Payments · Files · Schedule · Call · Details) above the conversation. The owner's brief: *"a single chat box with everything inside it."*

## Do
1. RULE 0: read #5586's PR body (`gh pr view 5586`) and `app/_components/chat/chat-box.tsx`, `lib/chat-box-tools.ts`, `thread-tool-panel.tsx`. **Reuse that frame.** Do not build a second one.
2. Enumerate EVERY place a conversation renders (`git grep -l "ChatMessageStream"`, plus importers of those). For each, say whether it is the one frame. Fix the ones that aren't. The supplier client page is priority 1; also check the couple's vendor workspace and the Vendors-page side panel.
3. On the client page, collapse the two nav rows into the frame's tray/⋮ the same way #5586 did (the handoff prototype is `HANDOFF-2026-09-18/PROTOTYPE/the-chat-box.html`).
4. Fix these, all seen live by the owner on that page:
   - "YOUR NEXT MOVE: Quote sent — follow up while you wait" while the couple has already asked to book (stale next move);
   - the stepper shows "Quoted" after the quote was Accepted and the booking was contracted;
   - the supplier sees the banner "your vendor sees what they need from your profile", which is couple-facing copy.
5. Measure the conversation's visible height at 320/390/1440 the way #5584/#5586 did, and put the table in the PR.

## Controller rules (these override anything in the handoff that conflicts)
- **Usage has reset.** Ignore the handoff's "98% / run on Fable" note. Run on the model named above.
- Read `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/00_START_HERE.md` and `~/Documents/Claude/Projects/setnayan-platform/build-sessions/HANDOFF-2026-09-18/04_TRAPS.md` first. Never read code from `/Users/icecasasola` or the primary checkout. Create your own worktree: `git worktree add ~/Documents/Claude/Projects/wt-S18 -b claude/<slug> origin/main`.
- **16 GB machine, and other sessions are running.** `pnpm install`, full tsc, `next build`, the full unit suite and the DB replay each go through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "S18 <what>" && { <cmd>; rc=$?; "$L" release "S18 <what>"; exit $rc; }`, as ONE command. Locally, run only targeted test files (`cd apps/web && npx tsx --test <file>`). Let CI do the full typecheck. **Never run `next dev`.**
- Push a DRAFT PR after your first commit. Run `gh pr merge <N> --auto --merge` right away, and mark the PR ready when you are done. Add a changelog fragment in `changelog.d/`. Prune your worktree the moment the PR merges.
- RULE 0 applies: run `gh pr list --state open` and `git log origin/main -15` before building, then state **what exists · what is missing · the delta**.
- Never weaken a guard. Never apply a migration to prod. Never run `migration repair`. Test as `testnayan1` by email and password.
- **Your final message must end with:** `CONTROLLER ▸ S18 · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n> <state> · <one line>`
