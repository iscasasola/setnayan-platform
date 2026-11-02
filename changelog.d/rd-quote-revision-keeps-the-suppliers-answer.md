## 2026-09-22 · fix(quote): "Update this quote" no longer discards the supplier's own gift answer

`vendor_proposals.includes_setnayan_gift` was **written on send and never asked for again.** Reopening
a quote to revise it reset the Setnayan-gift switch to the CARD's answer, throwing away a decision the
supplier had already made and priced. Nothing errored. Same disease as the send-path fix that preceded
it: a decision is made, the product quietly discards it.

**It was discarded at three layers, and the deepest one decides the shape of the fix:**

| layer | before |
|---|---|
| the query | the live-quote select listed 10 columns; the gift column was not one of them |
| the seed | `quote-revision-seed.ts` contained the string `gift` zero times |
| the builder | `giftSwitch` opened at `defaultQuoteSwitch(...)` — the card |

⚠ **A UI-only fix would have shipped green and still lost the answer**, because the value never
reached the page. That is why this touches the query, not just the component.

**What made it a defect rather than a preference:** every other field in that builder seeds from the
revision — open, stage, items, discount, installments, auto-balance, methods, validUntil, title, note.
**Ten seed; one did not.** A field nobody carried might be a choice. The single hole in an otherwise
complete wall is an omission.

**The order of the two questions is the whole point** (`openingGiftSwitch` in `lib/papic-on-a-quote.ts`):
the CURRENT booking decides whether there is a switch at all, and only then does the replaced quote set
its value. A naive pass-through resurrects a gift on a booking that has since gone waived, imported or
unreadable — failing in the direction that costs the supplier money. With no revision the function
returns the cards' answer unchanged, so a first-draft quote behaves exactly as before.

`NULL` in the column means "that quote expressed no opinion" — the column is nullable by design — so
falling through to the cards is correct, not lazy.

**Layer 1 is EXECUTED, not grepped.** The read lives in a server component that no unit test can import,
so the column list moved into `QUOTE_REVISION_SELECT`, a pure constant. The test then records which keys
`seedQuoteRevision` actually touches, via a Proxy, and requires the select to cover every one — so a
future field cannot be added to the seed and forgotten in the query, which is precisely how this was
lost. No second hand-written column list to rot against the first.

**Three sabotages watched red, one per layer:** reverting the builder to the cards alone · dropping the
column from the select · answering the old quote before asking whether the booking offers a switch.

**Two existing guards were re-pointed, neither weakened, and each re-proved against the defect it was
built for:**

- `the-gift-switch-reaches-the-bill.test.ts` required the literal spelling
  `useState<boolean | null>(() => defaultQuoteSwitch(`. The property — the switch opens at what the
  BOOKING says — is unchanged; `defaultQuoteSwitch` is simply an argument now. Re-pointed to the
  giftSwitch **initializer window** rather than the whole file, which is stronger: the old regex would
  also have been satisfied by a mention anywhere below it. Re-proved by opening the switch at a
  constant → red.
- `amount-to-pay.test.ts` grepped a 400-byte window of the page for `payment_schedule`. Re-pointed to
  **execute `QUOTE_REVISION_SELECT`**, plus an assertion that the page still reads with it. Stronger
  again: a byte window can pass because some unrelated part of the query fell inside it. Re-proved by
  dropping `payment_schedule` from the select → red.

🔑 **Both were anchor rot, not broken behaviour** — the property held and only the evidence moved. The
tell was that the code they guard was correct in both cases.

SPEC IMPACT: None — restores a decision the supplier already makes; no new price, no new copy, no migration.
