/**
 * Vendor service PAYMENT SCHEDULES — shared types + helpers.
 *
 * Vendor Transaction Lifecycle · Phase 2 · PR-A. A vendor defines, at
 * service-create (stage 0), HOW a couple pays: a downpayment (seq 0) plus
 * payment 1…X (seq 1..N). Each installment carries an amount (a % of the total
 * via `percent_bps` OR a fixed PHP figure via `amount_centavos`) and an optional
 * anchored due date (`due_anchor` + `due_offset_days`).
 *
 * The schedule is a reusable TEMPLATE on the vendor_services row. It is OPTIONAL
 * — a service may carry zero installments. The vendor editor persists rows as a
 * replace-all set per service; couples read them for display (the workspace
 * render lands in PR-B).
 *
 * Pure types + helpers live here so every surface shares one implementation and
 * client components can import them without dragging server-only code into the
 * client bundle. The couple-facing fetch lives in the server-only companion
 * ./vendor-service-payment-schedules.server.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type AmountKind = 'percent' | 'fixed';
export type DueAnchor = 'on_lock' | 'before_event';

export type PaymentScheduleItemRow = {
  schedule_item_id: string;
  vendor_service_id: string;
  vendor_profile_id: string;
  seq: number;
  label: string;
  amount_kind: AmountKind;
  percent_bps: number | null;
  amount_centavos: number | null;
  due_anchor: DueAnchor | null;
  due_offset_days: number | null;
  created_at: string;
  updated_at: string;
  // No-Show Downpayment Protection — reservation policy on the downpayment
  // (seq 0) row only. Null/false on every non-downpayment installment.
  cancellation_terms: string | null;
  downpayment_non_refundable: boolean;
  refund_window_days: number | null;
  no_show_forfeit: boolean;
};

// ===========================================================================
// No-Show Downpayment Protection — reservation policy on the downpayment row.
//
// The vendor's no-show / cancellation terms attach to the seq-0 downpayment
// installment. The couple must ACKNOWLEDGE them before a lock commits (when
// the downpayment is non-refundable OR carries a no-show forfeit); the policy
// text is then FROZEN into event_vendor_policy_acknowledgements at lock so a
// later template edit can't rewrite forfeit-dispute history. No money moves.
// ===========================================================================

/** The reservation policy fields as carried on the seq-0 downpayment row. */
export type DownpaymentPolicy = {
  cancellation_terms: string | null;
  downpayment_non_refundable: boolean;
  refund_window_days: number | null;
  no_show_forfeit: boolean;
};

/**
 * The immutable policy snapshot stored in
 * event_vendor_policy_acknowledgements.policy_snapshot_json at lock. Captures
 * the downpayment's policy fields + its human label + the resolved amount, so
 * an admin can adjudicate a forfeit from this row alone.
 */
export type PolicySnapshot = DownpaymentPolicy & {
  /** The downpayment installment's label at lock-time (e.g. "Downpayment"). */
  downpayment_label: string | null;
  /** The resolved downpayment amount (PHP) at lock, when computable. */
  downpayment_amount_php: number | null;
};

/**
 * Whether a reservation policy is "protected" — i.e. it carries terms a couple
 * must explicitly acknowledge before locking (non-refundable downpayment OR a
 * no-show forfeit). A plain refund-window-only disclosure is NOT a gate.
 */
export function isProtectedPolicy(p: DownpaymentPolicy | null | undefined): boolean {
  if (!p) return false;
  return Boolean(p.downpayment_non_refundable) || Boolean(p.no_show_forfeit);
}

/**
 * Pull the reservation policy off a service's schedule rows. The policy lives
 * on the seq-0 (downpayment) row only; returns null when there's no downpayment
 * row or it carries no terms at all. A refund-window-only policy is still
 * returned so the disclosure can render, but isProtectedPolicy gates the
 * acknowledgement.
 */
export function downpaymentPolicyFromRows(
  rows: Pick<
    PaymentScheduleItemRow,
    'seq' | 'cancellation_terms' | 'downpayment_non_refundable' | 'refund_window_days' | 'no_show_forfeit'
  >[],
): DownpaymentPolicy | null {
  const dp = rows.find((r) => r.seq === 0);
  if (!dp) return null;
  const policy: DownpaymentPolicy = {
    cancellation_terms: dp.cancellation_terms ?? null,
    downpayment_non_refundable: Boolean(dp.downpayment_non_refundable),
    refund_window_days: dp.refund_window_days ?? null,
    no_show_forfeit: Boolean(dp.no_show_forfeit),
  };
  const hasAny =
    policy.cancellation_terms != null ||
    policy.downpayment_non_refundable ||
    policy.refund_window_days != null ||
    policy.no_show_forfeit;
  return hasAny ? policy : null;
}

