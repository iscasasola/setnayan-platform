/**
 * /dev/suppliers-lab — a category the owner ADDED IN ADMIN, for the ⓘ (owner 2026-10-31, live: "I added a category
 * shoes but there is not (i)").
 *
 * `&shoes=1` puts a "Shoes" category under Attire, hair & make-up that NO code map knows (not `TILE_HINTS`, not a
 * plan group) — exactly the case that used to hide its ⓘ — with two services as Admin names them, so the ⓘ reads
 * the line built from Admin's own data. `&shoes=written` gives it the owner's own ⓘ text instead, as if written on
 * Admin › Categories › Shoes › Name › ⓘ text. Nothing here is read from a database.
 */
import { fallbackSnapshot, type TaxonomySnapshot } from '@/lib/taxonomy-snapshot';
import type { TaxonomyEntry, WeddingFolder, WeddingTile } from '@/lib/taxonomy';

export const LAB_SHOES_TILE = 'shoes' as WeddingTile;

/** The services filed under Shoes, as Admin › Categories names them (`canonical_service_schemas.display_name_en`). */
export const LAB_SHOE_SERVICE_LABELS: Readonly<Record<string, string>> = {
  bridal_shoes: 'Bridal shoes',
  custom_heels: 'Custom heels',
  groom_shoes: 'Groom’s shoes',
};

/** The owner's own ⓘ text for Shoes (`&shoes=written`). */
export const LAB_SHOES_WRITTEN = 'Heels, flats and dress shoes — the pair you walk the aisle in, and the one you dance in.';

/** The shipped taxonomy plus the owner's Shoes category under `look`. */
export function labShoesTaxonomy(written: boolean): TaxonomySnapshot {
  const t = fallbackSnapshot();
  const look = 'look' as WeddingFolder;
  t.tileOrder = [...t.tileOrder, LAB_SHOES_TILE];
  t.tileParent = { ...t.tileParent, [LAB_SHOES_TILE]: look };
  t.tileLabel = { ...t.tileLabel, [LAB_SHOES_TILE]: 'Shoes' };
  t.tileSlug = { ...t.tileSlug, [LAB_SHOES_TILE]: 'shoes' };
  t.tilesByParent = { ...t.tilesByParent, [look]: [...(t.tilesByParent[look] ?? []), LAB_SHOES_TILE] };
  const entry: TaxonomyEntry = { folder: look, phase: 'V1.1 base', tile: LAB_SHOES_TILE };
  t.map = { ...t.map, ...Object.fromEntries(Object.keys(LAB_SHOE_SERVICE_LABELS).map((k) => [k, entry])) };
  t.categoryHints = written ? { [LAB_SHOES_TILE]: LAB_SHOES_WRITTEN } : {};
  return t;
}
