## 2026-11-12 · feat(booking-fee): a top-up is held until the event day — the six top-up rules

Owner, 12 Nov 2026 (DECISION_LOG "💸 BOOKING-FEE TOP-UP — SIX RULES", "Yes, use your picks"; prototype specs
`Build_Booking_Fee_Hold_2026-11-12/booking-fee-hold.html`). When a booked quote rises, the supplier's booking fee grows
by a top-up — the `amendment_delta` the shipped re-derive already mints. This changes only WHEN it is owed and what
each surface says. Nothing new is priced; every figure is the charge row's own.

- **Rule 1 · due on the event day.** Migration `20271340632149_a_top_up_is_held_until_the_event_day.sql`:
  `booking_fee_rederive_lock_fee` stamps the top-up's `expires_at` at noon Manila on `events.event_date` (never in the
  past; no date → the shipped 7 days). Bills read "Due today" on the day and "overdue" from the day after.
- **Rule 4 · held, not owed, before then.** `vendor_event_fee_gate_stage` (SQL) and `eventAccessUnlocked` (TS,
  reason `top_up_held`) ignore a pending top-up through its due day. From the day after, the shipped lock applies, with
  the prototype's words "Settle ₱X booking fee to open this". The carry-over — an OVERDUE top-up stops a new
  booking's yes — is refused in `vendorAgreeToLock` (`lock_agree=top_up_owed`) and drawn on the booking ask as
  "Settle ₱X to accept" with one sheet (`top-up-carry-over.tsx`).
- **Rule 2 · settle early.** The bill rows and the pay page read "Settle early" before the event day.
- **Rule 3 · a free first booking stays free** — unchanged (`free_noop`), now pinned by a DB test.
- **Rule 5 · no email.** The fee sweep that emails a due bill (`order_quoted`) drops top-up orders; the supplier is
  told by the chat pin and Today's `booking_fee_overdue` blocker, which already fire only once a bill is overdue.
- **Rule 6 · a drop shows no credit** — unchanged SQL; a guard pins that no app/lib file reads `amendment_credit`.
- After the event day, unsettled: the supplier's message box keeps words only (`ChatSendForm` `wordsOnly`, refused
  server-side as `fee_words_only`) — the chat page still never reads the event gate; the event's Papic album in the
  portfolio is greyed under "Unlisted and uncounted until the top-up is settled · Settle ›".

Tests: `tests/db/a-top-up-is-held-until-the-event-day.db.test.ts` (12, replayed SQL) · `lib/booking-fee-top-up.test.ts` (12).

SPEC IMPACT: None — implements the 2026-11-12 DECISION_LOG row as written. Not built (flagged on the PR): the PUBLIC
side of "unlisted and uncounted" (the shop page's photos from that event and its review in the rating), and opening
the guest-list repricer to BOOKED quotes (`quote_follow_guest_count` still skips `deal_locked`).
