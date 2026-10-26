/**
 * lib/taxonomy-surfaces-agree.ts — "Surfaces disagreeing", the RUNTIME half of the one-source guard
 * (🌳 corpus prototypes/admin_taxonomy_four_levels_2026-10-26/PLAN.md § 8.3: "at request time it runs the
 * same registry of reader families against the live snapshot and lists any family whose answer ≠ the
 * DB's, with the file that owns it; empty = 'Every surface reads this page.' It replaces
 * brokenCoupleLinks's bare number. Because it runs against prod, it catches what a replay cannot.").
 *
 * PURE. /admin/categories reads the live taxonomy, the code fallback, the parts reader and the parts
 * tables, and hands the answers in; this decides which families disagree. Each family is a fact a
 * surface reads, and the owner is the file to open when it disagrees:
 *
 *   taxonomy reader   `getTaxonomy()` answered from the code copy (the tables could not be read) —
 *                     then EVERY surface is reading `lib/taxonomy.ts`, not this page.
 *   tile → services   the files still allowed to read the CONST buckets (`CONST_BUCKET_READERS` below,
 *                     the same list `lib/one-source-buckets.test.ts` enforces) answer differently from
 *                     the live buckets for some category — an admin edit they cannot see.
 *   parts reader      `getInspirationParts()` answered from the seed, or its services differ from the
 *                     `inspiration_part_services` rows this page edits.
 *   category key      couple-side category keys that point at no category (`validateVendorCategoryMapping`).
 *   plan groups       a planning group whose `catalogTile` is not a live, visible category (③0-g's
 *                     minimum runtime guard, until the ladder is derived).
 */

/**
 * Product files still allowed to read the CONST tile → services buckets (`canonicalServicesForTile`,
 * `fallbackCanonicalBuckets` from lib/vendor-counts.ts) — each with its exit. ONE list: the CI guard
 * `lib/one-source-buckets.test.ts` imports it, and the page names these files when they disagree.
 */
export const CONST_BUCKET_READERS: Readonly<Record<string, string>> = {
  'lib/vendor-counts.ts': 'defines them',
  'lib/moodboard-gallery.ts':
    'inspiration-part helpers (canonicalServicesForSlot · tradeLabelForCredit · galleryFromServices) — ③0-b owns this file; ③a makes a part name SERVICES, which removes the tile expansion here',
  'lib/moodboard-finalization.ts':
    'supplier sign-off (tradesForPart / canonicalServicesForPart / eligibleSuppliersForPart) — ③0-b owns this file, same exit as above',
};

export type SurfaceDisagreement = { family: string; owner: string; detail: string };

export type SurfacesInput = {
  taxonomySource: 'db' | 'fallback';
  /** Every live tier-2 category id. */
  categoryIds: readonly string[];
  /** Hidden category ids (marketplace_hidden). */
  hiddenIds: ReadonlySet<string>;
  /** The live buckets (`getCanonicalBuckets()`) and the const ones (`deriveBuckets(fallbackSnapshot())`). */
  liveByTile: ReadonlyMap<string, readonly string[]>;
  constByTile: ReadonlyMap<string, readonly string[]>;
  /** `getInspirationParts()` — its source and services per part (null = fallback with no services). */
  partsReaderSource: 'db' | 'fallback';
  partsReaderServices: Readonly<Record<string, readonly string[] | null>>;
  /** The tables this page edits (`inspiration_part_services`), or null when they could not be read. */
  partsTableServices: Readonly<Record<string, readonly string[]>> | null;
  brokenCoupleLinks: number;
  planGroups: ReadonlyArray<{ id: string; label: string; catalogTile?: string | null }>;
};

const same = (a: readonly string[] = [], b: readonly string[] = []) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export function surfacesDisagreeing(i: SurfacesInput): SurfaceDisagreement[] {
  const out: SurfaceDisagreement[] = [];
  if (i.taxonomySource === 'fallback') {
    out.push({ family: 'Taxonomy reader', owner: 'lib/taxonomy-db.ts', detail: 'The category tree could not be read — every surface is showing the code copy, not this page.' });
  }
  const tiles = new Set([...i.categoryIds, ...i.constByTile.keys()]);
  const differ = [...tiles].filter((t) => !same(i.liveByTile.get(t) ?? [], i.constByTile.get(t) ?? []));
  if (differ.length > 0) {
    const owners = Object.keys(CONST_BUCKET_READERS).filter((f) => f !== 'lib/vendor-counts.ts');
    out.push({
      family: 'Tile → services',
      owner: owners.join(' · '),
      detail: `${differ.length} ${differ.length === 1 ? 'category answers' : 'categories answer'} differently in the code copy these files still read (${differ.slice(0, 4).join(', ')}${differ.length > 4 ? ', …' : ''}).`,
    });
  }
  if (i.partsTableServices) {
    if (i.partsReaderSource === 'fallback') {
      out.push({ family: 'Parts reader', owner: 'lib/inspiration-parts-db.ts', detail: 'Inspiration parts answered from the seed — couples and shops do not see the parts on this page.' });
    } else {
      const keys = new Set([...Object.keys(i.partsTableServices), ...Object.keys(i.partsReaderServices)]);
      const off = [...keys].filter((k) => !same(i.partsTableServices![k] ?? [], i.partsReaderServices[k] ?? []));
      if (off.length) {
        out.push({ family: 'Parts reader', owner: 'lib/inspiration-parts-db.ts', detail: `${off.length} part${off.length === 1 ? '' : 's'} read different services than this page holds (${off.slice(0, 4).join(', ')}).` });
      }
    }
  }
  if (i.brokenCoupleLinks > 0) {
    out.push({
      family: 'Category key',
      owner: 'lib/vendor-category-taxonomy.ts',
      detail: `${i.brokenCoupleLinks} couple-side link${i.brokenCoupleLinks === 1 ? '' : 's'} point${i.brokenCoupleLinks === 1 ? 's' : ''} at a category that no longer exists.`,
    });
  }
  const live = new Set(i.categoryIds);
  const stale = i.planGroups.filter((g) => g.catalogTile && (!live.has(g.catalogTile) || i.hiddenIds.has(g.catalogTile)));
  if (stale.length) {
    out.push({
      family: 'Plan groups',
      owner: 'lib/wedding-plan-groups.ts',
      detail: `${stale.length} planning group${stale.length === 1 ? '' : 's'} point${stale.length === 1 ? 's' : ''} at a category that is gone or hidden (${stale.slice(0, 4).map((g) => g.label).join(', ')}).`,
    });
  }
  return out;
}
