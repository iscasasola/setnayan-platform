## 2026-11-06 · feat(taxonomy): apply taxonomy v2 — 39 categories, 84 services, every live key placed once

Owner, 2026-11-06: *"yes merge them"* · *"combine the services in the events running like cale-ice"*, then **taxonomy v2 approved** on top of the merge map (DECISION_LOG "TAXONOMY V2 APPROVED"; source `Setnayan-specs/prototypes/taxonomy_v2_2026-11-06/`). The approved target is checked in at `supabase/data/taxonomy-v2-2026-11-06.json` beside the merge map (`taxonomy-merge-2026-11-06.json`) and applied by migration `20271320461004` through `merge_service_category` and `merge_canonical_service`.

- **The picker becomes v2 exactly:** 39 live categories in 16 groups, 84 services, 90 specialties with 371 values. All 296 live keys are placed once (`live_key_map`). Of those, 216 trades fold into a survivor and 40 categories fold into another.
- **Two new categories:** *Staff, security & registration* (under Logistics & safety) and *Prayers & novena* (under Farewell). Their stored `coarse_category` values are `security` and `officiant`.
- **16 new services**, phase `V1.5+`, each with its v2 event scope.
- **Tea ceremony master is its own service** under Hosts & talent, wedding only. It is not a Host / emcee specialty.
- **Specialties are facets:** `category_specific_attributes` plus `filter_facets`, with the v2 keys prepended. Each value's event scope rides in the facet definition as `option_event_types`, alongside the `question` text. There is no new column. Rental is a yes/no `is_rental`.
- **Shops are tagged before their trade folds**, so no shop loses the value it held.
- **Categories:** surviving categories take the v2 labels. A category's event scope widens to cover its services and never narrows.
- **"Everything else":** retired, status only, with no forward.
- **Setnayan products are never folded.**
- **Code mirrors follow the database:**
  - `lib/taxonomy.ts`: new tiles, v2 labels, folded tiles out of `WEDDING_TILE_ORDER` (kept in the union so old ids type-check), `MERGED_TILE_INTO` plus `liveTileOf`, and `TAXONOMY_MAP` rebuilt field-for-field from the replayed database.
  - `fallbackSnapshot()` carries `tileForward`.
  - `CATEGORY_TO_TILE` resolves through the forward.
  - `VENDOR_CATEGORY_CANONICAL` anchors on live tiles. `security` is no longer exempt; it anchors on Staff, security & registration.
  - `BRANCH_TO_VENDOR_CATEGORY` is updated, and so are the inspiration consts.
  - The exhaustive tile records gain the two new tiles: icons, Find groups and booth templates.
- **Mechanism fix (PR A):** a category fold no longer leaves an inspiration part's home in its also-from list.
- **Tests:** `lib/the-approved-taxonomy-merge.test.ts` holds the migration to v2 value for value. Sabotage-checked: dropping one event from one value turns it red. `tests/db/the-approved-taxonomy-merge.db.test.ts` replays it, checks the result and checks it is idempotent.

SPEC IMPACT: The supplier taxonomy changes to v2. The approval is recorded in `DECISION_LOG.md` ("TAXONOMY V2 APPROVED", 2026-11-06) and the source is `Setnayan-specs/prototypes/taxonomy_v2_2026-11-06/`. No corpus edit was made from this builder.
