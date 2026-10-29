/**
 * record-card-plan — THE RECORD CARD'S PAYMENT ROWS: NAME · DUE DATE · AMOUNT, STORED AS THE RULE. (2026-10-29)
 *
 * The approved Booked prototype v4 (owner OK 2026-10-29 ~19:20, designer call 1 taken) draws a couple's plan for a
 * supplier they added as three things per payment — what it is, the day it is due, how much — instead of the live
 * `%`/`₱` + "N days after you book / before the event" rows. The STORED model does not change: every instalment is
 * still `amount_kind` + `value` + `due_anchor` + `due_offset_days` (`self-added-payment-plan.ts`), because that is
 * what lets a plan follow the wedding date and what every reader of `event_vendor_payment_plan` already understands.
 * This file is the exact map between the two.
 *
 * 🔑 NO LOSSY ROUND TRIP — the property the tests hold:
 *   · a stored rule opens as a date + an amount, and saved UNTOUCHED it posts the very same rule back (its anchor, its
 *     days, its percent — a 50 % row stays 50 %, so it keeps following the price);
 *   · a date the couple TYPES posts a rule that resolves back to exactly that date: "before the event" when the event
 *     date is set and the day is on or before it (the event date is the fixed point — a date counted from "after you
 *     book" would slide when they book), else "after you book" counted from the booking day;
 *   · an amount the couple TYPES posts as fixed pesos — unless it is exactly what the row's own percent gives at the
 *     price on the card, in which case the percent is kept.
 *
 * PURE.
 */

import { pctToBps, pctOfTotalPhp, shiftIsoDate } from '@/lib/vendor-service-payment-schedules';
import { planAmountNumber, type EditablePlanRow } from '@/lib/self-added-payment-plan';

export type PlanDates = {
  /** What "after you book" counts from — the lock day once booked, else today (`onLockAnchorIso`). */
  lockIso: string;
  /** The event date, or null while it is not fixed. */
  eventIso: string | null;
};

/** One row of the card. `rule` is the stored rule it opened with (null for a row added on the card). */
export type DatedRow = {
  key: number;
  label: string;
  /** YYYY-MM-DD, or '' while unknown (a legacy row with no stored rule — the couple picks the day). */
  dueIso: string;
  /** Pesos as typed ("60,000"). */
  amount: string;
  /** The instalment's `seq` — kept so payments logged against it stay attached. Null = new. */
  seq: number | null;
  /** A payment is logged against it (and not refused) — the card keeps it as it is. */
  settled: boolean;
  rule: Omit<EditablePlanRow, 'label'> | null;
};

