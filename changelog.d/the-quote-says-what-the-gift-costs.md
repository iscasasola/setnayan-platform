## 2026-09-15 · feat(quote): the Setnayan gift appears while the quote is being written — both halves

Owner 2026-09-09: *"the NUMBER appears on the QUOTE, not the card … the moment a
price exists the exact photo count is known and is the strongest line on it."*
Until now that number existed only on the **sent** quote. A supplier choosing what
to charge could see neither what their price bought the couple, nor — the half that
matters — **what it cost them**.

Owner 2026-09-15, asked whether the composer should show the upside alone:
**"show both."**

So while a supplier types, under the total:

> **Includes your Setnayan gift — your couple gets 1,429 free Papic photos**
> Added to your booking fee bill: ₱1,000. The photos reach your couple's Papic once
> that bill is paid.

It re-prices as the total changes, so the cost of quoting higher is visible *before*
they commit to it. The couple's voice is untouched and still never sees pesos
(owner 2026-09-09) — that asymmetry now lives in one function where it cannot be
half-applied.

**🔑 THE PREVIEW CANNOT DRIFT FROM THE BILL.** The composer runs in the browser
(asking the server per keystroke would make the number lag the field describing it),
so there are now two places computing one fact — precisely the shape that cost this
repo twice in two days. `previewGiftForTotal` therefore calls the SAME
`bookingFeePhp` → `setnayanGiftForFee` pair the server's `quoteSetnayanGift` runs and
the SQL prices the real bill from. `the-quote-preview-is-the-bill.test.ts` walks the
whole fee curve — the ₱3,500 floor, the tier-1 limit, into the taper, past the
50,000-credit cap — and asserts the two agree. Sabotaged with a "close enough" ×0.05
estimate: red.

**Mounted in BOTH composers, which is the point.** Measured on `origin/main`: every
deep link in the product (the clients action bar, the chat info rail) points at
`#send-proposal`; `#build-quote` — the fuller `ProposalMaker` — has **zero inbound
links anywhere in the repo**. Mounting only there would have made this invisible to
every supplier who followed a Quote button. `send-proposal-card.tsx`'s price input
becomes controlled so it can re-price too; it still posts `total_php` unchanged.

**Eligibility is not relaxed by moving the arithmetic.** `giftQuoteBasis` applies
every condition `quoteSetnayanGift` does, in the same order and the same direction —
the fee flag, `setnayan_gift_quote_applies` (the card's yes, a Setnayan-sourced
client, outside the first five free bookings), a readable ladder. Any doubt returns
null and the composer says **nothing** — never "0 photos", which advertises an
absence. What crosses to the browser is only the owner-set fee schedule and the
public retail ladder; the one per-account fact is consumed server-side and leaves
only as the presence or absence of the object.

**🔴 AND A DEAD HELPER IS RETIRED, NOT LEFT BESIDE ITS REPLACEMENT.** `giftQuoteLine`
shipped in `lib/setnayan-gift.ts` with a `'supplier'` branch, a passing test, and
**no importer but that test** — while the sent-quote page rendered its own inline
duplicate. The guard faced the corpse; the live copy was unguarded. Adding a third at
compose time would have made it three. `giftQuoteCopy` now serves all three surfaces
and `giftQuoteLine` is deleted.

**An existing guard was repinned, not weakened.** `the-gift-reaches-the-couple.test.ts`
matched the page's inline template literals character for character; with the copy
moved, those patterns could only ever fail, and "making it pass" would have meant
re-typing a third copy. It now asserts the page renders the shared copy for the right
audience, and **executes** `giftQuoteCopy` to inspect the couple's words rather than
grepping for them — strictly stronger. Sabotage-verified both ways: a money leak to
the couple goes red, and so does a re-typed sentence on the page.

⚠ **This path has never run in production.** Measured 2026-09-15: 0 proposals, 0
services with the gift switched on, 0 booking-fee charges, 0 ledger rows —
`NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE` is deliberately unset pending KYC. So the EMPTY
state is the normal state today, and that is the state the composer is designed for:
it renders nothing at all until a booking will really be billed.

Verified: 15,744 unit tests pass · typecheck clean · 31 CI lint guards green · every
new guard sabotage-verified with occurrence counts printed before and after.

SPEC IMPACT: `DECISION_LOG.md` — the 2026-09-15 "show both" ruling on the composer.
