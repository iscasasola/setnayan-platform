## 2026-11-22 · feat(supplier): Details shows "Your booking" — the supplier's own booking money, not the hosts' budget

Owner, 21 Nov (DECISION_LOG "SUPPLIER EVENT DETAILS — 'Budget' = their own booking money only"): *"the quotation,
payment plan, status"*.

- **Where "Budget" stood on a booked client's Details, the card is now "Your booking"** — view only, for THIS booking:
  Price · Paid · Left, the next payment with its status (Due · Was due · Waiting for you · All paid), what the agreed
  quotation covers, and one door, **Open payments**, to the shipped Book & Budget page (plan, actions).
- **No second computation.** Every figure is `clientPaymentView`'s — the same fold the Payment page and the couple's
  Pay sheet read (`lib/your-booking.ts`). A figure nobody measured is "—" and said; never ₱0, never "All paid" with
  no amount set.
- **The hosts' plan is not on this card (this build).** Details no longer draws the hosts' range, and the old
  "Not shared — the couple hasn't opted into budget sharing" hint is gone. The owner's 21 Nov correction ("YES THAT
  ONE", specs edeb9284) allows the hosts' planned amount while their share switch is on, view only — putting it back
  on Details behind that switch is a follow-up; the chat's first-inquiry card keeps it as it is. Before a booking there is no booking money, so there is no card in that place.
- No migration, no new server action, no new read (the page already had every input).
- Lab: `/dev/customer-money-lab?booking=1&s=due|waiting|received|noplan|unread`.
- Tests: `lib/your-booking.test.ts` (5).

Not in this PR (the 21 Nov drawing's other parts): Remind the hosts once a day (needs the once-a-day rule in the
database — #8094 carries the coordinator's), Change due date and Ask in chat on this card, To talk about · Your
parts · New for you. Left as shipped and NOT touched here: the first-inquiry card still lists the hosts' range while
their per-event switch (`events.share_budget_band`) is on.

SPEC IMPACT: None — builds the 21 Nov DECISION_LOG rows as written.

**Ship controller (22 Nov):** a plan read cut short (bookings, plans or payments refused) now reaches the fold as unread, so "Your booking" and the chat strip say "couldn’t load" instead of "Paid ₱0" with the whole price as Left. Guarded in `lib/your-booking.test.ts` (sabotage-checked).
