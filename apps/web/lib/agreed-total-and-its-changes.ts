/**
 * THE AGREED TOTAL AND ITS CHANGES — one arithmetic, every money reader.
 *
 * ── The ruling this file exists to keep ─────────────────────────────────────
 * Owner, 2026-09-09, asked directly whether a price change after a lock should
 * REPLACE the agreed total or sit BESIDE it:
 *
 *     "Both, shown separately."
 *
 * The agreed total UPDATES and the change stays visible as its own line. He was
 * told plainly that this is the most work, and that TWO NUMBERS TO KEEP IN STEP
 * IS EXACTLY HOW THE CURRENT DEFECT HAPPENED — and chose it anyway.
 *
 * ⇒ So the guard is as much the deliverable as the feature, and this module IS
 *   the guard: `agreed` is not computed a second time and compared. It is
 *   RETURNED AS THE SUM OF THE THREE PARTS THAT DRAW IT, in one expression, so a
 *   surface that renders `pricePart`, `breakdownPart` and `changesPart` and a
 *   surface that prints `agreed` cannot disagree — there is nothing to keep in
 *   step. `agreed-total-and-its-changes.test.ts` pins that, and pins the three
 *   readers to this function so a fourth arithmetic cannot quietly appear.
 *
 * ── What was wrong, measured ────────────────────────────────────────────────
 * `event_vendor_line_items` carried ONE meaning: the couple's itemised
 * BREAKDOWN of a supplier's price, with `event_vendors.total_cost_php` as the
 * fallback when no breakdown exists. Every reader implemented that as "once any
 * manual line exists, bill the lines and DROP the headline".
 *
 * Then `accept_change_order` began settling agreed deltas into the same table.
 * A −₱15,000 reduction on a ₱100,000 supplier therefore did not report ₱85,000:
 * it DELETED the ₱100,000 and reported −₱15,000. The one branch where the write
 * behaved — a package anchor, which bills its agreed total and rides lines on
 * top — is used by NOBODY (prod holds zero anchors), so the broken branch was
 * the only branch.
 *
 * `event_vendor_line_items.is_change_delta` (migration 20271218458148) is what
 * tells the two meanings apart, and this module is the only thing that reads it.
 *
 * ⛔ DO NOT "SIMPLIFY" THIS BY ALWAYS ADDING LINES ON TOP OF THE HEADLINE.
 * Production disproves it outright: all 12 suppliers carrying line items today
 * have Σ(lines) EXACTLY EQUAL to `total_cost_php` — Hain Catering ₱225,000 over
 * 2 lines, Alon Films ₱95,000 over 2, Bulaklak & Co. ₱78,000 over 2, and nine
 * more. Riding those on top doubles every one of them.
 *
 * ⛔ AND DO NOT RE-DERIVE "IS THIS A CHANGE?" FROM THE LABEL. The RPC writes
 * 'Change order: …' / 'Change order (credit): …', and a couple can type either
 * string into a line of their own. The fact lives in the column, set by the one
 * SECURITY DEFINER function entitled to author a settled delta.
 *
 * ── Units ───────────────────────────────────────────────────────────────────
 * UNIT-AGNOSTIC ON PURPOSE. `lib/budget-truth.ts` works in centavos and
 * `lib/budget.ts` works in pesos; both call this with their own unit already
 * applied. Mixing the conversion in here is how a third rounding rule would be
 * born.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** The only field of a line item this module needs. */
export type ChangeAwareLine = {
  /** `event_vendor_line_items.is_change_delta`. Absent/null → a breakdown line. */
  is_change_delta?: boolean | null;
};

/**
 * Split a supplier's manual line items into the two meanings the column now
 * distinguishes. Generic so each caller keeps its own row type.
 *
 * ⚠ The test is `=== true`, not truthiness — a row read from a client that has
 * not learned the column yet arrives as `undefined`, and `undefined` must mean
 * BREAKDOWN (today's behaviour), never CHANGE. Failing that way round is the
 * safe one: an unflagged row keeps the meaning every existing row already has.
 */
export function splitVendorLines<T extends ChangeAwareLine>(
  lines: readonly T[],
): { breakdown: T[]; changes: T[] } {
  const breakdown: T[] = [];
  const changes: T[] = [];
  for (const li of lines) {
    if (li.is_change_delta === true) changes.push(li);
    else breakdown.push(li);
  }
  return { breakdown, changes };
}

/** Which fact the supplier's BASE price came from. */
export type AgreedBaseSource =
  /** A locked package's agreed total. */
  | 'package'
  /** The vendor's own catalogue/published items. */
  | 'catalogue'
  /** Catalogue items PLUS the couple's own extra lines. */
  | 'catalogue_plus_breakdown'
  /** A marketplace listing's starting price — an ESTIMATE, not a commitment. */
  | 'listing_estimate'
  /** The couple's itemisation, which stands in for the headline. */
  | 'breakdown'
  /** `event_vendors.total_cost_php`. */
  | 'headline';

