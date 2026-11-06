## 2026-11-06 · feat(taxonomy): apply the approved supplier-taxonomy merge — 217 trades fold into survivors, 40 categories merge

Owner, 2026-11-06: *"yes merge them"* · *"combine the services in the events running like cale-ice"*. The approved map (296 rows, the owner's 8 "your call" picks applied — Photographer and Videographer stay separate, Lechon stays apart from Catering) is checked in at `supabase/data/taxonomy-merge-2026-11-06.json` and applied by migration `20271320461004` through the two merge mechanisms (`merge_service_category`, `merge_canonical_service`).

- **Trades are re-tiled first** (some categories split — Outdoor goes three ways), then **40 categories merge** into their survivors — the couples' suppliers on running events move with them (cale-ice's ten rows land on Live band, Brides' attire, Grooms' attire, Food cart, Mobile bar, Massage chair, Jewelleries & accessories). No new category is created.
- **"Everything else" is retired (status only, no forward)** — it is still the fallback home for a couple's self-added supplier and keeps rendering for them.
- **Surviving categories and trades are renamed** to the approved labels; every surviving trade gets a schema row.
- **The absorbed names become one filter per survivor** (`canonical_service_schemas.category_specific_attributes` + `filter_facets`, prepended), and **every shop that held an absorbed trade is tagged** with that value in `vendor_service_attributes` before its trade merges — the absorbed trade's own attribute row is folded in, not dropped. `is_rental` is stored as a yes/no field (recorded; the couple facet UI shows select facets only).
- **Setnayan products are never merged.** `pabati` (a Setnayan product) carries one supplier coverage row; left as is and flagged.
- Idempotent — a second run changes nothing (`tests/db/the-approved-taxonomy-merge.db.test.ts`, cale-ice fixture).

SPEC IMPACT: The supplier taxonomy itself changes (296 map trades → 79 live, Setnayan products included; 81 categories → 40 live). `DECISION_LOG.md` has no row for the 2026-11-06 approval yet — flagged for the controller to add (with the map path) rather than edited from this builder.
