## 2026-11-16 · fix(rise): the half-height sheets that are forms rise full screen

W1's walk found four sheets opening at half height. Each is judged by the two rulings: a form or page with fields to fill
rises full screen (DECISION_LOG 2026-11-10 "RISE FULL SCREEN IS THE NAME; FULL SCREEN EVERYTHING"); a pop-up picker or
menu opens at half the screen and drags up (DECISION_LOG 2026-11-12 "A POP-UP SHEET OPENS AT HALF THE SCREEN").

- **Discover › Filters** — a form (place, selects, checkboxes, Apply · Clear): rises through `RiseScreen`, drawing the shipped `FilterDrawerForm` (split out of `/explore`'s drawer — one form, two frames).
- **Booked QR** — the deal form (client · date · service · schedule · proof): its row rises through `RiseScreen` (`QrRow.rise`); every other QR row is a code viewer and keeps the half sheet.
- **Chat ＋** — a menu: stays half height with drag-up (2026-11-12). Not changed.
- **Answer their booking ask** — a form: rises full screen in the chat PR (claude/chat-live-fixes-1, CHAT-18).

Guard: `the-rise-screen-is-one-full-screen.test.ts` test 8 (sabotaged three ways, red each time).

SPEC IMPACT: None — applies the 2026-11-10 and 2026-11-12 rows.
