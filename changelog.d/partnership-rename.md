## 2026-08-05 · refactor(partnerships): the two "sponsored" kinds now say what they mean

Two of the four ways vendors can link to each other were stored under the word
**sponsored** — and that word has nothing to do with anyone paying Setnayan. The
vendor is sponsoring their *partner's service for the couple*: the partner is in
their package at no extra cost, or discounts when booked alongside them.

They are now called **included in package** and **discounted together**.

This is a rename rather than a comment because a comment doesn't travel with the
value. That one word has already sent two separate readers to the same wrong
conclusion — that the marketplace was being reordered by paid advertising. One
of those readings was written up as a finding; the other became a pricing
recommendation that reached you before anyone read the vendor's own screen.
Both cost real time, and the next reader would have paid it again.

Nothing about behaviour changes. No partnership exists yet in production, so
there was nothing to convert.

SPEC IMPACT: DECISION_LOG — corrects the 2026-07-27 ranking-honesty finding,
which read "sponsored" as paid placement.
