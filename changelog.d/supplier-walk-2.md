## 2026-11-23 · fix(service-cards): the Card Maker says what the card does: pieces follow the ruling, and Always available has no dead Schedule pick

Supplier-ready walk of service cards and schedules on main (controller, 22 Nov). Result: service cards 5 of 7, schedules 5 of 6. The schedules break (the yes cannot see a full team) is fixed by #8180. This PR fixes the two card breaks.

- **Rented by the piece** told the supplier "couples ask for how many they need". The ruling (`lib/pieces-ask-words.ts`, owner 20 Nov) is the opposite: a couple's ask carries no number, and the supplier says how many at the yes. Both helpers now say so (`cardCountQuestion` and the Card Maker's count helper).
- **Always available** still offered a "Schedule" pick. That card is never counted and never on the calendar (owner ruling 4), so the pick did nothing. The row now hides like the count and time-slot rows beside it. The stored schedule still rides the save through the hidden `schedule_choice` input.
- Guard: `lib/the-card-maker-says-what-the-card-does.test.ts` (4 sabotages, each red).
- Server actions: no new export. No migration. No baselines touched.

SPEC IMPACT: None. It brings the Card Maker's words and rows in line with the 19–20 Nov availability rulings.
