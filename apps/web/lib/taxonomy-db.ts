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
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_LABEL,
  WEDDING_FOLDER_SHORT_LABEL,
  WEDDING_FOLDER_SLUG,
  WEDDING_TILE_ORDER,
  TILE_PARENT,
  WEDDING_TILE_LABEL,
  WEDDING_TILE_SLUG,
  WEDDING_TILES_BY_PARENT,
  TAXONOMY_MAP,
  type WeddingFolder,
  type WeddingTile,
  type TaxonomyPhase,
  type TaxonomyEntry,
} from './taxonomy';

/**
 * Plain, fully-serializable mirror of the taxonomy constants — safe to pass
 * from a server component into a client component (Phase 2b provider).
 */
export type TaxonomySnapshot = {
  /** 'db' when reconstructed from the tables, 'fallback' when the constant was used. */
  source: 'db' | 'fallback';
  folderOrder: WeddingFolder[];
  folderLabel: Record<string, string>;
  folderShortLabel: Record<string, string>;
  folderSlug: Record<string, string>;
  tileOrder: WeddingTile[];
  tileParent: Record<string, WeddingFolder>;
  tileLabel: Record<string, string>;
  tileSlug: Record<string, string>;
  tilesByParent: Record<string, WeddingTile[]>;
  /** canonical_service → metadata (the TAXONOMY_MAP equivalent). */
  map: Record<string, TaxonomyEntry>;
};

/** Build the snapshot straight from the lib/taxonomy.ts constants. */
function fallbackSnapshot(): TaxonomySnapshot {
  return {
    source: 'fallback',
    folderOrder: [...WEDDING_FOLDER_ORDER],
    folderLabel: { ...WEDDING_FOLDER_LABEL },
    folderShortLabel: { ...WEDDING_FOLDER_SHORT_LABEL },
    folderSlug: { ...WEDDING_FOLDER_SLUG },
    tileOrder: [...WEDDING_TILE_ORDER],
    tileParent: { ...TILE_PARENT },
    tileLabel: { ...WEDDING_TILE_LABEL },
    tileSlug: { ...WEDDING_TILE_SLUG },
    tilesByParent: Object.fromEntries(
      Object.entries(WEDDING_TILES_BY_PARENT).map(([k, v]) => [k, [...v]]),
    ),
    map: { ...TAXONOMY_MAP },
  };
}

type CategoryRow = {
  id: string;
  parent_id: string | null;
  tier: number;
  label_en: string;
  label_short: string | null;
  slug: string;
  sort_order: number;
};

type MapRow = {
  canonical_service: string;
  folder_id: string;
  tile_id: string | null;
  phase: string;
  faith: string | null;
  is_ph: boolean;
  is_setnayan: boolean;
  is_rental: boolean;
  dietary: string | null;
  is_tradition: boolean;
  marketplace_hidden: boolean;
  secondary_tiles: string[] | null;
};

/** Reconstruct the snapshot from DB rows. Pure — no I/O. */
function snapshotFromRows(cats: CategoryRow[], maps: MapRow[]): TaxonomySnapshot {
  const parents = cats
    .filter((c) => c.tier === 1)
    .sort((a, b) => a.sort_order - b.sort_order);
  const tiles = cats
    .filter((c) => c.tier === 2)
    .sort((a, b) => a.sort_order - b.sort_order);

  const folderLabel: Record<string, string> = {};
  const folderShortLabel: Record<string, string> = {};
  const folderSlug: Record<string, string> = {};
  for (const p of parents) {
    folderLabel[p.id] = p.label_en;
    folderShortLabel[p.id] = p.label_short ?? p.label_en;
    folderSlug[p.id] = p.slug;
  }

  const tileParent: Record<string, WeddingFolder> = {};
  const tileLabel: Record<string, string> = {};
  const tileSlug: Record<string, string> = {};
  const tilesByParent: Record<string, WeddingTile[]> = {};
  for (const p of parents) tilesByParent[p.id] = [];
  for (const t of tiles) {
    if (t.parent_id) {
      tileParent[t.id] = t.parent_id as WeddingFolder;
      (tilesByParent[t.parent_id] ??= []).push(t.id as WeddingTile);
    }
    tileLabel[t.id] = t.label_en;
    tileSlug[t.id] = t.slug;
  }

  const map: Record<string, TaxonomyEntry> = {};
  for (const m of maps) {
    const entry: TaxonomyEntry = {
      folder: m.folder_id as WeddingFolder,
      phase: m.phase as TaxonomyPhase,
    };
    if (m.tile_id) entry.tile = m.tile_id as WeddingTile;
    if (m.marketplace_hidden) entry.marketplaceHidden = true;
    if (m.faith) entry.faith = m.faith as TaxonomyEntry['faith'];
    if (m.is_ph) entry.ph = true;
    if (m.is_setnayan) entry.setnayan = true;
    if (m.is_rental) entry.rental = true;
    if (m.dietary) entry.dietary = m.dietary as TaxonomyEntry['dietary'];
    if (m.is_tradition) entry.tradition = true;
    if (m.secondary_tiles && m.secondary_tiles.length > 0) {
      entry.secondary_tiles = m.secondary_tiles as WeddingTile[];
    }
    map[m.canonical_service] = entry;
  }

  return {
    source: 'db',
    folderOrder: parents.map((p) => p.id as WeddingFolder),
    folderLabel,
    folderShortLabel,
    folderSlug,
    tileOrder: tiles.map((t) => t.id as WeddingTile),
    tileParent,
    tileLabel,
    tileSlug,
    tilesByParent,
    map,
  };
}

/**
 * The taxonomy as it currently lives in the DB (or the constant fallback).
 * Cached per request. Server-only — reads cookies via the Supabase client.
 */
export const getTaxonomy = cache(async (): Promise<TaxonomySnapshot> => {
  try {
    const sb = await createClient();
    const [catsRes, mapsRes] = await Promise.all([
      sb
        .from('service_categories')
        .select('id,parent_id,tier,label_en,label_short,slug,sort_order')
        .lte('tier', 2),
      sb
        .from('canonical_service_taxonomy')
        .select(
          'canonical_service,folder_id,tile_id,phase,faith,is_ph,is_setnayan,is_rental,dietary,is_tradition,marketplace_hidden,secondary_tiles',
        ),
    ]);

    const cats = catsRes.data as CategoryRow[] | null;
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
