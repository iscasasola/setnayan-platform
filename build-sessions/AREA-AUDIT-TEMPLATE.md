## Your job: own this AREA end to end, so a real person can use it without hitting anything broken

Owner, 2026-09-18: *"please make sure event hub, chatbox and papic, and the vendor's and user's page are properly fixed."*

1. **Map the area.** List every route, page and component in the area, from `origin/main` (use a fresh worktree off origin/main, never `/Users/icecasasola`). Read its corpus design first (`~/Documents/Claude/Projects/Setnayan/`, e.g. `CLAUDE_DESIGN_0*_*.md`, `Design_*`, `BUILD_PLAN_Chat_And_Exclusive_2026-09-09.md`, `0012_papic`), plus `DECISION_LOG.md` (grep the area noun). RULE 0: extend what exists.
2. **Know what's already in flight.** Run `gh pr list --state open --limit 80`. Many PRs are open in these areas (e.g. #5614 chat everywhere; S41b's "couldn't load" PRs #5661–#5666; S27–S30 supplier/budget; S37 Papic cleanup). **Do not duplicate or fight them.** Read their diffs, treat them as landing, and build only what is still broken AFTER them. If you must touch a file an open PR touches, do a trial merge (`git merge --no-commit --no-ff origin/<their-branch>`) and back it out.
3. **Walk every journey in the area as the real person would**, by reading the code path (page → loader → query → RLS → render), plus **live read-only checks**: `curl` public pages on https://www.setnayan.com, read-only SQL on production (Supabase MCP `execute_sql`, SELECT only), and the served sha from `/api/health`. You can't sign in (never type credentials), so for signed-in pages trace the code and data, and say plainly what you couldn't see.
4. **Find what's broken**: dead links and buttons, a failure that looks like success or "none", wrong-audience wording, a stale state (e.g. "Quote sent" after booking), duplicate navigation, anything unreachable, anything the design promises and the page lacks. Test data: the rosa-ben event (`2d4f1144-7816-4367-9c99-6ff0f9a6de10`, couple testnayan3, supplier Saysay = testnayan2, booking contracted, deposit confirmed).
5. **Fix it**: one PR per coherent fix, each with an executable test that is sabotage-proven. Tests use `stripComments` from `lib/strip-comments.ts`, never their own comment regex. Add a changelog fragment. Draft PR first, then `gh pr merge <N> --auto --merge`, then mark ready.
6. **Write the owner a click-test checklist** for the area (a numbered list of what to click as which test account, and what should be seen), appended to `build-sessions/AREA-CHECKLISTS-2026-09-18.md` under your area heading. Commit that file in one of your PRs.

**Machine rules (16 GB, many sessions):** any `pnpm install`, full tsc, build or DB replay goes ONLY through `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "<you> <what>" && { <cmd>; rc=$?; "$L" release "<you> <what>"; exit $rc; }` as ONE command. Avoid installing: symlink `node_modules` (and `apps/web/node_modules`) from an existing worktree such as `~/Documents/Claude/Projects/wt-S41`, and never delete anything in other worktrees. Never run `next dev`. Never apply a migration to prod or run migration repair. Never weaken a guard.

Stop when the area is clean or after 6 PRs. Don't wait for CI. End with:
`CONTROLLER ▸ <you> · <DONE|BLOCKED|NEEDS-OWNER> · PR #<n…> · <what a person can now do / what is still broken>`

**Do not spawn sub-agents of your own.** The controller budgets how many agents run in parallel on this 16 GB Mac.

**If any tool call is blocked by a safety or permission check, do NOT retry it through a different tool or method.** Stop and report the block (what was blocked, and why you believe the change is correct) as BLOCKED in your CONTROLLER ▸ line. The controller reviews and decides.

## Two rules added 2026-09-20, both from real damage

- **One session per branch.** Never push to a branch another session is working on. If a PR needs refreshing and its author may still be live, say so and let the controller decide who owns it. Two sessions on one branch is how work gets silently deleted: on 2026-09-20 a refresher and an author both pushed to `claude/approval-notice`, and only a rejected non-fast-forward push made it visible.
- **Do NOT append to `AREA-CHECKLISTS-2026-09-18.md` or any other shared append-only file.** Every session writing to one file makes every PR conflict with every other. Write `build-sessions/<your-topic>-checklist.md` instead, and let the controller fold it in.
- **A guard run is evidence about the tree as it stood when it ran, not a property of the branch.** Run every blocking guard AFTER your last edit — including edits to comments. A comment explaining a guard fix has tripped that same guard here.

## ⏱ SPEED RULES — added 2026-09-20 after a day of queueing

The laptop has ONE heavy slot (`heavy-lock.sh`). A session that holds it for 27 minutes stops five others. Measured today: 15 merges in 3 hours, with most of the wall clock spent waiting, not building.

1. **Run only what your change touches.** Scoped `tsc` on changed files, the test files that name them, and the guards your diff can break. Do NOT run the full unit suite (17k tests) or the full `test:db:ci` replay (~12 min) unless your diff touches migrations, a generated baseline, or something global. **CI runs the full suites; that is its job.**
2. **Never watch a PR.** Push → arm `gh pr merge <N> --auto --merge` → report → exit. GitHub merges it without you. A polling loop holds a slot and changes nothing. The controller watches centrally.
3. **Report the verdict, not the launch.** "CI running" is not a result. Run every blocking guard, typecheck and your tests locally AFTER your last edit — including comment-only edits — then say what passed.
4. **Batch small fixes.** A PR here is a ~50-minute round trip. Three one-line fixes in one PR cost one round trip; three PRs cost three, plus three chances to go stale.
5. **Don't chase `main`.** If your PR goes stale twice, say so and stop. The controller decides whether to refresh again or hold it until the queue drains.
6. **Batch owner questions.** Collect them and hand the controller one list at the end. Do not drip-feed decisions.
7. **Never `pkill` by pattern.** `pkill -f "tsc --noEmit"` kills every session's typecheck on this machine, not yours. Kill only PIDs you started and recorded. A session did this on 2026-09-20 while tidying up and reported it; nothing visibly broke, and the next one might not be so lucky.
