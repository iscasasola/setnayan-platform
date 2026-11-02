## 2026-09-22 · style(quote): the Papic line reads as a row, not seven sentences

The approved prototype (`prototypes/quote_maker_FINAL_2026-09-22.html`) draws this as a ROW —
label · value — and the kit's rule is one title plus at most one status line, headings of 1–3 words,
no paragraphs. The seven `papicTopUpForQuote` headlines were full sentences.

Each now opens with the same label and carries its value:

| arm | was | now |
|---|---|---|
| included | *That is the most Papic this booking can carry.* | `Papic deal · on — that is the most this booking can carry.` |
| available, no total | *You can add an exclusive Papic deal to this quote.* | `Papic deal · off — put your price in to size it.` |
| available, too small | *This quote is too small to carry a Papic deal.* | `Papic deal · off — this quote is too small to carry one.` |
| available, priced | *You can add up to N free Papic photos for your couple — ₱X on top of your booking fee.* | `Papic deal · off — up to N free photos, ₱X on your fee.` |
| free_booking / not_sourced | *No Papic deal on this booking — and nothing to pay.* | `Papic deal · none — and nothing to pay.` |
| unreadable | *We could not work out the Papic you can add to this booking.* | `Papic deal — we could not work it out just now.` |

**Copy only. Every fact the guards pin survived, and they were the design constraint, not an
afterthought:** the priced arm still prints the gift's own charge with its centavos intact
(`₱[\d,]+\.\d{2}` — a fee-sized figure is never rounded); the waived and not-sourced arms still carry
no `₱` and no photo count; the unreadable arm still matches `/could not/i` and prints no digits; the
nothing-typed arm still refuses to say `₱0`. 15 of 15 subtests green, unchanged.

⚠ **This is the headline trim, NOT the full row the prototype draws, and the difference is worth
stating.** A true label-on-the-left, value-on-the-right row lives in `app/_components/booking-fee-notice.tsx`,
which renders `{headline, detail, cta}` as a note block — and that component is SHARED with the
booking-fee line whose copy the owner approved in #5737. Reshaping it would silently restyle that
line too, and its sentences ("Booking fee ₱1,787.50 (5.0%) — payable if they book.") are deliberate.
That is a separate decision about a shared component, not part of trimming seven strings.

⚠ **`VENDOR_SERVICE_CARDS_PATH` is deliberately NOT deleted.** It is the name
`the-exclusive-papic-on-a-quote.test.ts` uses to assert the door no longer points at the service-card
page; removing it would force that assertion to re-spell the old path as a string literal.

SPEC IMPACT: None — copy only, no behaviour change, no frame file.
