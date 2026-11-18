## 2026-11-17 · fix(supplier-clients): the picked client's Payment · Forms · Schedule · Files · Report tabs say what is true

Owner screenshots, event "Debut 18" (a debut, booked May 12 2027, first payment due Nov 13 — past — nothing paid).

- **Payment.** The Next line prints the plan row's own due words (`clientPaymentView(...).next.dueText` / `late`, drawn wine by `BudgetFigures`), so "Next · First payment · Was due Nov 13" agrees with the row. The asks panel no longer says "Nothing outstanding" over an overdue payment: it says no ask was sent yet and what the plan says is next; the form opens filled from that payment (amount, label, due day while ahead) instead of an invented example figure (`PaymentAsksPanel` `suggest`, computed in the client page from the same fold).
- **Forms · Report.** The client is named by the event type's own word (`terminology.organizerNoun` via `readClientNoun` — "celebrant" on a debut, "couple" on a wedding); lines about every client say "client". The "no questions yet" line is drawn once (`quietWhenEmpty` on the send panel and the answers); the page leaves room under the floating buttons (`pb-24`). The private-note box says "Add a note about this celebrant…".
- **Schedule.** Root cause of the all-green May: the box grid fills every open future day with the seat green (owner 14 Nov colour coding), and the legend named only one green — "Booked here" — so an open month read as booked solid; meanwhile the one real booking (a `setnayan_booking` calendar block, no pool-booking row) was folded in as a closure and drawn struck "Not available". Now `buildCustomerCalendarMonth` counts a `setnayan_booking` block as the booked day (full, one Setnayan booking, the green dot; never double-counted with a pool booking), and `CalendarLegend` names the seat green "Free". The run of show shows no "Live"/"Syncing" badge and calls the second box "First moment", not "Up next", while the event is still ahead (`startsOnWords`, RW-87's check).
- **Files.** No bare "—" above a file's day when it has no size.
- **Notices.** The returning-client inquiry says "This celebrant previously booked you…" (event kind's word; stored rows still strip in push copy), and the lock-request notices agree in number ("Wanda & Indigo have asked you… / want to book you", `agree` over the masthead's `splitCoupleNames`). Stored notifications are not rewritten.

Guard: `app/vendor-dashboard/clients/[eventId]/the-client-tabs-say-what-is-true.test.ts` (6 sabotages, each seen red).

SPEC IMPACT: None
