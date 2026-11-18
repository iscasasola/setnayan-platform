## 2026-11-18 · feat(supplier-client): days strip on Schedule, dates open Schedule, Paid N of M on Quotation, Forms narrowed to the client

Owner, 18 Nov ("plan it and set to build"), on the client-page drawing NL5NDoD6 v7:

- **Schedule** opens on a days strip for this client (`ScheduleDays`, `lib/schedule-days.ts`). It has Week | Month and a "This client / All my clients" dropdown. Dots mark the event day(s), Meeting-card days and payment due days, all from reads the page already makes. Tap a day for its rows. A payment day has "See payment ›", which switches tabs in place. The shipped blow-by-blow below is unchanged. "All my clients" asks the Clients month action once per month shown, adds the shop's other bookings in another colour, and marks "Clash: <schedule>" when another client holds the same hall or crew that day. A refused read is said. This replaces the v113 shop month (`ScheduleCalendar`, deleted) on this page; the full month stays on Clients › Calendar.
- **Dates open Schedule.** A meeting card's date in the chat (supplier side) opens this client's Schedule on that day (`ScheduleDayDoor`, `?tab=schedule&day=`). Calendar › a day › a client now lands on Schedule with that day picked (`clientScheduleDayHref`); before, it opened Details.
- **Quotation** (booked): "Paid N of M · Next due <day> ›" opens Payment, and "Who it counts · <rule> · N" comes from `get_vendor_headcount_rule`. Both use reads the page already makes (`lib/quote-top-lines.ts`).
- **Forms**: the client's Forms tab, its Load a form sheet and the chat's ＋ Form card list only the forms on the cards this client asked about or booked, plus the shop's chat forms (forms on no card), via `formsForThisClient`. The ＋ Form card gets the list from `formsAction` op `client`. A sent card form offers "Send again". It keeps the same send record, so the couple's last answers stay ticked, and the chat line says so (`formLineTitle` reads both wordings). The line "Every form is open to every service" is replaced.

Not built (named in the PR): "each chat-form answer is saved as a decision"; Payment-card dates in the chat; grouping quote lines by date (quote lines carry no date); seats, rooms, the plan and the Seats card (Card Maker build).

SPEC IMPACT: None. The rulings are already in DECISION_LOG and the drawing; this PR builds them.
