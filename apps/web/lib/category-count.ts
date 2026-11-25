/**
 * category-count.ts — 🔢 HOW MANY CATEGORIES A PUBLIC LINE MAY SAY, COUNTED FROM THE LIVE LIST (owner 2026-11-24,
 * "make it true"). The audit of 24 Nov found two typed counts that had drifted from the admin's own tree: "all 192
 * categories" on the front door's marketplace row and "200+ supplier sub-categories" in /llms.txt. A count of the
 * taxonomy is a fact about the admin-managed `service_categories` / `canonical_service_taxonomy` tables, so it is
 * COUNTED from their snapshot (`getTaxonomy()` / `readTaxonomyFrom`), never typed.
 *
 *   · categories      = the tier-2 categories couples can browse (`tileOrder`, minus `hiddenCategories`, minus any
 *                       whose folder is hidden) — what /explore's category grid draws;
 *   · sub-categories  = the services suppliers file under them (`map` entries that are not `marketplaceHidden` and
 *                       whose category is browsable) — the Lechonero / Barong Tagalog level.
 *
 * 🔒 ONLY A LIVE READ GIVES A NUMBER. When the snapshot fell back to the code constant (`source: 'fallback'`), the
 * count is `null` and the words say "every category" — never the constant's number dressed up as the live one.
 * PURE. 🔒 lib/public-lines-match-the-rulings.test.ts
 */
import type { TaxonomySnapshot } from '@/lib/taxonomy-snapshot';
import { formatCount } from '@/lib/format-number';

type Counted = Pick<TaxonomySnapshot, 'source' | 'tileOrder' | 'tileParent' | 'hiddenCategories' | 'map'>;

function browsableTiles(tax: Counted): Set<string> {
  return new Set(
    tax.tileOrder.filter((t) => !tax.hiddenCategories[t] && !tax.hiddenCategories[tax.tileParent[t] ?? '']),
  );
}

/** Browsable tier-2 categories, counted from a live read; `null` when the snapshot is the code fallback. */
export function liveCategoryCount(tax: Counted): number | null {
  if (tax.source !== 'db') return null;
  const n = browsableTiles(tax).size;
  return n > 0 ? n : null;
}

/** Browsable supplier sub-categories (services), counted from a live read; `null` on the fallback. */
export function liveSubCategoryCount(tax: Counted): number | null {
  if (tax.source !== 'db') return null;
  const tiles = browsableTiles(tax);
  const n = Object.values(tax.map).filter((e) => !e.marketplaceHidden && (!e.tile || tiles.has(e.tile))).length;
  return n > 0 ? n : null;
}

/** "all 81 categories", or "every category" when no live count was read. */
export function allCategoriesWords(n: number | null): string {
  return n === null ? 'every category' : `all ${formatCount(n)} categories`;
}
