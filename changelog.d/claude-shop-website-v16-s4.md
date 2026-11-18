## 2026-11-17 · feat(shop): v16 S4 — the verified shop's desktop side card

- **The shop card moves to the right** on a tablet and up, as in the approved v16 drawing (`<aside>`). It is the same card in the same source order (`md:order-last`), so a phone still reads it first.
  - It is pinned under the sticky top bar and the section menu.
  - It no longer climbs onto the hero on a computer.
- **Its booking half, on a computer** (`ShopSideCard`):
  - "from ₱…", the lowest price a live card shows, with that card's best offer through the one `pickBestDiscount`. With no shown price there is no line, never "from ₱0".
  - "Setnayan Verified · ★ 4.9 · 38 reviews", behind the Free-tier star gate and the trusted review stat.
  - **This month's Check a date** as the shipped seat plan (`SeatMonths`). It reads the same reads and answer as Check a date, over one month (`readThisMonthNotBookable`).
    - A green day opens Check a date on that day, and "See every month →" opens it on the first.
    - A failed read says it couldn't load, never "all free".
  - The quote (v16 S3), once a service is added.
- **One Check a date per screen.** On a computer the side card's month is the way in, so the action row's Check a date shows on a phone only (`md:hidden`).
- On the verified page the S3 quote tray is for phones (`phoneOnly`); a computer shows the quote in the side card. The quote store now also keeps the summary and notifies listeners.
- The unverified side card (`nvbk`) is S6 and is not built here.

SPEC IMPACT: None. This builds the 15 Nov rulings already in DECISION_LOG ("THE OWNER APPROVES THE SUPPLIER WEBSITE DESIGN…" and "SHOP WEBSITE MENU…: desktop uses the side card") and the 17 Nov "S2–S6 go ahead" row.
