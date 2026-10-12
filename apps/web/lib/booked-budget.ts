/**
 * booked-budget.ts — THE BUDGET UNDER THE BOOKED ROWS (owner 2026-10-07; corpus
 * `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR4 "Budget"; the prototype's
 * Booked mode).
 *
 *   Due next ₱528,000
 *   Budget · Booked · Paid to suppliers · Setnayan orders · If you book these · Buffer
 *   ▓▓▓▓▓▓░░░░░░  47% spoken for · 0% paid to suppliers
 *   one line per booked supplier: the next payment, or "No amount yet"
 *
 * ── EVERY FIGURE HAS A SHIPPED HOME — NO PRICE IS DECIDED HERE ─────────────
 *
 *   Budget · Booked · If you book these · Buffer
 *       `teamMoney` (`lib/your-team.ts`) — the SAME call, over the SAME plan
 *       model, that the Build body's money block makes. One page, two tabs,
 *       one figure: a second sum here would be a second mechanism that can
 *       disagree with the first about one fact.
 *   Paid to suppliers · Setnayan orders · Due next · each supplier's line
 *       the one resolver (`lib/budget-truth.ts`), read through
 *       `buildBudgetList` — where a budget line item REPLACES a supplier's
 *       headline, and where a refused read is `null`, never `[]`. The only
 *       arithmetic here is adding up rows that reader already produced.
 *
 * ── A FIGURE NOBODY MEASURED IS NOT ₱0 ─────────────────────────────────────
 * `paid`, `orders` and `dueNext` are `null` when their read was refused; the
 * meter then draws no "paid" bar, and the component prints words. A booked
 * supplier with no price makes the Buffer "Not knowable" — `teamMoney`'s own
 * rule, kept.
 *
 * Pure: no React, no I/O.
 */
import type { BudgetList } from './budget-page-view';
import type { BookedRow } from './booked-rows';
import { bufferTile, teamMoney, type TeamMoney } from './your-team';
import type { PlanBudgetModel } from './vendors-plan-budget';

/** The statuses that make a pick a booking — the Build body's own set. */
const BOOKED_STATUSES: ReadonlySet<string> = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

/**
 * The page's plan model → `teamMoney`, exactly as the Build body calls it
 * (`build-locked.tsx`): booked = Σ of the booked picks (`chosenCentavos`), the
 * build = every pinned pick not yet booked, a missing price COUNTED, never
 * added as ₱0.
 */
export function teamMoneyOfModel(
  model: Pick<PlanBudgetModel, 'folders' | 'chosenCentavos'>,
  budgetPhp: number | null,
): { money: TeamMoney; inBuildCount: number } {
  let bookedUnpriced = 0;
  const candidateCostsPhp: (number | null)[] = [];
  for (const f of model.folders) {
    for (const c of f.children) {
      const booked = (id: string) => {
        const p = c.picks.find((pp) => pp.vendor_id === id);
        return Boolean(p?.raw_status && BOOKED_STATUSES.has(p.raw_status));
      };
      for (const p of c.picks) {
        if (p.raw_status && BOOKED_STATUSES.has(p.raw_status) && p.rolled_cost_php == null) bookedUnpriced += 1;
      }
      for (const id of c.buildPickVendorIds) {
        const p = c.picks.find((pp) => pp.vendor_id === id);
        if (!p || booked(id)) continue;
        candidateCostsPhp.push(p.rolled_cost_php);
      }
    }
  }
  return {
    money: teamMoney({
      lockedCentavos: model.chosenCentavos,
      lockedUnpricedCount: bookedUnpriced,
      candidateCostsPhp,
      budgetPhp,
    }),
    inBuildCount: candidateCostsPhp.length,
  };
}

/** One supplier's line under the meter. */
export type BudgetLine =
  | { vendorId: string; name: string; own: boolean; kind: 'no_amount' }
  /** A payment is still owed: "First payment · by Oct 5" → Pay ₱528,000. */
  | { vendorId: string; name: string; own: boolean; kind: 'due'; label: string; dueDate: string | null; amountPhp: number | null }
  /** Money is owed with no date on it: what is paid of what is agreed → Pay. */
  | { vendorId: string; name: string; own: boolean; kind: 'owed'; paidPhp: number; agreedPhp: number }
  /** Nothing owed: what is paid of what is agreed → On track. */
  | { vendorId: string; name: string; own: boolean; kind: 'on_track'; paidPhp: number; agreedPhp: number }
  /** The ledger did not answer for this supplier. */
  | { vendorId: string; name: string; own: boolean; kind: 'unread' };

