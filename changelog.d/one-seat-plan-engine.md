## 2026-11-20 · feat(seating): one seat-plan engine for the couple and the supplier; only who fills a seat differs

Owner, verbatim (DECISION_LOG 2026-11-20): *"the need to run the same logic and code. The Seats on the Event will be
assigned from the guests / The seat from the Suppliers will be assigned when someone is booked."*

- **`lib/seat-plan-engine/`**: one module, imported as `@/lib/seat-plan-engine`, that both sides use.
  - `geometry`: the 11 couple table types, chair geometry, footprints, the default spot, Fit and the room box. They were **moved byte for byte out of `lib/seating.ts`**, which re-exports them, so its ~60 importers are unchanged.
  - `plan`: room · doors · tables · stage, plus the three supplier shapes (from PR #7968's `lib/plan-maker.ts`). An unsized room is now the couple's own 20 × 30 m board.
  - Row spacing (`SLOT_GAP_PCT` · `ROW_GAP_PCT` · `TABLE_BAND_PCT`) is named once in the engine. The couple's Auto-arrange and the supplier's Line up both read it. Round two's grid (PR #8057) moves in as `rows.ts` and reads the same names. The engine carries no second row algorithm.
  - `floors`: the 19 Nov rulings. One floor plan on many floors, each numbering its own rooms; copy a floor; "Make 5F different"; a booked room is never removed; generic names Room001… below Pro; "Floor plan is Pro and up".
  - `validate`: one check for both sides. Overlaps go through the couple's own placement oracle.
  - `occupants`: guests (event) or bookings (supplier), and nothing else. A couple sees only how many seats are free.
- **The couple's Seat plan runs on it.** `seating-editor.tsx`, `seating-context-dock.tsx` and `seating/actions.ts` take tables, chairs and the room box from the engine. The walk-through entrance's inline nearest-wall copy is replaced by the engine's `nearestWall`. **No visible change**: 375 px light, dark and desktop shots of Seats › 2D and List are pixel-identical to `main`.
- **`lib/seat-plan-engine/ADAPTER.md`**: exactly how PR #7968 switches onto the engine (three files to resolve, the import swap, one behaviour change, five duplicate rules to drop), and how PR #8057 moves its grid in as `rows.ts`.
- No migration, no new table, no new server action, no new client component.

SPEC IMPACT: None. The engine implements rulings already in DECISION_LOG (2026-11-19 Spaces rows; 2026-11-20 "SAME FLOOR PLAN", "ONE SEAT-PLAN ENGINE", "GUESTS › SEATS, ROUND TWO"). The round-two SCREENS are not built here; PR #8057 is building them, and moves its grid into this engine (ADAPTER.md § 7).
