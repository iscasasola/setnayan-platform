## 2026-11-08 · feat(clients): Build 2 B2-A — one Clients screen + Schedule asking marks

- **#43** Clients is ONE screen: "Clients · N booked · ₱X to collect · ⚙" → the month → the tiles as their own
  row → Overdue / Unread → every client under its day ("SUN 8 NOV"). Thumb row: Search clients · ⇅ · ＋ (Check a
  date folded into the day bar). Details numbers drawn inline. The client's Schedule month marks the dates people
  asked about, read in the same one request. Guard: `customers/clients-is-one-screen.test.ts`.
- **#38** One open path: every Clients row, tile row and Today Reply card opens that client through
  `clientLandingPage` → `customerCardHref`, on the page its kind means (Asking → Chat · Quoted → Quotation · Booked →
  Details · Hub on the day). An unbooked client's Payment door draws the Quotation. Guard: `customers/one-open-path.test.ts`.

SPEC IMPACT: None — builds the approved v113/v118 prototype (corpus prototypes/supplier_clients_2026-11-07).
