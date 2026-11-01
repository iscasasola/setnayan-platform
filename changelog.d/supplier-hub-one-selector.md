## 2026-10-31 · feat(supplier-hub): one row — Set up · Crew · Pages inside the Hub ▾, the Hub ⚙, crew search

The supplier slice of DECISION_LOG 2026-10-30 "ONE SELECTOR FOR EVERY PAGE" (owner *"all yes"*, Q1: the segmented rows become the same `Page · View ▾`), on the approved v13 Hub (2026-10-29).

- **One row**: the sliding segmented pill under the Hub row (Set up · Crew · The event's pages) is gone. The Hub ▾ lists the three views first (group "Show", each with its line, the one on screen ticked), then the events; the face says `Hub · Crew · Indalecio & Claire ▾` (the date stays in the ⓘ). A view keeps its own address (`?seg=`), so Back works; a search narrows the events only. `hub-screen.tsx`'s Hub line leaves the one-selector baseline.
- **The Hub ⚙** (`MenuSettingsButton menu="supplier-hub"`, a new live entry — not the couple's Event Hub `hub`) ends the row after the ⓘ, and moves up into the bar with it from 701. It holds what exists: **Crew view** — Member · Helper and what each opens, in the crew phone's own words for this shop's trade, "never the money". The v13 sheet's other rows — "Scans post to the couple's Event Hub" and "Countdown sound" — have nothing to save to, so they are not drawn.
- **Crew search**: Hub › Crew gets the thumb row's "Search your crew", narrowing the phones in place by name · role · state, and saying so when none is left.
- Guards: `the-hub-is-set-up-per-event.test.ts` (tests 6, 8, new 10), `every-supplier-top-row-is-one-selector.test.ts` (the Hub row is walked; the screen under it may draw no segmented row; the PickMenu's own props are read at brace depth 0), `every-menu-has-one-settings-button.test.ts` now counts a hyphenated menu key. Sabotaged red four ways.

SPEC IMPACT: DECISION_LOG.md row 2026-10-31 "SUPPLIER HUB: ONE ROW, ITS ⚙, CREW SEARCH" (the Hub ⚙'s contents, each v13 row justified or held).
