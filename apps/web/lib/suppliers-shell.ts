/**
 * suppliers-shell.ts — the pure rules behind the couple's ONE-SCREEN Suppliers
 * page (owner 2026-10-07; corpus `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1;
 * prototype `prototypes/suppliers_page_2026-10-07_fable.html`).
 *
 * The screen has the Maker's shape: one segmented control — Find · Build ·
 * Booked — over ONE body that swaps. Everything here can be decided without a
 * DOM, so it is unit-tested (`suppliers-shell.test.ts`) and the shell
 * (`services-takeover.tsx`), the page and the tests cannot disagree.
 *
 * NO NEW STATE AND NO NEW READ. A mode is a VIEW of the four sections the page
 * already ships, keyed by the tab keys the `BB_TAB_EVENT` bus already carries
 * (`lib/budget-build.ts`); the counts are derived from the plan model and the
 * team rows the page already built.
 */
import type { BudgetBuildTab } from './budget-build';
import { LOCKED_VENDOR_STATUSES } from './shortlist-taxonomy';
import { teamMoney } from './your-team';

/* ── THE THREE MODES ─────────────────────────────────────────────────────── */

export const SUPPLIERS_MODES = ['find', 'build', 'booked'] as const;
export type SuppliersMode = (typeof SUPPLIERS_MODES)[number];

/** The word on each segment. "Build", never "Picks" (owner 2026-10-07). */
export const SUPPLIERS_MODE_LABEL: Record<SuppliersMode, string> = {
  find: 'Find',
  build: 'Build',
  booked: 'Booked',
};

/**
 * Each mode's own bus key — what a press on its segment dispatches over
 * `goToBuildTab`, and what `?tab=` mirrors. Three of the four shipped tab keys
 * ARE the three modes; the fourth (`compare`, the saved builds) lives inside
 * Build and is scrolled to.
 */
export const SUPPLIERS_MODE_TAB: Record<SuppliersMode, BudgetBuildTab> = {
  find: 'shortlist',
  build: 'build',
  booked: 'budget',
};

/** Which body holds a section — every bus key and every `?tab=` resolves here. */
export function suppliersModeOfTab(tab: BudgetBuildTab): SuppliersMode {
  if (tab === 'build' || tab === 'compare') return 'build';
  if (tab === 'budget') return 'booked';
  return 'find';
}

/** A tab that IS its mode opens the body at its top; any other is scrolled to. */
export function isModeTab(tab: BudgetBuildTab): boolean {
  return SUPPLIERS_MODE_TAB[suppliersModeOfTab(tab)] === tab;
}

/* ── BUILD N/M AND THE BUILD'S MONEY ─────────────────────────────────────── */

/** The slice of the plan model's child this needs (`AccordionChild`). */
export type TallyChild = {
  picks: ReadonlyArray<{ vendor_id: string; raw_status?: string | null; rolled_cost_php: number | null }>;
  buildPickVendorIds: readonly string[];
  coveredBy?: unknown;
};

export type BuildTally = {
  /** Categories that hold a booked supplier or a build pick. */
  filled: number;
  /** Categories on the event that hold anybody at all (or are covered). */
  total: number;
  /** Booked + still-to-book, in whole pesos — only the prices that EXIST. */
  knownPhp: number;
  /** Booked suppliers and build picks with no recorded price. */
  unpriced: number;
};

const LOCKED = new Set<string>(LOCKED_VENDOR_STATUSES);
const isLocked = (p: { raw_status?: string | null }) => Boolean(p.raw_status && LOCKED.has(p.raw_status));

/**
 * "Build 2/5" and the build's total, from the SAME plan model `BuildLocked`
 * draws its rows from — booked = a pick in a locked status; in the build = a
 * `buildPickVendorIds` entry that is not booked yet (the two lists
 * `build-locked.tsx` calls `lockedRows` and `toLockRows`).
 *
 * 🔑 ONE SUM. The money goes through `teamMoney` — the function behind the
 * Build body's own tiles — so the peek and the tiles cannot disagree, and a
 * supplier with no recorded price is COUNTED (`unpriced`), never added as ₱0.
 */
