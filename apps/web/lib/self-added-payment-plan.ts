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

import { formatPhp } from '@/lib/php';
import {
  MAX_SCHEDULE_ITEMS,
  computePlanInstances,
  pctToBps,
  phpToCentavos,
  type DueAnchor,
  type PaymentScheduleItemRow,
  type PlanInstance,
  shiftIsoDate,
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

/**
 * A resolved instalment PLUS the rule the couple typed to produce it.
 *
 * 🔑 WHY `authored` EXISTS (2026-09-21). `instances_json` stores RESOLVED dates
 * — `due_date: '2026-12-11'` — which is what the Payments surface needs. But
 * "7 days before the event" cannot be recovered from 2026-12-11, so the
 * Details sheet had nothing to pre-fill its plan rows with: re-opening a
 * supplier would have shown the couple an empty plan and invited them to
 * retype one they had already agreed. The rule rides along in the same JSONB
 * row; every existing reader ignores fields it does not know.
 *
 * It also answers the question flagged when the lock fix shipped: with the
 * anchors kept, a plan CAN be re-resolved against a later lock date. Whether
 * it SHOULD be is still the owner's call — this only stops the data being lost.
 */
export type AuthoredPlanRule = {
  amount_kind: 'percent' | 'fixed';
  value: string;
  due_anchor: DueAnchor;
  due_offset_days: string;
};
export type CouplePlanInstance = PlanInstance & { authored: AuthoredPlanRule };

export type CouplePlanResult =
  | { ok: true; instances: CouplePlanInstance[] }
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

/**
 * The sentence a couple reads when their plan does not add up.
 *
 * 🔑 EXACT TO THE CENTAVO, through the shared `formatPhp`. This used to round
 * the shortfall to whole pesos with a local `toLocaleString`, so a plan short
 * by ₱0.50 would have been refused with "₱1 is unaccounted for" — a figure the
 * couple could not find anywhere in what they typed.
 */
export function planShortfallMessage(scheduledPhp: number, totalPhp: number): string {
  const diff = totalPhp - scheduledPhp;
  return diff > 0
    ? `Your payments add up to ${formatPhp(scheduledPhp)} of ${formatPhp(totalPhp)} — ${formatPhp(diff)} is unaccounted for.`
    : `Your payments add up to ${formatPhp(scheduledPhp)}, which is ${formatPhp(-diff)} more than the ${formatPhp(totalPhp)} price.`;
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
  /** The day the couple clicked Lock — or, before they have, today (see
   *  `onLockAnchorIso`). Anchors `on_lock`. */
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
      message: `"${undated.label}" is set before the event, but your event date isn't fixed yet. Set it for after you lock instead, or set your date first.`,
    };
  }

  const scheduled = instances.reduce((sum, i) => sum + (i.amount_php ?? 0), 0);
  if (Math.abs(scheduled - opts.totalPhp) > PLAN_TOTAL_TOLERANCE_PHP) {
    return { ok: false, message: planShortfallMessage(scheduled, opts.totalPhp) };
  }

  // Rows were filtered and validated above in the same order
  // `computePlanInstances` returns them (it sorts by seq, and seq IS the index),
  // so position i of `instances` is row i.
  const ordered = [...rows];
  return {
    ok: true,
    instances: instances.map((inst, i) => {
      const r = ordered[i]!;
      return {
        ...inst,
        authored: {
          amount_kind: r.amount_kind,
          value: r.value.trim(),
          due_anchor: r.due_anchor as DueAnchor,
          due_offset_days: r.due_offset_days.trim() === '' ? '0' : r.due_offset_days.trim(),
        },
      };
    }),
  };
}

/**
 * Read a stored plan back into the rows the sheet edits.
 *
 * Instances written before `authored` existed cannot be turned back into
 * rules — only a resolved date survives. They come back as FIXED peso amounts
 * with NO anchor, so the sheet shows the money correctly and asks for the one
 * thing it genuinely does not know. Guessing an anchor from a date would put a
 * rule in the couple's plan that they never chose.
 */
export type EditablePlanRow = {
  label: string;
  kind: 'percent' | 'fixed';
  value: string;
  anchor: '' | DueAnchor;
  days: string;
};

export function planInstancesToRows(instances: unknown): EditablePlanRow[] {
  if (!Array.isArray(instances)) return [];
  return instances.flatMap((raw): EditablePlanRow[] => {
    if (!raw || typeof raw !== 'object') return [];
    const i = raw as Partial<CouplePlanInstance>;
    const label = typeof i.label === 'string' ? i.label : '';
    const a = i.authored;
    if (a && (a.due_anchor === 'on_lock' || a.due_anchor === 'before_event')) {
      return [{ label, kind: a.amount_kind === 'fixed' ? 'fixed' : 'percent', value: String(a.value ?? ''), anchor: a.due_anchor, days: String(a.due_offset_days ?? '0') }];
    }
    const amt = typeof i.amount_php === 'number' ? i.amount_php : null;
    return [{ label, kind: 'fixed' as const, value: amt == null ? '' : String(amt), anchor: '' as const, days: '0' }];
  });
}

