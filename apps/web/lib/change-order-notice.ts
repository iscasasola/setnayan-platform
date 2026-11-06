/**
 * lib/change-order-notice.ts — WHAT EACH SIDE IS TOLD ABOUT A CHANGE ORDER.
 *
 * 🔴 WHY (2026-10-10). A change order is a signed amount on what the couple owes
 * (`vendor_change_orders.delta_amount_php`). Its four notices rode
 * `schedule_suggestion`, shared with meeting asks and handovers, and the notice
 * named no figure. They now have their own two types (`change_order_proposed`,
 * `change_order_answered`, enum values in migration 20271267016300) with their
 * own label, tone and words. Told in the app, NOT emailed (owner 2026-10-11:
 * "we manage without emails").
 *
 * 🔑 THE FIGURE IS THE ROW'S, NEVER THE FORM'S. Every amount printed here is
 * `delta_amount_php` READ BACK from `vendor_change_orders` and passed through
 * `formatPhp`. If the row could not be read the sentence is the old one, with
 * no figure — a notice with no amount makes the reader open the page; a notice
 * with a wrong amount is a false statement about their money.
 *
 * The titles and the "open the … to accept or decline" wording are the shipped
 * in-app words, unchanged. Pure. No I/O.
 */
import { formatPhp } from './php';

/** The two columns a notice reads off `vendor_change_orders`. */
export type ChangeOrderForNotice = {
  title: string | null;
  /** NUMERIC(12,2): a number over PostgREST, a string from some drivers. */
  delta_amount_php: number | string | null;
};

/**
 * "adds ₱5,000 to the total" · "takes ₱5,000 off the total" · "" when the
 * figure is absent, unreadable or zero (a zero is not a change in what is owed).
 */
export function changeOrderAmountPhrase(delta: number | string | null | undefined): string {
  if (delta === null || delta === undefined || delta === '') return '';
  const n = Number(delta);
  if (!Number.isFinite(n) || n === 0) return '';
  return n > 0 ? `adds ${formatPhp(n)} to the total` : `takes ${formatPhp(-n)} off the total`;
}

const named = (row: ChangeOrderForNotice | null, fallback: string, max: number): string =>
  (row?.title?.trim() || fallback.trim() || 'Change order').slice(0, max);

/**
 * A change order was raised and waits on the OTHER side's yes.
 * `from: 'couple'` is written to the supplier; `from: 'supplier'` to the couple.
 */
export function changeOrderProposedNotice(args: {
  from: 'couple' | 'supplier';
  /** The shop's name — used only when the supplier raised it. */
  supplierName?: string;
  /** The row as read back, or null when it could not be read. */
  row: ChangeOrderForNotice | null;
  /** The title the raiser typed — the name of it when the row is unreadable. */
  typedTitle: string;
}): { title: string; body: string } {
  const amount = changeOrderAmountPhrase(args.row?.delta_amount_php);
  const what = named(args.row, args.typedTitle, args.from === 'couple' ? 80 : 120);
  const lead = amount ? `${what} (${amount})` : what;
  return args.from === 'couple'
    ? {
        title: 'A couple proposed a change order',
        body: `${lead} — open the client to accept or decline.`,
      }
    : {
        title: `${args.supplierName?.trim() || 'A supplier'} proposed a change order`,
        body: `${lead} — open the supplier to accept or decline.`,
      };
}

/**
 * The other side answered. `by: 'couple'` is written to the supplier who raised
 * it; `by: 'supplier'` to the couple who raised it.
 */
export function changeOrderAnsweredNotice(args: {
  by: 'couple' | 'supplier';
  decision: 'accept' | 'decline';
  row: ChangeOrderForNotice | null;
}): { title: string; body: string } {
  const verb = args.decision === 'accept' ? 'accepted' : 'declined';
  const who = args.by === 'couple' ? 'The couple' : 'Your supplier';
  const what = named(args.row, 'Change order', 80);
  // The figure only on a yes: a declined change moves nothing.
  const amount = args.decision === 'accept' ? changeOrderAmountPhrase(args.row?.delta_amount_php) : '';
  return {
    title: args.decision === 'accept' ? 'Change order accepted' : 'Change order declined',
    body: amount ? `${who} ${verb} "${what}" — it ${amount}.` : `${who} ${verb} "${what}".`,
  };
}
