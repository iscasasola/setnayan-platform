/**
 * inline-more-order.ts — WHAT ORDERS THE BENCH'S "More in {category}" RESULTS,
 * and what may never be allowed to.
 *
 * ── THE COMPLAINT ────────────────────────────────────────────────────────────
 * The Sort by bar sits above TWO rows and governed ONE of them. A couple picked
 * *Lowest price*, watched the shortlist carousel reorder, watched the search
 * results underneath it not move, and was told nothing at all about why.
 *
 * ── THE RULING, AND IT IS A COMMERCIAL ONE ───────────────────────────────────
 * Owner, 2026-09-09: ***"bottom tier only."***
 *
 * `_actions/category-search.ts` orders results by a ladder locked on
 * 2026-05-31 — relationship depth → **BOOSTED (paid placement)** → top-reviews
 * → tail — and its own comment calls re-ranking it *"a separate, sign-off-gated
 * change"*. A shipped smart-sort price re-rank is already confined to *"the
 * TAIL tier ONLY — the relationship / boosted / top-reviews tiers stay"*
 * unchanged. The couple's chosen lens now joins it there, on exactly the same
 * terms.
 *
 * 🔑 **NOTHING PAID MOVES BY ALGORITHM.** What Setnayan sells is the DEFAULT
 * position. A vendor who paid for `ad_rank` bought a place in row 2's top; a
 * sort chip that could demote them is a refund we never agreed to. Getting this
 * boundary wrong moves money, which is why the boundary is enforced by
 * construction below rather than by a comparator that "usually" leaves them
 * alone.
 *
 * ── HOW IT IS ENFORCED BY CONSTRUCTION ───────────────────────────────────────
 * `orderInlineMoreRow` never sorts the array it is given. It collects the
 * INDICES holding tail rows, orders that sub-list, and writes it back into
 * those same indices. Every non-tail row therefore ends at the byte-identical
 * position it started at — not "usually", not "unless the comparator is
 * unstable", but because no other index is ever written.
 *
 * ⚠ THAT SHAPE IS LOAD-BEARING, NOT STYLE. The tail is NOT a contiguous suffix
 * of the returned array: `category-search.ts` applies a service-date down-rank
 * AFTER the ladder that stable-partitions busy vendors to the end, so a boosted
 * vendor who is busy on the date legitimately sits below tail rows. Anything
 * that assumed "sort the last N" would drag that boosted card around.
 *
 * ── AND THE ROW SAYS WHAT IT IS ORDERED BY ───────────────────────────────────
 * `inlineMoreOrderNote` writes the sentence the row was missing. It is built
 * from the tiers ACTUALLY PRESENT in this row and from whether the chosen sort
 * could discriminate at all — never from a template that assumes either. A row
 * whose sort changed nothing says so; a row that is all tail says the sort
 * ordered all of it.
 *
 * Pure and framework-free, like `inline-more-row.ts` beside it — no React, no
 * server action, no Supabase — so every rule here is a unit test rather than
 * something only a browser could show you.
 */

import { orderByBenchSort, type BenchSort, type BenchSortFacts } from '@/lib/bench-sort';
import { LENSES } from '@/lib/ranking-lenses';
import type { CompatInputs } from '@/lib/compat-score';

/**
 * The four rungs of the owner-locked 2026-05-31 result ladder, in order.
 *
 * Declared HERE, in the pure module, and imported by the server action that
 * stamps it — one vocabulary, so "which rung is protected?" has exactly one
 * answer in the codebase.
 */
export type LadderTier = 'relationship' | 'boosted' | 'top_reviews' | 'tail';

/** The ONE rung the couple's sort is allowed to touch. */
export const ORDERABLE_TIER: LadderTier = 'tail';

/**
 * Everything this module needs off a row-2 card. Structural rather than an
 * import of `CategoryVendorResult`: that type lives behind a `'use server'`
 * file, and a pure module must stay loadable by `node --test` without dragging
 * a Supabase client in behind it (the same reason `inline-more-row.ts` gives).
 */
export type InlineMoreOrderable = {
  vendorProfileId: string;
  ladderTier: LadderTier;
  /** A service floor, NOT a quote — see `startsAtPhp` on the server type. */
  startsAtPhp: number | null;
  rating: number | null;
  reviewCount: number | null;
  distanceKm: number | null;
  serviceRadiusKm: number | null;
  verified: boolean;
};

/**
 * Project a row-2 card onto the ONE scorer's inputs (`lib/compat-score`).
 *
 * ⛔ `boosted` IS DELIBERATELY NOT PASSED, and this is the most important line
 * in the file. `compat-score` documents that input as `ad_rank > 0` — paid
 * placement — and feeding it here would let a vendor's ad spend buy them score
 * INSIDE the one tier that is supposed to be free of it. `bench-sort.ts`
 * refuses it for the same reason on the row above.
 *
 * What is omitted is omitted because this row genuinely does not know it, and
 * omission reads as NEUTRAL in the scorer rather than as a penalty:
 *  • `budgetFitRatio` — needs the couple's per-category allocation resolved
 *    against this shop; the search does not carry it out to the client.
 *  • `dateHeadroomRatio` — row 2's date verdict is a PARTITION applied after
 *    the sort (`classifyInlineMoreRow`), never a term inside it. Passing it
 *    here would sink a clashing vendor twice.
 *  • `freshnessRatio` / `demandCoupleCount` — not fetched by this search.
 *  • `songOverlapRatio` / `preferenceMatchRatio` — no style signal on the card.
 *
 * A lens whose driving dimension is one of those cannot discriminate here, and
 * `canOrderInlineMoreRow` says so out loud instead of pretending.
 */
