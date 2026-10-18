# HANDOVER — rd/budget-b3-b5 · started 2026-10-18 ~14:00 PHT by the controller

Owner 2026-10-18 list item 8 (approved-not-built designs: the Budget page) + "Continue as it becomes available".
Ship-on-green authorised through 19 Oct. CONTRACT: corpus BUDGET_PAGE_2026-10-08_fable.md + prototypes/budget_page_2026-10-08_fable.html
+ BUDGET_BUILD_STATUS_2026-10-08.md (read via `git -C ~/Documents/Claude/Projects/Setnayan show origin/main:<path>`).
B0 #6439, B1 #6441, B2 #6449 MERGED (budget-screen.tsx live). B4 done in #6516 (verify).
BUILD: B3 — the frosted thumb row (Add expense, All/Owing/Paid PickMenu, search, failed-group Retry) exactly as drawn.
B5 — the tour/ⓘ/copy sweep: customer_budget_v1 (lib/tours.ts) still describes the removed estimates split — rewrite its
words to the shipped page (tours are switched off, TIP_POPUPS_ON=false; still fix the words), ⓘ texts, copy.
Leftovers named in BUDGET_BUILD_STATUS (share-budget toggle door, payment-plan instalments in EventMoney, dead action
saveAllocationSnapshot): do the ones that are small and safe; name the rest. Money reads: honest failures (never ₱0 for a
failed read — CLAUDE.md "reads-are-honest"). 375 px shots light + dark + side-by-side vs prototype.
Files: apps/web/app/dashboard/[eventId]/budget/**, lib/budget-page-view.ts, lib/tours.ts (budget entry only).
Own walk folder (scratchpad/budget-walk/). Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-budget-b3-b5.md.

## STATE (builder, 2026-10-18)
Step 1 DONE (commit below): B3 thumb row (Add · All▾ PickMenu · search, glass), filter/search pure fn + guard,
Retry on failed group, partial summary (Owed floor "+" via bookedBudgetBlock, legend "part of this couldn't load",
Next "couldn't check"); B5 tour words (prototype verbatim), Mahr/Chinese → notes inside Target ⓘ; dead
saveAllocationSnapshot deleted (port + never-read baselines regenerated).
Decisions where the record is silent: search empty copy "No match."; group count stays the unfiltered total
(prototype); filter does not move the summary; meter draws no bar on a partial ledger (B1 rule, not the
prototype's partial bar); Next on partial = "couldn't check" (B4's rule); tradition notes ride INSIDE the Target ⓘ
(a second ⓘ does not fit the 160px cell).
Step 2 DONE: walked /dev/budget-lab 375 light+dark, Chromium + WebKit; shots in scratchpad budget-walk/shots.
Walk fixes: search input type=text (native ✕ doubled ours); row controls all 44px; Target field lifted above the
(pointer:coarse) 16px input floor (it drew 16px on phones since B1); TraditionNotes moved to its own component +
lab ?state=traditions.
Step 3 DONE: draft PR #6633 (label do-not-auto-merge, autoMergeRequest null); shots → ~/Documents/Claude/Projects/shots-2026-10-18/6633/.
NEXT: CI loop to green; delete this file when green.
Left, named: masthead .ics/CSV/Print still on the page (B4's move to Schedule/⋯ not done); share-band toggle
still at page foot (no ⋯ menu yet); payment-plan instalments not in EventMoney (own PR, changes every money
surface); marketing page app/(shell)/budget + lib/feature-pages/plan-a.ts still describe Save/Standard/Splurge.
