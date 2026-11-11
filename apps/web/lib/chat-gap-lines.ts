/**
 * The words of two Setnayan lines the chat gained (chat gaps, owner 8 Nov 2026). Pure, so the guard reads one rule.
 *
 * Neither carries the free-text note a supplier typed: a Setnayan line is written by the service role and is not
 * screened by the chat's contact rules the way a person's message is (`tg_chat_messages_guard_end_user_write` checks
 * end users), so only words this file builds go in. The note still reaches the couple through the notice and the
 * ask itself.
 */
import { formatPhp } from '@/lib/php';
import { DELEGATE_AREA_LABEL, type DelegateArea } from '@/lib/delegate-areas';

/** "Payment asked · ₱5,000 · due 12 Dec 2026" — a date-only `due` is read as that calendar day, never shifted. */
export function paymentAskedLine(args: { amountPhp: number; dueDate: string | null }): string {
  const parts = ['Payment asked', formatPhp(args.amountPhp)];
  const due = args.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(args.dueDate) ? new Date(`${args.dueDate}T00:00:00Z`) : null;
  if (due && !Number.isNaN(due.getTime())) {
    parts.push(`due ${due.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}`);
  }
  return parts.join(' · ');
}

/** "Sol Studio asked to open: Seat plan, Guest list — the hosts answer in Access requests." (the house labels) */
export function accessAskedLine(args: { shopName: string; areas: readonly DelegateArea[] }): string {
  const names = args.areas.map((a) => DELEGATE_AREA_LABEL[a] ?? a).join(', ');
  return `${args.shopName.trim() || 'Your supplier'} asked to open: ${names} — the hosts answer in Access requests.`;
}