export function inlineMoreCompatInputs(row: InlineMoreOrderable): CompatInputs {
  return {
    distanceKm: row.distanceKm,
    travelRadiusKm: row.serviceRadiusKm,
    avgRating: row.rating,
    reviewCount: row.reviewCount,
    verified: row.verified,
  };
}

/** The facts one row-2 card contributes to the shared ordering rule. */
export function inlineMoreSortFacts(row: InlineMoreOrderable): BenchSortFacts {
  return {
    pricePhp: row.startsAtPhp,
    rating: row.rating,
    compat: inlineMoreCompatInputs(row),
  };
}

/**
 * CAN the chosen sort actually order these rows?
 *
 * A sort that silently no-ops is the defect this whole change exists to remove,
 * so it is answered before anything is moved and the answer is what the row's
 * sentence reports.
 *
 * 🔑 For a LENS this reuses `LENSES[mode].hideWhen` — the SHIPPED §15.2
 * predicate, which reads the same `CompatInputs` the scorer reads. A second
 * "can this lens discriminate?" rule is exactly the drift this repo keeps
 * producing; there is one, and it lives in `ranking-lenses.ts`.
 */
export function canOrderInlineMoreRow(mode: BenchSort, tail: readonly InlineMoreOrderable[]): boolean {
  if (tail.length < 2) return false;
  if (mode === 'price') return tail.some((r) => r.startsAtPhp != null);
  if (mode === 'rating') return tail.some((r) => r.rating != null);
  return !LENSES[mode].hideWhen(tail.map(inlineMoreCompatInputs));
}

/**
 * Re-order the TAIL rows of a row-2 result set, in place, and nothing else.
 *
 * Returns a NEW array. Every row whose `ladderTier` is not `'tail'` comes back
 * at the identical index it went in at — that is the commercial guarantee, and
 * it is a property of the algorithm, not of the comparator.
 */
export function orderInlineMoreRow<T extends InlineMoreOrderable>(
  rows: readonly T[],
  mode: BenchSort,
): T[] {
  const slots: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row && row.ladderTier === ORDERABLE_TIER) slots.push(i);
  }
  const tail = slots.map((i) => rows[i] as T);
  // Nothing to order, or nothing the chip can order it BY. Hand the ladder's
  // own order straight back rather than running a comparator that would shuffle
  // on tie-breaks the couple never asked for.
  if (!canOrderInlineMoreRow(mode, tail)) return [...rows];

  const sorted = orderByBenchSort(tail, mode, inlineMoreSortFacts);
  const out = [...rows];
  slots.forEach((slot, k) => {
    const picked = sorted[k];
    if (picked) out[slot] = picked;
  });
  return out;
}

// ── The sentence the row was missing ────────────────────────────────────────

/** How the couple hears each protected rung named. The words are the ones
 *  already ON the cards ("Featured" is the paid-placement corner badge), so the
 *  sentence describes something the couple can see rather than a tier name. */
const TIER_PHRASE: Record<Exclude<LadderTier, 'tail'>, string> = {
  relationship: 'suppliers you know',
  boosted: 'Featured',
  top_reviews: 'most reviewed',
};

const TIER_ORDER: Exclude<LadderTier, 'tail'>[] = ['relationship', 'boosted', 'top_reviews'];

/** "Featured", "Featured and most reviewed", "suppliers you know, Featured and
 *  most reviewed" — only the rungs this particular row actually contains. */
function leadPhrase(rows: readonly InlineMoreOrderable[]): string | null {
  const present = TIER_ORDER.filter((t) => rows.some((r) => r.ladderTier === t));
  const parts = present.map((t) => TIER_PHRASE[t]);
  if (parts.length === 0) return null;
  const joined =
    parts.length === 1
      ? (parts[0] as string)
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] as string}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * ONE line under "More in {category}" saying what this row is ordered by, so
 * the Sort by bar stops appearing to govern something it does not.
 *
 * `modeLabel` is passed in rather than looked up on purpose: the chip's wording
 * differs by flag (`Best fit` with the replan flag off, `Best matches` with it
 * on), and a sentence that quotes a different word from the button the couple
 * just pressed is a new small lie in place of the old one. The caller renders
 * the chips, so the caller owns the label.
 */
export function inlineMoreOrderNote(args: {
  rows: readonly InlineMoreOrderable[];
  mode: BenchSort;
  modeLabel: string;
}): string | null {
  const { rows, mode, modeLabel } = args;
  if (rows.length === 0) return null;

  const tail = rows.filter((r) => r.ladderTier === ORDERABLE_TIER);
  const lead = leadPhrase(rows);
  const ordered = canOrderInlineMoreRow(mode, tail);
  const chip = `your ‘${modeLabel}’`;

  // The whole row is tail — there is no protected rung here at all, so the
  // couple's sort really did order every card they can see.
  if (!lead) return ordered ? `Ordered by ${chip}.` : `Setnayan’s order for this category.`;

  // Protected rungs, but nothing beneath them. Saying the sort orders "the
  // rest" would be false; saying what it WOULD order explains the stillness.
  if (tail.length === 0) return `${lead} first — ${chip} orders anything below them.`;

  return ordered
    ? `${lead} first, then ${chip}.`
    : `${lead} first, then Setnayan’s order.`;
}
