/**
 * taxonomy-db.ts — the DB-backed read-through for the marketplace taxonomy.
 *
 * Phase 2 of the DB-backed-taxonomy build (spec 0023 §3.15 · the ♾️
 * "Admin Finalize = permanent live publish" lock). Reads the tree +
 * canonical mapping from the `service_categories` and
 * `canonical_service_taxonomy` tables (Phase 1, migration 20260803001000) and
 * reconstructs the SAME shapes the `lib/taxonomy.ts` constants expose, so a
 * server consumer can `await getTaxonomy()` and read DB-sourced taxonomy that
 * updates the moment an admin edits it — no deploy.
 *
 * SAFETY: every read is wrapped so an empty result or any error FALLS BACK to
 * the `lib/taxonomy.ts` constant. The DB is seeded FROM that constant
 * (generator: scripts/gen-taxonomy-seed.ts), so today the snapshot is
 * byte-equivalent to the constant — this layer is behavior-preserving until an
 * admin actually changes the DB. `source` reports which path was taken.
 *
 * Cached per request via React `cache()` (same pattern as lib/supabase/server,
 * lib/events) — one taxonomy read per render tree regardless of how many
 * server components await it.
 */
import { cache } from 'react';

import { createClient } from './supabase/server';
import {
  fallbackSnapshot,
  snapshotFromRows,
  type CategoryRow,
  type MapRow,
  type TaxonomySnapshot,
} from './taxonomy-snapshot';

// Re-export the snapshot type from its old home so existing importers
// (`import { type TaxonomySnapshot } from '@/lib/taxonomy-db'`) keep working.
export type { TaxonomySnapshot } from './taxonomy-snapshot';

/** The tree's columns, without the ⓘ (`hint_en`) — the shape the retry below falls back to. */
const CATEGORY_COLS =
  'id,parent_id,tier,label_en,label_short,slug,sort_order,applicable_event_types,icon_name,sample_photo_r2_key,marketplace_hidden,coarse_category';

/**
 * The taxonomy as it currently lives in the DB (or the constant fallback).
 * Cached per request. Server-only — reads cookies via the Supabase client.
 */
export const getTaxonomy = cache(async (): Promise<TaxonomySnapshot> => {
  try {
    const sb = await createClient();
    const readCats = (cols: string) => sb.from('service_categories').select(cols).lte('tier', 2);
    const [firstCatsRes, mapsRes] = await Promise.all([
      readCats(`${CATEGORY_COLS},hint_en`),
      sb
        .from('canonical_service_taxonomy')
        .select(
          'canonical_service,folder_id,tile_id,phase,faith,is_ph,is_setnayan,is_rental,dietary,is_tradition,marketplace_hidden,secondary_tiles',
        ),
    ]);

    // The ⓘ column (`hint_en`, owner 2026-10-31) must never take the whole tree down: if that read is refused
    // (e.g. a build running ahead of its migration), read again without it — every ⓘ then answers from the
    // fallback chain in lib/category-hints.ts, and the categories themselves stay the admin's.
    const catsRes = firstCatsRes.error ? await readCats(CATEGORY_COLS) : firstCatsRes;
    const cats = catsRes.data as unknown as CategoryRow[] | null;
    const maps = mapsRes.data as MapRow[] | null;

    // Fall back on any error, or if the tree/mapping haven't been seeded yet.
    if (
      catsRes.error ||
      mapsRes.error ||
      !cats ||
      !maps ||
      cats.length === 0 ||
      maps.length === 0
    ) {
      return fallbackSnapshot();
    }

    return snapshotFromRows(cats, maps);
  } catch {
    return fallbackSnapshot();
  }
});
