## 2026-10-10 · feat(suppliers): Booked and Budget — "Waiting for their yes", one next step per booked supplier, the budget's six figures, the Pay sheet, room size (Suppliers PR4)

Built on the three Budget drafts (#6439 · #6441 · #6449, merged into this branch first). Owner 2026-10-07 — the prototype's Booked mode (`prototypes/suppliers_page_2026-10-07_fable.html`) — and the rulings of 2026-10-10 (`SUPPLIERS_OWNER_RULINGS_2026-10-10.md`).

**What a couple sees under Booked**

- **Waiting for their yes** — a supplier they asked who has not answered (the handshake's middle state: `teamRows`' `asked` group). Nudge · Chat · Withdraw; nothing else opens. The DB's own deadline ("5 days left to answer") is kept under it.
- **Booked** — one row each with the ONE next step ("first payment · ₱528,000 · by Oct 5" · "set the price so your buffer can count" · "Paid in full ₱85,000"); a tap opens what they feed across the event and the verbs: Pay / Set price / Payments · Your record · Chat · Workspace · Cancel booking.
- **Budget** — Due next; Budget · Booked · Paid to suppliers · Setnayan orders · If you book these · Buffer; the meter (spoken for · paid); one line per booked supplier with its own Pay / Set price.
- **Pay sheet** — Pay and Payments open in place: the supplier's payment plan, then the ONE shipped payment card (`DepositReservation`: where to pay them, record it, what was paid). No link to the workspace.
- **Room size** on a booked reception · ceremony · accommodation only: "18 × 24 m · sent ✓", or "not sent · Ask them" (one canned chat line).
- **A pending date change** is said on the row of the supplier it is waiting on (ruling 10), in the Home doorway's own words.

**Where every number comes from**

- A row's next step: the supplier's own plan (`event_vendor_payment_plan`, folded by the shipped `computeStepper`) → else a dated line on the one ledger (`buildBudgetList` over `lib/budget-truth.ts`) → else the shipped first-payment sentence. **An ESTIMATED 50/50 plan never names an amount on a row** (a quote-locked booking keeps its real schedule in the accepted quote; the Pay sheet states it through `moneyStep`).
- Budget · Booked · If you book these · Buffer: `teamMoney` over the page's plan model — the Build body's own call (`teamMoneyOfModel`), so the two tabs cannot print two figures for one fact. Paid to suppliers · Setnayan orders · Due next · each supplier's line: the one resolver. No price, fee, rate or percentage is written in code; the meter's percentages are computed from those figures.
- **A refused read reaches the pixels.** The team read → "Couldn't load your suppliers". The ledger's supplier read → a priced row says "we couldn't check your payments" (never Pay, never "Paid in full"), Paid to suppliers says "Couldn't load", the meter draws no paid bar. The orders read → "Couldn't load". The plan read → `null`, never an empty map. A venue's shop that did not answer → "we couldn't check", never "not sent". The Pay sheet's one request → "We couldn't load their payments" with Try again.

**No second writer.** Every verb calls an action that already ships (`contactShortlistVendor` nudge · `WithdrawAskButton` · `CancelBookingButton` · `loadSelfAddedSupplier` → `NewManualVendorModal` · the payment card's own `recordDeposit` / `logScheduledPayment` · `sendChatMessage`). One new server action, READ-ONLY: `loadPaySheet` (1,199 → 1,200 of 1,225).

**Files.** `lib/booked-rows.ts` · `lib/booked-budget.ts` · `lib/booked-plans.server.ts` · `lib/booked-room.server.ts` · `lib/pay-sheet.ts` · `vendors/_actions/pay-sheet.ts` · `vendors/_components/booked-{body,row,slot,budget,room-line,stand-ins}` · `pay-sheet.tsx`. The shell takes one additive prop (`bookedSlot`). `/dev/suppliers-lab?mode=booked` draws every state on fixtures.

**Removed from the page, and where each went** (`lint-port-no-lost-controls` named them): `<TeamRows>` → `<BookedBody>`; `<RowAction>` (Pay › · Nudge › · Review › · Check › · Book ›) → the row's verbs — Book and a quote's Nudge stay on the Find card and in Build, because a supplier the couple is still deciding on is no longer listed under Booked; `<MerkadoBudgetLens>` → the Budget section, its door to the Budget part kept as "Open budget". `team-rows.tsx` is deleted; `merkado-budget-lens.tsx` is left in place, unmounted (four guards read its source).

**Guards.** `lib/booked-rows.test.ts` (14) · `lib/booked-budget.test.ts` (7) · `lib/pay-sheet.test.ts` (4) · `your-team-phone-first.test.ts` and `pillar-parts.test.ts` re-pointed · two rosters extended with reasons (`agreed-total-and-its-changes`, `deposit-fact-has-one-reader`). 16 sabotages, each seen red and restored.

**Kept as shipped, for the owner's look:** the ways to pay are `VendorDirectPay`'s list (the prototype drew one dropdown with one shown).

SPEC IMPACT: None — implements `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR4 and ruling 10 of `SUPPLIERS_OWNER_RULINGS_2026-10-10.md`; the deviations are listed in the builder's report for the controller to file.
