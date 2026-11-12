## 2026-11-12 · feat(quote): when a guest is removed, an unlocked quote falls back (Piece 1 · PR-2 follow-up)

Owner, 12 Nov 2026 (DECISION_LOG "WHEN A GUEST IS REMOVED, THE PRICE FALLS BACK — UNLESS THE SUPPLIER LOCKED IT"): *"if the price is paid, then it stays, meaning that price is already agreed upon, it really depends if the supplier already locked the price."*

- **Migration `20271340566104_a_quote_falls_back_with_the_guest_list`** extends the shipped repricer `quote_follow_guest_count` (#7516) in both directions:
  - **Unlocked** (`vendor_proposals.changes_locked` false): it follows the list down as well as up. billed = max(the per-service count, `merge_snapshot.min_pax`, the pax the quote was first SENT at). The sent pax is the shipped floor (`billed_pax` as the quote maker wrote it). The repricer now keeps it as `sent_billed_pax` because it rewrites `billed_pax`. Each per-head line becomes max(its sent amount, rate × billed). A line keeps `sent_amount_centavos` and `sent_detail` from the first time it moves, so a line quoted above rate × pax is never cut below what was sent.
  - **Locked:** it still rises but never falls. The locked price is the floor.
  - **Paid never changes.** A drop comes off the unpaid AUTO Final-balance row(s), latest first. An auto row that reaches ₱0 is removed from the plan. The drop is capped at what is still unsettled (the unpaid auto rows, and never below what has been paid on the booking). If the full drop would go past that, the quote falls only as far as whole guests fit under the cap. No refund, no credit.
  - **Booked deals** stay untouched, as for the rise.
  - One line goes into the conversation: "Quote fell to N pax · −₱X" (`quote_fall_words`). On an accepted quote, `event_vendors.total_cost_php` / `pax_quote_base` follow.
  - New: ticking a guest "Not counted for ▾" (INSERT on `guest_not_counted_for`) now moves the quote too, since it can lower it.
  - New SQL helper `quote_follow_lines(lines, billed, can_fall)`, used for both directions (no browser grant).
- **`lib/quote-pax-follow.ts`:** the TS mirror (`followLines`, `followGuestCount` now returns `rose` / `fell`, `quoteFallWords`). **Chat:** `quoteFallFromLine` + `streamLineKind → 'fall'` + `QuoteFellCard` ("Quote fell · Now N pax · −₱X"). The couple reads "<Shop>'s quote follows your guest list. The drop comes off the Final balance — what you have paid stays as it is. Nothing to accept." The supplier reads "Their guest list shrank, so the per-guest lines followed it. The drop comes off the Final balance — paid payments stay as they are."
- **Lab:** `/dev/chat-cards-c-lab?m=fell` (both chats) · `?m=drop` (the supplier's payment plan before/after). Shots are in `build-notes/shots/pax-fall/`.

⚠ A quote that already ROSE before this migration has no `sent_billed_pax`. Its current `billed_pax` and current line amounts become its floor, so it never falls: the pax it was sent at is never guessed.

Guards: `tests/db/a-quote-follows-the-guest-list.db.test.ts` (+8, and the old "never down" case is rewritten to "falls back to what was sent") and `lib/quote-pax-follow.test.ts` (+9).

SPEC IMPACT: None. The ruling is already in DECISION_LOG 2026-11-12. This PR builds it.
