## 2026-11-02 · feat(crew-meals): the caterer sees the crew meals the host set, per booked supplier

The fourth of the owner's four schedule additions (DECISION_LOG 2026-11-02 "SCHEDULE FITS THE COORDINATOR'S TIMELINE
AS WRITTEN: 4 ADDITIONS" (4)). A real timeline ends "Crew meals: Photo 4 · Video 3 · HMUA 2 …" for the caterer.

- **Rule 0 — the field already existed.** The couple side has held a crew-meal count per booked supplier since
  2026-07-09: `event_vendors.crew_size` (the host's number; blank = the supplier's own listing) on a supplier marked
  `crew_meal_covered`. No new column. What was missing was the caterer's READ (a supplier reads no other supplier's
  booking row) and the couple's toggle when the feeder is a caterer, not a crew-meal provider.
- Migration `20271303132255`: `get_vendor_crew_meals(event)` — SECURITY DEFINER, gated exactly like its twin
  `get_vendor_catering_metrics` (fee gate in SQL · own org · BOOKED · a food category, plus 'crew_meals'). Booked
  suppliers marked fed only, with their count and whether it came from their listing. Names and counts only.
- Production sheet: a "Crew meals" section — each supplier, its meals, the total; a refused read is said, never "none".
- Couple workspace: "Crew fed by your caterer" is offered once a caterer is booked (was: only a crew-meal provider);
  the caterer's own row says how many crew meals it is feeding.
- Tests: `tests/db/a-caterer-sees-the-crew-meals.db.test.ts` (3) ·
  `app/vendor-dashboard/clients/[eventId]/production-sheet/the-caterer-sees-the-crew-meals.test.ts` (4).

SPEC IMPACT: None (implements the 2026-11-02 ruling; no decision changed).
