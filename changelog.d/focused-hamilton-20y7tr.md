## 2026-11-06 · feat(seat-plan)[migration]: the seat plan opens for guest booths, performers and AV production

Owner, 6 Nov (DECISION_LOG 2026-11-06 "SUPPLIER ACCESS MAP (#6407): FOUR OWNER CALLS", call 2): add `guest_booth`, `performers` and `av_production` to the seat-plan read.

- Migration `20271320476390_seat_plan_opens_for_booths_performers_and_av` re-creates `get_vendor_seat_plan` from its newest definition (`20271304542745_suppliers_see_seats_on_the_day`, copied by script) with only the floor list changed: three categories added. The meal-count gate is untouched — the three see tables and seats, never meal counts (call 3). No table, grant or row change.
- `lib/the-seat-plan-opens-for-booths-performers-av.test.ts` pins the newest RPC floor list to exactly the new list (sabotage-checked: dropping `performers` fails it) and pins the meal-count gate as unchanged.
- `tests/db/the-seat-plan-opens-for-booths-performers-av.db.test.ts` calls the replayed RPC: a booked guest booth, performer and AV crew each open the plan with its table and no meal counts; a caterer still gets meal counts; `crew_meals` is still refused. Without the migration the first three fail.
- The supplier access map (#6407) mirrors this list as `SEAT_PLAN_CATEGORIES`; whichever PR lands second carries the three into it (its test reads this RPC and will say so).

SPEC IMPACT: `03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md` § 7 — Seat plan now reaches guest booths (Booths), performers and AV production (Program). The 6 Nov DECISION_LOG row already records the ruling; § 7 itself is not yet edited (this session has read-only access to the spec repo).
