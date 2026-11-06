## 2026-11-06 · feat(taxonomy): apply taxonomy v2 — 39 categories, 84 services, every live key placed once

Owner, 2026-11-06: *"yes merge them"* · *"combine the services in the events running like cale-ice"*, then **taxonomy v2 approved** on top of the merge map (DECISION_LOG "TAXONOMY V2 APPROVED"; source `Setnayan-specs/prototypes/taxonomy_v2_2026-11-06/`). The approved target is checked in at `supabase/data/taxonomy-v2-2026-11-06.json` beside the merge map (`taxonomy-merge-2026-11-06.json`) and applied by migration `20271320461004` through `merge_service_category` and `merge_canonical_service`.

- **The picker becomes v2 exactly:** 39 live categories in 16 groups, 84 services, 90 specialties with 371 values. All 296 live keys are placed once (`live_key_map`). Of those, 216 trades fold into a survivor and 40 categories fold into another.
- **Two new categories:** *Staff, security & registration* (under Logistics & safety) and *Prayers & novena* (under Farewell). Their stored `coarse_category` values are `security` and `officiant`.
- **16 new services**, phase `V1.5+`, each with its v2 event scope.
- **Tea ceremony master is its own service** under Hosts & talent, wedding only. It is not a Host / emcee specialty.
- **Specialties are facets:** `category_specific_attributes` plus `filter_facets`, with the v2 keys prepended. Each value's event scope rides in the facet definition as `option_event_types`, alongside the `question` text. There is no new column. Rental is a yes/no `is_rental`.
- **Shops are tagged before their trade folds**, so no shop loses the value it held.
- **Categories:** surviving categories take the v2 labels. A category's event scope widens to cover its services and never narrows.
- **"Everything else" is left untouched** (hidden, active, no forward). Neither approved source names it, and it is the home of a self-added supplier.
- **Setnayan products are never folded.**
- **Code mirrors follow the database:**
  - `lib/taxonomy.ts`: new tiles, v2 labels, folded tiles out of `WEDDING_TILE_ORDER` (kept in the union so old ids type-check), `MERGED_TILE_INTO` plus `liveTileOf`, and `TAXONOMY_MAP` rebuilt field-for-field from the replayed database.
  - `fallbackSnapshot()` carries `tileForward`.
  - `CATEGORY_TO_TILE` resolves through the forward.
  - `VENDOR_CATEGORY_CANONICAL` anchors on live tiles. `security` is no longer exempt; it anchors on Staff, security & registration.
  - `BRANCH_TO_VENDOR_CATEGORY` is updated, and so are the inspiration consts.
  - The exhaustive tile records gain the two new tiles: icons, Find groups and booth templates.
- **What the fold would otherwise have broken, kept:**
  - **Each one-person attire board keeps its half** (owner 2026-10-08). The Filipiniana & Barongs cross-view gave the bride a terno and the groom a barong. v2 folds ternos into Gowns & dresses with every gown, and barongs into Barong & suits with every suit. Left alone, a dressmaker would have been offered the Groomsmen shelf and any suit tailor the Bridal gown board. Migration step 11 keeps Bride, Bridesmaids and Flower girl on Gowns & dresses (the bride also keeps hair & make-up), and Groom, Groomsmen and Ring bearer on Barong & suits. Entourage, Guests, Parents and Principal sponsors keep both.
  - **The backdrop still admits only the LED-wall service and the stylist** (MB26). This holds at the part's services, even though its LED-wall row is now Lights, sound & effects.
  - **A folded tile key still narrows day-of desks.** A shop whose `services[]` says `dj` keeps the song desk when booked as `band_dj`. `liveTileOf` is applied in both narrowing loops.
  - **`categoriesForTile` answers a folded id as its live row,** so the removal guard still sees every booking.
- **The coordinator trade follows v2.** `wedding_day_weather_forecaster` (now a specialty of Coordinator / planner) joins `COORDINATOR_TRADE_SERVICES`, and migration `20271321430700` adds it to the SQL copy `services_make_a_coordinator`. The Date & feng-shui consultant now sits on the same row but is its own service, so it is **not** added; adding it would be an access change.
- **Inspiration parts keep their links; the categories got wider.** On 21 parts the fold widened the categories while the merge kept each part's links (rewritten to the survivor), so the live link table admits exactly the shops it did before. The 16 new services are linked to no part (③a: a new service links nothing). The code fallback still expands categories, so when the parts read fails it is wider than the table. That is flagged for the owner and left unchanged.
- **Mechanism fix (PR A):** a category fold no longer leaves an inspiration part's home in its also-from list.
- **Tests:** `lib/the-approved-taxonomy-merge.test.ts` holds the migration to v2 value for value. Sabotage-checked: dropping one event from one value turns it red. `tests/db/the-approved-taxonomy-merge.db.test.ts` replays it, checks the result and checks it is idempotent.

SPEC IMPACT: The supplier taxonomy changes to v2. The approval is recorded in `DECISION_LOG.md` ("TAXONOMY V2 APPROVED", 2026-11-06) and the source is `Setnayan-specs/prototypes/taxonomy_v2_2026-11-06/`. No corpus edit was made from this builder.
