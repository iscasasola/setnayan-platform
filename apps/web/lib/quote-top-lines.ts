/**
 * 🧾 THE TWO LINES UNDER A BOOKED CLIENT'S QUOTE (owner 18 Nov 2026, client-page rulings; drawing NL5NDoD6 v7):
 *
 *   · "Paid N of M · Next due <day> ›" — the booking's frozen payment plan, counted by installment. Opens Payment.
 *     Quotation and Payment stay two tabs (owner asked; no merge) — this line is the door between them.
 *   · "Who it counts · <rule> · N" — the couple's per-head rule for this booking (`get_vendor_headcount_rule`, numbers
 *     and the rule only, never names). The RPC answers ONE rule per booking, so it is said once, not per quote line.
 *
 * Pure: every input is already read by the client page (`planRowsAll`, `headcountRule`) — no request of its own.
 * A plan read that was refused is `'unread'` and SAID ("couldn't load"), never "Paid 0 of 0".
 */
export type PlanStepLike = { state: 'paid' | 'pending' | 'due'; due_date?: string | null };

export type QuotePlanLine = { paid: number; total: number; nextDue: string | null } | 'unread' | null;

/** Paid N of M over every installment of the booking's plans; null when there is no plan to count. */
export function quotePlanLine(planReadComplete: boolean, steps: readonly PlanStepLike[], nextDue: string | null): QuotePlanLine {
  if (!planReadComplete) return 'unread';
  if (steps.length === 0) return null;
  return { paid: steps.filter((s) => s.state === 'paid').length, total: steps.length, nextDue: steps.every((s) => s.state === 'paid') ? null : nextDue };
}

/** "Paid 1 of 3" — the words of the line's head. */
export function paidOfWords(p: { paid: number; total: number }): string {
  return p.paid === p.total ? `Paid in full · ${p.total} of ${p.total}` : `Paid ${p.paid} of ${p.total}`;
}
