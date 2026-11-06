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
- **The thumb row is the drawing's `.bbar`:** a frosted, full-width strip (the sheet's paper at 84 % over a 16 px blur,
  a hairline on top) holding the shipped ActionButtons at their own word width, side by side from the start — Cancel
  grey (neutral) · Save & add terracotta (`tone="brand" main`). Green is only the Done that closes the services list.
- The send is checked against the server action's 6 MB limit before it leaves, so photo + receipts too big together are
  said in the sheet rather than failing the press.
- Dev lab: `/dev/add-your-own-lab?s=add` draws the add sheet (no session) and answers its save through the same pure
  functions, so the paid → proof → logged walk can be seen without a database.
- Guard: `lib/an-already-paid-line-is-a-logged-payment.test.ts` (the seq/amount truth table, the insert writes only
  columns `logPayment` writes, the proof goes through the private folder, the rows post the tick and mount the shipped
  proof field). `scripts/port-control-baseline.json` regenerated.

### Local verification fixes (same day, builder-verifier against the prototype)

The first cloud build differed from § 1 in five places; each is fixed on this branch and held by the new guard
`lib/the-add-sheet-is-the-approved-drawing.test.ts` (sabotaged twice to prove it fires):

- the thumb row was split into two stretched equal halves (`grid-cols-2` + `w-full`) on an opaque footer → content-width
  pills on a frosted row, as drawn;
- every payment line carried a ✕ row button → the add sheet's payment lines now swipe left to remove with Undo
  ("Swipe a payment left to remove it."), like services and inclusions; the record card's rows are untouched;
- the "Already paid" box was green → ink, as drawn (green is only Done);
- the services list closed on a plain-text "Done ✓" → `PickMenu` gains an opt-in `doneButton` that draws the shipped
  ActionButton `tone="ok"` "Done" with the hint beside it (every other PickMenu is unchanged);
- the three lists were loose rows/boxed inputs, the section labels uppercase eyebrows, and the proof a bare browser file
  input → one lines drawing (`_components/sheet-lines.tsx`: one bordered box, hairlines, a grip column, 48 px lines),
  sentence-case 14 px labels, and `ChosenProofField` gains an opt-in `look="button"` (dashed thumb · "Add payment
  proof" · "optional — screenshot/receipt", then "Replace"); once a file is picked it still shows the shipped legible
  preview (owner 2026-09-20, "too small"), so the same input and the same upload path carry the file.
- Smaller deltas, same pass: the plan's sum line reads as drawn ("2 payments · 1 already paid … ₱ — of ₱ —"), the
  inclusions note counts its lines ("1 line"), and the Done row lives in `website/editor/_components/pick-done-row.tsx` so `pick-menu.tsx`
  stays under the inlined-size cap (`the-dropdown-wears-the-accent.test.ts`).
- `scripts/port-control-baseline.json` regenerated again for the two new component files.

### Controller review fixes (same day)

- **A form page, not a drawer, on a tablet and a computer.** At 820 and 1440, the add sheet was the 440 px drawer
  pinned right, leaving most of the screen dark. `Sheet` now takes an opt-in `page` geometry, declared per surface in
  `SHEET_AT` and held by `sheet-agrees-with-the-nav`. With `page`, from the dock point up the sheet is centred and
  `min(50rem, 100vw − 3.5rem)` wide, which is the drawing's form column. On a phone it is the same bottom sheet. Only
  the add sheet uses it (`page={!edit}`). The record card and every other sheet keep the drawer.
  ⚠ This is a deliberate exception to "every sheet the 440-px right panel" (owner 2026-10-19, `shell-boundary.tsx`),
  taken on the approved makers-match drawing and "always maximize the screen" (owner 2026-10-29). Flagged for the
  owner.
- **The map waits behind the pin.** `AddressPinField` takes an opt-in `mapFolded`. When folded it draws the address
  row, a "Pin on map" press and the hint "The pin follows the address." The press opens Find and the map, and looks up
  the typed address straight away. A pin that is already set opens the map. Only the add sheet folds it; every other
  caller keeps the map open as shipped. The map itself (the 2026-09-20 "Address Pin" ruling) is unchanged.
- **The field shape stays the house template.** The label-left pills with the Required line are the `TypedRow` form
  row. `scripts/lint-field-template.mjs` enforces it: "EVERY TYPED ANSWER IS THE ONE FIELD TEMPLATE", owner
  2026-11-01. The template has no prefix slot, so `+63` stays in the number's placeholder and `₱` comes from
  `TypedRow amount`.
- The dev lab draws the add sheet under the couple tree's `tab` boundary (701), so its 820 and 1440 frames match what
  the Suppliers page shows. The guard gains §5 (page sheet) and §6 (folded map). Both were sabotaged and both fired.
- `lint:no-card`: the page panel (the sheet's own surface) and the empty receipt's dashed slot are each marked
  `no-card-ok` with a reason. The folded hint keeps the address field's shipped hint markup, which
  `the-venues-and-ceremony-time-wait-for-apply` pins; only the words change.

SPEC IMPACT: None — implements the already-logged 2026-11-07 DECISION_LOG row; no corpus file changes.
