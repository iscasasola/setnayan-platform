## 2026-10-26 · feat(admin/categories): ③b — the four-level map (Groups | Categories | Services | Parts), part picker, service cards, Download ▾, "Surfaces disagreeing"

Owner 2026-10-26, verbatim *"Build the taxonomy"* (DECISION_LOG "APPROVED — BUILD THE TAXONOMY", "CONTROLLER
CALLS ON THE TAXONOMY FOUNDATION", rulings "no fifth column" + the per-service part picker). Built on the SHIPPED
page `/admin/categories` ("Categories & event types"): its "Supplier categories" list IS the four-level map now;
Event types and Religions are unchanged; the shipped Show ▾ views Requests · Unfiled · Religion-tagged ·
Event-scoped · Words waiting keep their list + panel. Stacked on `rd/taxonomy-foundation`.

- **Desktop:** four columns with SVG connector lines service → part, drawn only in the gap between Services and
  Parts. Picking a service is the Finder shift — Categories | Services | Parts | Cards with a breadcrumb back;
  **never five columns** (`columnsFor` + `map-shows-at-most-four-columns.test.ts`). Parts follow the picked service.
- **Phone:** photo tiles one level at a time (All › group › category), a Map toggle with the lines in a 44-px
  gutter, Services / Parts / Cards as titled blocks, a full-screen drawer.
- **Drawer per item:** the shipped Group / Category / Service panels (gaining Order ▾ on a group and a service,
  "Files shops as ▾" + Parts + Service cards on a category, Inspiration parts + Service cards on a service) and two
  new ones — Part (Name · Move to ▾ with Undo · Order ▾ · Services ▾ · cards that can add photos · Hidden) and
  Service card (facts · shop · Live/Held from `is_active` + shop visibility).
- **Add:** the last row of every column ("＋ Add a group / category / service"; tap · type · Enter; near matches
  inline; "add as a search word instead"). The top "+ Add" / "Goes under ▾" row is deleted (`AddServiceOrCategory`).
  A new group is born HIDDEN and shows with its first category (controller call). "＋ Add a part" opens the picker:
  the whole library, tick = link this service (`inspiration_part_services`), untick = unlink, or create a new part
  (home = this category, linked to the service).
- **Move / order:** desktop drag a category onto a group, a service or a part onto a category — "Moved to … · Undo".
- **Needs a look:** categories with no service · parts with no service · held cards · categories whose shops are
  filed under Other. **Search** reaches all four levels with icon + path ("via …" for a part found by its service).
- **Download ▾:** printable tree (A4 PDF, pdf-lib) + CSV (`group,category,service,service_key,part,part_key,home,
  hidden`, gaps kept) from `GET /admin/categories/export?format=pdf|csv&show=&q=`, which re-checks admin and 404s.
- **"Surfaces disagreeing"** (PLAN § 8.3): one line under the toolbar runs every reader family against the live
  tables (taxonomy reader · const tile→services readers · parts reader · category key · plan groups) —
  "Every surface reads this page." when none. `CONST_BUCKET_READERS` is now ONE list shared with
  `lib/one-source-buckets.test.ts`.
- **One core per write:** `_components/taxonomy-writes.ts` — `createTaxonomyNode`, `createCanonicalLeaf` and
  `remapCanonical` were refactored onto it, and the map's JSON doors (`four-level-actions.ts`) call the same cores.
- **Migration `20271292221070_a_service_keeps_its_place_among_its_category.sql`:** `canonical_service_taxonomy.
  sort_order INT NOT NULL DEFAULT 0` — Order ▾ on a service (PLAN § 7.3 said grep before adding; it did not exist).
  All zero = today's A–Z; only this page reads it.
- **Not built (said, not hidden):** Approve · Ask to fix · Reject on a held card (Integrity watch › Cards has no such
  actions on main — omitted rather than a second editor); card-check status (the card-checks PRs are unmerged —
  `is_active` + shop visibility stand in, PLAN § 7.8); a part's photo count; Delete part.
- Dev lab `/dev/categories-lab` draws the real map + panels with no sign-in (404 in production).

SPEC IMPACT: corpus `prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md` § 12 build record (what shipped,
what moved, the schema column, the not-built list). No locked SKU, schema rename or retired feature. ⚑ Flag for the
owner: services' Order ▾ orders them on this page only (couples and shops still see A–Z) — said in the column ⓘ.
