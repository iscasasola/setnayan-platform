/**
 * self-added-payment-plan — THE COUPLE'S OWN INSTALMENT PLAN for a supplier
 * they added themselves. (2026-09-20)
 *
 * Owner: *"Payment Plan Must set date for until the payment is fully paid.
 * just like on our quote maker."*
 *
 * ── Why this is NOT a note ────────────────────────────────────────────────
 * An earlier draft stored payment terms as free text, on the owner's earlier
 * line that manual payment info has "no connection to the user's event". His
 * refinement settled it: a plan with due dates is something the couple is
 * TRACKED against, and you cannot see "until fully paid" unless something is
 * counting. So this produces real instalments for
 * `event_vendor_payment_plan` — the same table a marketplace booking's plan
 * is frozen into at lock, and the one the Payments surface already reads.
 *
 * The free-text column was deleted before it shipped: free text cannot carry a
 * due date, and one beside a real schedule would be two sources for one fact.
 *
 * ── REUSES THE QUOTE MAKER'S MATH, DOES NOT RESTATE IT ────────────────────
 * Dates and amounts come from `computePlanInstances` — the same pure function
 * `finalizeVendor` uses to freeze a marketplace booking's plan. Anchors are
 * the quote maker's own (`on_lock` / `before_event` + a day offset), per the
 * owner's choice of relative anchors over fixed calendar dates, so a plan
 * self-corrects if the wedding date moves. Nothing here re-derives a date.
 *
 * This module only does what the quote maker's own editor does NOT need:
 * turn the couple's typed rows into schedule-shaped rows, and refuse a plan
 * that does not add up.
 *
 * PURE — no client, no `server-only` — so the whole truth table is executed by
 * `self-added-payment-plan.test.ts` rather than grepped.
 */

import {
  MAX_SCHEDULE_ITEMS,
  computePlanInstances,
  pctToBps,
  phpToCentavos,
  type DueAnchor,
  type PaymentScheduleItemRow,
  type PlanInstance,
} from '@/lib/vendor-service-payment-schedules';

/** One row as the couple types it. Strings, because the inputs are strings. */
export type CouplePlanRowInput = {
  label: string;
  /** 'percent' → whole percent 0–100 · 'fixed' → whole pesos. */
  amount_kind: 'percent' | 'fixed';
  value: string;
  due_anchor: '' | DueAnchor;
  due_offset_days: string;
};

export type CouplePlanResult =
  | { ok: true; instances: PlanInstance[] }
  | { ok: false; message: string };

export const PLAN_LABEL_MAX = 60;

/**
 * How far a plan may miss the agreed total and still be accepted, in pesos.
 *
 * ⚠ NOT ZERO, AND NOT A SLOPPY TOLERANCE EITHER. Percentages of a real price
 * rarely land on whole pesos — 3 × 33% of ₱80,000 is ₱79,200, and three rows
 * of "one third" can never be exact. A ±₱1 window absorbs the rounding that
 * `pctOfTotalPhp` does at the centavo, and nothing else: a plan that is ₱100
 * short is a plan the couple mistyped, and telling them so is the entire point
 * of "until the payment is fully paid".
 */
export const PLAN_TOTAL_TOLERANCE_PHP = 1;

export const PLAN_EMPTY = 'Add at least one payment.';
export const PLAN_TOO_MANY = `A plan can have at most ${MAX_SCHEDULE_ITEMS} payments.`;
export const PLAN_NEEDS_TOTAL =
  'Set the price first — a payment plan has to add up to something.';
export const PLAN_LABEL_REQUIRED = 'Give every payment a name, like "Downpayment".';
export const PLAN_AMOUNT_REQUIRED = 'Every payment needs an amount above zero.';
export const PLAN_ANCHOR_REQUIRED =
  'Every payment needs a due date — that is what "until fully paid" means.';

export function planShortfallMessage(scheduledPhp: number, totalPhp: number): string {
  const diff = Math.round(totalPhp - scheduledPhp);
  const peso = (n: number) => `₱${Math.abs(n).toLocaleString('en-PH')}`;
  return diff > 0
    ? `Your payments add up to ${peso(scheduledPhp)} of ${peso(totalPhp)} — ${peso(diff)} is unaccounted for.`
    : `Your payments add up to ${peso(scheduledPhp)}, which is ${peso(diff)} more than the ${peso(totalPhp)} price.`;
}

