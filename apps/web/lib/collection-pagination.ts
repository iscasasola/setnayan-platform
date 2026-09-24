/**
 * THE COLLECTION TEMPLATE'S PAGES — ten to a page, and the pager that says so.
 *
 * Owner-approved 2026-09-24 (DECISION_LOG, "the template is good"): a
 * collection shows **10 per page**, the pager reads **"1 · 2 · … · Last"**
 * beside **"1–10 of N"**, it **appears only when a page fills** (a collection
 * of ten or fewer has no pager at all), and the dashed **"+ New <thing>"** tile
 * sits in the grid **only while the page has room** for it. Prototype:
 * `prototypes/collection_template_posters_add_flow_v4_2026-09-24.html`.
 *
 * Pure arithmetic, no React and no request — the page is a URL parameter
 * (`?page=2`), so moving between pages is a navigation, never a server action
 * and never client state. That also makes every page linkable and makes the
 * back button do what a person expects.
 *
 * 🔑 IT KNOWS NOTHING ABOUT EVENTS. It is the template's, so the next
 * collection (Alaga, Samahan, Shortlist — STANDARD-collection-card.md) pages
 * its cards with the same numbers instead of inventing a second pager.
 */

/** Ten per page — the approved template's number. */
export const COLLECTION_PAGE_SIZE = 10;

/** One stop in the pager, in reading order. */
export type CollectionPagerStop =
  | { kind: 'page'; page: number; label: string; current: boolean }
  | { kind: 'gap' };

export type CollectionPage = {
  /** The page being shown, 1-based, clamped into range. */
  page: number;
  pageCount: number;
  total: number;
  /** Slice bounds into the full, already-ordered list: `items.slice(from, to)`. */
  from: number;
  to: number;
  /** "1–10 of 100" — printed only beside a pager. */
  rangeLabel: string;
  /** More than one page exists. With one page there is nothing to page. */
  showPager: boolean;
  /** The page holds fewer than a full page, so the dashed tile fits. */
  hasRoomForNewTile: boolean;
  /** "1 · 2 · … · Last" — empty when `showPager` is false. */
  stops: CollectionPagerStop[];
};

/**
 * Read `?page=` the way a person might have typed it. Anything that is not a
 * whole number ≥ 1 is page 1 — a stale or mangled link still shows the
 * collection, never an error and never an empty page.
 */
export function parseCollectionPage(raw: string | string[] | undefined): number {
  const one = Array.isArray(raw) ? raw[0] : raw;
  if (!one || !/^\d{1,6}$/.test(one)) return 1;
  const n = Number(one);
  return n >= 1 ? n : 1;
}

/**
 * Where page `requested` of a `total`-long collection starts and ends, and the
 * pager that goes with it.
 *
 * The pager, read off the approved prototype stop by stop:
 *   • page 1 is always a stop, and the LAST page is always the stop "Last";
 *   • between them, the current page and its neighbours;
 *   • "…" wherever the numbers jump.
 * So page 1 of 10 is "1 · 2 · … · Last", page 4 is "1 · … · 3 · 4 · 5 · … ·
 * Last", and on the last page "Last" is itself the current stop.
 *
 * A requested page past the end shows the LAST page, not an empty one: a link
 * saved when there were 30 events still lands on real cards after 10 of them
 * finish.
 */
export function paginateCollection(
  total: number,
  requested: number,
  perPage: number = COLLECTION_PAGE_SIZE,
): CollectionPage {
  const safeTotal = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(safeTotal / perPage));
  const page = Math.min(Math.max(1, Math.floor(requested) || 1), pageCount);
  const from = (page - 1) * perPage;
  const to = Math.min(from + perPage, safeTotal);
  const showPager = safeTotal > perPage;

  const stops: CollectionPagerStop[] = [];
  if (showPager) {
    const numbered = new Set<number>([1]);
    for (let p = page - 1; p <= page + 1; p++) {
      if (p >= 1 && p < pageCount) numbered.add(p);
    }
    const ordered = [...numbered].sort((a, b) => a - b);
    let prev = 0;
    for (const p of ordered) {
      if (p - prev > 1) stops.push({ kind: 'gap' });
      stops.push({ kind: 'page', page: p, label: String(p), current: p === page });
      prev = p;
    }
    if (pageCount - prev > 1) stops.push({ kind: 'gap' });
    stops.push({ kind: 'page', page: pageCount, label: 'Last', current: page === pageCount });
  }

  return {
    page,
    pageCount,
    total: safeTotal,
    from,
    to,
    rangeLabel: safeTotal === 0 ? '' : `${from + 1}–${to} of ${safeTotal}`,
    showPager,
    hasRoomForNewTile: to - from < perPage,
    stops,
  };
}
