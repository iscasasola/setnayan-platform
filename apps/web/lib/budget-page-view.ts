/**
 * budget-page-view — what the Budget page DRAWS, derived from the one resolver.
 *
 * `BUDGET_PAGE_2026-10-08_fable.md` §4: "Derive. — summary = sum(list)". The
 * page never runs a second query for a figure it prints: everything here is a
 * pure reading of `EventMoney` (`lib/budget-truth.ts`), so the summary and the
 * list under it cannot disagree about one peso.
 *
 * Pure — no I/O, no clock. The dates and day counts a line carries were stamped
 * once by the resolver (`paymentDueState`, the one clock); nothing here compares
 * a day count against a threshold of its own.
 */
import { OTHER_BUCKET, bucketLabel, type EventMoney, type MoneyLine } from './budget-truth';

/** The summary's ONE "Next" line — the earliest dated payment still owed. */
export type NextPayment = {
  /** Still owed on that line — what is actually due, not the line's total. */
  amountPhp: number;
  /** The supplier's name, or the cost's own label when nobody supplied it. */
  name: string;
  /** ISO date, `YYYY-MM-DD`. */
  dueDate: string;
  /** `event_vendors.vendor_id`, or null for a cost with no supplier. */
  vendorId: string | null;
  /** `event_costs.cost_id` when the payment is one of the couple's own expenses. */
  costId: string | null;
};

/**
 * The earliest dated, agreed payment that still has money owed on it.
 *
 * AGREED lines only (owner 2026-09-02, BA2: "we only add the finalized
 * budgets") — an un-booked supplier's quote is shopping, and telling a couple
 * their "next payment" is one they never agreed to make is the ₱80,000 defect
 * in a new place. An OVERDUE line is the earliest by definition, and it is
 * still the next thing to pay.
 *
 * Ties break on the larger amount, then the name, so the pick is deterministic.
 */
export function pickNextPayment(lines: readonly MoneyLine[]): NextPayment | null {
  let best: MoneyLine | null = null;
  for (const l of lines) {
    if (l.kind !== 'committed' || !l.dueDate || !(l.stillOwedPhp > 0)) continue;
    if (
      best === null ||
      l.dueDate < best.dueDate! ||
      (l.dueDate === best.dueDate && l.stillOwedPhp > best.stillOwedPhp) ||
      (l.dueDate === best.dueDate &&
        l.stillOwedPhp === best.stillOwedPhp &&
        (l.vendorName ?? l.label) < (best.vendorName ?? best.label))
    ) {
      best = l;
    }
  }
  if (best === null) return null;
  return {
    amountPhp: best.stillOwedPhp,
    name: best.vendorName ?? best.label,
    dueDate: best.dueDate!,
    vendorId: best.vendorId,
    costId: best.source === 'event_cost' ? best.sourceRef : null,
  };
}

/**
 * The meter under the summary: green = paid, gold = agreed, track = target,
 * a red tail when agreed runs past the target. Widths are percentages of
 * whichever is larger, target or agreed — so the bar is never longer than its
 * track and an over-target event shows HOW far over, to scale.
 */
export type BudgetMeter = {
  agreedPct: number;
  paidPct: number;
  /** Width of the red tail, anchored to the right edge. 0 when within target. */
  overPct: number;
};

export function budgetMeter(args: {
  targetPhp: number | null;
  agreedPhp: number | null;
  paidPhp: number | null;
}): BudgetMeter {
  const { targetPhp, agreedPhp, paidPhp } = args;
  // An unknown figure draws no bar. A bar at 0% would be a claim.
  if (agreedPhp === null || paidPhp === null) return { agreedPct: 0, paidPct: 0, overPct: 0 };
  const base = Math.max(targetPhp ?? 0, agreedPhp, 1);
  const pct = (n: number) => Math.max(0, Math.min(100, (n / base) * 100));
  return {
    agreedPct: pct(agreedPhp),
    paidPct: pct(paidPhp),
    overPct: targetPhp !== null && agreedPhp > targetPhp ? pct(agreedPhp - targetPhp) : 0,
  };
}

