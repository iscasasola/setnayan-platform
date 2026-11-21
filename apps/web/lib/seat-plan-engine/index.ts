/**
 * lib/seat-plan-engine — 🪑⚙ THE ONE SEAT-PLAN ENGINE FOR THE COUPLE AND THE SUPPLIER. ONLY WHO FILLS A SEAT DIFFERS.
 *
 * Owner, verbatim (DECISION_LOG 2026-11-20): *"the need to run the same logic and code. The Seats on the Event will be
 * assigned from the guests / The seat from the Suppliers will be assigned when someone is booked."* And the same day:
 * *"The Seat Plan here needs to have the same Floor Plan for Suppliers on their Spaces."*
 *
 * Both sides import THIS path:
 *   · the couple's Seat plan — `app/dashboard/[eventId]/seating/_components/seating-editor.tsx`;
 *   · a supplier's Spaces floor plan — Rooms & seating (PR #7968; how it switches over: `ADAPTER.md` in this folder).
 *
 *   geometry   tables and their chairs, the 11 couple table types, footprints, the room box (moved from lib/seating)
 *   plan       a Plan (room · doors · tables · stage), the supplier shapes, doors on walls, Line up, readers for
 *              both sides' storage
 *   (rows)     round two's grid — rows on the stage line, a table joining a row, snapping, Fit the room — is being
 *              built on PR #8057; it lands here as `rows.ts` (ADAPTER.md § 7), never as a second copy elsewhere
 *   floors     one floor plan on many floors, each numbering its own rooms; copy a floor; make one different
 *   validate   one check for both sides; overlaps go through the couple's placement oracle
 *   occupants  who fills a seat — guests (event) or bookings (supplier) — and nothing else
 *
 * Every file is pure (no React, no Supabase) and runs nothing on import, so the couple editor's chunk keeps only
 * what it calls.
 */
export * from './geometry';
export * from './plan';
export * from './floors';
export * from './validate';
export * from './occupants';
