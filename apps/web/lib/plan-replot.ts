/**
 * plan-replot — AN ACCEPTED PRICE CHANGE ALWAYS RE-PLOTS THE UNPAID PAYMENTS. (2026-10-29)
 *
 * Owner, verbatim: *"Re-split payments after a price change? yes. allow this. replot the payments always."*
 * (DECISION_LOG 2026-10-29 "AN ACCEPTED PRICE CHANGE ALWAYS RE-PLOTS THE UNPAID PAYMENTS".)
 *
 * The rule, in one place:
 *   · a SETTLED instalment — any payment logged against its `seq` that the supplier did not refuse (paid, or
 *     waiting for their OK) — NEVER changes: that money has already left the couple's hands;
 *   · the UNPAID instalments share what is left of the new price (`new total − settled`) in the SAME PROPORTIONS
 *     they had before — the plan's own rule, kept: a 30/70 plan stays 30/70 of what is left;
 *   · whole pesos per instalment; the rounding lands on the LAST unpaid instalment, so the plan adds up exactly;
 *   · everything already settled and the price went UP → one new "Balance" instalment for the difference;
 *   · the price went DOWN to or below what is already settled → the unpaid instalments go (nothing is left to pay),
 *     and `overByPhp` says by how much the settled money passed the new price — never a negative instalment.
 *
 * 🔑 ONE RULE, THREE CALLERS, ONE TWIN. The couple's record card re-plots its rows live as the price is typed
 * (`replotAmounts`); the database re-plots a stored plan when a change line lands or a self-added supplier's price
 * moves (`public.plan_replot_instances`, migration `a_price_change_replots_the_unpaid_payments`). The SQL is the
 * twin of `replotInstances` below, and `a-price-change-replots-the-unpaid-payments.db.test.ts` runs both over the
 * same plans and holds them equal — so the screen can never preview a split the database does not make.
 *
 * PURE — no client, no `server-only`.
 */

import { pctOfTotalPhp } from '@/lib/vendor-service-payment-schedules';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ReplotCore = {
  /** The new amount per input row — a settled row echoes its own; an unpaid row that no longer has anything to pay is `null` (drop it). */
  next: Array<number | null>;
  /** > 0 when every row was settled and the price went up: one new instalment of this much. */
  balancePhp: number;
  /** > 0 when the settled money already passes the new price, by this much. */
  overByPhp: number;
};

/**
 * The split itself, over plain amounts — what the record card runs on its rows as the price is typed.
 * `amounts[i]` is row i's current amount (null/NaN reads as 0 weight); `settled[i]` marks a row that must not move.
 */
export function replotAmounts(
  amounts: ReadonlyArray<number | null>,
  settled: ReadonlyArray<boolean>,
  newTotalPhp: number,
): ReplotCore {
  const amt = amounts.map((a) => (a != null && Number.isFinite(a) ? a : 0));
  const paid = round2(amt.reduce((s, a, i) => (settled[i] ? s + a : s), 0));
  const remaining = round2(newTotalPhp - paid);
  const unpaid = amt.map((_, i) => i).filter((i) => !settled[i]);
  const next: Array<number | null> = amt.map((a) => a);

  if (unpaid.length === 0) {
    return { next, balancePhp: remaining > 0 ? remaining : 0, overByPhp: remaining < 0 ? -remaining : 0 };
  }
  if (remaining <= 0) {
    for (const i of unpaid) next[i] = null;
    return { next, balancePhp: 0, overByPhp: -remaining };
  }

  let weights = unpaid.map((i) => Math.max(0, amt[i]!));
  let total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) {
    weights = unpaid.map(() => 1);
    total = unpaid.length;
  }
  let given = 0;
  unpaid.forEach((i, k) => {
    if (k < unpaid.length - 1) {
      const a = Math.round((remaining * weights[k]!) / total);
      next[i] = a;
      given += a;
    } else {
      next[i] = round2(remaining - given);
    }
  });
  // A share that rounded to nothing is not a payment — `buildCouplePaymentPlan` refuses an amount of zero.
  for (const i of unpaid) if (next[i] != null && !(next[i]! > 0)) next[i] = null;
  return { next, balancePhp: 0, overByPhp: 0 };
}