export type BookedBudget = {
  /** Σ of each booked supplier's NEXT payment that names an amount. `null` = neither the plans nor the ledger were read. */
  dueNextPhp: number | null;
  budgetPhp: number | null;
  bookedPhp: number;
  /** Booked suppliers with no price — `bookedPhp` is then a partial sum. */
  bookedUnpriced: number;
  /** `null` = the supplier read was refused. Unknown, never ₱0. */
  paidPhp: number | null;
  /** `null` = the orders read was refused. */
  orders: { totalPhp: number; count: number; owedPhp: number; onlyName: string | null } | null;
  inBuildPhp: number;
  inBuildCount: number;
  inBuildUnpriced: number;
  buffer: { text: string; tone: 'good' | 'over' | 'none'; unpriced: number };
  /** Percent of the budget, 0–100. `null` when there is no budget to measure against. */
  meter: { spokenPct: number; paidPct: number | null } | null;
  lines: BudgetLine[];
};

const pct = (n: number, of: number) => Math.max(0, Math.min(100, (n / of) * 100));

export function bookedBudget(args: {
  team: { money: TeamMoney; inBuildCount: number };
  list: Pick<BudgetList, 'suppliers' | 'orders'>;
  booked: readonly BookedRow[];
  /** The payment plans were read (`false` = that read was refused). */
  plansKnown: boolean;
}): BookedBudget {
  const { money, inBuildCount } = args.team;
  const { suppliers, orders } = args.list;
  const bookedIds = new Set(args.booked.map((b) => b.vendorId));
  const mine = suppliers === null ? null : suppliers.filter((s) => bookedIds.has(s.vendorId));

  const paidPhp = mine === null ? null : mine.reduce((sum, s) => sum + Math.round(s.paidPhp * 100), 0) / 100;
  // What each row itself says is next — one derivation (`lib/booked-rows.ts`),
  // so the sum under "Due next" is the sum of the rows above it.
  const dueNextPhp =
    mine === null && !args.plansKnown
      ? null
      : args.booked.reduce(
          (sum, b) => sum + (b.next.kind === 'due' && b.next.amountPhp !== null ? Math.round(b.next.amountPhp * 100) : 0),
          0,
        ) / 100;

  const lines: BudgetLine[] = args.booked.map((b) => {
    const who = { vendorId: b.vendorId, name: b.name, own: b.own };
    if (!b.priced) return { ...who, kind: 'no_amount' };
    if (b.next.kind === 'due') {
      return { ...who, kind: 'due', label: b.next.label, dueDate: b.next.dueDate, amountPhp: b.next.amountPhp };
    }
    if (b.money === null) return { ...who, kind: 'unread' };
    return {
      ...who,
      kind: b.money.owedPhp > 0 ? 'owed' : 'on_track',
      paidPhp: b.money.paidPhp,
      agreedPhp: b.money.agreedPhp,
    };
  });

  const unpriced = money.lockedUnpriced + money.inBuildUnpriced;
  const tile = bufferTile(money.bufferPhp, unpriced);
  const budget = money.budgetPhp;
  return {
    dueNextPhp,
    budgetPhp: budget,
    bookedPhp: money.lockedPhp,
    bookedUnpriced: money.lockedUnpriced,
    paidPhp,
    orders:
      orders === null
        ? null
        : {
            totalPhp: orders.reduce((sum, o) => sum + Math.round(o.amountPhp * 100), 0) / 100,
            count: orders.length,
            owedPhp: orders.reduce((sum, o) => sum + Math.round(o.owedPhp * 100), 0) / 100,
            onlyName: orders.length === 1 ? orders[0]!.name : null,
          },
    inBuildPhp: money.inBuildPhp,
    inBuildCount,
    inBuildUnpriced: money.inBuildUnpriced,
    buffer: { ...tile, unpriced },
    meter:
      budget !== null && budget > 0
        ? {
            spokenPct: pct(money.lockedPhp + money.inBuildPhp, budget),
            paidPct: paidPhp === null ? null : pct(paidPhp, budget),
          }
        : null,
    lines,
  };
}
