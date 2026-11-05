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
  defaultPaymentScheduleRows,
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
  /**
   * The instalment's stored `seq`, when the row was opened from a saved plan (2026-10-29). A payment is attached to
   * its instalment BY `seq` (`event_vendor_payments.schedule_instance_seq`), so a row keeps its own: removing or
   * adding a payment above a paid one must not hand that payment to a different instalment. Absent / duplicate → the
   * row is numbered after the highest kept one, exactly as before for a plan typed fresh.
   */
  seq?: number | null;
};

/**
 * Give every row a `seq`: a row's own (a whole number, not already taken) is kept, the rest are numbered after the
 * highest kept one in the order they came. A plan with no seqs at all is numbered 0, 1, 2… — what it always was.
 */
export function assignPlanSeqs<T extends { seq?: number | null }>(rows: readonly T[]): Array<T & { seq: number }> {
  const taken = new Set<number>();
  const kept = rows.map((r) => {
    const s = r.seq;
    if (typeof s === 'number' && Number.isInteger(s) && s >= 0 && !taken.has(s)) {
      taken.add(s);
      return s;
    }
    return null;
  });
  let next = taken.size > 0 ? Math.max(...taken) + 1 : 0;
  return rows.map((r, i) => ({ ...r, seq: kept[i] ?? next++ }));
}

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
export const PLAN_LABEL_REQUIRED = 'Give every payment a name, like "First payment".';
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

/**
 * THE AMOUNT A COUPLE TYPED, AS A NUMBER — the one reading, shared by the
 * sheet's running total and the server's check. (2026-10-29)
 *
 * 🔴 THE BUG THIS CLOSES. The owner, on a ₱395,000 stylist: *"i tried fixing
 * the payment plans there but did not save properly"*. A peso amount is typed
 * the way pesos are written — "100,000", "₱295,000" — and `Number("100,000")`
 * is NaN. So the server refused the whole plan with "Every payment needs an
 * amount above zero" (about a row that plainly had one), and the running total
 * quietly skipped the row, so even the preview disagreed with the screen.
 *
 * Only the marks money is WRITTEN with are dropped — thousands commas, the peso
 * sign, a percent sign, spaces. Anything else ("1o0", "100k") still reads as
 * NaN and is still refused: guessing at a typo is how a plan ends up saying an
 * amount nobody typed. Blank is NaN too (never a silent 0).
 */
export function planAmountNumber(raw: string): number {
  const t = String(raw ?? '').replace(/[,\s₱%]/g, '').replace(/^PHP/i, '');
  if (t.length === 0) return NaN;
  return Number(t);
}

/**
 * What the sheet's running total shows — the SAME reading the server checks.
 * A percent row with no price adds nothing (the footer says "Set a price
 * first"); a row that does not read as an amount adds nothing either, and the
 * server then names it.
 */
export function planPreviewTotal(
  rows: ReadonlyArray<{ kind: 'percent' | 'fixed'; value: string }>,
  totalPhp: number | null,
): number {
  let sum = 0;
  for (const r of rows) {
    const n = planAmountNumber(r.value);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (r.kind === 'fixed') sum += n;
    else if (totalPhp != null) sum += (totalPhp * n) / 100;
  }
  return sum;
}