/** "Oct 5" — a due date in a row or on the Next line. Year omitted on purpose. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ONE LIST (plan row B2)
// ═══════════════════════════════════════════════════════════════════════════
//
// Owner 2026-10-08: "opening budget will show all your booked vendors, and
// expenses and they can add more manually" · "including purchased in setnayan".
//
// Three groups, ONE source: every row below is a reading of `EventMoney.lines`.
// The summary above the list is `EventMoney.committed / paid / stillOwed`, which
// the resolver sums from those same lines — so Σ(rows) IS the summary, by
// construction, and `budget-page-view.test.ts` holds the equality.
//
// 🛑 A GROUP IS `null` WHEN ITS READ WAS REFUSED — never `[]`. An empty array
// means "we looked and there are none" and draws the honest zero-state; `null`
// means "we do not know" and must draw words. The type makes a caller choose.

/** Which side of the All · Owing · Paid filter a row falls on. */
export type RowStatus = 'owing' | 'paid';

/** One dated payment still owed to a supplier — a "Due" row in its sheet. */
export type SupplierDue = {
  label: string;
  dueDate: string;
  amountPhp: number;
};

/** A booked supplier: agreed · paid · owed, one row. */
export type SupplierRow = {
  /** `event_vendors.vendor_id`. */
  vendorId: string;
  name: string;
  /** Two letters for the 40px circle. */
  initials: string;
  /** What they are booked for — the plan group's own label. */
  service: string;
  agreedPhp: number;
  paidPhp: number;
  owedPhp: number;
  /** Their dated payments still owed, earliest first. */
  dues: SupplierDue[];
  status: RowStatus;
};

/** Something bought on Setnayan. Read-only here. */
export type OrderRow = {
  /** `orders.order_id`. */
  orderId: string;
  name: string;
  /** The Manila day it was placed, or null when the order carries none. */
  bookedOn: string | null;
  amountPhp: number;
  /** > 0 only while the order is awaiting payment. */
  owedPhp: number;
  status: RowStatus;
};

/** A cost the couple added by hand — `event_costs`. */
export type ExpenseRow = {
  /** `event_costs.cost_id`. */
  costId: string;
  name: string;
  initials: string;
  /** Its category's label, or null when it was filed under "Other". */
  category: string | null;
  amountPhp: number;
  paidPhp: number;
  owedPhp: number;
  status: RowStatus;
};

export type BudgetList = {
  /** `null` = the supplier read was refused. Unknown, not empty. */
  suppliers: SupplierRow[] | null;
  /** `null` = the orders read was refused. */
  orders: OrderRow[] | null;
  /** `null` = the costs read was refused. */
  expenses: ExpenseRow[] | null;
};

/** "Seda Vertis North" → "SV" · "Catering" → "CA". Never empty. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '·';
  const letters =
    words.length === 1
      ? Array.from(words[0]!).slice(0, 2).join('')
      : `${Array.from(words[0]!)[0] ?? ''}${Array.from(words[1]!)[0] ?? ''}`;
  return letters.toUpperCase();
}

/** "Church offering" → "CH". Never empty. */
export function firstTwoLetters(name: string): string {
  const letters = Array.from(name.trim()).slice(0, 2).join('').toUpperCase();
  return letters.length > 0 ? letters : '·';
}

const statusOf = (owedPhp: number): RowStatus => (owedPhp > 0 ? 'owing' : 'paid');
/** Sum in centavos so forty lines cannot drift a peso apart from the resolver. */
const sumPhp = (values: readonly number[]): number =>
  values.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100;

