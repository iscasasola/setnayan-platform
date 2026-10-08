import type { ReactNode } from 'react';

/**
 * TIMELINE STATES — what a list of Timeline rows shows BEFORE it has rows: the band and line every row sits on, the
 * LOADING shimmer, and A PROBLEM (gallery § 16). Lifted out of `timeline-row.tsx` on 2026-10-08, unchanged.
 *
 * 🪶 WHY ITS OWN FILE: the Maker's page shows the shimmer while Schedule and Love Story stream in, and their pages
 * show the problem when a read is refused — and for those two small pieces the Maker's FIRST LOAD was carrying the
 * whole row (the name field, the empty state, their handlers). This file has no hooks and no state, so the shimmer
 * is plain server HTML (no JavaScript at all) and the problem costs only itself. `timeline-row.tsx` re-exports
 * everything here, so its wearers import as before; what must NOT happen is a first-load file importing
 * `timeline-row.tsx` again — `lib/the-maker-first-load-leaves-the-row-behind.test.ts` walks the imports and fails.
 *
 * Neutral: nothing here knows the Maker, the Schedule or the Love Story, and no accent colour is written here.
 */
/** The band a row sits on, and the row's own line — ONE arrangement for a real row, a sample of one and a loading one. */
export const TIMELINE_BAND_CLASS = 'border-t border-ink/10 bg-cream first:border-t-0';
export const TIMELINE_ROW_CLASS = 'flex min-h-[58px] items-center gap-1 py-1.5 pl-3 pr-1';

/**
 * LOADING — soft shapes of the rows that are coming (gallery § 16: *"loading shows soft grey shapes of what is coming,
 * shimmering, so the page does not jump when it arrives"*). The real row's own band and line, so nothing moves when
 * the rows land. Says it is busy; never looks like an empty list (that has words and a first action) or a problem.
 */
export function TimelineRowsLoading({ label, rows = 3, pills = 1 }: { label: string; rows?: number; pills?: 1 | 2 }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} data-timeline-loading="" className="flex animate-pulse flex-col border-y border-ink/10 motion-reduce:animate-none">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={TIMELINE_BAND_CLASS}>
          <div className={TIMELINE_ROW_CLASS}>
            {Array.from({ length: pills }, (_p, j) => (
              <span key={j} aria-hidden className="h-10 w-[72px] shrink-0 rounded-full bg-ink/10" />
            ))}
            <span aria-hidden className={`ml-1.5 h-3.5 rounded-full bg-ink/10 ${['w-32', 'w-24', 'w-40'][i % 3]}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A PROBLEM — the list could not be read (gallery § 16: *"a problem says so in plain words with Try again, and never
 * pretends the list is empty"*). Never the empty state's words; `onRetry` is the wearer's (a re-read, once per tap —
 * no loop).
 */
export function TimelineProblem({ title, children, onRetry }: { title: string; children: ReactNode; onRetry?: (() => void) | null }) {
  return (
    <div role="alert" data-timeline-problem-state="" className="flex flex-col items-center gap-1.5 px-6 py-8 text-center">
      <b className="text-[15px] font-semibold text-danger-700">{title}</b>
      <p className="max-w-[28ch] text-[13.5px] text-ink/70">{children}</p>
      {onRetry ? (
        <button type="button" data-timeline-retry="" onClick={onRetry} className="sn-press mt-2 inline-flex min-h-11 items-center rounded-full px-5 text-[14px] font-semibold text-ink ring-1 ring-inset ring-ink/20">
          Try again
        </button>
      ) : null}
    </div>
  );
}
