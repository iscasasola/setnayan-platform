/**
 * paginate.ts — THE ONE paging rule for every long list a supplier owns.
 *
 * Owner, 2026-09-19, looking at My Customers as a supplier: "if they have 1000
 * inquiries, they can still manage all and still be able to see the lower parts
 * of the page?" Every list on that page rendered every row it had, so the
 * calendar, the payment tiles and the QR panel were pushed down by one row per
 * customer, forever.
 *
 * 🔑 ONE PURE FUNCTION, SHARED BY EVERY PAGER. The roster, Bookings, Messages,
 * Clients and Proposals all page through `paginate()` and draw with the one
 * `<ListPager>` (`app/vendor-dashboard/_components/list-pager.tsx`). Two lists
 * that each computed "which rows are on page 3" for themselves are two lists
 * that will one day disagree about page 3 — one clamps, one shows an empty page;
 * one counts from 0, one from 1.
 *
 * ⚖ THE RULES, each executed by `paginate.test.ts`:
 *   · a page is 1-based; anything unreadable (missing, "abc", "0", "-2", "1.5")
 *     is page 1;
 *   · a page PAST THE END clamps to the last page — never an empty page that
 *     reads like "you have no customers";
 *   · `total` is ALWAYS the whole list, never the slice — a count shown beside a
 *     pager is a count of everything;
 *   · the slice keeps the caller's ORDER. Paging happens after sorting, so
 *     page 1 of a list that opens on who is waiting still opens on who is
 *     waiting.
 */

/** Rows per page for every supplier list. One number, so no list drifts. */
export const LIST_PAGE_SIZE = 20;

export type Paged<T> = {
  /** The rows on this page, in the caller's order. */
  items: T[];
  /** The page actually shown (1-based), after clamping. */
  page: number;
  /** How many pages exist. Never below 1, so "page 1 of 1" is the empty case. */
  pageCount: number;
  /** Every row in the list, across all pages. */
  total: number;
  /** 1-based position of the first row shown; 0 when the list is empty. */
  from: number;
  /** 1-based position of the last row shown; 0 when the list is empty. */
  to: number;
  pageSize: number;
};

/** A `?page=` value as a person or a stale link typed it → a page number ≥ 1. */
export function parsePageParam(raw: string | string[] | null | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string' || !/^\d+$/.test(v.trim())) return 1;
  const n = Number.parseInt(v.trim(), 10);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

/** How many pages `total` rows fill. Always ≥ 1. */
export function pageCountOf(total: number, pageSize: number = LIST_PAGE_SIZE): number {
  const size = Math.max(1, Math.floor(pageSize));
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/**
 * The page WINDOW for a list of `total` rows — the same clamping as
 * `paginate`, for a list the DATABASE pages (`.range(start, end)`), where the
 * rows are never all in memory. `paginate` is built on this, so a list paged
 * in SQL and a list paged in memory cannot clamp differently.
 */
export function pageWindowFor(
  total: number,
  rawPage: string | string[] | number | null | undefined,
  pageSize: number = LIST_PAGE_SIZE,
): Omit<Paged<never>, 'items'> & { start: number; end: number } {
  const size = Math.max(1, Math.floor(pageSize));
  const count = Math.max(0, Math.floor(total));
  const pageCount = pageCountOf(count, size);
  const asked =
    typeof rawPage === 'number'
      ? Number.isSafeInteger(rawPage) && rawPage >= 1
        ? rawPage
        : 1
      : parsePageParam(rawPage);
  const page = Math.min(asked, pageCount);
  const start = (page - 1) * size;
  const shown = Math.max(0, Math.min(size, count - start));
  return {
    page,
    pageCount,
    total: count,
    from: shown === 0 ? 0 : start + 1,
    to: shown === 0 ? 0 : start + shown,
    pageSize: size,
    start,
    // Inclusive, as `.range()` takes it.
    end: start + size - 1,
  };
}

/**
 * Clamp a requested page into [1, pageCount] and slice. `rawPage` may be the
 * raw search param; it is parsed here so no caller can skip the parse.
 */
export function paginate<T>(
  all: readonly T[],
  rawPage: string | string[] | number | null | undefined,
  pageSize: number = LIST_PAGE_SIZE,
): Paged<T> {
  const w = pageWindowFor(all.length, rawPage, pageSize);
  return {
    items: all.slice(w.start, w.start + w.pageSize),
    page: w.page,
    pageCount: w.pageCount,
    total: w.total,
    from: w.from,
    to: w.to,
    pageSize: w.pageSize,
  };
}

/**
 * The page numbers a pager shows: always the first and last, the current page
 * and one either side, with `null` for a gap. Seven slots at most, so it fits a
 * phone row: `1 … 4 5 6 … 50`.
 */
export function pagerWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const keep = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((n) => keep.add(n));
  const nums = [...keep].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const n of nums) {
    const prev = out.length ? out[out.length - 1] : null;
    if (typeof prev === 'number' && n - prev > 1) out.push(null);
    out.push(n);
  }
  return out;
}

/**
 * The link for page `page` of a list whose page lives in `param`, keeping
 * every other parameter the viewer already has (lane, month, search, the open
 * section). Page 1 drops the param rather than printing `?page=1`.
 */
export function pageHref(
  keepParams: string,
  param: string,
  page: number,
  hash?: string,
): string {
  const q = new URLSearchParams(keepParams);
  if (page <= 1) q.delete(param);
  else q.set(param, String(page));
  const s = q.toString();
  const h = hash ? `#${hash.replace(/^#/, '')}` : '';
  return s ? `?${s}${h}` : h || '?';
}

/** Lower-case, accent-free, single-spaced — so "Peña" matches "pena". */
export function normalizeSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** A `?q=` value → the normalized needle, or null when there is nothing to search. */
export function parseSearchParam(raw: string | string[] | null | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return null;
  const n = normalizeSearchText(v).slice(0, 80);
  return n.length > 0 ? n : null;
}

/**
 * Keep the rows whose text contains every word of the needle. Runs BEFORE
 * `paginate`, so a match on page 40 of the full list is on page 1 of the search.
 */
export function filterBySearch<T>(
  all: readonly T[],
  needle: string | null,
  textOf: (row: T) => string | null | undefined,
): T[] {
  if (!needle) return [...all];
  const words = needle.split(' ').filter(Boolean);
  return all.filter((row) => {
    const hay = normalizeSearchText(textOf(row) ?? '');
    return words.every((w) => hay.includes(w));
  });
}
