## 2026-11-13 · fix(supplier+couple): W1 walk booking round — the Portfolio address, the delivered box

- **F-W1-64** `/vendor-dashboard/portfolio` (a 404) now goes to the Portfolio, `/vendor-dashboard/collections`
  (next.config redirect, exact source).
- **F-W1-72** The couple's "Also mark this supplier delivered" starts UNTICKED and is offered only once the event's day
  has passed (a refused or empty date read offers nothing). It was pre-ticked 179 days early with ₱0 paid.
- **F-W1-70** The couple's Suppliers row read a booking as "booked" only from a schedule-pool hold; an in-app booking
  (quote → ask → agree) is `contracted` with no hold, so the row stayed an inquiry ("Sent today"). The booking row's
  own `contracted` / `deposit_paid` status now counts as booked.
- **F-W1-65** Not a code bug: "Booked" on Today counts booked events DATED this Manila month (owner Q2 default; the
  full row says "this month"). The walk's booking is May 2027, so November reads 0.
- **F-W1-71** The couple's handover (an album, a link, a sign-off) and its Confirm receipt move from the picked
  supplier's Payment page to its **Files** page, and the "delivered your handover" notice and the event Home's handover
  link now open Files. Drawn once, not twice.
- **F-W1-67 / F-W1-73** A tab switch on the picked screen (the supplier's client card and the couple's supplier
  workspace — one shared shell) now writes `?tab=` with a `null` history state, so Next's router adopts the address.
  It used to pass the router's own state, which Next lets through without telling the router, so the next refresh
  (a chat poll, a save) wrote the old `?tab=` back and a reload opened the wrong page.
- **F-W1-69** "Send link" (and the other handover forms) answers each press once: a second press while the first is
  still sending is ignored, and a save that lands says "Handover sent — the couple will confirm receipt." under the
  form (`StayForm sayNote`, the door's own news line). A press that stays on the page never reached the page's
  `?handover=sent` banner, so a successful send said nothing.
- **F-W1-68** (owner 13 Nov 2026: "until first payment is completed" — the date is still held only once the first payment
  is in, ruling 5 kept). An agreed but unpaid booking no longer reads "Asking" on the supplier's calendar and schedule:
  the open-asks reader marks an ask `agreed` when the shop's own booking row is `contracted` / `deposit_paid`, and the
  day shows it as **Booked · Date held once the first payment is in** (a Booked dot, never counted as asking or toward
  "Holding this date"). "Run of show · Live" is unchanged (owner: "Live").

SPEC IMPACT: None.