/** The fields of a stored instalment this reads; everything else on the object is carried through untouched. */
export type ReplotInstance = {
  seq: number;
  label: string;
  amount_php: number | null;
  due_date: string | null;
  amount_kind: 'percent' | 'fixed';
  percent_bps: number | null;
  authored?: { amount_kind: 'percent' | 'fixed'; value: string; due_anchor: string; due_offset_days: string };
  [k: string]: unknown;
};

export type ReplotResult = {
  instances: ReplotInstance[];
  /** False when the plan already adds up to the new price — nothing was re-plotted (and nothing to keep in history). */
  changed: boolean;
  overByPhp: number;
};

/** The words a whole-peso amount is stored with in an `authored` rule — "60000", never "60000.00". */
export function amountText(n: number): string {
  return String(round2(n));
}

/**
 * Re-plot a stored plan (`event_vendor_payment_plan.instances_json`) to a new agreed total. `settledSeqs` are the
 * instalments with a payment logged against them that was not refused.
 *
 * An unpaid PERCENT instalment stays percent when its percent of the new price IS its new amount (a plan with nothing
 * paid keeps its 50/50 as 50/50); otherwise it becomes the fixed amount it now is — and its `authored` rule follows,
 * so the couple's record re-opens on the amount the plan really holds.
 */
export function replotInstances(
  instances: ReadonlyArray<ReplotInstance>,
  settledSeqs: ReadonlySet<number> | ReadonlyArray<number>,
  newTotalPhp: number,
): ReplotResult {
  const settledSet = settledSeqs instanceof Set ? settledSeqs : new Set(settledSeqs as ReadonlyArray<number>);
  const rows = [...instances].sort((a, b) => a.seq - b.seq);
  if (rows.length === 0 || !Number.isFinite(newTotalPhp)) return { instances: [...instances], changed: false, overByPhp: 0 };
  const oldSum = rows.reduce((s, r) => s + (r.amount_php ?? 0), 0);
  if (Math.abs(oldSum - newTotalPhp) < 0.005) return { instances: [...instances], changed: false, overByPhp: 0 };

  const core = replotAmounts(
    rows.map((r) => r.amount_php),
    rows.map((r) => settledSet.has(r.seq)),
    newTotalPhp,
  );
  const out: ReplotInstance[] = [];
  rows.forEach((r, i) => {
    if (settledSet.has(r.seq)) {
      out.push(r);
      return;
    }
    const a = core.next[i];
    if (a == null) return;
    const keepsPercent =
      r.amount_kind === 'percent' && r.percent_bps != null && Math.abs(pctOfTotalPhp(newTotalPhp, r.percent_bps) - a) < 0.005;
    if (keepsPercent) {
      out.push({ ...r, amount_php: a });
      return;
    }
    const next: ReplotInstance = { ...r, amount_php: a, amount_kind: 'fixed', percent_bps: null };
    if (r.authored) next.authored = { ...r.authored, amount_kind: 'fixed', value: amountText(a) };
    out.push(next);
  });
  if (core.balancePhp > 0) {
    const last = rows[rows.length - 1]!;
    const due = rows.reduce<string | null>((d, r) => (r.due_date && (!d || r.due_date > d) ? r.due_date : d), null);
    const balance: ReplotInstance = {
      seq: Math.max(...rows.map((r) => r.seq)) + 1,
      label: 'Balance',
      amount_php: core.balancePhp,
      due_date: due,
      amount_kind: 'fixed',
      percent_bps: null,
    };
    if (last.authored) balance.authored = { ...last.authored, amount_kind: 'fixed', value: amountText(core.balancePhp) };
    out.push(balance);
  }
  return { instances: out, changed: true, overByPhp: core.overByPhp };
}

/** One kept plan — `event_vendor_payment_plan.replot_history[]`, written by the database when it re-plots. */
export type PlanReplotEntry = {
  at: string;
  from_php: number;
  to_php: number;
  /** 'change' — an accepted change line · 'price' — a self-added supplier's price was edited. */
  source: 'change' | 'price';
  /** The plan as it was before. */
  instances: unknown[];
};

/** The newest kept plan, read defensively off the JSONB column — null when there is none or it does not read. */
export function lastPlanReplot(history: unknown): { fromPhp: number; toPhp: number; at: string } | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const e = history[history.length - 1] as Partial<PlanReplotEntry> | null;
  const from = Number(e?.from_php);
  const to = Number(e?.to_php);
  if (!e || !Number.isFinite(from) || !Number.isFinite(to) || typeof e.at !== 'string') return null;
  return { fromPhp: from, toPhp: to, at: e.at };
}