export type AgreedTotalParts = {
  /** The single price row a surface draws (0 = the price IS the breakdown). */
  pricePart: number;
  /** Σ breakdown lines when they are billed as their own rows, else 0. */
  breakdownPart: number;
  /** Σ change lines. ALWAYS billed — that is the whole ruling. */
  changesPart: number;
  /** `pricePart + breakdownPart` — what was agreed BEFORE any change. */
  basePart: number;
  /** `pricePart + breakdownPart + changesPart`. One expression, no second sum. */
  agreed: number;
  baseSource: AgreedBaseSource;
  /** True when breakdown lines are billed as rows (so a surface must draw them). */
  billBreakdown: boolean;
};

/**
 * The supplier's agreed total, and the parts that draw it.
 *
 * The cascade below is the SHIPPED precedence, unchanged, with exactly two
 * corrections — both of which are the ruling:
 *
 *   1. `breakdown` is Σ of the BREAKDOWN lines only, never all lines. A settled
 *      change no longer masquerades as an itemisation and so can no longer
 *      delete the price it was adjusting.
 *   2. `changesPart` is added in EVERY branch, including the ones that used to
 *      drop manual lines entirely. A change the two of them agreed is never
 *      silently absent from the number they are shown.
 *
 * ⚠ The branch tests are `!== 0`, NOT `> 0` — this is R12, and `lib/budget.ts`
 * had never inherited it (`lib/budget-truth.ts` fixed it alone, in 2026-08).
 * With `> 0` a net-credit itemisation reverts a supplier to their stale
 * headline. Unifying the two copies here is what stops them drifting again.
 */
export function resolveAgreedTotal(args: {
  /** `event_vendors.total_cost_php`, in the caller's unit. */
  headline: number;
  /** Σ vendor-controlled catalogue items, in the caller's unit. */
  catalogue: number;
  /** Σ BREAKDOWN lines (call `splitVendorLines` first), in the caller's unit. */
  breakdown: number;
  /** Σ CHANGE lines (call `splitVendorLines` first), in the caller's unit. */
  changes: number;
  /** A locked package anchor bills its agreed total; lines ride on top of it. */
  isPackageAnchor?: boolean;
  /** The package's locked total — the fallback when the headline is 0. */
  packageLocked?: number;
  /**
   * A marketplace listing's starting price on a NOT-YET-COMMITTED supplier: an
   * estimate, drawn alone. §18.1.
   */
  listingEstimate?: boolean;
}): AgreedTotalParts {
  const { headline, catalogue, breakdown, changes } = args;

  let pricePart: number;
  let billBreakdown: boolean;
  let baseSource: AgreedBaseSource;

  if (args.isPackageAnchor) {
    // A locked package bills the AGREED total, never Σ of its inclusions.
    pricePart = headline !== 0 ? headline : args.packageLocked ?? 0;
    billBreakdown = breakdown !== 0;
    baseSource = 'package';
  } else if (args.listingEstimate) {
    pricePart = catalogue;
    billBreakdown = false;
    baseSource = 'listing_estimate';
  } else if (catalogue !== 0 && breakdown !== 0) {
    pricePart = catalogue;
    billBreakdown = true;
    baseSource = 'catalogue_plus_breakdown';
  } else if (catalogue !== 0) {
    pricePart = catalogue;
    billBreakdown = false;
    baseSource = 'catalogue';
  } else if (breakdown !== 0) {
    // The couple's itemisation IS the price — the headline is superseded.
    pricePart = 0;
    billBreakdown = true;
    baseSource = 'breakdown';
  } else {
    pricePart = headline;
    billBreakdown = false;
    baseSource = 'headline';
  }

  const breakdownPart = billBreakdown ? breakdown : 0;
  const basePart = pricePart + breakdownPart;

  return {
    pricePart,
    breakdownPart,
    changesPart: changes,
    basePart,
    // THE PIN. One expression. There is no second computation of `agreed`
    // anywhere for it to drift against.
    agreed: pricePart + breakdownPart + changes,
    baseSource,
    billBreakdown,
  };
}

/** Σ `amount_php` over rows, tolerating the NUMERIC-as-string PostgREST gives. */
export function sumAmountPhp(lines: readonly { amount_php: number | string | null }[]): number {
  return lines.reduce((acc, li) => {
    const n = typeof li.amount_php === 'string' ? Number(li.amount_php) : li.amount_php;
    return acc + (n != null && Number.isFinite(n) ? n : 0);
  }, 0);
}

