/**
 * taxonomy-read.ts — the reads behind `getTaxonomy()` (lib/taxonomy-db.ts), with the client passed IN so a stubbed
 * client can prove what a refused read draws (`taxonomy-read-is-honest.test.ts`). No Next server imports.
 *
 * SAFETY (unchanged from taxonomy-db.ts): an empty result or any error on the tree or the mapping FALLS BACK to the
 * `lib/taxonomy.ts` constant, and `source` says so.
 *
 * Two optional columns are read with a retry, so a build running ahead of its migration never takes the whole tree
 * down: the ⓘ (`service_categories.hint_en`) and how a service books (`canonical_service_taxonomy.availability_style`,
 * Availability plan step 2). 🔒 When the availability read is refused, the snapshot says UNKNOWN
 * (`serviceAvailability: null`) — never "Not set" for every service, which would look exactly like a fresh column.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fallbackSnapshot, snapshotFromRows, type CategoryRow, type MapRow, type TaxonomySnapshot } from './taxonomy-snapshot';

/** The tree's columns, without the ⓘ (`hint_en`) — the shape the retry below falls back to. */
const CATEGORY_COLS =
  'id,parent_id,tier,label_en,label_short,slug,sort_order,applicable_event_types,icon_name,sample_photo_r2_key,marketplace_hidden,coarse_category';

/** The mapping's columns, without `availability_style` — the shape its retry falls back to. */
const MAP_COLS =
  'canonical_service,folder_id,tile_id,phase,faith,is_ph,is_setnayan,is_rental,dietary,is_tradition,marketplace_hidden,secondary_tiles';

type ReadClient = Pick<SupabaseClient, 'from'>;

export async function readTaxonomyFrom(sb: ReadClient | null): Promise<TaxonomySnapshot> {
  if (!sb) return fallbackSnapshot();
  try {
    const readCats = (cols: string) => sb.from('service_categories').select(cols).lte('tier', 2);
    const readMaps = (cols: string) => sb.from('canonical_service_taxonomy').select(cols);
    const [firstCatsRes, firstMapsRes] = await Promise.all([readCats(`${CATEGORY_COLS},hint_en`), readMaps(`${MAP_COLS},availability_style`)]);

    // The ⓘ column (`hint_en`, owner 2026-10-31) must never take the whole tree down: if that read is refused
    // (e.g. a build running ahead of its migration), read again without it — every ⓘ then answers from the
    // fallback chain in lib/category-hints.ts, and the categories themselves stay the admin's.
    const catsRes = firstCatsRes.error ? await readCats(CATEGORY_COLS) : firstCatsRes;
    // Same for how a service books: read again without it, and say the setting is UNKNOWN (not "Not set").
    const availabilityRead = !firstMapsRes.error;
    const mapsRes = firstMapsRes.error ? await readMaps(MAP_COLS) : firstMapsRes;
    const cats = catsRes.data as unknown as CategoryRow[] | null;
    const maps = mapsRes.data as unknown as MapRow[] | null;

    // Fall back on any error, or if the tree/mapping haven't been seeded yet.
    if (catsRes.error || mapsRes.error || !cats || !maps || cats.length === 0 || maps.length === 0) {
      return fallbackSnapshot();
    }

    return snapshotFromRows(cats, maps, { availabilityRead });
  } catch {
    return fallbackSnapshot();
  }
}
