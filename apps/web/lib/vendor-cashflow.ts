/**
 * Vendor Payday Calendar & Cash-Flow View (Wave 4) — pure, typed assembly of a
 * vendor's upcoming installment timeline.
 *
 * Off-platform money — READ / AGGREGATION ONLY. This module never moves money,
 * never charges, never computes tax. It takes the rows the SECURITY DEFINER
 * `vendor_payday_installments()` RPC already resolved (one per installment,
 * frozen at lock) and shapes them into a chronological, grouped timeline the
 * Payday page renders: running expected-cash totals, a confirmed-vs-owed split,
 * and an `overdue` flag (due_date in the past AND not yet vendor-confirmed).
 *
 * Pure + dependency-free so it's trivially testable and client-importable.
 * "Today" is passed in (Manila-local YYYY-MM-DD) so the module stays a pure
 * function of its inputs — the page derives Manila today and hands it over.
 */

/** One installment as returned by the `vendor_payday_installments()` RPC. */
export type PaydayInstallmentRow = {
  event_vendor_id: string;
  event_id: string;
  event_name: string;
  /** Event date 'YYYY-MM-DD' or null (date not set / tentative). */
  event_date: string | null;
  seq: number;
  label: string;
  /** Resolved peso amount, or null when it couldn't resolve at lock. */
  amount_php: number | null;
  /** Resolved due date 'YYYY-MM-DD', or null (no anchor / unresolved). */
  due_date: string | null;
  /** True when a vendor-confirmed payment exists for this booking + seq. */
  confirmed: boolean;
};

/** A single installment enriched for display. */
export type PaydayInstallment = PaydayInstallmentRow & {
  /** Stable per-installment key (booking + seq). */
  key: string;
  /** due_date < today AND NOT confirmed. Never overdue once confirmed. */
  overdue: boolean;
  /** Sort bucket: rows with no due_date sink to the end of the timeline. */
  hasDueDate: boolean;
};

/** A month group ('YYYY-MM') of installments, chronological. */
export type PaydayMonthGroup = {
  /** 'YYYY-MM' or the literal 'undated' bucket for null due dates. */
  key: string;
  /** Human label, e.g. 'March 2027' or 'No due date yet'. */
  label: string;
  installments: PaydayInstallment[];
  /** Sum of resolvable amounts in this group (nulls skipped). */
  expectedPhp: number;
  /** Sum of confirmed amounts in this group. */
  confirmedPhp: number;
};

/** Roll-up totals across the whole timeline. */
export type PaydayTotals = {
  /** Sum of every resolvable installment amount. */
  expectedPhp: number;
  /** Sum of confirmed installment amounts (money already received). */
  confirmedPhp: number;
  /** expectedPhp − confirmedPhp — still owed across all bookings. */
  owedPhp: number;
  /** Sum of overdue (past-due + unconfirmed) installment amounts. */
  overduePhp: number;
  /** Count of overdue installments. */
  overdueCount: number;
  /** Count of installments whose amount couldn't resolve at lock. */
  unresolvedCount: number;
  /** Total installment count. */
  installmentCount: number;
  /** Distinct booked events represented. */
  eventCount: number;
};

export type PaydayTimeline = {
  /** Overdue installments first (chronological by due date), for the band. */
  overdue: PaydayInstallment[];
  /** All installments grouped by due month, chronological. */
  months: PaydayMonthGroup[];
  totals: PaydayTotals;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM' → 'Month YYYY'. Falls back to the raw key if unparseable. */
function monthLabel(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return monthKey;
  const monthIdx = Number(m[2]) - 1;
  return `${MONTH_NAMES[monthIdx] ?? m[2]} ${m[1]}`;
}

/**
 * Assemble the Payday timeline from the raw RPC rows.
 *
 * @param rows      installment rows from `vendor_payday_installments()`
 * @param todayIso  Manila-local 'YYYY-MM-DD' (the page derives this)
 */
export function buildPaydayTimeline(
  rows: PaydayInstallmentRow[],
  todayIso: string,
): PaydayTimeline {
  const installments: PaydayInstallment[] = rows.map((r) => {
    const hasDueDate = typeof r.due_date === 'string' && r.due_date.length > 0;
    const overdue = hasDueDate && !r.confirmed && (r.due_date as string) < todayIso;
    return {
      ...r,
      key: `${r.event_vendor_id}:${r.seq}`,
      hasDueDate,
      overdue,
    };
  });

  // Chronological sort: dated installments by due date asc, undated last
  // (then stable by event + seq for determinism).
  const byDueDate = (a: PaydayInstallment, b: PaydayInstallment): number => {
    if (a.hasDueDate && b.hasDueDate) {
      if (a.due_date! < b.due_date!) return -1;
      if (a.due_date! > b.due_date!) return 1;
    } else if (a.hasDueDate !== b.hasDueDate) {
      return a.hasDueDate ? -1 : 1;
    }
    if (a.event_name !== b.event_name) return a.event_name.localeCompare(b.event_name);
    return a.seq - b.seq;
  };
  const sorted = [...installments].sort(byDueDate);

  // Group by due month ('YYYY-MM'); null due dates → an 'undated' bucket sorted
  // last (the empty key sorts after real month keys via the explicit guard).
  const groupMap = new Map<string, PaydayInstallment[]>();
  for (const inst of sorted) {
    const groupKey = inst.hasDueDate ? (inst.due_date as string).slice(0, 7) : 'undated';
    const bucket = groupMap.get(groupKey);
    if (bucket) bucket.push(inst);
    else groupMap.set(groupKey, [inst]);
  }

  const months: PaydayMonthGroup[] = [...groupMap.entries()]
    .sort(([a], [b]) => {
      if (a === 'undated') return 1;
      if (b === 'undated') return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    })
    .map(([key, items]) => {
      let expectedPhp = 0;
      let confirmedPhp = 0;
      for (const it of items) {
        if (it.amount_php !== null) {
          expectedPhp += it.amount_php;
          if (it.confirmed) confirmedPhp += it.amount_php;
        }
      }
      return {
        key,
        label: key === 'undated' ? 'No due date yet' : monthLabel(key),
        installments: items,
        expectedPhp,
        confirmedPhp,
      };
    });

  // Roll-up totals.
  let expectedPhp = 0;
  let confirmedPhp = 0;
  let overduePhp = 0;
  let overdueCount = 0;
  let unresolvedCount = 0;
  const eventIds = new Set<string>();
  for (const it of installments) {
    eventIds.add(it.event_id);
    if (it.amount_php === null) {
      unresolvedCount += 1;
    } else {
      expectedPhp += it.amount_php;
      if (it.confirmed) confirmedPhp += it.amount_php;
    }
    if (it.overdue) {
      overdueCount += 1;
      if (it.amount_php !== null) overduePhp += it.amount_php;
    }
  }

  const overdue = sorted.filter((it) => it.overdue);

  return {
    overdue,
    months,
    totals: {
      expectedPhp,
      confirmedPhp,
      owedPhp: expectedPhp - confirmedPhp,
      overduePhp,
      overdueCount,
      unresolvedCount,
      installmentCount: installments.length,
      eventCount: eventIds.size,
    },
  };
}

/**
 * Manila-local 'YYYY-MM-DD' for "now". Mirrors the vendor calendar page's
 * idiom (`en-CA` gives ISO order; `Asia/Manila` is the platform timezone).
 */
export function manilaTodayIso(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}
