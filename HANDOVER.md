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
