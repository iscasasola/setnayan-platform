/**
 * 💳 PAYMENT STRATEGIES — a shop's saved, named pay plans (DECISION_LOG 2026-11-17 "a supplier's own payment plan,
 * made once, used on every card"; table `vendor_pay_plans`, migration 20271350884376).
 *
 * The plan is the SOURCE a card's schedule is copied from. A card keeps its own rows in
 * `vendor_service_payment_schedules` (what a couple pays by); `vendor_services.pay_plan_id` says which plan it
 * follows. So this module only converts between the three shapes the rows take:
 *   • ParsedScheduleRow   — what `parsePaymentScheduleForm` reads off the card's form (centavos, basis points);
 *   • PayPlanItem         — the same row without `seq`, as stored in `vendor_pay_plans.items` (array order = seq);
 *   • ScheduleItemDraft   — what the editor shows (whole percent, whole pesos).
 * Pure — no I/O. The writes live in `commitVendorService`.
 */
import type { ParsedScheduleRow } from '@/lib/service-card-save-parts';
import {
  MAX_SCHEDULE_ITEMS,
  bpsToPct,
  type AmountKind,
  type DueAnchor,
  type ScheduleItemDraft,
} from '@/lib/vendor-service-payment-schedules';

export type PayPlanItem = Omit<ParsedScheduleRow, 'seq'>;

/** A saved plan as the maker's picker lists it. `cardIds` = the cards following it now (this card included). */
export type PayPlanOption = {
  id: string;
  name: string;
  items: ScheduleItemDraft[];
  cardIds: string[];
};

export const PAY_PLAN_NAME_MAX = 60;

/** "My 3-step plan" → trimmed, inner spaces folded. `null` = empty or too long. */
export function cleanPlanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || name.length > PAY_PLAN_NAME_MAX) return null;
  return name;
}

/** The card's parsed rows → the plan's stored items (seq is the array order). */
export function planItemsFromRows(rows: readonly ParsedScheduleRow[]): PayPlanItem[] {
  return [...rows]
    .sort((a, b) => a.seq - b.seq)
    .map(({ seq, ...rest }, i) =>
      i === 0
        ? rest
        : // The no-show terms belong to the first payment only — the same rule the parser keeps.
          { ...rest, cancellation_terms: null, downpayment_non_refundable: false, refund_window_days: null, no_show_forfeit: false },
    );
}

const isKind = (v: unknown): v is AmountKind => v === 'percent' || v === 'fixed';
const isAnchor = (v: unknown): v is DueAnchor => v === 'on_lock' || v === 'before_event';
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

/**
 * A stored `items` value → editor drafts. A row that does not hold together (no label, an unknown kind, a kind
 * without its amount) makes the WHOLE plan unreadable (`null`) — a plan shown with a payment silently missing
 * would read as a different plan.
 */
export function planItemsToDrafts(items: unknown): ScheduleItemDraft[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_SCHEDULE_ITEMS) return null;
  const out: ScheduleItemDraft[] = [];
  for (const [i, raw] of items.entries()) {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label.trim() : '';
    if (!label || !isKind(r.amount_kind)) return null;
    const bps = int(r.percent_bps);
    const centavos = int(r.amount_centavos);
    if (r.amount_kind === 'percent' && bps === null) return null;
    if (r.amount_kind === 'fixed' && centavos === null) return null;
    const first = i === 0;
    out.push({
      seq: i,
      label,
      amount_kind: r.amount_kind,
      percent: r.amount_kind === 'percent' && bps !== null ? bpsToPct(bps) : null,
      amount_php: r.amount_kind === 'fixed' && centavos !== null ? Math.round(centavos / 100) : null,
      due_anchor: isAnchor(r.due_anchor) ? r.due_anchor : null,
      due_offset_days: isAnchor(r.due_anchor) ? int(r.due_offset_days) : null,
      cancellation_terms: first && typeof r.cancellation_terms === 'string' && r.cancellation_terms.trim() ? r.cancellation_terms : null,
      downpayment_non_refundable: first && r.downpayment_non_refundable === true,
      refund_window_days: first ? int(r.refund_window_days) : null,
      no_show_forfeit: first && r.no_show_forfeit === true,
    });
  }
  return out;
}

/** Two sets of rows say the same plan — how the editor knows a picked plan was changed on this card. */
export function samePlanRows(a: readonly ScheduleItemDraft[], b: readonly ScheduleItemDraft[]): boolean {
  if (a.length !== b.length) return false;
  const key = (d: ScheduleItemDraft, i: number) =>
    [
      d.label.trim(),
      d.amount_kind,
      d.amount_kind === 'percent' ? d.percent : d.amount_php,
      d.due_anchor ?? '',
      d.due_anchor ? (d.due_offset_days ?? '') : '',
      i === 0 ? (d.cancellation_terms ?? '').trim() : '',
      i === 0 ? d.downpayment_non_refundable : false,
      i === 0 ? (d.refund_window_days ?? '') : '',
      i === 0 ? d.no_show_forfeit : false,
    ].join('|');
  return a.every((d, i) => key(d, i) === key(b[i] as ScheduleItemDraft, i));
}

/** The one-time question, in the drawing's words. `n` counts this card. */
export function planScopeQuestion(n: number): string {
  return `Change it on all ${n} cards, or just this one?`;
}

/**
 * What the card's save does with the plan, decided from the posted fields — pure so it can be tested.
 *   own      — no plan: the card's rows are its own (pay_plan_id cleared).
 *   save     — "Save as my plan": a new plan from this card's rows; this card (and the ticked ones) follow it.
 *   follow   — the picked plan, unchanged: this card (and the ticked ones) follow it.
 *   all      — the picked plan, changed here, "All N cards": the plan takes these rows; every card on it follows.
 *   detach   — the picked plan, changed here, "Just this one" (or no other card follows it… then it is `all`).
 */
export type PlanIntent =
  | { kind: 'own' }
  | { kind: 'save'; name: string; applyTo: string[] }
  | { kind: 'follow'; planId: string; applyTo: string[] }
  | { kind: 'all'; planId: string; applyTo: string[] }
  | { kind: 'detach' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPlanIntent(formData: FormData): PlanIntent | { kind: 'error'; message: string } | null {
  if (formData.get('pay_plan_present') !== '1') return null;
  const applyTo = Array.from(
    new Set(formData.getAll('pay_plan_apply_to').filter((v): v is string => typeof v === 'string' && UUID.test(v))),
  );
  const rawName = formData.get('pay_plan_save_name');
  if (typeof rawName === 'string' && rawName.trim() !== '') {
    const name = cleanPlanName(rawName);
    if (!name) return { kind: 'error', message: `Name the plan in up to ${PAY_PLAN_NAME_MAX} characters.` };
    return { kind: 'save', name, applyTo };
  }
  const planId = formData.get('pay_plan_id');
  if (typeof planId !== 'string' || planId === '') return { kind: 'own' };
  if (!UUID.test(planId)) return { kind: 'error', message: 'That pay plan could not be found.' };
  const edited = formData.get('pay_plan_edited') === '1';
  if (!edited) return { kind: 'follow', planId, applyTo };
  const scope = formData.get('pay_plan_scope');
  if (scope === 'this') return { kind: 'detach' };
  return { kind: 'all', planId, applyTo };
}
