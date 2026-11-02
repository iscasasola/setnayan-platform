## 2026-09-20 · feat(quote): the maximum exclusive Papic deal, beside the booking fee

⚖ OWNER, 2026-09-20, verbatim: *"When they create a quote, similar to service cards, they get to
see the booking fee for that, and the maximum additional papic service they can also purchase on
top to offer that exclusive deal."*

**Stacked on #5737 (`claude/fee-finds-the-supplier`)**, which shipped the fee half the same day.
This is the Papic half, built ON TOP of it — no second quoter, no second fee sentence.

### What already existed (RULE 0 — nothing here is new product)

The "additional papic service they can purchase on top to offer that exclusive deal" is the
**SETNAYAN GIFT**, owner-locked 2026-09-09: free Papic photos for the couple, sized at
`GIFT_SHARE_OF_FEE_PCT` (40%) of the booking fee, capped at `GIFT_CAP_CREDITS` (50,000), priced off
the live `platform_retail_catalog_v2` ladder and billed to the supplier on top of the fee
(`lib/setnayan-gift.ts`, SQL `setnayan_gift_for_fee`, migration `20271222508050`). It was already
shown in both quote composers.

### What was broken

`giftQuoteBasis` collapses FOUR distinct database answers — `card_says_no`, `free_booking`,
`not_sourced`, `no_booking` — into one `null`, and `null` renders nothing. Right for the PROMISE
(never quote a couple photos the bill will not carry); wrong for the supplier's question, *"how much
CAN I add?"*

Measured on production 2026-09-20: `select count(*), count(*) filter (where
includes_setnayan_gift) from vendor_services` → **2 services, 0 with the gift on**. So on every
quote written in production so far, the composer has said **nothing at all** about Papic — the
supplier was never told the exclusive deal exists, what its ceiling is, or where its switch lives.

### What this adds

- `apps/web/lib/papic-on-a-quote.ts` — PURE. `standingForGiftArm` (the arm→standing decision,
  executable because the server file cannot be imported) and `papicTopUpForQuote` (the copy). Six
  standings, each with a true sentence: **included** (qualifies the gift block as the ceiling, and
  prints no second copy of its number), **available** (the maximum — *"You can add up to N free
  Papic photos for your couple — ₱X on top of your booking fee"* — plus the door to the switch),
  **free_booking**, **not_sourced**, **unreadable**, **silent**.
- `apps/web/lib/papic-on-a-quote.server.ts` — the two reads, and nothing else.
- `giftLadderIsPriceable` exported from `lib/setnayan-gift.ts` and used by `setnayanGiftForFee`, so
  an UNPRICEABLE catalogue (no 50,000 rung) is `unreadable` and never explained to the supplier as
  *"your quote is too small"*.
- Both quote surfaces (`ProposalMaker`, `SendProposalCard`) now carry BOTH lines under the total.
- `BookingFeeNotice` takes a `testId`, so two rows of one shape can be counted per LINE.
- The thread page asks `setnayan_gift_quote_applies` **once** and derives the gift basis from that
  same answer (`giftBasisFrom`) instead of asking twice.

### Every number's source

| Number | Source |
|---|---|
| The booking fee | `bookingFeePhp` under the live `getBookingFeeSchedule` (#5737's `bookingFeeForecast`) |
| The maximum photos + its charge | `previewGiftForTotal` = `bookingFeePhp` → `setnayanGiftForFee`, byte for byte what SQL `setnayan_gift_for_fee` bills |
| 40% | `GIFT_SHARE_OF_FEE_PCT` |
| 50,000 | `GIFT_CAP_CREDITS`, priced off the live `PAPIC_GUEST_50K` rung (₱15,000 on 2026-09-20) |
| The free-five position | `booking_fee_ledger.booking_ordinal`, via #5737 |

No local rate, no default, no literal. A read that fails prints **no number** and says so.

### Purchase path — deliberately NOT half-built

There is no new payment here. The gift is already purchased by the existing mechanism: the SQL
trigger `booking_fee_charges_size_the_gift` adds it to the supplier's booking-fee bill when the
lock charge opens, and `booking_fee_grant_setnayan_gift` grants the photos to the couple when that
bill is paid. The only thing a supplier must DO is switch the deal on for the service card, so the
line carries a link to `/vendor-dashboard/services`. An in-quote, per-quote purchase would need a
new per-booking switch and is left as an owner decision (see the PR body).

### Both ends

The ceiling is supplier-only and guarded as such: no `app/dashboard/**` or `app/proposals/**`
surface may import it. The couple is still promised photos ONLY when the bill will carry them —
`giftBasisFrom` yields a basis for `'applies'` and for nothing else, which is exactly
`giftQuoteBasis`'s old contract, now executed rather than asserted.

### Guards

`apps/web/lib/the-exclusive-papic-on-a-quote.test.ts` — 11 tests, all mutation-proven RED:
the quoter across paid/free/read-failure/catalogue-missing/nothing-typed; no invented number; every
arm the SQL returns plus one it cannot yet; the gate not relaxed; both mounts counted per surface
and per line; both ends. `the-gift-is-on-the-quote-being-written.test.ts` re-pinned to the new
symbol (same strictness — sabotage-proven).

SPEC IMPACT: `DECISION_LOG.md` — 2026-09-20 row recording the ruling and that the "additional papic
service" is the existing Setnayan gift, not a new product.
