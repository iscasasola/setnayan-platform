## 2026-11-16 · fix(supplier): the Clients calendar's key says what green means (EB-231)

The every-button walk (EB-231) found the Dates tour saying *"Green is booked here"* over a month where 16 Nov → December
were all green and day 16 opened "Free · nothing on this day". The calendar was right. Under the owner's 2026-11-14
ruling (CLIENTS-CAL, "only the colour coding changes"), a day's FILL shows whether it can still take a booking:
seat green if it can, outlined if it is off, full or past. What is ON the day is shown by its DOTS: green is booked
here, grey is elsewhere, gold is a couple asking. The tour is the only key on Clients, because the month there draws
no legend, and it still described the old marks. This rewrites the `vendor_dates_v1` "Your month at a glance" body
to match.

- **Guard:** `app/vendor-dashboard/customers/the-calendar-key-says-what-green-means.test.ts` renders the real
  `CalendarGrid` in box mode and checks four things: an open empty day is green-filled with no dot, a booked day
  carries the dot, and blocked or past days are outlined. It then holds the tour's words to that. Sabotage
  (restoring the old body) turns it red.
- **EB-219 is not changed here.** Today's "Booked · events this month" (`bookedThisMonth`, month-scoped, Setnayan
  bookings) and Clients' "booked" door (all dates, plus outside bookings) are deliberately different measures. That
  was reported to the controller rather than unified.

SPEC IMPACT: None.
