/**
 * taxonomy-snapshot.ts — the PURE (no I/O, no Next server imports) half of the
 * DB-backed taxonomy read-through. Holds the serializable `TaxonomySnapshot`
 * type + the two reconstruction functions (`fallbackSnapshot`,
 * `snapshotFromRows`). Split out of `taxonomy-db.ts` (which owns the Supabase
 * read + request cache) so this logic is unit-testable without pulling in
 * `next/headers` / the server client. `taxonomy-db.ts` re-exports the type.
 */
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
  /** tile id → applicable event_type_vocab keys. null / [] = universal (serves all events). */
  tileEventTypes: Record<string, string[] | null>;
  /**
   * category id (folder OR tile) → admin-set Lucide icon name, or null when the
   * node has no override (fall back to the code default). Covers both tiers; the
   * constant fallback has no overrides → empty map (every consumer keeps its
   * hardcoded default). Validate the value before rendering — `getLucideIcon()`
   * (lib/nav-icons.ts) returns null for anything off the allowlist.
   */
  categoryIcons: Record<string, string | null>;
  /**
   * category id (folder OR tile) → stored sample-photo ref (`r2://…` or a
   * legacy URL / `/public` path), or null. Resolve to a display URL with
   * `displayUrlForStoredAsset()` (lib/uploads.ts). Empty on the fallback path.
   */
  categoryPhotos: Record<string, string | null>;
  /**
   * category id (folder OR tile) → true when admin-flagged marketplace_hidden
   * in service_categories. Couple-facing consumers (/explore tile grid,
   * onboarding pickers) must skip hidden ids; admin + vendor surfaces keep
   * them. Sparse — only true entries stored. Empty on the fallback path.
   */
  hiddenCategories: Record<string, true>;
  /** canonical_service → metadata (the TAXONOMY_MAP equivalent). */
  map: Record<string, TaxonomyEntry>;
};

export type CategoryRow = {
  id: string;
  parent_id: string | null;
  tier: number;
  label_en: string;
  label_short: string | null;
  slug: string;
  sort_order: number;
  applicable_event_types: string[] | null;
  icon_name: string | null;
  sample_photo_r2_key: string | null;
  marketplace_hidden: boolean;
};

export type MapRow = {
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

/** Build the snapshot straight from the lib/taxonomy.ts constants. */
export function fallbackSnapshot(): TaxonomySnapshot {
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
    tileEventTypes: {}, // constant fallback has no event scoping → all universal
    categoryIcons: {}, // constant fallback has no admin icon overrides → all default
    categoryPhotos: {}, // constant fallback has no admin photo overrides
    hiddenCategories: {}, // constant fallback has no hidden tiles
    map: { ...TAXONOMY_MAP },
  };
}

/** Reconstruct the snapshot from DB rows. Pure — no I/O. */
export function snapshotFromRows(cats: CategoryRow[], maps: MapRow[]): TaxonomySnapshot {
  const parents = cats
    .filter((c) => c.tier === 1)
    .sort((a, b) => a.sort_order - b.sort_order);
  const tiles = cats
    .filter((c) => c.tier === 2)
    .sort((a, b) => a.sort_order - b.sort_order);

  // Icon/photo overrides cover BOTH tiers (folders + tiles), keyed by category id.
  // hiddenCategories is sparse: only admin-flagged (true) ids get an entry;
  // absent = visible (default), same as false.
  const categoryIcons: Record<string, string | null> = {};
  const categoryPhotos: Record<string, string | null> = {};
  const hiddenCategories: Record<string, true> = {};
  for (const c of cats) {
    categoryIcons[c.id] = c.icon_name ?? null;
    categoryPhotos[c.id] = c.sample_photo_r2_key ?? null;
    if (c.marketplace_hidden) hiddenCategories[c.id] = true;
  }

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
  const tileEventTypes: Record<string, string[] | null> = {};
  for (const p of parents) tilesByParent[p.id] = [];
  for (const t of tiles) {
    if (t.parent_id) {
      tileParent[t.id] = t.parent_id as WeddingFolder;
      (tilesByParent[t.parent_id] ??= []).push(t.id as WeddingTile);
    }
    tileLabel[t.id] = t.label_en;
    tileSlug[t.id] = t.slug;
    tileEventTypes[t.id] =
      t.applicable_event_types && t.applicable_event_types.length > 0
        ? t.applicable_event_types
        : null; // null = universal (serves all events)
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
    tileEventTypes,
    categoryIcons,
    categoryPhotos,
    hiddenCategories,
    map,
  };
}
