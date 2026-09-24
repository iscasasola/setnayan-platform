## 2026-09-23 · style(fee): the booking-fee notice is a row, not a stack

Owner ruled build it. `BookingFeeNotice` shipped as an icon beside three stacked paragraphs; it is now
a row — one left cell that stacks the sentence over its sub-line, the value on the right.

**Seven mounts across five files inherit it, and no mount site changed.** Only the component moved:
`lock-answer-forms` · `proposal-maker` (×2) · `overview-sections` · `clients/[eventId]/page` ·
`send-proposal-card` (×2). The composers mount the shape twice — the fee, and the Papic deal beside it.

⚠ **THE THREE IMPORTERS THAT TAKE ONLY `BookingFeeBills` / `WaivedFeeRows` DO NOT MOVE**, by
construction: those exports were not touched. The supplier's dashboard home is one of them.

🛑 **THE PROTOTYPE DOES NOT DRAW THIS AS LABEL-LEFT / VALUE-RIGHT, AND THAT CHANGED THE JOB.** In
`quote_maker_FINAL_2026-09-22.html` the *money lines* are label/value (`<span class="v">`); the fee row
is a full-width stacked left cell with **no `.v` at all**, and the #5737 sentence sits in it verbatim:

```html
<div class="row"><span class="l">
  <span>Booking fee ₱1,787.50 (5.0%) — payable if they book.</span>
  <span class="s">Your 1st paid booking. 5% up to ₱100,000, then 1%, on the agreed total of ₱35,750.</span>
</span></div>
```

**Building cells would have meant splitting that sentence** — 12 headline arms in
`booking-fee-disclosure.ts` plus 7 in `papic-on-a-quote.ts` — **and the sentence is the owner's
approved wording.** The component's own docblock says every word is decided one layer below "so a
surface cannot quietly reword the money"; parsing a headline in here to find a value is the defect that
file exists to prevent. **So the row is built AROUND the string, not out of it: zero copy changed, zero
arms touched.** Where a `cta` exists it becomes the right-hand cell — the only value this component
actually has.

⚖ **THE TONE ICON IS KEPT — OWNER DECISION, 2026-09-23, NOT A BUILD CHOICE.** The approved prototype
draws this row with **no icon** and signals tone with colour alone. Asked directly, the owner said keep
it. **The reason is recorded here so the next session reading the prototype beside the code does not
"fix" the discrepancy back:** the icon is the only **non-colour** cue separating `overdue` from `info`,
colour alone fails anyone who cannot distinguish it, and this is money. **A divergence from an approved
artifact needs its reason attached or it reads as drift.**

✅ **And the icon does NOT break the prototype's rhythm — checked, not assumed.** The concern would be
that a 16px icon pushes the fee row's text right of the `Total` / `Net payable` lines above it in the
composer. It does not matter, because the prototype puts the fee row in its **own** `rows` container,
separate from the money one:

```html
<div class="rows"> …Subtotal · Discount · Total… </div>   ← money lines
<div class="rows"> …Booking fee… · …Papic deal… </div>    ← a SEPARATE bordered block
```

The fee row was never in the money lines' rhythm, so there is no alignment to break.

**Every assertion in the guard is a POSITION, not a presence.** A row and the stack it replaces contain
the same three things, so "does it render the headline, the detail and the link" is true of both and
passes on the defect. The sharpest one: **the link must be a SIBLING of the text cell, never a child** —
in the stack it was a child, with all three strings still on screen.

**Four sabotages watched red:** link back inside the text cell · `ml-auto` dropped · `min-w-0` dropped ·
headline and detail unwrapped.

✅ **The two existing guards needed NO re-pointing, measured rather than assumed.**
`the-fee-finds-the-supplier` asserts `vendorBookingFeePayPath(bill.orderId)`, which lives in
`BookingFeeBillRow` and is untouched; `the-exclusive-papic-on-a-quote` asserts `data-testid={testId}`,
which the row keeps. Both already assert properties, not markup.

SPEC IMPACT: None — layout only. No copy, no money, no behaviour.
