## 2026-10-29 · fix(suppliers): an opened category's pinned head no longer covers its first card

Owner, live, the event's Suppliers › Find on a phone: *"when i tapped a category, this is how it pinned on top. it
made the service card not placed properly"* — the opened category's head ("Catering · 1 yours · Booked ✓") sat over
the top of its first card: the supplier's name line cut off, the thumbnail half under the head.

**Cause (measured on `/dev/suppliers-lab`, Chromium + WebKit):** the landing aimed the opened row at `--stick-h` (the
top bar + the pinned Find · Build · Booked row) — but a landing that scrolls UP (the row above folding, a row low in the
list) brought the phone's top bar back AFTER it had aimed, `--stick-h` grew 58 → 109 px, and the head pinned 36–49 px
over its own card. A landing that scrolled down left the head a bar's height below the pinned row instead.

**Fix (`lib/pin-landing.ts`):**
- the page's own landing no longer moves the top bar — while a landing holds (until the person's next wheel, touch,
  pointer or key), `<html data-pin-landing>` and `useHideOnScroll` leaves the bar where the person last put it;
- the landing holds its line: a changed `--stick-h`, or the page settling under it at rest, lands the row again;
- the row lands ON the line (its `scroll-margin-top` is exactly `--stick-h`; the old `+ 14px` strip is gone), and
  anything inside an open category clears the line plus that category's own measured head (`--cat-head-h`);
- `lib/pin-room.ts`: on a page shorter than the screen (a new event's Find), `scrollHeight` read the screen, so the room
  came out short and the row stopped 21 px low — the room is now re-read once it is in.
- `/dev/suppliers-lab` now carries the app's `data-chrome="app" data-boundary="tab"` and slides its bar away below 701
  px like the real one — without them the lab could never show this bug.

The head still pins while the category is browsed, and follows the bar both ways.

Walked: 304 opens (5 states × 4 sizes × light/dark × Chromium/WebKit, down-then-up order) — 0 covers, head within
±1 px of the pinned row; before: covers of 35–36 px (Chromium 375/390) and 65-px gaps (WebKit). Sabotage (hold
removed): 49-px covers return in both engines. Opening a category makes 0 requests.

Guards: `lib/an-opened-category-never-covers-its-card.test.ts` (CI) ·
`tests/e2e/an-opened-category-never-covers-its-card.spec.ts` (labs: `E2E_LABS=1`, 16/16 against the lab).

SPEC IMPACT: None.
