## 2026-11-07 · fix(suppliers): Add manually matches the approved makers-match sheet — services as lines, inclusions as lines, "Already paid" + proof per payment

The owner approved `prototypes/makers_match_2026-11-07/makers-match.html` § 1 (DECISION_LOG 2026-11-07, "THE FOUR MAKERS
ARE APPROVED") and ruled that every change is a fix to the shipped sheet, never a new screen. This fixes the couple's
`new-manual-vendor-modal.tsx` in place (add mode only — the record card and the marketplace link are untouched):

- **No categories on the sheet.** The title is "Add a supplier" (no category eyebrow). Services is ONE multi-select
  `PickMenu` of service names with search inside it — the Suppliers page's own rows, flat, no folder headings — drawn by
  a new `lines` mode of the shipped `ServicesCoveredPicker`. The row the sheet was opened from arrives ticked ("the row
  you opened this from"); more can be ticked; each picked service is a line that swipes left to remove (the shared
  `SwipeToDelete`) with Undo in a `PeekToast`. The first line is the row the supplier is filed under — if the couple
  removes the opened-from row, the next line becomes it (`storageForRow`, the writer a move uses); the rest post as
  `covers`, exactly as "Also covers" did. Nothing new is stored.
- **Inclusions as lines** — one input per line, "Add a line", swipe to remove with Undo; they post as the one
  newline-joined `inclusions` field the save always read.
- **Payment plan as lines** — the record card's dated rows (name · due date · amount), starting from two named lines
  ("Reservation", "Balance"). A line with no amount and no date is no payment, so an untouched plan no longer greets a
  plain add with a refusal (`addManualSupplier`'s plan step now needs an amount or a day on some row).
- **"Already paid" per payment line.** Ticked, the shipped `ChosenProofField` opens under it ("Proof of payment
  (optional — screenshot/receipt)"). On save, `addManualSupplier` logs each ticked line as an `event_vendor_payments`
  row — `amount_php · paid_at · proof_r2_key · schedule_instance_seq`, the shape `logPayment` writes — on the
  instalment the plan just saved it as (`paidAtAddPayments` in `lib/self-added-payment-plan.ts`; the amount is the saved
  instalment's, read back by `seq`). The receipt goes to the private `payment-proof/events/<event>` folder through
  `uploadDepositProof` and is kept only if it satisfies `budgetPaymentProofPolicy`. **No new column, no migration.** A
  receipt that cannot be stored costs the receipt, never the payment; the saved step says what was logged ("Logged as
  already paid: Reservation ₱20,000 (with proof)").
- **The heads-up moves into an ⓘ** ("Suppliers you add yourself").
- **The thumb row is full width:** Cancel grey (neutral) · Save & add terracotta (`tone="brand" main`, unchanged —
  BUTTON_RULE: a save that adds is the forward step), equal halves. `.ab`'s `flex: 0 0 auto` beat the old `flex-1`, so
  the row is a two-column grid with `w-full` buttons.
- The send is checked against the server action's 6 MB limit before it leaves, so photo + receipts too big together are
  said in the sheet rather than failing the press.
- Dev lab: `/dev/add-your-own-lab?s=add` draws the add sheet (no session) and answers its save through the same pure
  functions, so the paid → proof → logged walk can be seen without a database.
- Guard: `lib/an-already-paid-line-is-a-logged-payment.test.ts` (the seq/amount truth table, the insert writes only
  columns `logPayment` writes, the proof goes through the private folder, the rows post the tick and mount the shipped
  proof field). `scripts/port-control-baseline.json` regenerated.

SPEC IMPACT: None — implements the already-logged 2026-11-07 DECISION_LOG row; no corpus file changes.