/** Hard ceiling on installments per service — keeps the card/editor tidy. */
export const MAX_SCHEDULE_ITEMS = 12;

export const DUE_ANCHOR_LABELS: Record<DueAnchor, string> = {
  on_lock: 'after booking is locked',
  before_event: 'before the event',
};

/**
 * One installment as the editor/action work with it before it becomes a DB row
 * (no ids, percent as a whole number, fixed as whole pesos — the human units).
 */
export type ScheduleItemDraft = {
  seq: number;
  label: string;
  amount_kind: AmountKind;
  /** Whole-number percent (0–100) when amount_kind = 'percent', else null. */
  percent: number | null;
  /** Whole pesos when amount_kind = 'fixed', else null. */
  amount_php: number | null;
  due_anchor: DueAnchor | null;
  /** Days relative to the anchor; null when no anchor. */
  due_offset_days: number | null;
  // No-Show Downpayment Protection — only meaningful on the downpayment (seq 0)
  // row; the editor renders these fields on that row alone.
  cancellation_terms: string | null;
  downpayment_non_refundable: boolean;
  refund_window_days: number | null;
  no_show_forfeit: boolean;
};

/** Display-shaped installment for couple-facing surfaces (PR-B renders it). */
export type CoupleFacingScheduleItem = {
  schedule_item_id: string;
  seq: number;
  label: string;
  amount_kind: AmountKind;
  /** Whole-number percent (0–100) for percent installments, else null. */
  percent: number | null;
  /** Whole pesos for fixed installments, else null. */
  amount_php: number | null;
  due_anchor: DueAnchor | null;
  due_offset_days: number | null;
};

/** percent (whole 0–100) → basis points (0–10000). */
export function pctToBps(pct: number): number {
  return Math.round(pct * 100);
}

/** basis points (0–10000) → percent (whole 0–100). */
export function bpsToPct(bps: number): number {
  return Math.round(bps / 100);
}

/** whole pesos → centavos. */
export function phpToCentavos(php: number): number {
  return Math.round(php * 100);
}

/** centavos → whole pesos. */
export function centavosToPhp(centavos: number): number {
  return Math.round(centavos / 100);
}

// ===========================================================================
// Per-booking PLAN SNAPSHOT (Phase 2 PR-B).
//
// At lock, finalizeVendor freezes the booked service's SCHEDULE TEMPLATE into a
// CONCRETE plan against the booking's real total + dates. These pure helpers do
// the resolution (no I/O) so the action stays thin + the math is testable.
// ===========================================================================

/** One frozen installment stored in event_vendor_payment_plan.instances_json. */
export type PlanInstance = {
  seq: number;
  label: string;
  /**
   * Resolved peso amount, or null when it can't be computed yet (a percent
   * installment with no booking total). When null we retain percent_bps +
   * amount_kind below so a later read can resolve it once the total exists.
   */
  amount_php: number | null;
  /**
   * Resolved ISO date (YYYY-MM-DD), or null when the anchor can't resolve yet
   * (e.g. before_event with no/tentative event_date, or no anchor at all).
   */
  due_date: string | null;
  /** Retained from the template so a null amount can resolve later. */
  amount_kind: AmountKind;
  percent_bps: number | null;
};

