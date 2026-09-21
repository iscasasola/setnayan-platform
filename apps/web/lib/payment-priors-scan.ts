/**
 * payment-priors-scan.ts — read EVERY prior payment the duplicate rule must
 * see, or say you could not.
 *
 * ── THE DEFECT, measured 2026-09-22 (CTRL-B1 build 3) ───────────────────────
 * `approvePayment` fed `classifyDuplicate` from:
 *
 *     .select('payment_id, order_id, reference_number, status')
 *     .neq('payment_id', paymentId)
 *     .in('status', MONEY_STATUSES)          // ← no .limit(), no .range()
 *
 * PostgREST caps rows server-side. Past that cap the query returns an arbitrary
 * SUBSET — silently, with no error and no flag. **A money guard that reads a
 * subset passes on the duplicate it never loaded**, and it passes in exactly the
 * reassuring shape of "no duplicates found".
 *
 * ⚠ The cap is Supabase PLATFORM configuration. It is not in this repo, not in
 * the database, and was NOT measured — so nothing here may depend on knowing it.
 * That is the whole design constraint: the answer must be identical whatever the
 * cap turns out to be.
 *
 * ── WHY NOT JUST NARROW THE QUERY ──────────────────────────────────────────
 * The blocking verdict (`refuse`) only ever comes from a prior on the SAME
 * order, and that IS narrowed — see `sameOrderPage` at the call site. But the
 * `warn` verdict is cross-order, and it must survive the BDO rail where the
 * bank wraps our code inside their own. `compareReferences` catches that by
 * NORMALISING both sides; SQL cannot, because the normalisation strips the very
 * characters an `ilike` would have to match on. So the cross-order half is paged
 * exhaustively instead of narrowed.
 *
 * ── WHY THIS FILE IS PURE ──────────────────────────────────────────────────
 * `approvePayment` is `'use server'`, so a test cannot import it. The paging is
 * the part that can be got wrong — off-by-one on the last page, an error read as
 * "end of data", a cap that truncates — so it lives here behind an injected
 * fetcher and its tests EXECUTE every one of those cases.
 */

/** One page of rows, or a failure. Never "empty because something broke". */
export type PageResult<T> = { ok: true; rows: T[] } | { ok: false; error: string };

export type ScanResult<T> =
  | { ok: true; rows: T[]; pages: number }
  | { ok: false; error: string; pagesRead: number };

/**
 * How many rows to ask for per page. Deliberately below any plausible PostgREST
 * `max-rows` so a page is never itself truncated — if the platform cap were
 * lower than this, a full page would be indistinguishable from a capped one and
 * the loop would stop early believing it had reached the end.
 */
export const PRIORS_PAGE_SIZE = 500;

/**
 * A ceiling on pages, so a pathological table cannot hang an admin request.
 *
 * 🔑 HITTING IT IS A FAILURE, NOT AN END. Returning the rows gathered so far
 * would re-create the exact defect this file exists to remove — a partial read
 * wearing the shape of a complete one. The caller must treat `ok:false` as
 * "cannot classify", which fails closed.
 */
export const PRIORS_MAX_PAGES = 200;

/**
 * Page until the source is exhausted. `fetchPage` is given a half-open range
 * `[from, to]` inclusive, matching PostgREST's `.range()`.
 *
 * Termination: a page shorter than `PRIORS_PAGE_SIZE` is the last one. A page
 * of exactly `PRIORS_PAGE_SIZE` means there may be more, so it asks again —
 * including the case where the next page comes back empty, which is the
 * off-by-one this shape exists to avoid.
 */
export async function scanAllPriors<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<ScanResult<T>> {
  const pageSize = opts.pageSize ?? PRIORS_PAGE_SIZE;
  const maxPages = opts.maxPages ?? PRIORS_MAX_PAGES;
  const rows: T[] = [];
  let pages = 0;

  for (;;) {
    if (pages >= maxPages) {
      return {
        ok: false,
        error:
          `duplicate scan exceeded ${maxPages} pages of ${pageSize} — refusing to classify from a partial read`,
        pagesRead: pages,
      };
    }
    const from = pages * pageSize;
    const page = await fetchPage(from, from + pageSize - 1);
    pages += 1;
    if (!page.ok) {
      // A refused or failed read is NOT an empty estate. Propagating the failure
      // is what lets the caller refuse rather than approve a payment whose
      // priors it never saw.
      return { ok: false, error: page.error, pagesRead: pages };
    }
    rows.push(...page.rows);
    if (page.rows.length < pageSize) return { ok: true, rows, pages };
  }
}
