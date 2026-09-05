/**
 * inline-more-row.ts — every decidable thing about the bench's inline
 * "More in {category}" row (row 2).
 *
 * ── THE RULING (owner 2026-09-06) ────────────────────────────────────────────
 * *"when they also click the find reception button, it must show a lower row
 * that will show other vendors for that category and a search button also"* —
 * and, decisively, **"we do not want to leave the page."**
 *
 * `CategorySearchOverlay` does not navigate, but it is `position:fixed; inset:0`
 * — it COVERS the bench, which is the same feeling. So "Find {category}" now
 * opens a second rail underneath the considered carousel, and the full sheet
 * becomes opt-in behind "See all →". The sheet is NOT deleted: it carries
 * filters and facets this row deliberately does not.
 *
 * ── WHAT LIVES HERE, AND WHY IT IS NOT IN THE COMPONENT ─────────────────────
 * `shortlist-categories.tsx` is ~2,100 lines and renders the whole bench, so it
 * is the highest-regression-risk file on this surface. The same discipline
 * `bench-sort.ts`, `coverage-strip.ts` and `your-team.ts` already follow applies:
 * the component renders, this module decides. Everything below is pure and unit
 * tested — no React, no server action, no Supabase.
 *
 * ── THE THREE RULES ROW 2 INHERITS ──────────────────────────────────────────
 *  1. **No Lock, no Add-to-build.** Not expressed here because it is expressed
 *     by ABSENCE — this module exposes no lock/build decision at all, exactly
 *     as `shortlist-categories.tsx`'s own docblock promises ("carries none of
 *     the plan-group lock/build machinery … so it can't destabilise those
 *     tabs"). Saving to *considering* is what row 1 already displays, so it
 *     respects the boundary; a Lock button in row 2 would cross it.
 *  2. **The shared-date sink applies.** `classifyInlineMoreRow` runs the SAME
 *     `classifyAgainstBuildWindow` + `partitionByBuildFit` pair row 1 runs. A
 *     row that offers vendors the row above just ruled out is worse than no row.
 *  3. **Fail open.** A candidate with no calendar signal is never a clash —
 *     `classifyAgainstBuildWindow` returns null for it and the partition keeps
 *     it among the fits. That is the shipped stance of the whole availability
 *     path and it is asserted in the tests, not merely inherited by luck.
 */

import {
  classifyAgainstBuildWindow,
  partitionByBuildFit,
  type BuildDateWindow,
  type TeamCalendarMember,
} from './build-date-window';

/**
 * The only thing this module needs to know about a row-2 candidate. Deliberately
 * structural rather than an import of `CategoryVendorResult`: that type lives
 * behind a `'use server'` file, and a pure module must stay loadable by
 * `node --test` without dragging a Supabase client in behind it.
 */
export type InlineMoreVendor = { vendorProfileId: string };

/** One classified row-2 card. `clashWith` is what the amber badge NAMES. */
export type InlineMoreEntry<T extends InlineMoreVendor> = {
  row: T;
  /** Null for a card that fits, or for a clash with no single culprit. */
  clashWith: string | null;
};

/**
 * Single-open, like every other level of this accordion ("when one opens, the
 * others collapse" — owner 2026-06-16). Tapping the open row's own Find button
 * closes it, so the button is a toggle and never a dead end.
 */
export function toggleInlineMoreTile(open: string | null, tile: string): string | null {
  return open === tile ? null : tile;
}

/**
 * Drop the candidates already sitting in row 1 for THIS category.
 *
 * Only this category's picks are removed, never every pick in the event: a
 * vendor the couple shortlisted under Catering is a legitimate — and useful —
 * result under Styling, and the shipped sheet shows it as "✓ Added" rather than
 * hiding it. What must never happen is the same card appearing twice, one row
 * above the other.
 */
export function excludeBenchVendors<T extends InlineMoreVendor>(
  rows: readonly T[],
  benchProfileIds: Iterable<string | null | undefined>,
): T[] {
  const taken = new Set<string>();
  for (const id of benchProfileIds) if (id) taken.add(id);
  return rows.filter((r) => !taken.has(r.vendorProfileId));
}

/**
 * The shared-date sink, applied to row 2 exactly as row 1 applies it.
 *
 * `freeDaysByProfileId` is keyed by MARKETPLACE PROFILE id — row 2's candidates
 * have no `event_vendors` row yet, which is the whole point of the row. A
 * profile absent from the map has no calendar signal and therefore no verdict
 * (rule 3: fail open).
 *
 * Stability is inherited from `partitionByBuildFit`: the owner-locked result
 * order (favorites → boosted → top-10 reviews → nearest) survives untouched
 * among the fits, and the sink only moves the losers to the end.
 */
export function classifyInlineMoreRow<T extends InlineMoreVendor>(args: {
  rows: readonly T[];
  /** profile id → day keys free inside the probe window. Absent = no signal. */
  freeDaysByProfileId: ReadonlyMap<string, readonly string[]>;
  window: BuildDateWindow | null;
  members: readonly TeamCalendarMember[];
  probeDayKeys: readonly string[];
}): { fits: InlineMoreEntry<T>[]; clashes: InlineMoreEntry<T>[] } {
  const { rows, freeDaysByProfileId, window: w, members, probeDayKeys } = args;

  const verdicts = rows.map((row) => {
    const days = freeDaysByProfileId.get(row.vendorProfileId);
    const verdict = classifyAgainstBuildWindow({
      window: w,
      vendorFreeDays: days ? new Set(days) : null,
      // A row-2 candidate is by construction not on the team (anything already
      // on this bench row was excluded above), so this id can only ever fail to
      // match a member — which is exactly the self-skip behaviour we want.
      vendorId: row.vendorProfileId,
      members,
      probeDayKeys,
    });
    return { row, verdict };
  });

  const split = partitionByBuildFit(verdicts, (v) => v.verdict);
  return {
    fits: split.fits.map(({ row }) => ({ row, clashWith: null })),
    clashes: split.clashes.map(({ row, verdict }) => ({
      row,
      clashWith: verdict && verdict.fits === false ? verdict.clashWith : null,
    })),
  };
}

/**
 * May a just-saved row-2 card offer "Undo"?
 *
 * ⚠ THE GAP THIS CLOSES. `saveVendorToPicks` writes to the database, so a
 * mis-tap in row 2 is not undoable from row 2 — and the bench is read-only
 * about picks, so there is no × on a row-1 card either. The undo is therefore
 * offered right where the mistake happens.
 *
 * It is offered ONLY for `'ok'` — a save that actually created the row. On
 * `'already_saved'` the action is idempotent and the pick PRE-EXISTED this tap;
 * an "Undo" there would delete something the couple shortlisted days ago and
 * never asked to lose.
 */
export function canUndoInlineSave(status: string): boolean {
  return status === 'ok';
}

/**
 * A query is worth sending to the server only once it can narrow anything.
 * One character matches almost every vendor in a category, so it costs a round
 * trip to change nothing; empty means "show me the category", which is the
 * row's own default fetch and must NOT be skipped.
 */
export function shouldRunInlineMoreQuery(raw: string): boolean {
  const q = raw.trim();
  return q.length === 0 || q.length >= 2;
}
