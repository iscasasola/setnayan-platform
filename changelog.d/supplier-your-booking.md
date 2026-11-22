## 2026-11-22 · feat(supplier): Details shows "Your booking" — the supplier's own booking money, not the hosts' budget

Owner, 21 Nov (DECISION_LOG "SUPPLIER EVENT DETAILS — 'Budget' = their own booking money only", and the same day's
"hosts MAY share their planned amount"): *"the quotation, payment plan, status"*.

- **Where "Budget" stood on a booked client's Details, the card is now "Your booking"** — view only, for THIS booking:
  Price · Paid · Left, the next payment with its status (Due · Was due · Waiting for you · All paid), what the agreed
  quotation covers, and one door, **Open payments**, to the shipped Book & Budget page (plan, actions).
- **No second computation.** Every figure is `clientPaymentView`'s — the same fold the Payment page and the couple's
  Pay sheet read (`lib/your-booking.ts`). A figure nobody measured is "—" and said; never ₱0, never "All paid" with
  no amount set.
- **The hosts' planned amount is private unless the hosts share it.** It is one line ("Hosts' planned amount", a range)
  drawn only while their own switch is on (`events.share_budget_band`, shipped, off by default, hosts only). Off draws
  nothing — the old "Not shared — the couple hasn't opted into budget sharing" hint is gone.
- Before a booking there is no booking money: only that shared line, when the hosts share it.
- No migration, no new server action, no new read (the page already had every input).
- Lab: `/dev/customer-money-lab?booking=1&s=due|waiting|received|noplan|unread[&shared=1]`.
- Tests: `lib/your-booking.test.ts` (5).

Not in this PR (the 21 Nov drawing's other parts): Remind the hosts once a day (needs the once-a-day rule in the
database — #8094 carries the coordinator's), Change due date and Ask in chat on this card, the per-supplier share
switch (today's switch is per event), To talk about · Your parts · New for you.

SPEC IMPACT: None — builds the 21 Nov DECISION_LOG rows as written.
