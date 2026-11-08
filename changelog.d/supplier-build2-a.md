## 2026-11-08 · feat(clients): Build 2 B2-A — one Clients screen + Schedule asking marks

- **#43** Clients is ONE screen: "Clients · N booked · ₱X to collect · ⚙" → the month → the tiles as their own
  row → Overdue / Unread → every client under its day ("SUN 8 NOV"). Thumb row: Search clients · ⇅ · ＋ (Check a
  date folded into the day bar). Details numbers drawn inline. The client's Schedule month marks the dates people
  asked about, read in the same one request. Guard: `customers/clients-is-one-screen.test.ts`.
- **#38** One open path: every Clients row, tile row and Today Reply card opens that client through
  `clientLandingPage` → `customerCardHref`, on the page its kind means (Asking → Chat · Quoted → Quotation · Booked →
  Details · Hub on the day). An unbooked client's Payment door draws the Quotation. Guard: `customers/one-open-path.test.ts`.
- **#37** One picked mark on the Clients month, the week strip and the client's Schedule month — the day's number in
  an ink box that pops in — and one swipe (month and week, 40 px, 320 ms, never picks a day). Blocked days are struck
  through. The Dates tour's stops follow the one screen. Guard: `app/_components/calendar-day-box.test.ts`.
- **#28** One filled day only on the supplier calendars: the picked day; part-booked days keep their dots, blocked
  days their strike, today its ring; a closure row's lead is the day's struck number.
- **#36** The picked client's page menu keeps its picked page centred (tap, body swipe, deep link, first open), the
  ends staying put; a sideways swipe across the page turns the page. Guard: `the-page-menu-centres-the-picked-page.test.ts`.
- **#27** The return rule: letting a picked day go glides the page back to where it stood before any day opened
  (520 ms; instant under reduced motion), waiting for the list to grow back first. Guard: `calendar-day-box.test.ts`.
- **#29** Accept bookings is felt: flipping the day bar's switch strikes / un-strikes the day on the month and the week
  strip at once, then squashes it (off) or pops it with a small confetti burst (on); reduced motion keeps only the
  strike. Guard: `customers/accept-bookings-is-felt.test.ts`.

SPEC IMPACT: None — builds the approved v113/v118 prototype (corpus prototypes/supplier_clients_2026-11-07).
