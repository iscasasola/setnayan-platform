/**
 * `getTaxonomy()` minus the network: the replayed `service_categories` (tier ≤ 2, as the reader
 * filters) + `canonical_service_taxonomy` rows through the reader's own `snapshotFromRows`.
 *
 * `SELECT *`, not a hand-typed column list — `snapshotFromRows` reads only the fields the reader
 * selects, so a superset is the reader's input exactly, and no second column list can drift.
 * Shared by the db tests that must judge a resolver against the DATABASE, not the code fallback.
 */
import type { PGlite } from '@electric-sql/pglite';

import { snapshotFromRows, type CategoryRow, type MapRow, type TaxonomySnapshot } from '../../lib/taxonomy-snapshot';

export async function taxonomyFromDb(db: PGlite): Promise<TaxonomySnapshot> {
  const cats = await db.query<CategoryRow>(`SELECT * FROM public.service_categories WHERE tier <= 2`);
  const maps = await db.query<MapRow>(`SELECT * FROM public.canonical_service_taxonomy`);
  if (cats.rows.length === 0 || maps.rows.length === 0) {
    throw new Error('taxonomyFromDb: the taxonomy seed did not replay — a test on it would check nothing');
  }
  return snapshotFromRows(cats.rows, maps.rows);
}
