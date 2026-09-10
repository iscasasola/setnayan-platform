## 2026-09-10 · fix(proposals): the next step after accepting a quote is on screen

Accepting a formal proposal only shortlists the shop at a price — it is not a
booking. The couple-side accepted state used to say only "Accepted on
<date>" and stop. It now resolves the shop's workspace page (the same
`event_vendors` row `respond_vendor_proposal` upserts) and shows a next-step
line pointing at the shipped Lock control there: "You've accepted. To book
{shop}, ask them to lock — once they confirm, it's booked." The in-chat
proposal card already links to this same page, so it inherits the fix with
no separate change. No new server action, no migration.

SPEC IMPACT: None (implements build-plan session A4; no schema, price or
locked-decision change).
