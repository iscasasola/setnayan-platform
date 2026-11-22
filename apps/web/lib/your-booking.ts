/**
 * lib/your-booking.ts — 🧾 "YOUR BOOKING" ON THE SUPPLIER'S DETAILS PAGE, DECIDED (pure).
 *
 * Owner, 21 Nov 2026 (DECISION_LOG "SUPPLIER EVENT DETAILS — 'Budget' = their own booking money only"): *"budget is also
 * shared but only the budget allocated to their service"* → *"the quotation, payment plan, status"*. So the card that
 * used to be "Budget" (the hosts' range) is now the supplier's OWN booking money, view only, for THEIR booking only:
 *
 *   Your booking
 *   ₱280,000 Price · ₱84,000 Paid · ₱196,000 Left
 *   Next: Second payment · ₱98,000                [Due Nov 27]
 *   Covers: Catering · Dessert table
 *   Open payments — Your quotation and payment plan ›
 *
 * 🔑 NO SECOND COMPUTATION. Every figure is `clientPaymentView`'s (`lib/client-payment-view.ts`) — the SAME fold the
 * supplier's Payment page and the couple's Pay sheet read — so this card can never disagree with the page it opens.
 * The status words are the plan row's own badge words (`PRICE_BADGE.supplier`, "Was due Nov 13" · "Due Apr 28").
 *
 * 🛑 A FIGURE NOBODY MEASURED IS NOT ₱0: a refused read says "couldn't load" and draws "—"; no amount set says so;
 * "All paid" needs a real agreed amount with nothing left — never "nothing owed because nothing was set".
 *
 * 🔒 NEVER THE HOSTS' PLAN (controller, 22 Nov 2026, on the ruling above): this card holds the supplier's own booking
 * money and nothing else — the hosts' planned amount is not drawn here, not even behind their sharing switch. The view
 * has no field for it, so no caller can pass one in.
 *
 * 🔒 lib/your-booking.test.ts
 */
import type { ClientPaymentView } from './client-payment-view';
import { PRICE_BADGE, type PriceBadgeTone } from './price-summary';

export const YOUR_BOOKING_TITLE = 'Your booking';
export const YOUR_BOOKING_DOOR = { label: 'Open payments', line: 'Your quotation and payment plan' } as const;
export const YOUR_BOOKING_UNREAD = 'Part of this couldn’t load. Open payments to try again.';
export const YOUR_BOOKING_NO_AMOUNT = 'No amount is set for this booking yet.';
export const YOUR_BOOKING_ALL_PAID = 'All paid';
export const YOUR_BOOKING_COVERS_UNREAD = 'What it covers couldn’t load.';
/** How many of the quotation's lines the card names before "+N more". */
export const YOUR_BOOKING_COVERS_MAX = 3;

export type YourBookingView = {
  /** Price · Paid · Left, in that order. `value` is "—" when the figure was not measured. */
  figures: readonly { key: 'price' | 'paid' | 'left'; label: string; value: string }[];
  /** A sentence under the figures when they cannot speak for themselves (a refused read · no amount set). */
  note: string | null;
  /** The next payment and its status, or "All paid". Null when there is nothing true to say. */
  next: { line: string; status: string; tone: PriceBadgeTone } | null;
  /** What the agreed quotation covers. Null = no agreed quotation on record (no line is drawn). */
  covers: string | null;
};

export type YourBookingInput = {
  /** The booking's money, already folded for the Payment page (`clientPaymentView`). */
  pay: ClientPaymentView;
  /**
   * The agreed quotation's line labels. `null` = the quotes read was refused (said); `undefined` = no agreed quotation
   * (a claimed booking the couple recorded has none).
   */
  quoteLines: readonly string[] | null | undefined;
  peso: (php: number) => string;
};

/** "Catering · Dessert table · Coffee cart +2 more" — the quotation's own line names, never reworded. */
export function coversLine(lines: readonly string[]): string | null {
  const named = lines.map((l) => l.trim()).filter(Boolean);
  if (named.length === 0) return null;
  const shown = named.slice(0, YOUR_BOOKING_COVERS_MAX).join(' · ');
  const more = named.length - YOUR_BOOKING_COVERS_MAX;
  return more > 0 ? `${shown} +${more} more` : shown;
}

export function yourBookingView(i: YourBookingInput): YourBookingView {
  const { pay, peso } = i;
  const dash = '—';
  const figures = [
    { key: 'price' as const, label: 'Price', value: pay.agreedPhp === null ? dash : peso(pay.agreedPhp) },
    { key: 'paid' as const, label: 'Paid', value: pay.paidPhp === null ? dash : peso(pay.paidPhp) },
    {
      key: 'left' as const,
      label: 'Left',
      // A plan with an amount not set yet has no honest total: what is left is a floor, said with "+".
      value: pay.collectPhp === null ? dash : `${peso(pay.collectPhp)}${pay.collectAtLeast ? '+' : ''}`,
    },
  ];
  const nothingMeasured = pay.agreedPhp === null && pay.paidPhp === null && pay.collectPhp === null;
  const note = pay.partial ? YOUR_BOOKING_UNREAD : nothingMeasured ? YOUR_BOOKING_NO_AMOUNT : null;

  let next: YourBookingView['next'] = null;
  if (pay.next) {
    const line = `Next: ${pay.next.name} · ${peso(pay.next.amountPhp)}`;
    next = pay.next.check
      ? // The hosts logged it; it waits on this supplier's own check (the Payment page's "Check ›").
        { line, status: PRICE_BADGE.supplier.pending, tone: 'warn' }
      : { line, status: pay.next.dueText ?? PRICE_BADGE.supplier.due, tone: pay.next.late ? 'late' : 'soft' };
  } else if (!pay.partial && pay.agreedPhp !== null && pay.agreedPhp > 0 && pay.collectPhp === 0 && !pay.collectAtLeast) {
    next = { line: YOUR_BOOKING_ALL_PAID, status: PRICE_BADGE.supplier.paid, tone: 'ok' };
  }

  const covers = i.quoteLines === null ? YOUR_BOOKING_COVERS_UNREAD : i.quoteLines === undefined ? null : coversLine(i.quoteLines);
  return { figures, note, next, covers };
}
