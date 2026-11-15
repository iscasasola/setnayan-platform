## 2026-11-16 · fix(supplier): Today's "Booked · events this month" opens Clients on the same number (EB-219)

Owner, DECISION_LOG `75a46e3c` (16 Nov, item 9, "a"): Supplier Today's "Booked · this month" opens Clients **filtered to
this month**, with "All months" one tap away. The every-button walk (EB-219) found Today saying "0 booked this month"
while the door it opened said "6 booked". The two counted different things: Clients' Booked counts every date, plus
the bookings from outside Setnayan.

- **One number:** `lib/booked-this-month.ts` (`bookedThisMonthCount`) now defines it: distinct Setnayan bookings dated in
  this Manila month. A read that fell short gives `null` ("couldn't load"), never 0. Today's stat
  (`lib/vendor-overview.ts`) and Clients both print it over the same read (`fetchVendorRoomEventsDetailed`). Today's
  figure itself is unchanged.
- **Clients `?door=booked&within=month`** (Today's link): the Booked tile reads "N booked this month", and so does the
  pinned count. The list shows that month's events from every lane, so an event earlier in the month that is already
  Done is still listed. Outside bookings are not in the month view, because Today does not count them; they stay
  under All months. A `This month ▾ / All months` dropdown sits over Booked. It is the shared `LinkPickMenu`, per the
  one-dropdown rule. The extra read runs only when the month filter is asked for.
- **Guard:** `app/vendor-dashboard/customers/booked-this-month-is-one-number.test.ts`. Three sabotages each turn it red:
  Today's link back to `?door=booked`, the tile printing its own lanes, and a short read counting 0.

No server actions, no migration. SPEC IMPACT: None. The DECISION_LOG row already records the ruling.