/** A synthetic schedule row. Only the fields `computePlanInstances` reads. */
function toScheduleRow(r: CouplePlanRowInput, seq: number): PaymentScheduleItemRow {
  const n = Number(r.value);
  return {
    // 🔑 SYNTHETIC IDS, NEVER PERSISTED. `computePlanInstances` takes the
    // vendor-side ROW type, and these three keys are part of that shape
    // without being read by it. The couple has no vendor_service and no
    // vendor_profile, which is exactly why this plan is computed rather than
    // snapshotted from a template — nothing here is written to
    // vendor_service_payment_schedules.
    schedule_item_id: `couple-${seq}`,
    vendor_service_id: '',
    vendor_profile_id: '',
    seq,
    label: r.label.trim().slice(0, PLAN_LABEL_MAX),
    amount_kind: r.amount_kind,
    percent_bps: r.amount_kind === 'percent' ? pctToBps(n) : null,
    amount_centavos: r.amount_kind === 'fixed' ? phpToCentavos(n) : null,
    due_anchor: r.due_anchor === '' ? null : r.due_anchor,
    due_offset_days: r.due_offset_days.trim() === '' ? 0 : Math.trunc(Number(r.due_offset_days)),
    created_at: '',
    updated_at: '',
    cancellation_terms: null,
    downpayment_non_refundable: false,
    refund_window_days: null,
    no_show_forfeit: false,
  };
}

/**
 * Validate the couple's rows and resolve them into `instances_json`.
 *
 * ⚠ THE SUM CHECK IS THE POINT, NOT A NICETY. "Until the payment is fully
 * paid" is only meaningful if the plan covers the price: a plan short by
 * ₱20,000 would show the couple a final instalment, let them pay it, and call
 * the booking settled while a fifth of it was never scheduled. The message
 * names both figures so the couple can see which one is wrong.
 */
export function buildCouplePaymentPlan(opts: {
  rows: readonly CouplePlanRowInput[];
  /** The agreed total NOW — resolved by the caller, never a raw column. */
  totalPhp: number | null;
  /** ISO date the booking locked, or the day it was added. Anchors `on_lock`. */
  lockDateIso: string;
  /** ISO event date, or null. Anchors `before_event`. */
  eventDateIso: string | null;
}): CouplePlanResult {
  const rows = opts.rows.filter(
    (r) => r.label.trim().length > 0 || r.value.trim().length > 0,
  );
  if (rows.length === 0) return { ok: false, message: PLAN_EMPTY };
  if (rows.length > MAX_SCHEDULE_ITEMS) return { ok: false, message: PLAN_TOO_MANY };
  if (opts.totalPhp == null || !(opts.totalPhp > 0)) {
    return { ok: false, message: PLAN_NEEDS_TOTAL };
  }

  for (const r of rows) {
    if (r.label.trim().length === 0) return { ok: false, message: PLAN_LABEL_REQUIRED };
    const n = Number(r.value);
    if (!Number.isFinite(n) || n <= 0) return { ok: false, message: PLAN_AMOUNT_REQUIRED };
    if (r.amount_kind === 'percent' && n > 100) {
      return { ok: false, message: 'A percentage cannot be more than 100.' };
    }
    // Every row needs an anchor. A null anchor resolves to a null due_date,
    // which is precisely the untracked plan the owner asked us not to build.
    if (r.due_anchor === '') return { ok: false, message: PLAN_ANCHOR_REQUIRED };
    const days = r.due_offset_days.trim();
    if (days !== '' && (!Number.isFinite(Number(days)) || Number(days) < 0)) {
      return { ok: false, message: 'Days must be zero or more.' };
    }
  }

  const instances = computePlanInstances({
    scheduleRows: rows.map(toScheduleRow),
    totalCostPhp: opts.totalPhp,
    lockDateIso: opts.lockDateIso,
    eventDateIso: opts.eventDateIso,
  });

  // A `before_event` row cannot resolve without an event date. Letting it
  // through would store a due_date of null — a payment with no day, in a plan
  // whose whole purpose is days.
  const undated = instances.find((i) => i.due_date == null);
  if (undated) {
    return {
      ok: false,
      message: `"${undated.label}" is set before the event, but your event date isn't fixed yet. Anchor it after the booking instead, or set your date first.`,
    };
  }

  const scheduled = instances.reduce((sum, i) => sum + (i.amount_php ?? 0), 0);
  if (Math.abs(scheduled - opts.totalPhp) > PLAN_TOTAL_TOLERANCE_PHP) {
    return { ok: false, message: planShortfallMessage(scheduled, opts.totalPhp) };
  }

  return { ok: true, instances };
}