/** Add `days` to an ISO date (YYYY-MM-DD) in UTC; returns ISO date. */
function shiftIsoDate(isoDate: string, days: number): string | null {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve a service's schedule template rows into a concrete per-booking plan.
 *
 *   amount: percent → totalCostPhp * percent_bps / 10000 (rounded to peso);
 *           fixed   → amount_centavos / 100.
 *           If totalCostPhp is null, percent rows snapshot amount_php:null and
 *           retain percent_bps/amount_kind so they resolve later. Fixed rows
 *           always resolve (the figure is absolute).
 *   due_date: on_lock      → lockDateIso + due_offset_days
 *             before_event  → eventDateIso - due_offset_days
 *             (no anchor / no eventDateIso when before_event) → null.
 *
 * Pure + total — never throws on missing inputs (lock must not crash).
 */
export function computePlanInstances(opts: {
  scheduleRows: PaymentScheduleItemRow[];
  totalCostPhp: number | null;
  /** ISO date the booking locked (YYYY-MM-DD) — anchors on_lock installments. */
  lockDateIso: string;
  /** ISO event date (YYYY-MM-DD) or null — anchors before_event installments. */
  eventDateIso: string | null;
}): PlanInstance[] {
  const { scheduleRows, totalCostPhp, lockDateIso, eventDateIso } = opts;
  return [...scheduleRows]
    .sort((a, b) => a.seq - b.seq)
    .map((row): PlanInstance => {
      // amount
      let amountPhp: number | null = null;
      if (row.amount_kind === 'fixed' && row.amount_centavos != null) {
        amountPhp = Math.round(row.amount_centavos / 100);
      } else if (row.amount_kind === 'percent' && row.percent_bps != null) {
        amountPhp =
          totalCostPhp != null
            ? Math.round((totalCostPhp * row.percent_bps) / 10000)
            : null;
      }

      // due date
      let dueDate: string | null = null;
      const offset = row.due_offset_days ?? 0;
      if (row.due_anchor === 'on_lock') {
        dueDate = shiftIsoDate(lockDateIso, offset);
      } else if (row.due_anchor === 'before_event' && eventDateIso) {
        dueDate = shiftIsoDate(eventDateIso, -offset);
      }

      return {
        seq: row.seq,
        label: row.label,
        amount_php: amountPhp,
        due_date: dueDate,
        amount_kind: row.amount_kind,
        percent_bps: row.percent_bps,
      };
    });
}

// ===========================================================================
// Per-installment PROGRESS STEPPER (Phase 2 PR-D).
//
// The frozen plan (instances_json) describes WHAT is owed; the couple's logged
// payments (event_vendor_payments, joined by schedule_instance_seq) describe
// WHAT has moved. These pure helpers fold the two into a per-installment state
// the couple + vendor steppers render. No I/O — the server fetchers below shape
// the inputs.
//
//   • 'due'     — no payment logged against this installment seq yet.
//   • 'pending' — a payment is logged but the vendor hasn't confirmed it.
//   • 'paid'    — a payment for this seq is vendor-confirmed.
// Plus the plan-level `cleared_at` = the whole booking is settled.
// ===========================================================================

/** One installment's settlement state for the stepper. */
export type InstallmentState = 'due' | 'pending' | 'paid';

/** A plan installment enriched with its current settlement state. */
export type StepperInstallment = PlanInstance & { state: InstallmentState };

/**
 * The minimal payment shape the stepper needs: which installment a payment is
 * attributed to (seq) + whether the vendor has confirmed it.
 */
export type PaymentSeqState = {
  schedule_instance_seq: number | null;
  vendor_confirmed: boolean;
};

/**
 * Fold a plan + its payments into per-installment states.
 *
 * For each plan installment (by seq): 'paid' if ANY payment with that seq is
 * vendor-confirmed, else 'pending' if ANY payment with that seq is logged
 * (unconfirmed), else 'due'. Pure + total.
 */
export function computeStepper(
  instances: PlanInstance[],
  payments: PaymentSeqState[],
): StepperInstallment[] {
  const confirmedSeqs = new Set<number>();
  const loggedSeqs = new Set<number>();
  for (const p of payments) {
    if (p.schedule_instance_seq == null) continue;
    loggedSeqs.add(p.schedule_instance_seq);
    if (p.vendor_confirmed) confirmedSeqs.add(p.schedule_instance_seq);
  }
  return [...instances]
    .sort((a, b) => a.seq - b.seq)
    .map((inst): StepperInstallment => ({
      ...inst,
      state: confirmedSeqs.has(inst.seq)
        ? 'paid'
        : loggedSeqs.has(inst.seq)
          ? 'pending'
          : 'due',
    }));
}

/**
 * A glance-level money roll-up for one booking's installment plan — the
 * vendor-side mirror of the couple's BudgetLiveSummary, but derived purely from
 * the stepper steps already loaded (no extra query, no couple-RLS access). Used
 * to crown the per-booking plan card on the vendor thread with "received of
 * total · %" + the next installment owed.
 */
export type PlanRollup = {
  /** Σ of every installment's resolved amount (PHP). Null amounts count as 0. */
  total: number;
  /** Σ of vendor-confirmed installments (state 'paid'). */
  received: number;
  /** Σ of logged-but-unconfirmed installments (state 'pending'). */
  pending: number;
  /** Whole-number percent received (0–100); 0 when total is 0. */
  percentReceived: number;
  /** Earliest not-yet-paid installment (due or pending), or null if all paid. */
  next: { label: string; amountPhp: number; dueDate: string | null } | null;
};

/**
 * Collapse a booking's stepper into its PlanRollup. Pure. `next` is the
 * earliest non-paid installment by due_date (dated first, then by seq), so the
 * vendor sees what's owed next at a glance. Amounts that haven't resolved yet
 * (percent installments before the total exists) count as 0 toward the totals.
 */
export function computePlanRollup(steps: StepperInstallment[]): PlanRollup {
  let total = 0;
  let received = 0;
  let pending = 0;
  for (const s of steps) {
    const amt = Number(s.amount_php) || 0;
    total += amt;
    if (s.state === 'paid') received += amt;
    else if (s.state === 'pending') pending += amt;
  }
  const percentReceived =
    total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;

  const open = steps
    .filter((s) => s.state !== 'paid')
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return a.seq - b.seq;
    });
  const n = open[0];
  const next = n
    ? { label: n.label, amountPhp: Number(n.amount_php) || 0, dueDate: n.due_date ?? null }
    : null;

  return { total, received, pending, percentReceived, next };
}

