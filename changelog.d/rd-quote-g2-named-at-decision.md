## 2026-09-22 · fix(quote): the couple is told the gift at the moment of decision, not after

⚖ Restores a locked ruling — owner 2026-09-09: *"the NUMBER appears on the QUOTE … a gift named
at the moment of decision closes; a gift revealed after booking is only a thank-you."*
Not a new decision: the product was shipping the thank-you.

**The defect, measured on `origin/main` (a throwaway db-test on the replayed schema, run and
deleted):**

```
quote status=sent    switch=ON card=OFF → setnayan_gift_offered_on=false → arm card_says_no
quote status=viewed  switch=ON card=OFF → setnayan_gift_offered_on=false → arm card_says_no
quote status=accepted switch=ON card=OFF → setnayan_gift_offered_on=TRUE
```

The per-quote switch (20271240324859) is read by SQL only once a quote is **accepted** — correct
for the BILL, which must follow what the couple agreed to. But the couple's quote page asked that
same question, so a supplier who switched the gift on read *"Includes your Setnayan gift — N free
Papic photos"* on their own screen, sent it, and the couple deciding on that quote saw **nothing**.
Two screens, one quote, opposite answers, neither erroring.

**One rule, both screens.** They disagreed because they were two mechanisms for one fact. Both now
run the same pure pair, in the same order, with no third spelling anywhere:

    standingForGiftArm(arm, basis) → standingForQuoteSwitch(…, quoteSwitch) → giftBasisFrom(…)

- `quoteSetnayanGift` takes the quote's own `quoteSwitch`, keeps the `card_says_no` arm alive long
  enough to be switched (one extra ladder read on that arm only), and gates the promise on the
  unchanged `giftBasisFrom` contract.
- `app/proposals/[publicId]/page.tsx` selects `includes_setnayan_gift`, types it, and passes it.
- `sendProposalCore` — the saved-template composer in the same panel — now writes the column too.
  One panel had two composers and only one carried the supplier's answer. `null` stays the honest
  default on both paths: a composer that never rendered a switch has made no decision, and writing
  `false` would retract a gift the card actively promises.
- ⛔ A switch still cannot conjure a gift out of a waived fee, an imported client or an unreadable
  ladder — those arms are returned untouched. No price or photo count is written down anywhere,
  including in the tests.

**Proof.** `lib/the-quote-promises-what-the-supplier-was-shown.test.ts` — 9 subtests, including the
whole arm × switch matrix (5 × 3) executed as one table, and source pins that each surface runs the
shared pair rather than re-implementing the arm move. Sabotages watched RED: the old
`applies !== 'applies'` early return restored (the couple goes silent again) · the switch made to
promise from any arm · the page ceasing to pass its own switch · the template path ceasing to write
the column · the basis gate removed · the arm filter removed.

⚠ **One existing guard fired and was re-pointed, not weakened — and it is the interesting one.**
`the-gift-reaches-the-couple.test.ts` pinned the literal `if (applies !== 'applies') return null;`
— the very line this fix must delete, because that line *was* the defect. Its property ("a gift
that will not be carried must resolve to null") is unchanged, now holds in two places, and **both
are asserted**: one assertion became two, and each was sabotaged red on its own. The property is
also executed, not merely grepped, by the matrix above.

🔎 **Found and NOT widened into this slice:** `giftQuoteBasis` in `lib/setnayan-gift.server.ts` has
no live caller (the thread page moved to `resolvePapicQuoteStanding` + `giftBasisFrom` on
2026-09-20) and still carries the OLD eligibility shape beside the new one. Two guards reference it
only to assert it is *not* called. Reported for separate removal — precedent: `giftQuoteLine`.

**Not done here, and why:** carrying the switch through "Update this quote" needs
`QuoteRevisionSource`/`QuoteRevisionSeed` *and* the two files this session is barred from
(`messages/[threadId]/page.tsx` selects the revision source; `proposal-maker.tsx` would open the
switch at it). Reported to the controller rather than half-built; a revision therefore still resets
the gift to the card's answer.

SPEC IMPACT: None — restores the 2026-09-09 lock. No migration, no SKU, no price, no frame file.