// ───────────────────────────────────────────────────────────────────────────
// THE AGREED TOTAL NOW — for every screen that shows ONE number
// ───────────────────────────────────────────────────────────────────────────
//
// Owner, 2026-09-11, shown ₱100,000 agreed → −₱15,000 Deal → "Agreed total now
// ₱85,000" on the budget, and asked what every OTHER screen should say:
//
//     "Show the total now"
//
// The couple's supplier list, the event home's committed figure, the Decisions
// payments line, the checklist, the supplier's own performance figures — they
// all print ₱85,000. Only the budget card and the per-supplier page draw the
// breakdown (before · each change · now). One price everywhere.
//
// Those screens read `event_vendors.total_cost_php` and nothing else, so they
// kept printing the ₱100,000 the lock wrote. They now call `agreedTotalNow`,
// which is `resolveAgreedTotal`'s own `agreed` on the headline branch — the
// same expression, not a second sum. `agreed-total-and-its-changes.test.ts`
// fails if a file that reads `total_cost_php` is neither routed through this
// nor classified as something other than a price shown to a person.

/**
 * The PostgREST embed that brings a booking's change lines along in the SAME
 * query as `total_cost_php`. Spread into a `.select(…)` on `event_vendors`.
 *
 * ⚠ The FK is NAMED on purpose. A bare `event_vendor_line_items(…)` embed is
 * accepted today, but PostgREST refuses an embed with PGRST201 the moment a
 * second relationship appears between the two tables — and supabase-js
 * RESOLVES that as `{ error }`, so the page quietly degrades instead of failing.
 * Probed against production 2026-09-11: the named form resolves.
 */
export const CHANGE_LINES_EMBED =
  'change_lines:event_vendor_line_items!event_vendor_line_items_vendor_id_fkey(amount_php,is_change_delta)';

/** A line item as the single-number readers load it. */
export type ChangeLineRow = ChangeAwareLine & { amount_php: number | string | null };

/**
 * The agreed total NOW, for a reader that holds only the headline:
 * `total_cost_php` + Σ change lines. Breakdown lines in `lines` are ignored —
 * they itemise the headline, they do not extend it (all 12 suppliers carrying
 * line items in production sum to their headline exactly).
 *
 * `null` when there is no price at all (no headline and no change), so a
 * surface that says "no price yet" keeps saying it.
 */
export function agreedTotalNow(
  headline: number | string | null | undefined,
  lines: readonly ChangeLineRow[] | null | undefined,
): number | null {
  const changes = sumAmountPhp(splitVendorLines(lines ?? []).changes);
  const h = headline == null ? null : Number(headline);
  const hasHeadline = h != null && Number.isFinite(h);
  if (!hasHeadline && changes === 0) return null;
  return resolveAgreedTotal({
    headline: hasHeadline ? (h as number) : 0,
    catalogue: 0,
    breakdown: 0,
    changes,
  }).agreed;
}

/**
 * The same rule over a list of rows that carry their own `vendor_id`: each
 * row's `total_cost_php` becomes the agreed total NOW. For a loader whose rows
 * come from a helper it does not own (`fetchEventVendors`), paired with
 * `fetchChangeLinesByVendor` — one extra query per page, never one per row.
 *
 * ⚠ The returned rows are FOR DISPLAY. Never write one back as a headline: that
 * would bake the change into `total_cost_php` and count it twice.
 */
export function withAgreedTotalNow<
  T extends { vendor_id: string; total_cost_php?: number | string | null },
>(rows: readonly T[], changeLinesByVendor: ReadonlyMap<string, readonly ChangeLineRow[]>): T[] {
  return rows.map((r) => {
    const lines = changeLinesByVendor.get(r.vendor_id);
    if (!lines || lines.length === 0) return r;
    // `as T`: the field keeps its declared type — a number or null, which every
    // `total_cost_php` column type already admits.
    return { ...r, total_cost_php: agreedTotalNow(r.total_cost_php ?? null, lines) } as T;
  });
}

/**
 * Every change line on one event, grouped by booking. ONE query.
 *
 * Returns `{ error }` rather than throwing, like the client it wraps — the
 * caller decides what a refusal means on its screen. On error the map is
 * EMPTY, which makes `withAgreedTotalNow` a no-op: the screen shows the
 * headline, exactly what it showed before this read existed.
 */
export async function fetchChangeLinesByVendor(
  client: SupabaseClient,
  eventId: string,
): Promise<{ byVendor: Map<string, ChangeLineRow[]>; error: string | null }> {
  const byVendor = new Map<string, ChangeLineRow[]>();
  const { data, error } = await client
    .from('event_vendor_line_items')
    .select('vendor_id,amount_php,is_change_delta')
    .eq('event_id', eventId)
    .eq('is_change_delta', true);
  if (error) return { byVendor, error: error.message };
  for (const row of (data ?? []) as Array<ChangeLineRow & { vendor_id: string }>) {
    const list = byVendor.get(row.vendor_id);
    if (list) list.push(row);
    else byVendor.set(row.vendor_id, [row]);
  }
  return { byVendor, error: null };
}
