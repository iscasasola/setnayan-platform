## 2026-11-12 · feat(quote): a quote follows the guest list — the pax-follow repricer (Piece 1 · PR-2)

Owner, 12 Nov 2026 (DECISION_LOG "Quotation maker pax follows…", "Three quote rulings", "QUOTE MONEY — THREE ANSWERS", "A LOCKED QUOTATION STILL FOLLOWS THE GUEST LIST", "THE QUOTE FOLLOWS EACH SERVICE'S OWN COUNT"): *"it only goes up as their guests go up."*

- **Migration `20271339826198_a_quote_follows_the_guest_list`.** `quote_follow_guest_count(event_id)` (SECURITY DEFINER, no browser grant). Every sent / viewed / accepted quote that is not yet booked and whose lines carry their own per-head rate (`line_items[].basis = 'per_pax'` + `rate_centavos`, written by PR-1) rises to max(the per-service count, `merge_snapshot.min_pax`, the billed pax it carries). It never goes down. Each per-head line becomes max(its amount, rate × billed), and flat lines stay as they are. The rise lands on the auto Final-balance row; paid rows don't change (if the auto row is already paid, a new auto row is added). The same proposal row is updated. On an accepted quote, `event_vendors.total_cost_php` is updated to match. One line, "Quote rose to N pax · +₱X", goes into the conversation. A supplier's `changes_locked` quote still rises. Booked deals are not touched (Piece 2).
- It is called from `tg_events_keep_booking_history` and from statement-level triggers on `guests`, `guest_not_counted_for` and `event_vendor_count_rules`. A fault in the repricer raises a WARNING and never blocks a guest-list write.
- **Count:** the guest list on the event's headcount basis, minus the guests a service leaves out (`guests_not_counted_for_services`). Each service counts its own guests.
- **One pax mechanism:** the trigger `event_vendors_pax_follow_owns_the_count` refuses an added-guest surcharge on a row whose quote already follows the list. `lib/pax.ts` stops proposing one, and `acceptPaxSurcharge` reads the refusal instead of announcing a change.
- **`lib/quote-pax-follow.ts`:** the pure TS mirror of the SQL. The rise line has a card in both chats (`QuoteRoseCard`, `quoteRiseFromLine`). There is nothing to accept.
- **Guest card:** a guest with a `kids` meal gets "Leave out of <service>'s count?" for each booked per-head service. It only acts when the couple taps it.
- `LOCK_REFUSAL_WORDS.quote_locked` → "The supplier marked this quotation final — only your guest count can move the price."

Guards: `tests/db/a-quote-follows-the-guest-list.db.test.ts` (11), `lib/quote-pax-follow.test.ts` (7), `lib/supplier-locks.test.ts` (+1). Each guard was turned red by a sabotage and then restored.

SPEC IMPACT: None