/**
 * The page's one list, from the resolver's own lines.
 *
 * AGREED lines only (`kind === 'committed'`). Estimates — a shortlisted
 * supplier's quote, an order still awaiting approval — are shopping, not
 * budget (owner 2026-09-02, BA2), and they are not part of `committed` either,
 * so leaving them out is what keeps the list equal to the summary.
 */
export function buildBudgetList(money: EventMoney): BudgetList {
  const committed = money.lines.filter((l) => l.kind === 'committed');

  // ── Booked suppliers — every line that names a supplier, folded per supplier.
  let suppliers: SupplierRow[] | null = null;
  if (money.reads.suppliers === 'ok') {
    const byVendor = new Map<string, MoneyLine[]>();
    for (const l of committed) {
      if (l.vendorId === null) continue;
      const mine = byVendor.get(l.vendorId);
      if (mine) mine.push(l);
      else byVendor.set(l.vendorId, [l]);
    }
    suppliers = Array.from(byVendor.entries()).map(([vendorId, lines]) => {
      const first = lines[0]!;
      const name = first.vendorName?.trim() || first.label;
      const owedPhp = sumPhp(lines.map((l) => l.stillOwedPhp));
      const dues: SupplierDue[] = lines
        .filter((l) => l.dueDate !== null && l.stillOwedPhp > 0)
        .map((l) => ({ label: l.label, dueDate: l.dueDate!, amountPhp: l.stillOwedPhp }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.amountPhp - a.amountPhp);
      return {
        vendorId,
        name,
        initials: initialsOf(name),
        service: bucketLabel(first.bucket),
        agreedPhp: sumPhp(lines.map((l) => l.amountPhp)),
        paidPhp: sumPhp(lines.map((l) => l.paidPhp)),
        owedPhp,
        dues,
        status: statusOf(owedPhp),
      };
    });
  }

  // ── Bought on Setnayan — the resolver already kept the vendor-payer booking
  // fee out and turned `submitted` into an estimate; what is left is agreed.
  let orders: OrderRow[] | null = null;
  if (money.reads.orders === 'ok') {
    orders = committed
      .filter((l) => l.source === 'setnayan_order')
      .map((l) => ({
        orderId: l.sourceRef,
        name: l.label,
        bookedOn: l.bookedOn,
        amountPhp: l.amountPhp,
        owedPhp: l.stillOwedPhp,
        status: statusOf(l.stillOwedPhp),
      }))
      // Oldest first, undated last — the order a couple bought them in.
      .sort((a, b) => (a.bookedOn ?? '9999').localeCompare(b.bookedOn ?? '9999'));
  }

  // ── Your expenses — money with nobody on the other side of it.
  let expenses: ExpenseRow[] | null = null;
  if (money.reads.costs === 'ok') {
    expenses = committed
      .filter((l) => l.source === 'event_cost')
      .map((l) => ({
        costId: l.sourceRef,
        name: l.label,
        // An expense is named by its first two letters ("Church offering" → CH),
        // as drawn; a supplier by the initials of its first two words.
        initials: firstTwoLetters(l.label),
        category: l.bucket === OTHER_BUCKET ? null : bucketLabel(l.bucket),
        amountPhp: l.amountPhp,
        paidPhp: l.paidPhp,
        owedPhp: l.stillOwedPhp,
        status: statusOf(l.stillOwedPhp),
      }));
  }

  return { suppliers, orders, expenses };
}

/**
 * The supplier this sheet's "Record a payment" pre-fills with: their earliest
 * dated payment still owed, or — when nothing is dated — everything still owed.
 * `null` when they are paid up: a form pre-filled with ₱0 invites a ₱0 payment.
 */
export function suggestedPayment(row: Pick<SupplierRow, 'dues' | 'owedPhp'>): {
  amountPhp: number;
  dueDate: string | null;
} | null {
  const next = row.dues[0];
  if (next) return { amountPhp: next.amountPhp, dueDate: next.dueDate };
  return row.owedPhp > 0 ? { amountPhp: row.owedPhp, dueDate: null } : null;
}