/** A synthetic schedule row. Only the fields `computePlanInstances` reads. */
function toScheduleRow(r: CouplePlanRowInput, seq: number): PaymentScheduleItemRow {
  // `seq` is the row's own (`assignPlanSeqs`), so it is what `computePlanInstances` sorts and stores by.
  const n = planAmountNumber(r.value);
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
  // Each row keeps its own seq (`assignPlanSeqs`), and the plan is ordered by it — `computePlanInstances` sorts by
  // seq, so ordering the rows the same way keeps "position i of the instances is row i" true below.
  const rows = assignPlanSeqs(
    opts.rows.filter((r) => r.label.trim().length > 0 || r.value.trim().length > 0),
  ).sort((a, b) => a.seq - b.seq);
  if (rows.length === 0) return { ok: false, message: PLAN_EMPTY };
  if (rows.length > MAX_SCHEDULE_ITEMS) return { ok: false, message: PLAN_TOO_MANY };
  if (opts.totalPhp == null || !(opts.totalPhp > 0)) {
    return { ok: false, message: PLAN_NEEDS_TOTAL };
  }

  for (const r of rows) {
    if (r.label.trim().length === 0) return { ok: false, message: PLAN_LABEL_REQUIRED };
    const n = planAmountNumber(r.value);
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
    scheduleRows: rows.map((r) => toScheduleRow(r, r.seq)),
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
      message: `"${undated.label}" is set before the event, but your event date isn't fixed yet. Set it for after you book instead, or set your date first.`,
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

export function planInstancesToRows(
  instances: unknown,
  opts: {
    /**
     * The plan row's `is_default_seeded` — Setnayan's own 50/50 ESTIMATE,
     * seeded by the lock (`freezePaymentPlanAtBooking`) for a priced supplier
     * with no plan. Its rule is not unknown: it is `defaultPaymentScheduleRows`.
     */
    defaultSeeded?: boolean;
  } = {},
): EditablePlanRow[] {
  if (!Array.isArray(instances)) return [];
  const seeded = opts.defaultSeeded === true ? defaultPaymentScheduleRows() : null;
  return instances.flatMap((raw): EditablePlanRow[] => {
    if (!raw || typeof raw !== 'object') return [];
    const i = raw as Partial<CouplePlanInstance>;
    const label = typeof i.label === 'string' ? i.label : '';
    const a = i.authored;
    if (a && (a.due_anchor === 'on_lock' || a.due_anchor === 'before_event')) {
      return [{ label, kind: a.amount_kind === 'fixed' ? 'fixed' : 'percent', value: String(a.value ?? ''), anchor: a.due_anchor, days: String(a.due_offset_days ?? '0') }];
    }
    // 🔴 THE LOCK'S ESTIMATE CAME BACK WITH NO DUE DATES (2026-10-29). Locking a
    // priced supplier the couple added seeds a 50/50 estimate with no `authored`
    // rule, so the record sheet re-opened it as two blank-dated rows — and from
    // then on EVERY save of the sheet, even a new phone number, was refused
    // "Every payment needs a due date" for a plan the couple never touched. The
    // estimate's rule is known exactly (it is the default schedule), so it comes
    // back as that rule, matched by its `seq`.
    const rule = seeded?.find((d) => d.seq === i.seq) ?? null;
    if (rule && rule.due_anchor) {
      return [{ label, kind: 'percent', value: String((rule.percent_bps ?? 0) / 100), anchor: rule.due_anchor, days: String(rule.due_offset_days ?? 0) }];
    }
    // A legacy PERCENT instance keeps its percent (it carries `percent_bps`), so
    // the share still follows the price; its day is the one thing unknown.
    if (i.amount_kind === 'percent' && typeof i.percent_bps === 'number' && i.percent_bps > 0) {
      return [{ label, kind: 'percent', value: String(i.percent_bps / 100), anchor: '', days: '0' }];
    }
    const amt = typeof i.amount_php === 'number' ? i.amount_php : null;
    return [{ label, kind: 'fixed' as const, value: amt == null ? '' : String(amt), anchor: '' as const, days: '0' }];
  });
}

/**
 * The stored `seq` of each row `planInstancesToRows` returns, in the same order (one per instance it keeps) — so the
 * record card can post each row's own seq back and a payment stays on its instalment.
 */
export function planInstanceSeqs(instances: unknown): Array<number | null> {
  if (!Array.isArray(instances)) return [];
  return instances.flatMap((raw): Array<number | null> => {
    if (!raw || typeof raw !== 'object') return [];
    const s = (raw as { seq?: unknown }).seq;
    return [typeof s === 'number' && Number.isInteger(s) && s >= 0 ? s : null];
  });
}

/**
 * The row the couple's own save writes into `event_vendor_payment_plan`.
 *
 * 🔴 `is_default_seeded: false` IS THE FIX, NOT A DEFAULT (2026-10-29). Lock a
 * priced supplier the couple added and `freezePaymentPlanAtBooking` seeds a
 * 50/50 ESTIMATE flagged `is_default_seeded = true`. The couple's save used to
 * upsert only `instances_json`, so the flag SURVIVED their plan — and the flag
 * is what two readers act on:
 *   · `lockMayOverwritePlan` lets a re-lock replace a default-seeded plan, so
 *     the plan they typed was thrown away for another generic 50/50;
 *   · the Booked row skips a default-seeded plan's instalments as "estimated",
 *     so their real next payment was never shown as due.
 * A plan the couple typed is theirs; it says so on the row.
 */
export function couplePlanUpsert(args: {
  eventId: string;
  vendorId: string;
  instances: readonly CouplePlanInstance[];
  nowIso: string;
}): {
  event_id: string;
  event_vendor_id: string;
  instances_json: readonly CouplePlanInstance[];
  is_default_seeded: false;
  updated_at: string;
} {
  return {
    event_id: args.eventId,
    event_vendor_id: args.vendorId,
    instances_json: args.instances,
    is_default_seeded: false,
    updated_at: args.nowIso,
  };
}

/**
 * WHAT A SAVE DOES WITH THE PLAN ROWS THE SHEET POSTED. (2026-10-29)
 *
 * Owner: *"the payment scheme there should properly update and save"* — which
 * includes taking payments OFF, down to none.
 *
 *  · 'save'  — some row has a name or an amount: build it and write it, or
 *              refuse it and say why.
 *  · 'clear' — the plan editor was on the sheet (`plan_present`) and every
 *              payment was removed or left blank: the couple's plan is now NO
 *              payments, and that is written (`instances_json = []`).
 *  · 'skip'  — the sheet carried no plan editor at all: nothing was asked.
 *
 * 🔴 THE BUG THIS CLOSES. Emptying the plan used to post no `plan_label`, the
 * save read that as "nothing asked", and the OLD plan stayed — the sheet closed
 * as saved and the next open showed every payment the couple had just removed.
 * "Has rows?" could not tell an untouched form from an emptied one; the
 * editor's own presence can.
 *
 * A row counts when it has a name OR an amount — the same filter
 * `buildCouplePaymentPlan` applies — so an amount with no name is refused for
 * its missing name, never mistaken for an empty plan and cleared.
 */
export type PlanSaveStep = 'save' | 'clear' | 'skip';

export const PLAN_PRESENT_FIELD = 'plan_present';

export function planSaveStep(args: {
  /** Did the form carry the plan editor (`plan_present=1`)? */
  editorPresent: boolean;
  postedLabels: readonly unknown[];
  postedValues: readonly unknown[];
}): PlanSaveStep {
  const filled = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  if (args.postedLabels.some(filled) || args.postedValues.some(filled)) return 'save';
  return args.editorPresent ? 'clear' : 'skip';
}

/**
 * The one sentence the record sheet shows when part of a save did not land.
 *
 * 🔑 THE REASON IS ITS OWN SENTENCE. This was `Saved — except ${parts}.`, with a
 * plan's refusal dropped in as a "part" — so a couple read "Saved — except Your
 * payments add up to ₱100,000 of ₱395,000 — ₱295,000 is unaccounted for.." and
 * had to work out which field it meant. Now: what did not save, then why.
 */
export function partialSaveSentence(
  parts: ReadonlyArray<{ what: string; why?: string | null }>,
): string | null {
  if (parts.length === 0) return null;
  const whats = parts.map((p) => p.what);
  const list = whats.length <= 1 ? whats.join('') : `${whats.slice(0, -1).join(', ')} and ${whats[whats.length - 1]}`;
  const whys = parts
    .map((p) => (p.why ?? '').trim())
    .filter((w) => w.length > 0)
    .map((w) => (/[.!?]$/.test(w) ? w : `${w}.`));
  return [`Saved — except ${list}.`, ...whys].join(' ');
}

/**
 * The price the record sheet starts from, as the whole-peso digits its amount
 * field holds. `String(Number('80000.50'))` is "80000.5", and stripping every
 * non-digit from THAT glued the centavos on — ₱800,005, a hundred times the
 * price, written back by the next save. The field takes whole pesos, so it
 * starts from the whole pesos.
 */
export function priceDigitsForSheet(price: string | null | undefined): string {
  const t = String(price ?? '').replace(/,/g, '').trim();
  if (t.length === 0) return '';
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return t.replace(/[^\d]/g, '');
  return String(Math.trunc(n));
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
 * couple's (`saveSelfAddedPaymentPlan`, which writes `is_default_seeded: false`
 * through `couplePlanUpsert` — so its plan stays protected here even when it
 * was typed over the lock's own estimate). The
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
