## 2026-10-08 · feat(budget): one list — booked suppliers, bought on Setnayan, your expenses (Budget B2)

Plan row **B2** of `BUDGET_PAGE_2026-10-08_fable.md`, built from `prototypes/budget_page_2026-10-08_fable.html` (owner: "opening budget will show all your booked vendors, and expenses and they can add more manually" · "including purchased in setnayan" · "budget looks good!"). Stacked on B1 (`rd/budget-summary-rows`).

**What a couple sees.** Under the summary there is ONE list in three groups, hairline rows, a 40 px circle, a name, one grey line, and the amount with a second line ("₱950,400 owed · Oct 5" in wine, or "paid ✓" in green):

1. **Booked suppliers** — agreed · paid · owed per supplier. Tap → a sheet with every payment (Paid · date · how / Due · date), **Chat**, and **Record a payment** (Amount pre-filled with the next due · Date · How: GCash · Bank transfer · Cash · Card).
2. **Bought on Setnayan** — read-only: name · date · receipt · amount · paid ✓. An order awaiting payment shows as owed.
3. **Your expenses** — name · category · paid so far · amount. Tap → Amount and Paid so far, saved as you type, and **Remove**. **＋ Add expense** (Name · Amount · Paid so far · Category, optional).

The summary above is the resolver's own sum of these rows — `budget-page-view.test.ts` holds Σ(list) = Agreed / Paid / Owed.

**Removed from this page** (the plan row's list): the "Suggested budget split" planner mount and its share-my-budget toggle, the "Category by category" table (`budget-ledger-table.tsx`, deleted) and its render guard (`the-plan-meets-the-ledger.test.ts`, retired — three of its assertions held the pure core the CSV export still uses and moved to `lib/budget-ledger.test.ts`), the "Costs you pay yourself" form (`costs-with-no-supplier.tsx`, deleted), and the per-supplier itemization cards (`VendorItemizationCard` is no longer mounted here; it is still the supplier workspace's).

**How**

- `lib/budget-page-view.ts` — `buildBudgetList(money)`: three groups from `EventMoney.lines`, AGREED lines only. A group is `null` (unknown) when its read was refused, never `[]`. `suggestedPayment()` pre-fills Record a payment.
- `budget/_components/budget-screen.tsx` (summary + list + the ＋ Add expense thumb control, portalled to `<body>`) and `budget-sheets.tsx` (the four sheets — a **dynamic import**, loaded on the first tap). Built on the shipped `Sheet`, `PickMenu`, `ActionButton`, `InfoTip`, `Count` and the toast provider.
- **Server actions +0** (1198 → 1198). The plan asked for a new `updateEventCost`; the edit instead rides `recordEventCost` on a `cost_id` field (`updateRecordedCost`, not exported). It asks for the changed row back: an UPDATE that RLS filters to zero rows is not an error, and "Saved." over a figure that never moved is a failure drawn as success (DB test added).
- **One writer of a payment.** Record a payment posts through `logScheduledPayment` (→ `logPayment`, every rule intact). A supplier ON SETNAYAN is paid under "Amount to pay", so their button goes there; a door that could not be checked offers no form. A refusal is printed in the sheet, which stays open.
- **Bought-on-Setnayan date:** `orders` has no `paid_at`. The row is dated by **`orders.created_at`** (the Manila day the order was placed), carried as `MoneyLine.bookedOn`. Not `updated_at`, which moves on every later touch.
- **A refused read reaches the pixels:** a group whose read failed says "Couldn't load your purchases." (or suppliers / expenses) and prints no count. With the kill-switch off the resolver is never asked, and all three groups say so rather than drawing three empty lists. (Retry, the red-dot styling review and the summary's "₱X+" are plan row B3.)
- `nav-registry-defaults.ts` — the vestigial `customer.budget-anchors.allocate` slot is retired (its `#budget-allocate` section is gone); `payments` now lands on the list.

**Guards**

- `budget/the-supplier-ledger-collapses.test.ts` REWRITTEN for the sheet: the collapsed row carries the money; the history is shut (not on the page, not in the first load); the row opens its own sheet; one writer; a refusal does not close the sheet.
- `budget/the-ledger-reads-one-clock.test.ts` KEPT, re-pointed at the files that draw a due date now.
- `lib/budget-page-view.test.ts` (20) · `lib/budget-read-is-honest.test.ts` (+2 = 17) · `lib/a-cost-needs-no-supplier.test.ts` (two rules re-pointed, +2 for the edit) · `lib/amount-to-pay.test.ts` (door rule re-pointed, stricter) · `tests/db/a-cost-can-exist-with-no-supplier.db.test.ts` (+1).
- Rosters updated for deleted files: `a-round-code-sits-in-a-round-slot`, `agreed-total-and-its-changes` (the lab fixture is not a read), `money-wears-the-ledger-face` (prose bill shrank).
- Regenerated on this tree: `port-control-baseline.json`, `no-card.baseline.txt` (1984 → 1976), `ugat/screens.generated.json`, `one-comment-stripper.baseline.txt` (−1).

**What left the Budget page and where it still lives** (no silent drops): adding / deleting a supplier's line items, "Suggest milestones", deleting a logged payment, attaching a receipt photo and a reference number, the supplier's published payment details, and the accepted-quote lines are all still on the supplier's own workspace (`vendors/<id>/workspace`), which mounts the same card. Recording a cost WITH a supplier named (which booked a manual supplier and minted a claim QR) has no caller after this PR — Suppliers has its own add-a-supplier door.

**Needs another stream, stated:** (1) `vendors/_components/plan-budget-accordion.tsx` ("Suggested for … · **Adjust**") links to `?part=budget#budget-allocate`, a section this PR removes — the Suppliers stream must re-point or drop that link. (2) The share-my-budget toggle has no door until the ⋯ menu (plan row B4). (3) The first-visit tour `customer_budget_v1` still describes the estimates split until B5 rewrites it. (4) Payment-plan instalments (`event_vendor_payment_plan`) are not `EventMoney` lines, so a supplier on Setnayan shows "owed" without a date here; the dates are under Amount to pay.

SPEC IMPACT: None — implements `BUDGET_PAGE_2026-10-08_fable.md` §5 row B2. The four "needs another stream" items above are recorded in `BUDGET_BUILD_STATUS_2026-10-08.md` in the corpus.
