## 2026-10-13 · feat(suppliers): Booked + Budget, and the supplier's money half that answers it (Suppliers PR4 · Pair 3)

The couple's Suppliers page, step 4, stacked on step 3 (#6505), carrying the three Budget drafts (#6439 B0 · #6441 B1 · #6449 B2, merged whole) and the never-pushed 2026-10-10 Booked draft (`rd/suppliers-booked-part`). Map `SUPPLIER_CONNECTION_MAP_2026-10-10.md` P3 (rows 19–24).

**The couple — Suppliers › Booked**

- **Waiting for their yes** — asked, not answered: Nudge · Chat · Withdraw; nothing else opens (the DB's own deadline under it).
- **Booked** — hairline rows with a terracotta arrow; ONE next step each (the supplier's own plan → a dated ledger line → the shipped sentence; an ESTIMATED 50/50 never names an amount); a tap unfolds room size ("18 × 24 m · sent ✓" / "not sent · Ask them"), "Used across your event", a pending date change, and the verbs (Pay · Your record · Chat · Workspace · Cancel booking / Dispute). Main buttons terracotta, 44 px, borderless soft chips in flipping tokens (look calls 1, 3, 7, 8 of 2026-10-12).
- **Budget** — the approved B4 block (`BUDGET_PAGE_2026-10-08_fable.md` § 2): Paid · Owed, the Budget page's meter, ONE Next line ("Pay ›" opens that supplier's Pay sheet), Open budget ›. Every figure is the Budget page's own reading (`knownMoneyTotals` · `budgetMeter` · `pickNextPayment`) of the SAME `EventMoney` the rows are drawn from — one resolver call per request. A refused source → Paid "—", Owed "₱X+", no bar, no Next line.
- **Pay sheet** — in place, one request (`loadPaySheet`, read-only): the plan as **kind 26 Price summary** (instalment rows with badges, total bold), then the ONE shipped payment card (`DepositReservation`).
- **Budget page** (B0–B2 as drafted): honest reads, the summary as rows with Target edited in place, one list (booked suppliers · bought on Setnayan · your expenses).

**The supplier — the customer card's Money fold** (`clients/[eventId]/_components/customer-money-fold.tsx`, Quote tab)

- Paid · Due, the received meter, the same instalments as kind 26 (Received ✓ · Waiting for you · Due), and each payment the couple logged **answered in place** — Confirm received (terracotta) · Not received — through the thread page's own `PendingPaymentAnswer` (`confirmVendorPayment` / `refuseVendorPayment`), which now post `return_to` = the card; the actions honour only the bare card path (`lockAnswerReturnTo`). The card no longer sends the supplier to chat to answer.
- The loop: couple records → "Waiting for their check" / "Waiting for you" → Confirm → "Paid ✓" / "Received ✓", the row's next step moves on; Not received → Due again on both ends (H4) and the couple is told (shipped notice).

**Row 19 (a booking with no plan cannot be paid):** already fixed on main (deb3d4bb3a, `freezePaymentPlanAfterSupplierAgreed` at the supplier's yes) — verified, nothing re-built.

**Not here, on purpose:** fee logic (created at the yes on `rd/booking-fee-rules`); no word of the fee reaches a couple (guarded). Setnayan pays no money back (2026-10-08): the row's verb says "Dispute", not "Request refund".

**Orphans left by the drafts, settled (ugat-both-ends):** `BudgetAllocationPlanner` (unmounted by B2 — owner: *"not this one"*) and `MerkadoBudgetLens` (replaced by the B4 block) are deleted with their guard rows; the share-my-budget switch (`ShareBudgetBandToggle`, unmounted by B2 to wait for B4's ⋯ menu) is mounted again at the foot of the Budget page, couple-only, so the opt-in keeps a door. The supplier's answer actions read `return_to` themselves (`a-decision-reply-posts-what-the-action-reads` marks it optional for the thread's own forms).

**Shared pieces:** `lib/price-summary.ts` + `app/_components/price-summary.tsx` (kind 26, one fold, two viewers) · `lib/booked-budget.ts` (the B4 block) · labs `/dev/suppliers-lab?mode=booked&money=due|waiting|received|refused` and `/dev/customer-money-lab?s=…` over ONE fixture (`app/dev/suppliers-lab/money-pair.ts`).

**Guards:** `lib/price-summary.test.ts` (8) · `lib/booked-budget.test.ts` (6, rewritten for B4) · `lib/booked-rows.test.ts` · `lib/pay-sheet.test.ts` · `app/dev/customer-money-lab/the-lab-never-ships.test.ts` · re-pointed `your-team-phone-first`, `pillar-parts`.

SPEC IMPACT: None — implements `BUDGET_PAGE_2026-10-08_fable.md` B0–B2 + B4, `SUPPLIERS_PAGE_CHECK_2026-10-07_fable.md` Booked, control template kind 26 (round 2, 2026-10-12) and the 2026-10-12 look calls; the decisions taken are listed in the PR body for the controller to file.
