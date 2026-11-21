/**
 * 🎟 THE PAY PAGE'S CODE BOX — the rules, pure so they can be tested (EVERY PAYMENT WALL TAKES A CODE, owner
 * 2026-11-22, DECISION_LOG 00bfe8db). The write is `app/pay/[reference]/pay-code.ts`; the box is drawn by
 * `app/pay/[reference]/page.tsx` step 1.
 */

/** A voucher check that could not be made. Never "invalid": the code may be fine and the read failed. */
export const PAY_CODE_UNCHECKED = 'We couldn’t check that code. Please try again.';

/**
 * A code that would make the bill ₱0. There is no free-voucher route on /pay yet — nothing would confirm or switch on a
 * ₱0 bill — so it is refused before anything is written (open call, 2026-11-22), never applied into a dead end.
 */
export const PAY_CODE_COVERS_ALL = 'This code covers the whole price — please message us and we’ll switch it on for you.';

/** The order statuses a code may still re-price: unpaid and nobody has sent anything. */
export const PAY_CODE_STATUSES: ReadonlySet<string> = new Set(['draft', 'awaiting_payment']);

export type PayCodeGate = { ok: true } | { ok: false; reason: string };

/**
 * May a code re-price this order now? Only an UNPAID order nobody has started paying: no payment row (no receipt, no
 * Maya payment, nothing submitted), no open Maya checkout (Maya already holds a price — it is never re-priced), not
 * admin-quoted (`confirmed_total_php` is already the agreed figure), and no code on it yet (one code per order).
 */
export function payCodeOpenFor(o: {
  orderStatus: string;
  hasPayment: boolean;
  mayaCheckoutOpen: boolean;
  codeApplied: boolean;
  quoted: boolean;
}): PayCodeGate {
  if (!PAY_CODE_STATUSES.has(o.orderStatus) || o.hasPayment) {
    return { ok: false, reason: 'This one is already sent for checking — a code can’t change it now.' };
  }
  if (o.mayaCheckoutOpen) return { ok: false, reason: 'Your Maya payment is already open at this price — finish it there.' };
  if (o.codeApplied) return { ok: false, reason: 'A code is already on this one.' };
  if (o.quoted) return { ok: false, reason: 'This price was set by our team — a code can’t change it. Please message us.' };
  return { ok: true };
}

/**
 * Draw "Have a code?" on step 1? The page asks the same questions it can see: still awaiting payment, nothing sent, no
 * Maya checkout open (an UNREAD answer hides the box — never a box beside a checkout we could not rule out), and no code
 * yet. A quoted order hides it too.
 */
export function payCodeBoxShown(p: {
  awaitingPayment: boolean;
  sentOrWaiting: boolean;
  mayaCheckout: 'open' | 'none' | 'unread';
  codeApplied: boolean;
  quoted: boolean;
}): boolean {
  return p.awaitingPayment && !p.sentOrWaiting && p.mayaCheckout === 'none' && !p.codeApplied && !p.quoted;
}
