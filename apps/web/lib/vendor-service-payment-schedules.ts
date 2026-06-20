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
};

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
