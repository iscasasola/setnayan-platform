## 2026-07-20 · feat(schedule): travel multi-day itineraries — night-blocks, tours, clash guard

Travel events get a real multi-day itinerary on the existing schedule spine
(`event_schedule_blocks`) — the ai-travel-scheduling work item from the
2026-07-18 What's-Next suite, unblocked by ai-gap-leaves (PR #3414):

- **Migration `20270825683668`** — two new `schedule_block_type` enum values:
  `'lodging'` (a hotel NIGHT-BLOCK: check-in → check-out spanning days;
  multiple hotels = sequential night-blocks) and `'tour'` (a tour/activity
  TIME-BLOCK — the `tour_activity` taxonomy leaf generates schedule blocks,
  not just vendor listings). Also asserts the travel profile's
  `multi_day=TRUE` + `layer_mode='roaming'` (verify-and-set per the spec; the
  composable foundation already UPDATEd it, this makes it self-sufficient).
- **`lib/schedule-travel.ts`** (new, pure) — the itinerary engine:
  `expandLodgingNights` (per-night expansion, check-in day → the night before
  check-out), `buildTravelItinerary` (the day-by-day lens over the one master
  timeline; pure filter, never a copy), `detectTravelClashes` (overlapping
  tour time-blocks + trip nights with no hotel booked), `findTourOverlap` +
  `tourDoubleBookMessage` (save-time double-book rejection). Tour-overlap
  copy is the AI's existing **GRD-06** guard template verbatim ("Two things
  land on {slot}: {item_a} and {item_b}…") — reused, not re-invented.
- **Schedule page (travel only)** — a day-by-day Trip Itinerary section +
  a Guard-styled clash panel above the timeline; the add-block form offers
  the trip-shaped type menu (Hotel stay / Tour first) with check-in/check-out
  field labels. `createScheduleBlock` / `updateScheduleBlock` accept
  `lodging`/`tour` ONLY on travel events and reject an overlapping tour at
  save with the GRD-06 copy. Travel skips the generic party run-of-show seed
  (a trip is not an evening program).
- **Fallbacks** — `TRAVEL_PROFILE` code fallback (roaming + multi-day,
  matching the seeded DB row) so a DB hiccup can't flip travel single-day.
- **Inert elsewhere** — non-travel events never see the new block types, the
  itinerary chrome, or the guards; their schedule surface is byte-identical
  (no flag needed).
- Unit suite `lib/schedule-travel.test.ts` (19 tests): night-span expansion,
  itinerary domain math, GRD-06 overlap pairs + verbatim copy, lodging-gap
  runs, save-time double-book incl. self-exclusion on update.

SPEC IMPACT: `Setnayan_AI_Gap_Leaves_Travel_Dinner_Date_2026-07-17.md` Part-B
travel scheduling shipped; `Whats_Next_Suite_AI_Pricing_2026-07-18.md` §8
`ai-travel-scheduling` closed.
