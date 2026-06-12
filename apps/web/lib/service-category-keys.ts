/**
 * service-category-keys.ts — cross-vocabulary resolver for
 * `vendor_services.category` (and the surfaces that read it).
 *
 * Three vocabularies coexist in that TEXT column:
 *
 *   1. canonical_service keys (~200 · lib/taxonomy.ts TAXONOMY_MAP /
 *      canonical_service_taxonomy) — the FORWARD vocabulary. The vendor
 *      Services picker writes these from 2026-06-12 on, and the couple-side
 *      scoping queries (`canonicalsForGroup` → `.in('category', …)`) already
 *      speak it.
 *   2. WeddingTile keys (~53) — tile-level listings (admin-seeded rows, e.g.
 *      'photo_video') are legal and bucket under themselves.
 *   3. legacy VendorCategory keys (30 · lib/vendors.ts) — frozen rows written
 *      by the pre-taxonomy picker. Anchored to tiles via
 *      lib/vendor-category-taxonomy.ts; never written again, never re-tagged.
 *
 * Every helper here accepts ANY of the three and resolves through the
 * constants (the DB snapshot is seeded from them, so the sync path stays
 * deploy-consistent; pass a live TaxonomySnapshot where admin edits must win).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  TAXONOMY_MAP,
  TILE_PARENT,
  WEDDING_TILE_LABEL,
  WEDDING_TILE_ORDER,
  type WeddingFolder,
  type WeddingTile,
} from './taxonomy';
import type { TaxonomySnapshot } from './taxonomy-db';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from './vendors';
import { tilesForVendorCategory } from './vendor-category-taxonomy';

const TILE_SET: ReadonlySet<string> = new Set(WEDDING_TILE_ORDER);
const LEGACY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

/** 'mini_nail_bar' → 'Mini nail bar' — last-resort label for unknown keys. */
export function humanizeCategoryKey(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.length === 0 ? key : words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The tile(s) a service-category key surfaces under, whatever vocabulary it
 * uses. Canonical → primary tile + secondary tiles; tile → itself; legacy →
 * its bridge anchor(s); unknown / exempt / marketplace-hidden → [].
 */
export function tilesForServiceKey(
  key: string,
  tax?: TaxonomySnapshot,
): WeddingTile[] {
  const map = tax?.map ?? TAXONOMY_MAP;
  const entry = map[key];
  if (entry) {
    const tiles: WeddingTile[] = [];
    if (entry.tile) tiles.push(entry.tile);
    for (const t of entry.secondary_tiles ?? []) {
      if (!tiles.includes(t)) tiles.push(t);
    }
    return tiles;
  }
  const liveTiles: ReadonlySet<string> = tax ? new Set(tax.tileOrder) : TILE_SET;
  if (liveTiles.has(key)) return [key as WeddingTile];
  if (LEGACY_SET.has(key)) return tilesForVendorCategory(key as VendorCategory);
  return [];
}

/** Parent folder(s) of the 10 a service-category key rolls up into. */
export function foldersForServiceKey(
  key: string,
  tax?: TaxonomySnapshot,
): WeddingFolder[] {
  const tileParent = tax?.tileParent ?? TILE_PARENT;
  const out: WeddingFolder[] = [];
  for (const tile of tilesForServiceKey(key, tax)) {
    const folder = tileParent[tile] as WeddingFolder | undefined;
    if (folder && !out.includes(folder)) out.push(folder);
  }
  return out;
}

/**
 * Human label for a service-category key. Resolution order:
 * DB canonical label (display_name_en, when the caller fetched one) → live /
 * constant tile label → legacy VendorCategory label → humanized key. Fixes
 * the raw-key rendering ('photo_video') the legacy-only resolver produced.
 */
export function serviceCategoryKeyLabel(
  key: string,
  opts?: {
    canonicalLabels?: ReadonlyMap<string, string>;
    tax?: TaxonomySnapshot;
  },
): string {
  const fromDb = opts?.canonicalLabels?.get(key);
  if (fromDb && fromDb.trim().length > 0) return fromDb;
  const tileLabel = opts?.tax
    ? opts.tax.tileLabel[key]
    : (WEDDING_TILE_LABEL as Record<string, string>)[key];
  if (tileLabel) return tileLabel;
  if (LEGACY_SET.has(key)) return VENDOR_CATEGORY_LABEL[key as VendorCategory];
  return humanizeCategoryKey(key);
}

/**
 * display_name_en for canonical keys, straight from canonical_service_schemas
 * (the same source the marketplace sidebar + admin taxonomy viewer read).
 * Missing table / RLS / transient errors degrade to an empty map — callers
 * fall back to tile / legacy / humanized labels.
 */
export async function fetchCanonicalServiceLabels(
  supabase: SupabaseClient,
  keys?: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  try {
    let query = supabase
      .from('canonical_service_schemas')
      .select('canonical_service, display_name_en');
    if (keys && keys.length > 0) {
      query = query.in('canonical_service', [...new Set(keys)]);
    }
    const { data, error } = await query;
    if (error) return new Map();
    const out = new Map<string, string>();
    for (const row of (data ?? []) as {
      canonical_service: string;
      display_name_en: string | null;
    }[]) {
      if (row.display_name_en) out.set(row.canonical_service, row.display_name_en);
    }
    return out;
  } catch {
    return new Map();
  }
}

/**
 * Widen a canonical-key scope into every vocabulary that may appear in
 * `vendor_services.category`, for `.in('category', …)` queries.
 *
 * The couple-side scoping helpers emit canonical keys only — which silently
 * missed every legacy-keyed row (pre-taxonomy picker writes) and every
 * tile-keyed row. This adds: the canonicals' tiles, and every legacy
 * VendorCategory whose bridge anchor intersects those tiles. Pure widening —
 * the original keys always survive.
 */
export function expandCategoryKeysForQuery(
  keys: ReadonlyArray<string>,
  tax?: TaxonomySnapshot,
): string[] {
  const out = new Set<string>(keys);
  const tiles = new Set<WeddingTile>();
  for (const key of keys) {
    for (const tile of tilesForServiceKey(key, tax)) tiles.add(tile);
  }
  for (const tile of tiles) out.add(tile);
  for (const legacy of VENDOR_CATEGORIES) {
    if (tilesForVendorCategory(legacy).some((t) => tiles.has(t))) out.add(legacy);
  }
  return [...out];
}

/**
 * Is this key one the create-service action should accept? Live canonical
 * (not marketplace-hidden — those never list publicly), live tile, or legacy
 * (kept so an old bookmarked ?add= link doesn't 500 — the picker no longer
 * offers them).
 */
export function isAcceptedServiceCategoryKey(
  key: string,
  tax?: TaxonomySnapshot,
): boolean {
  const map = tax?.map ?? TAXONOMY_MAP;
  const entry = map[key];
  if (entry) return entry.marketplaceHidden !== true;
  const liveTiles: ReadonlySet<string> = tax ? new Set(tax.tileOrder) : TILE_SET;
  return liveTiles.has(key) || LEGACY_SET.has(key);
}