export function buildTally(children: ReadonlyArray<TallyChild>, lockedCentavos: number): BuildTally {
  let filled = 0;
  let total = 0;
  let lockedUnpriced = 0;
  const candidateCostsPhp: Array<number | null> = [];
  for (const c of children) {
    const onEvent = c.picks.length > 0 || c.coveredBy != null;
    if (onEvent) total += 1;
    const locked = c.picks.filter(isLocked);
    lockedUnpriced += locked.filter((p) => p.rolled_cost_php == null).length;
    const toBook = c.buildPickVendorIds
      .map((vid) => c.picks.find((p) => p.vendor_id === vid))
      .filter((p): p is TallyChild['picks'][number] => p != null && !isLocked(p));
    for (const p of toBook) candidateCostsPhp.push(p.rolled_cost_php);
    if (locked.length > 0 || toBook.length > 0) filled += 1;
  }
  const money = teamMoney({ lockedCentavos, lockedUnpricedCount: lockedUnpriced, candidateCostsPhp, budgetPhp: null });
  return {
    filled,
    total,
    knownPhp: money.lockedPhp + money.inBuildPhp,
    unpriced: money.lockedUnpriced + money.inBuildUnpriced,
  };
}

/** Is there a peso figure to print? None recorded → no figure, never "₱0". */
export function tallyHasMoney(t: Pick<BuildTally, 'knownPhp'>): boolean {
  return t.knownPhp > 0;
}

/* ── FIND: WHICH CATEGORIES ARE OPEN ─────────────────────────────────────── */

/**
 * Is this category's row open? (Find's thumb row, owner 2026-10-07 evening.)
 *
 *   · searching        every row with a hit is open — the hits unfold by themselves;
 *   · "Expand all"     every row is open, EXCEPT the ones folded by a tap on
 *                      their own header since;
 *   · otherwise        the one row the couple opened.
 */
export function isCategoryOpen(s: {
  tile: string;
  searching: boolean;
  openTile: string | null;
  openAll: boolean;
  folded: ReadonlySet<string>;
}): boolean {
  if (s.searching) return true;
  if (s.openAll) return !s.folded.has(s.tile);
  return s.openTile === s.tile;
}

/* ── THE DATE · PLACE LINE ───────────────────────────────────────────────── */

export type SuppliersFact = {
  text: string;
  /** Still vague or not set — drawn in the accent, as the prototype's `.set`. */
  open: boolean;
};

const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

/**
 * The date as the line says it: a day ("Fri, Dec 18, 2026"), a month
 * ("December 2026"), a year ("2026"), or the ask when there is none.
 * Parsed by its parts — a DATE column must not drift a day across timezones.
 */
export function suppliersDateFact(iso: string | null | undefined, precision: string | null | undefined): SuppliersFact {
  const [y, m, d] = (iso ?? '').split('-').map(Number);
  if (!y || !m || !d) return { text: 'Pick your date', open: true };
  if (precision === 'year') return { text: String(y), open: true };
  if (precision === 'month') {
    return { text: new Date(y, m - 1, 1).toLocaleDateString('en-US', MONTH_FORMAT), open: true };
  }
  return { text: new Date(y, m - 1, d).toLocaleDateString('en-US', DAY_FORMAT), open: false };
}

/**
 * The place: the booked venue and its area ("Seda Vertis North, Metro
 * Manila"), the area alone while no venue is booked, or the ask.
 */
export function suppliersPlaceFact(venueName: string | null | undefined, area: string | null | undefined): SuppliersFact {
  const venue = venueName?.trim() || null;
  const where = area?.trim() || null;
  if (venue) return { text: where ? `${venue}, ${where}` : venue, open: false };
  if (where) return { text: where, open: true };
  return { text: 'Pick the place', open: true };
}
