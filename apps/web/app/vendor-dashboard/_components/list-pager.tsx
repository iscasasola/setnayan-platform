import Link from 'next/link';
import { pageHref, pagerWindow, type Paged } from '@/lib/paginate';

/**
 * ListPager — THE pager under every long supplier list.
 *
 * "1–20 of 1,000 · ‹ Prev · 1 2 3 … 50 · Next ›"
 *
 * 🔑 ONE COMPONENT, fed by the ONE `paginate()` (`lib/paginate.ts`). The roster,
 * Bookings, Messages, Clients and Proposals all draw with this, so no two lists
 * can disagree about what a page is, and each keeps the other lists' place:
 * every list on My Customers lives on ONE URL, so each pages through its OWN
 * `param` and `keepParams` carries everyone else's.
 *
 * It says nothing when the list fits on one page — a pager reading "1–4 of 4"
 * is noise. `incomplete` is the exception: a list that could not be read in
 * full says so even when it is short, because a short list that is short
 * because a read failed looks exactly like a quiet shop.
 *
 * Phone width (375px, a 343px column): the numbered slots are hidden below
 * `sm` and a compact "3 / 50" stands in for them, so the controls are three
 * pills — ‹ Prev · 3 / 50 · Next › — and the range line wraps above them
 * (`flex-wrap`) rather than the row scrolling sideways. From `sm` up, the
 * numbers are `pagerWindow`'s seven slots at most.
 *
 * Every link lands on `hash` (the list's own id), so a page change opens at
 * the top of the list it changed, not at the top of the hub.
 */
export function ListPager({
  paged,
  param,
  keepParams,
  hash,
  noun = 'rows',
  incomplete = false,
}: {
  paged: Paged<unknown>;
  /** The search param this list pages through (`page`, `mpage`, …). */
  param: string;
  /** Every other param to preserve, as a query string (no leading `?`). */
  keepParams: string;
  /** The id to land on, so paging does not jump to the top of the page. */
  hash?: string;
  /** What the rows are, for the screen reader label. */
  noun?: string;
  /** The read behind this list did not reach the end. */
  incomplete?: boolean;
}) {
  const { page, pageCount, total, from, to } = paged;
  const nf = new Intl.NumberFormat('en-PH');
  const incompleteNote = incomplete ? (
    <p
      role="status"
      className="mt-2 rounded-xl border px-3 py-2 text-xs"
      style={{
        background: 'var(--sn-warning-soft)',
        borderColor: 'color-mix(in srgb, var(--sn-warning) 30%, transparent)',
        color: 'var(--sn-warning-deep)',
      }}
    >
      Some of this list could not be loaded, so it may be missing entries. Reload
      the page to try again.
    </p>
  ) : null;

  if (pageCount <= 1) return incompleteNote;

  const hrefFor = (n: number) => pageHref(keepParams, param, n, hash);
  const control =
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border px-2.5 text-xs font-semibold';
  const idle = { background: 'transparent', color: 'var(--m-slate)', borderColor: 'var(--m-line)' };
  const on = { background: 'var(--m-ink)', color: 'var(--m-paper)', borderColor: 'var(--m-ink)' };
  const off = { ...idle, opacity: 0.4 };

  return (
    <>
      <nav
        aria-label={`Pages of ${noun}`}
        data-list-pager={param}
        className="mt-3 flex flex-wrap items-center justify-between gap-2"
      >
        <p className="font-mono text-xs" style={{ color: 'var(--m-slate-2)' }}>
          {nf.format(from)}–{nf.format(to)} of {nf.format(total)}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className={control} style={idle}>
              ‹ Prev
            </Link>
          ) : (
            <span aria-disabled="true" className={control} style={off}>
              ‹ Prev
            </span>
          )}
          <span
            className={`${control} font-mono sm:hidden`}
            style={on}
            aria-current="page"
          >
            {page} / {pageCount}
          </span>
          {pagerWindow(page, pageCount).map((n, i) =>
            n === null ? (
              <span
                key={`gap-${i}`}
                aria-hidden
                className="hidden px-1 font-mono text-xs sm:inline"
                style={{ color: 'var(--m-slate-2)' }}
              >
                …
              </span>
            ) : n === page ? (
              <span
                key={n}
                aria-current="page"
                className={`${control} hidden font-mono sm:inline-flex`}
                style={on}
              >
                {n}
              </span>
            ) : (
              <Link
                key={n}
                href={hrefFor(n)}
                aria-label={`Page ${n}`}
                className={`${control} hidden font-mono sm:inline-flex`}
                style={idle}
              >
                {n}
              </Link>
            ),
          )}
          {page < pageCount ? (
            <Link href={hrefFor(page + 1)} rel="next" className={control} style={idle}>
              Next ›
            </Link>
          ) : (
            <span aria-disabled="true" className={control} style={off}>
              Next ›
            </span>
          )}
        </div>
      </nav>
      {incompleteNote}
    </>
  );
}

/** A query string of every param in `sp` except `drop` — what a pager keeps. */
export function keepParamsFrom(
  sp: Record<string, string | string[] | undefined>,
  drop: readonly string[],
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (drop.includes(k)) continue;
    if (typeof v === 'string' && v.length > 0) q.set(k, v);
  }
  return q.toString();
}
