## 2026-10-30 · fix(pinned-rows): a pinned row never sits under the iPhone's clock and Dynamic Island

Owner, on the iPhone app's Home (screenshot): *"The top row is intersecting with the floating islang of iphone"*. When the app's top bar slides away on scroll, the shared offset every head pins under (`useShellBarOffset` → Home's `--home-bar`, Guests' and People's `--gs-top`) fell to `0px`, so the pinned line drew under the status bar. It now falls to `env(safe-area-inset-top, 0px)` — 0 on any screen without an inset, so desktop and Android are unchanged. Guard: `guests/_components/a-pinned-row-clears-the-island.test.ts`.

SPEC IMPACT: None

## 2026-10-30 · fix(suppliers-booked): a closed Booked row closes on an iPhone, so its buttons work

Owner, iPhone app, Suppliers › Booked: *"All buttons do not work."* · *"Booked does not collapse"*. A row folds with a `0fr` grid track and marks the folded part `inert`; the folded part had `overflow: clip` without `min-height: 0`, and `clip` makes no scroll container, so a grid item's automatic minimum stayed its full content height — WebKit drew every row open while `inert` swallowed every tap (reproduced in the suppliers lab under WebKit: `elementFromPoint` at each button returned the row, not the button). `min-height: 0` added (the same as `.fold > div` in Guests and `.home-fold > div`). Guard: `vendors/_components/a-closed-booked-row-is-closed.test.ts`.

SPEC IMPACT: None
