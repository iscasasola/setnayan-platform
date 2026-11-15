## 2026-11-12 · feat(quote): a booked quote follows the guest list too — Piece 2

Owner, 12 Nov 2026 ("A LOCKED QUOTATION STILL FOLLOWS THE GUEST LIST"; recommendation 3 approved the same day).
`20271339826198` made a not-yet-booked quote rise with the guest list and `20271340566104` made an unlocked one fall
back too; both skipped BOOKED deals, because a booked change moves `event_vendors.total_cost_php` and the supplier's
booking-fee top-up would have been billed at once. The top-up is now HELD until the event day (`20271340632149`), so
migration `20271341557835_a_booked_quote_follows_the_guest_list.sql` retires the skip: a booked deal (contracted ·
deposit_paid) is repriced like a supplier-LOCKED quote — it rises with the list and never falls — and its booking
total follows; a delivered or complete job never moves. TS mirror `lib/quote-pax-follow.ts` (`booked` = locked).

Pre-ship audit fix: `vendor_requote_blocker` calls a delivered/complete job 'deal_locked' too, so the loop still
repriced its proposal (lines, total, Final installment, chat line) while only `event_vendors` was fenced. The loop now
skips a proposal whose anchor booking is `delivered` or `complete` outright; the 🏁 db test asserts the whole proposal
and the chat stay unchanged.

Stacked on the booking-fee top-up PR — it must merge after it.

SPEC IMPACT: None — implements the 2026-11-12 ruling as written ("it really depends if the supplier already locked
the price": a booking is the supplier's yes on the price, so a booked quote never falls).
