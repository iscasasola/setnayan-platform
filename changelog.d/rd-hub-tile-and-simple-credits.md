## 2026-10-24 · feat(home, papic): the Event Hub tile opens the Hub and picks what shows; "Add credits" asks only how much

Owner, 24 Oct, on the live new Home.

**Event Hub tile (compact Home + the md+ card).**
- A tap anywhere on the tile now opens the Event Hub (every face, through `openEventHub`: a new tab on the web, the in-app sheet in the app). With no public link yet, it opens the Maker.
- The tile has two 32-px buttons, with their labels in `aria-label` and an ⓘ next to the label. **Pick what shows** opens the shared bottom `Sheet` in place. **Maker** goes to the Event Hub Maker (it was the pen). The tile no longer has its own View button, because the tile itself opens the Hub.
- **Pick what shows is ONE choice of four ROWS** (owner 2026-10-25: *"pick what shows makes them choose between Save the Date, Invitation, The Day, Post Event only"*, then *"make it choices. remove the guests see and place the choices there"*): four single-select rows in the sheet itself (`role="radio"`), the one guests see now marked ✓ "Now", each a 44-px framed press with its stage's one-line ⓘ. ⚠ A deliberate exception to "any set of choices is a dropdown", on the owner's word — noted in the code and held by the guard.
  - The write is the shipped `setLaunchPhase` — the Maker's "Which version guests see" door: host-gated, LIVE, not drafted (so no Apply bar). It lands back on Home.
  - No part switches and no page picker in the sheet; parts stay in the Maker. The pin is read on the tap (`readHomeHubPick`, hosts only).
  - Each row's ⓘ says what that stage is (the shipped `LAUNCH_PHASE_CHOICES` hints). The Maker greys no stage, so none is greyed here.
- Home's tile now honours a pin: `manualLaunchPhase(launch_mode, manual_phase) ?? resolveHubStage(…)`. Both columns join `HOME_EVENT_COLUMNS` and `DASHBOARD_ROW_CARRIES` (the one dashboard row — no extra read), so the tile names the page guests really see.
- The sheet body is a static import: a `next/dynamic` chunk grew the shared webpack runtime past the 202 KB budget.
- A press inside the portalled sheet no longer starts a swipe of the tile.
- The md+ card gets the same "Pick what shows" button.

**Papic "Add credits" sheet (web and iPhone app).** The sheet now shows: title "Add credits" with its ⓘ and the sheet's ✕, then "You have N credits", then the shipped −/+ stepper (unchanged), then "New total", then one button.
- On the web the button reads "Add N credits · ₱X". In the app it keeps Apple's "Buy N credits · <Apple price>".
- Removed: "How many do I need?" (guests coming, photos each), the range line, the "HOW MUCH TO ADD" eyebrow and "Not now". The range and "one credit is one photo" now sit in the ⓘ.
- `credit-need.tsx`, `lib/papic-credit-need.ts` and its test are deleted. `papicBuySizes` no longer makes its three guest reads per tap.

**Guards re-aimed to this ruling (each says so in place):**
- `the-ladder-is-a-stepper`: the range now lives in the ⓘ, and a new test checks that the sheet asks only how much.
- `home-one-widget-per-page`: hub-next opens the Hub, and the buttons are Pick what shows and Maker.
- `home-has-no-go-elsewhere-links` and `home-shows-every-paid-service`: the tile's pen is named "Maker".
- `home-upper-opens-lower-grows`: a dialog-opening button is not the tile growing.
- `event-details-shows-the-map`: phrasing only.

New guard: `home-cards/the-hub-tile-picks-what-shows.test.ts`.

SPEC IMPACT: None in code contracts. This implements owner rulings given in chat on 2026-10-24 and 2026-10-25 and supersedes the 2026-10-23 "How many do I need?" helper. A DECISION_LOG row has not been written by this builder; it is flagged for the controller.