/**
 * Whether the vendor may mark the whole plan cleared: every installment must be
 * 'paid' (vendor-confirmed). An empty plan (no formal schedule) is vacuously
 * clearable at the vendor's discretion — mirrors the DB guard's gate exactly.
 */
export function canClearPlan(steps: StepperInstallment[]): boolean {
  if (steps.length === 0) return true;
  return steps.every((s) => s.state === 'paid');
}

/** The full per-booking plan progress: installments + states + cleared flag. */
export type PlanProgress = {
  /** null = no frozen plan (not locked / pre-PR-B). */
  steps: StepperInstallment[] | null;
  /** Set when the whole plan has been marked cleared by the vendor. */
  clearedAt: string | null;
};

/** Map a stored row to the human-unit draft shape the editor renders. */
export function rowToDraft(row: PaymentScheduleItemRow): ScheduleItemDraft {
  return {
    seq: row.seq,
    label: row.label,
    amount_kind: row.amount_kind,
    percent: row.percent_bps != null ? bpsToPct(row.percent_bps) : null,
    amount_php: row.amount_centavos != null ? centavosToPhp(row.amount_centavos) : null,
    due_anchor: row.due_anchor,
    due_offset_days: row.due_offset_days,
    cancellation_terms: row.cancellation_terms ?? null,
    downpayment_non_refundable: Boolean(row.downpayment_non_refundable),
    refund_window_days: row.refund_window_days ?? null,
    no_show_forfeit: Boolean(row.no_show_forfeit),
  };
}

/** Map a stored row to the couple-facing display shape. */
export function rowToCoupleFacing(row: PaymentScheduleItemRow): CoupleFacingScheduleItem {
  return {
    schedule_item_id: row.schedule_item_id,
    seq: row.seq,
    label: row.label,
    amount_kind: row.amount_kind,
    percent: row.percent_bps != null ? bpsToPct(row.percent_bps) : null,
    amount_php: row.amount_centavos != null ? centavosToPhp(row.amount_centavos) : null,
    due_anchor: row.due_anchor,
    due_offset_days: row.due_offset_days,
  };
}

/**
 * A vendor's own schedule for a service (all installments, seq-ordered). Call
 * with the vendor's RLS client — owner RLS scopes it to their own services.
 */
export async function fetchOwnSchedule(
  client: SupabaseClient,
  vendorServiceId: string,
): Promise<PaymentScheduleItemRow[]> {
  const { data, error } = await client
    .from('vendor_service_payment_schedules')
    .select('*')
    .eq('vendor_service_id', vendorServiceId)
    .order('seq', { ascending: true });
  if (error || !data) return [];
  return data as PaymentScheduleItemRow[];
}

/**
 * Every schedule row for a set of the vendor's own services, grouped by
 * vendor_service_id (seq-ordered within each). One round-trip for the whole
 * service list on the vendor editor page.
 */
export async function fetchOwnSchedulesByService(
  client: SupabaseClient,
  vendorServiceIds: string[],
): Promise<Map<string, PaymentScheduleItemRow[]>> {
  const out = new Map<string, PaymentScheduleItemRow[]>();
  if (vendorServiceIds.length === 0) return out;
  const { data, error } = await client
    .from('vendor_service_payment_schedules')
    .select('*')
    .in('vendor_service_id', vendorServiceIds)
    .order('seq', { ascending: true });
  if (error || !data) return out;
  for (const row of data as PaymentScheduleItemRow[]) {
    const list = out.get(row.vendor_service_id) ?? [];
    list.push(row);
    out.set(row.vendor_service_id, list);
  }
  return out;
}