/** The stored rule each row posts — the hidden `plan_kind` / `plan_value` / `plan_anchor` / `plan_days`. */
export type PostedRule = { kind: 'percent' | 'fixed'; value: string; anchor: '' | 'on_lock' | 'before_event'; days: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from `a` to `b` (both YYYY-MM-DD, UTC midnights). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** The day a stored rule falls on — the same arithmetic `computePlanInstances` does. '' when it cannot resolve. */
export function ruleDueIso(anchor: '' | 'on_lock' | 'before_event', days: string, dates: PlanDates): string {
  const d = Math.trunc(Number(days.trim() === '' ? '0' : days));
  if (!Number.isFinite(d)) return '';
  if (anchor === 'on_lock') return shiftIsoDate(dates.lockIso, d) ?? '';
  if (anchor === 'before_event' && dates.eventIso) return shiftIsoDate(dates.eventIso, -d) ?? '';
  return '';
}

/** The pesos a stored rule comes to at `totalPhp` — null for a percent with no price yet. */
export function ruleAmountPhp(kind: 'percent' | 'fixed', value: string, totalPhp: number | null): number | null {
  const n = planAmountNumber(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (kind === 'fixed') return n;
  return totalPhp != null && totalPhp > 0 ? pctOfTotalPhp(totalPhp, pctToBps(n)) : null;
}

/** "60000" → "60,000"; centavos kept when there are any ("26,664.5"). */
export function amountWords(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '';
  return n.toLocaleString('en-PH', { maximumFractionDigits: 2 });
}

/** The card's rows from the stored ones (`planInstancesToRows`), their seqs, and which are settled. */
export function rowsFromRules(
  rows: ReadonlyArray<EditablePlanRow>,
  opts: { dates: PlanDates; totalPhp: number | null; seqs?: ReadonlyArray<number | null>; settledSeqs?: ReadonlyArray<number> },
): DatedRow[] {
  const settled = new Set(opts.settledSeqs ?? []);
  return rows.map((r, i) => {
    const seq = opts.seqs?.[i] ?? null;
    return {
      key: i,
      label: r.label,
      dueIso: ruleDueIso(r.anchor, r.days, opts.dates),
      amount: amountWords(ruleAmountPhp(r.kind, r.value, opts.totalPhp)),
      seq,
      settled: seq != null && settled.has(seq),
      rule: { kind: r.kind, value: r.value, anchor: r.anchor, days: r.days },
    };
  });
}

/**
 * A typed day as a stored rule that resolves back to that same day — or null when no rule can say it (no event date
 * and a day before the booking day: "after you book" cannot count backwards).
 */
export function dateToAnchor(
  dueIso: string,
  dates: PlanDates,
  prefer?: '' | 'on_lock' | 'before_event',
): { anchor: 'on_lock' | 'before_event'; days: string } | null {
  if (!ISO.test(dueIso)) return null;
  const beforeEvent = dates.eventIso && dueIso <= dates.eventIso ? { anchor: 'before_event' as const, days: String(daysBetween(dueIso, dates.eventIso)) } : null;
  const afterBook = dueIso >= dates.lockIso ? { anchor: 'on_lock' as const, days: String(daysBetween(dates.lockIso, dueIso)) } : null;
  if (prefer === 'on_lock' && afterBook) return afterBook;
  if (prefer === 'before_event' && beforeEvent) return beforeEvent;
  return beforeEvent ?? afterBook;
}

/** The rule one card row posts. `totalPhp` = the price on the card now. */
export function postedRule(row: DatedRow, dates: PlanDates, totalPhp: number | null): PostedRule {
  const typed = planAmountNumber(row.amount);
  const r = row.rule;
  // ── amount ──
  let kind: 'percent' | 'fixed' = 'fixed';
  // What is SAVED is the plain number — the field shows "100,000", the plan stores "100000".
  let value = Number.isFinite(typed) ? String(typed) : row.amount.trim();
  if (r && r.kind === 'percent') {
    const ruleSays = ruleAmountPhp('percent', r.value, totalPhp);
    if (row.amount.trim() === '' && ruleSays == null) {
      // A percent with no price yet shows no amount — untouched, it posts its percent.
      kind = 'percent';
      value = r.value;
    } else if (ruleSays != null && Number.isFinite(typed) && Math.abs(ruleSays - typed) < 0.005) {
      kind = 'percent';
      value = r.value;
    }
  } else if (r && r.kind === 'fixed' && Number.isFinite(typed) && Math.abs(planAmountNumber(r.value) - typed) < 0.005) {
    value = r.value;
  }
  // ── day ──
  if (r && r.anchor !== '' && ruleDueIso(r.anchor, r.days, dates) === row.dueIso) {
    return { kind, value, anchor: r.anchor, days: r.days };
  }
  const a = dateToAnchor(row.dueIso, dates, r?.anchor);
  return { kind, value, anchor: a?.anchor ?? '', days: a?.days ?? '0' };
}

/** The rows in the order they are drawn: by day, a row with no day yet last. Each row keeps its `seq`. */
export function byDue(rows: ReadonlyArray<DatedRow>): DatedRow[] {
  return [...rows].sort((a, b) => {
    if (!a.dueIso && !b.dueIso) return a.key - b.key;
    if (!a.dueIso) return 1;
    if (!b.dueIso) return -1;
    return a.dueIso < b.dueIso ? -1 : a.dueIso > b.dueIso ? 1 : a.key - b.key;
  });
}

/** The honest line under the rows (prototype v4): what the payments add up to against the price. */
export function addsUpLine(rows: ReadonlyArray<DatedRow>, totalPhp: number | null, peso: (n: number) => string): { text: string; off: boolean } {
  const sum = rows.reduce((s, r) => {
    const n = planAmountNumber(r.amount);
    return Number.isFinite(n) && n > 0 ? s + n : s;
  }, 0);
  if (totalPhp == null || !(totalPhp > 0)) return { text: `Adds up to ${peso(sum)} · set the price to check it`, off: false };
  const gap = Math.round((totalPhp - sum) * 100) / 100;
  if (Math.abs(gap) <= 1) return { text: `Adds up to ${peso(sum)} · matches the price`, off: false };
  return gap > 0
    ? { text: `Adds up to ${peso(sum)} · ${peso(gap)} not in a payment yet`, off: true }
    : { text: `Adds up to ${peso(sum)} · ${peso(-gap)} more than the price`, off: true };
}
