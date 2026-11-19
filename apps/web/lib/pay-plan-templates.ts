/**
 * 💳 SHOP › TEMPLATES › PAYMENT STRATEGIES — the words a saved pay plan is listed with (Card Maker part 4; the HYBRID
 * drawing's Templates screen, built onto the shipped Shop per ruling 280d53a9 "Yes, extend it"; the name "Payment
 * Strategies" is the owner's 17 Nov ruling). Pure — the read is `pay-plan-templates.server.ts`, the delete rides the
 * shipped `formsAction` (`op: 'plan-retire'`), so no new server action.
 *
 * A plan is the SOURCE cards copy from: deleting it from Templates never changes a card — each card keeps its own rows
 * (`vendor_pay_plans.retired_at`; `vendor_services.pay_plan_id` stays, the picker simply stops offering it).
 */
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import type { ScheduleItemDraft } from '@/lib/vendor-service-payment-schedules';

export type PlanTemplate = {
  id: string;
  name: string;
  items: ScheduleItemDraft[];
  /** Live cards following it now. */
  cardCount: number;
};

/** `null` plans = the read was refused — said, never "none yet" (reads-are-honest). */
export type PlanTemplatesRead = { status: 'ok'; plans: PlanTemplate[] } | { status: 'unread' };

/** One payment, as the plan's sheet lists it: "Reservation · 30% · when they book". */
export function paymentLine(d: ScheduleItemDraft): string {
  const amount =
    d.amount_kind === 'percent' ? (d.percent == null ? null : `${formatCount(d.percent)}%`) : d.amount_php == null ? null : formatPhpRounded(d.amount_php);
  const days = d.due_offset_days ?? 0;
  const when =
    d.due_anchor === 'on_lock'
      ? days > 0
        ? `${formatCount(days)} ${days === 1 ? 'day' : 'days'} after they book`
        : 'when they book'
      : d.due_anchor === 'before_event'
        ? days > 0
          ? `${formatCount(days)} ${days === 1 ? 'day' : 'days'} before the event`
          : 'on the event day'
        : null;
  return [d.label, amount, when].filter(Boolean).join(' · ');
}

/** The row's quiet line: "3 payments · on 2 cards" · "2 payments · not used yet". */
export function planRowLine(p: PlanTemplate): string {
  const n = p.items.length;
  const pays = `${formatCount(n)} ${n === 1 ? 'payment' : 'payments'}`;
  return `${pays} · ${p.cardCount > 0 ? `on ${formatCount(p.cardCount)} ${p.cardCount === 1 ? 'card' : 'cards'}` : 'not used yet'}`;
}

/** The delete's toast, and what a card keeps. */
export function planDeletedLine(p: PlanTemplate): string {
  return p.cardCount > 0 ? `${p.name} deleted · its ${p.cardCount === 1 ? 'card keeps' : 'cards keep'} the payments` : `${p.name} deleted`;
}

/** The kinds the Show dropdown lists, in the drawing's order (Availability is the Availability builder's, not here yet). */
export const TEMPLATE_KINDS = [
  { key: 'forms', label: 'Quick Forms' },
  { key: 'offers', label: 'Discounts and Promos' },
  { key: 'plans', label: 'Payment Strategies' },
] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number]['key'];
