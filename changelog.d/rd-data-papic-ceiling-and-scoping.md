## 2026-10-02 · feat(data): wedding Papic "at most" 100,000, recommendation floor 5,000/0, and the thin event types scoped to categories

Two data migrations, owner-approved 2026-10-02 (nothing is applied to prod by hand — normal pipeline).

- `20271258946423_wedding_papic_ceiling_is_one_hundred_thousand` — `papic_event_pool_config`: wedding `ceiling_points` 30000 → 100000; `recommend_floor_points` = 5000 for wedding and 0 for every other event type (written only where it differs). The `default` row, `floor_points` (the entitlement) and every other ceiling are untouched; guards raise if anything else moves.
- `20271259024543_thin_event_types_are_scoped_to_the_categories_that_serve_them` — appends birthday / hangout / date / wake / simple_event to the tier-2 CATEGORIES that serve them (services keep inheriting). Never removes a type; guards raise if a wedding's category set changes or a type falls below its floor (birthday 8 · wake 5 · simple_event 5 · hangout 3 · date 3).
- Tests: `papic-wedding-ceiling.db.test.ts`, `thin-event-types-are-scoped.db.test.ts`; `papic-pool-sizing-by-event-type.db.test.ts` updated for the wedding's new ceiling.

SPEC IMPACT: None
