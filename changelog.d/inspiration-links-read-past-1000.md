## 2026-10-30 · fix(inspiration): the parts' links are read past row 1,000

PR #7058 seeded 272 starter parts and 2,384 links, taking `inspiration_part_services` to ~2,769 rows. Every
reader selected the whole relation in one request; PostgREST caps a request at 1,000 rows with `error: null`,
so Admin › Categories › Reception › Events Place showed only its 2 old parts and the couple's Mood Board, the
supplier's Part ▾, collections, the seating lab and the wizard lost every link past row 1,000.

- `lib/inspiration-parts-db.ts` gains `readEveryPartRow` / `readInspirationPartTables`, which page the three relations
  through the existing `readAllPages`, ordered by each relation's unique key and proved against the server's exact
  count. A failed page or a read that stops short is an error, never a partial list.
- The chains stay literal `.from('…')` in that file so the Ugat screens map (two imports deep) still sees the
  tables on every screen that reads them.
- `getInspirationParts()` (fallback on error), `loadMapData` ("Couldn't load the parts" on error) and
  `addPartCore` (refuses the add on error) read through it.
- `tests/db/supabase-over-pglite.ts` models `.range()`, `select(…, { count: 'exact' })`, appended `.order()`s and
  a `maxRows` cap shaped like PostgREST's `db-max-rows`.
- Guards: `lib/inspiration-parts-are-read-to-the-end.test.ts` (helper + source guard: no unbounded select of the
  part relations anywhere) and `tests/db/inspiration-links-read-past-1000.db.test.ts` (real readers over the
  replayed seed under a 1,000-row cap).

SPEC IMPACT: None
