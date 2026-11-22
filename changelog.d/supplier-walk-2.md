## 2026-11-23 · fix(service-cards): Supplier › Shop draws Card 14; pieces follow the ruling; Always available has no dead Schedule pick

Supplier-ready walk of service cards and schedules on main (controller, 22 Nov). Result: service cards 5 of 7, schedules 5 of 6. The schedules break (the yes cannot see a full team) is fixed by #8180. This PR fixes the two card breaks.

- **Rented by the piece** told the supplier "couples ask for how many they need". The ruling (`lib/pieces-ask-words.ts`, owner 20 Nov) is the opposite: a couple's ask carries no number, and the supplier says how many at the yes. Both helpers now say so (`cardCountQuestion` and the Card Maker's count helper).
- **Always available** still offered a "Schedule" pick. That card is never counted and never on the calendar (owner ruling 4), so the pick did nothing. The row now hides like the count and time-slot rows beside it. The stored schedule still rides the save through the hidden `schedule_choice` input.
- **Supplier › Shop drew the old card.** The shop's own services list drew every card with the OLD side-photo row face. Card 14 is "the one service card everywhere" (DECISION_LOG 20 Nov, CARD 14 v4 APPROVED). The list now passes Card 14 (`ServiceCardView` `mall`, through the new `ownShopMall` in `lib/mall-card.ts`), the same face Find and Discover draw. There is no event on the shop's own list, so it shows no guest total, no distance and no venue ask. The shop's Edit · Share · Online row stays under the card. Owner, 23 Nov: "the suppliers>shop has the service card wrong."
- Guard: `lib/the-card-maker-says-what-the-card-does.test.ts` (7 sabotages, each red).
- Server actions: no new export. No migration. No baselines touched.

SPEC IMPACT: None. It brings the Card Maker's words and rows in line with the 19–20 Nov availability rulings.