/**
 * MAY THE LOCK STEP OVERWRITE THIS BOOKING'S PAYMENT PLAN? (2026-09-21)
 *
 * 🔴 THE BUG THIS CLOSES — found by tracing the owner's question "is the
 * payment connected?", not by any test. `finalizeVendor` snapshots a plan into
 * `event_vendor_payment_plan` at EVERY lock, with an `upsert`. That was written
 * when only a marketplace supplier could have a plan (theirs, from their
 * service's schedule). Its own comment said so: "off-platform / manual vendors
 * have no vendor_services rows … we still create an empty plan for them."
 *
 * Since 2026-09-20 a couple CAN author a plan for a supplier they added. So:
 *   1. couple adds a venue — ₱80,000, "30% now, 70% two weeks before" — saved;
 *   2. couple taps Lock;
 *   3. the snapshot finds no service schedule, seeds a generic 50/50 ESTIMATE,
 *      and the upsert REPLACES the couple's plan with it.
 * Each half passed its own tests. Only the sequence was wrong.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 *  · ON-PLATFORM → yes. The supplier's own schedule is the truth, and a
 *    re-lock refreshing it is the existing, intended behaviour.
 *  · OFF-PLATFORM with no plan, or an empty one → yes. Nothing to lose.
 *  · OFF-PLATFORM whose plan is our own default-seeded estimate → yes; it was
 *    only ever a placeholder, and refreshing it is what the flag is for.
 *  · OFF-PLATFORM with a real, non-default plan → **NO.** That plan was typed
 *    by the couple, and a lock step with no schedule to read has nothing better
 *    to offer than a generic 50/50.
 *
 * ⚖ Why this can be told apart without a new column: the only writers of a
 * non-empty, NON-default-seeded plan on an off-platform booking are the
 * couple's (`saveSelfAddedPaymentPlan`, never sets `is_default_seeded`). The
 * lock snapshot on such a booking writes either `[]` or a default-seeded
 * estimate. If a third writer ever appears, this truth table is where it must
 * be added — `self-added-payment-plan.test.ts` executes it.
 */
export function lockMayOverwritePlan(args: {
  onPlatform: boolean;
  /** The existing plan's instances, or null when there is no plan row. */
  existingInstances: readonly unknown[] | null;
  existingIsDefaultSeeded: boolean;
}): boolean {
  if (args.onPlatform) return true;
  if (!args.existingInstances || args.existingInstances.length === 0) return true;
  if (args.existingIsDefaultSeeded) return true;
  return false;
}

/**
 * WHAT "N DAYS AFTER LOCK" COUNTS FROM. (owner 2026-09-21: "on the date you
 * clicked on lock")
 *
 * `anchorDate` is `event_vendor_payment_plan.on_lock_anchor_date`, stamped by
 * `finalizeVendor` the day the couple locks. Once it exists it is the only
 * answer — re-saving the plan months later must not slide every date forward.
 * Before the lock there is no such day yet, so the dates are shown as if the
 * couple locked today, and the lock re-dates them (`redateOnLockInstalments`).
 *
 * ⚠ It used to be the day the supplier was ADDED — which put "7 days after
 * lock" in the past for a supplier added in March and locked in June.
 */
export function onLockAnchorIso(anchorDate: string | null | undefined, todayIso: string): string {
  return typeof anchorDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(anchorDate)
    ? anchorDate.slice(0, 10)
    : todayIso;
}

/**
 * Re-date a couple's plan to the day they clicked Lock.
 *
 * Only the DATE of instalments the couple anchored "after lock" moves; amounts,
 * labels, seq and "before the event" rows are untouched. A legacy
 * instance with no stored rule (`authored`) is left exactly as it is — its
 * rule is unknown, and guessing one from a date would invent a term the couple
 * never set.
 */
export function redateOnLockInstalments(instances: unknown, lockDateIso: string): unknown[] {
  if (!Array.isArray(instances)) return [];
  return instances.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const i = raw as Partial<CouplePlanInstance>;
    if (i.authored?.due_anchor !== 'on_lock') return raw;
    const days = Number(i.authored.due_offset_days);
    const due = shiftIsoDate(lockDateIso, Number.isFinite(days) && days >= 0 ? days : 0);
    return due ? { ...i, due_date: due } : raw;
  });
}
