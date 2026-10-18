# HANDOVER — rd/spotlight-tours (spotlight tours: engine + host + supplier scripts)

Owner's list item 2. Rulings: corpus DECISION_LOG 2026-10-02 "NOBODY SHOULD LEAVE…", "THE SPOTLIGHT TOUR LOOK IS
APPROVED", "SIMPLIFY FIRST, THEN TOUR", "…FINAL STEP BEFORE THE APPLE CHECK"; 2026-10-03 "TIP POPUPS OFF UNTIL THE
SPOTLIGHT TOUR". Contract: corpus `prototypes/spotlight_tour_sample_2026-10-02.html`.

## What is built (this branch)
- Engine `apps/web/app/_components/spotlight-tour.tsx` (client, LAZY chunk): dim + white pulsing ring gliding .75s,
  hand, tip card (Step N of M · progress · Skip · Next/Finish · "Tap it yourself — or press Next"), done card + confetti,
  reduced motion off. Finds `[data-tour~="…"]`, first drawn + uncovered match; scrolls it into the band between fixed
  bars; ring clamped above the home indicator. Missing anchor → dim lifts, waits; missing > 1.4 s while a later step is
  on screen → jumps ahead. Pauses under the Maker (`[data-maker-shell]`). Progress in localStorage, seen-state via the
  shipped `completeTour` (no new server action).
- Mount `spotlight-mount.tsx` (tiny client, `React.lazy`), server wrapper `spotlight.tsx`.
- Scripts in `lib/tours.ts` (`spotlight` on TourDefinition): `host_spotlight_v1` (dashboard layout), 
  `host_day_spotlight_v1` (Event Home on/after the day), `supplier_spotlight_v1` (vendor layout). New keys on purpose.
- ⓘ "Show me around" row in the account menu replays (drawn only where a tour is mounted: `html[data-spotlight]`).
- Old carousel stays OFF; `guided-tour.tsx` now loads the card lazily (it was in every role layout's first load).
- Guard `lib/spotlight-anchors-exist.test.ts` (sabotaged: anchor rename → red; static engine import → red).

## Decisions taken (not in the record)
- ⓘ lives in the account menu, not on pages: PageMasthead's docblock records the owner removing standalone ⓘ dots
  (2026-08-21). Same pattern as the Maker's "About the Maker" row.
- Next only performs the real action on doorway steps (`go: true` — tabs/links); on other steps tapping does it.
- Day + Post Event is its own short tour on Home, mounted only once the day has come (after the planning tour).
- Supplier payday step is Today's money number (Customers › People draws no Money switch).

## Left / next
- Per-page MiniTours (~40) are NOT converted to spotlight steps yet (their keys stay off). Maker-internal tour untouched.
- Home's Next card has no "Show me" button yet (ruling 2026-10-02 (2)).
- Desktop: tab steps have no rail anchors; the tour waits and resumes on the next page with a step.
