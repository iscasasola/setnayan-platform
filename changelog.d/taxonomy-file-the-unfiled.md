## 2026-08-27 · fix(taxonomy): file the 30 "unfiled" services into the four branches that already carried their names

Owner, looking at `/admin/taxonomy?view=unfiled`: *"there are so many that are not added on the taxonomy. or not categorized properly."*

**Measured in production before anything was written.** 275 rows in `canonical_service_schemas`, 276 in `canonical_service_taxonomy`, **30 of them carrying a folder and a NULL `tile_id`** — that is the Unfiled tray, exactly. And **six tier-2 branches held zero leaves.** Four of those six are the exact homes of all 30, one for one:

| branch | leaves it should hold | what they are |
|---|---|---|
| `officiants` | 20 | every celebrant the product knows — Catholic priest, imam, rabbi, pandit, granthi, monk, INC minister, Kingdom Hall elder, LDS bishop, tribal elder, plus judge / mayor / justice of the peace |
| `counseling_seminars` | 5 | Pre-Cana, Christian pre-marital, INC, Muslim pre-wedding, the CFO seminar |
| `wedding_paperwork` | 3 | marriage-licence expediting, apostille / DFA, Fil-Am visa logistics |
| `travel_honeymoon` | 2 | honeymoon planners, destination-wedding travel coordinators |

20 + 5 + 3 + 2 = **30**. Not a subset — the whole tray, and every empty branch that had a candidate.

🔑 **HIDDEN AND UNFILED ARE TWO DIFFERENT FACTS AND ONE FIELD WAS CARRYING BOTH.** The 2026-05-31 marketplace shrink pulled officiants and pre-marriage paperwork *out of the marketplace* (`marketplaceHidden`) — the celebrant auto-resolves from the ceremony venue, the paperwork lives in the Setnayan AI wizard — and implemented that by **also omitting the tile**, which `TaxonomyEntry.tile`'s own docblock stated as the rule: *"Omitted when `marketplaceHidden` is true."* So a deliberate product decision rendered, in the admin console, as 30 pieces of work nobody had done. The visibility half is untouched here. Only the filing half changes.

⚠ **NOTHING BECOMES VISIBLE, AND THAT IS CHECKED RATHER THAN ASSUMED.** All 30 leaves keep `marketplace_hidden`, and so do all four branches. Every consumer that could surface them reads the hidden flag **before** it ever looks at the tile — `lib/vendor-counts.ts` (`if (meta.marketplaceHidden) continue;`, which is why `/explore` still skips these four branches as zero-canonical), `lib/vendor-coverages.ts` (feeds both the `/open-shop` picker and the coverage editor, and drops a hidden *branch* too), and `lib/vendor-service-vocab.ts`. Filing is bookkeeping; it is not a door.

🚨 **AND THE FOUR BRANCHES HAD NEVER EXISTED OUTSIDE PRODUCTION.** They were created through the admin console on **2026-07-03 20:49:27Z — all four in the same second** — and no migration has ever named them in a `CREATE` or an `INSERT`: `grep -rn "'officiants'" supabase/migrations` returns exactly **one** hit, an `UPDATE` in `20270832295038` that has been matching **zero rows in every replay and every fresh database** since the day it merged. So the migration's first section is not defensive boilerplate — without it the filing `UPDATE`s would blow the `canonical_service_taxonomy.tile_id → service_categories(id)` foreign key everywhere except prod. It reproduces prod's own labels, slugs, sort orders, hidden flag and event scoping, so the replay and production finally agree.

⚖ **One judgement call, stated rather than buried.** `visa_wedding_logistics` was foldered `planning` while its two obvious siblings were foldered `venue`. It moves to `venue` with them, because Paperwork & Government hangs off `venue` and this table's invariant is `folder_id` = the branch's `parent_id` — measured clean across all 245 already-filed rows, and now pinned. Filing it under Travel & Honeymoon would have preserved the folder and been wrong about the thing itself.

**Also fixed, found on the way:** `crew_meal_supply` is the only leaf under Feast › Crew Meals, it is marketplace-**visible**, and it had **no `canonical_service_schemas` row** — the 2026-07-08 migration that created the tile re-emitted the taxonomy seed and never added the schema. Two silent consequences: it was absent from the admin Services list (built from that table), so nobody could edit its name or attributes; and the `/open-shop` picker fell through to `humanize(canonical_service)` for its label. The display name inserted is byte-identical to what `humanize` already rendered, so **nothing a person reads changes** — the row exists so the name becomes editable.

**The code constant moves with the database, deliberately.** `apps/web/lib/taxonomy.ts` is still the authoring source that `scripts/gen-taxonomy-seed.ts` re-emits into full-seed migrations — it has been re-emitted at least twice (`20270520996335`, `20270825054104`), each time as a whole-tree `INSERT … ON CONFLICT DO UPDATE`. Filing only in SQL would have left the next regeneration free to quietly un-file all 30. So the four branches join `WeddingTile` / `TILE_PARENT` / `WEDDING_TILE_ORDER` / `WEDDING_TILE_LABEL` / `WEDDING_TILE_SLUG`, and all 30 entries name their tile. The stale docblocks that described the old rule are corrected in place.

🔑 **The exhaustive `Record<WeddingTile, …>` types did their job**: adding four tiles turned up two more maps that had to keep up — `WEDDING_TILE_ICON` and the 3-D plan's `BOOTH_TEMPLATES` — neither of which a grep for the tile names would have found. Both filled, with a comment saying these four never render for a couple.

🛡 **New guard `apps/web/tests/db/every-service-has-a-tile.db.test.ts`, 6 cases, and it asserts BOTH directions.** "Every service has a tile" alone is satisfied by a change that files these *and* makes them sellable — which would silently open a supplier category (officiants, marriage licences) the owner has never agreed to sell. So it also pins `marketplace_hidden` on all 30 leaves and all four branches, the `folder_id` = parent invariant, that every `tile_id` names a live **tier-2** branch (the FK proves existence, not tier), and a **floor** of ≥30 filed rather than an exact 30 — an exact count goes red on the first legitimate 31st celebrant and gets relaxed by whoever hits it. Case 1 is a population floor, because the whole class of bug here is a tree that isn't in the database being measured.

**What was NOT wrong**, checked and reported rather than churned: zero services are misfiled (every filed row's folder already matched its branch's parent, all 245 of them), zero pending vendor category requests, zero unanchored refinement leaves, and the two other empty branches are fine — `filipiniana_barongs` is a documented cross-view fed by `FILIPINIANA_BARONG_CANONICALS`, and `editorial` is genuinely empty but `/explore` skips a zero-canonical tile, so no couple meets a dead category.

**Named, not fixed:** `setnayan_pakanta` exists in `canonical_service_taxonomy` and **not** in the code `TAXONOMY_MAP`, so `/explore` drops it on the `TAXONOMY_MAP[c] !== undefined` filter. Adding it would change what renders on a public page; that is a product call, not a taxonomy tidy-up.

🔴 **OWNER DECISION, deliberately not made here:** whether officiants, pre-marriage counselling, marriage paperwork and honeymoon planners should become things a supplier can list and a couple can book. Today they deliberately are not, per the 2026-05-31 lock. This change makes the admin tree tell the truth about them; it does not reopen that question.

SPEC IMPACT: None on price, SKU or product scope. Data + placement only; no service changes visibility, and no couple- or supplier-facing surface renders differently.
