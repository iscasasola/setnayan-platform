/**
 * 🎟 THE PAY PAGE'S CODE BOX — the rules, pure so they can be tested (EVERY PAYMENT WALL TAKES A CODE, owner
 * 2026-11-22, DECISION_LOG 00bfe8db). The write is `app/pay/[reference]/pay-code.ts`; the box is drawn by
 * `app/pay/[reference]/page.tsx` step 1.
 */

/** A voucher check that could not be made. Never "invalid": the code may be fine and the read failed. */
export const PAY_CODE_UNCHECKED = 'We couldn’t check that code. Please try again.';

/**
 * ₱0 · A CODE THAT COVERS THE WHOLE PRICE (controller 2026-11-22, the follow-up to #8130). It is applied like any other
 * code; the page then says there is nothing to pay and offers ONE button, "Send for confirmation", which writes a ₱0
 * payment row on channel `voucher` into the existing /admin/payments queue. An admin confirms it — so a leaked 100%
 * code switches nothing on by itself. No Maya and no receipt upload on that route.
 */
export const PAY_FREE_HEAD = 'Your code covers this — nothing to pay';
export const PAY_FREE_BUTTON = 'Send for confirmation';
/** `payments.channel` of that ₱0 row — the only channel the database lets carry ₱0 (migration 20271357859993). */
export const PAY_FREE_CHANNEL = 'voucher';

/** Is this bill on the ₱0 route? Still awaiting payment, a code on it, and nothing left to pay. */
export function payFreeRoute(p: { awaitingPayment: boolean; amountPhp: number; codeApplied: boolean }): boolean {
  return p.awaitingPayment && p.codeApplied && Number.isFinite(p.amountPhp) && p.amountPhp <= 0;
}

/**
 * The ₱0 row's reference: the code and the order's own reference, so the row reads as LOGGED (a pending row with no
 * reference and no screenshot is a bill's placeholder — `lib/payment-logged.ts`) and two orders using the same code
 * never share a reference (the duplicate-reference check would flag them).
 */
export function payFreeReference(code: string, orderReference: string): string {
  return `${code}${orderReference}`.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 64);
}

/**
 * 🔒 WHAT `?code_error=` MAY SAY — a FIXED list (review of #8130, low 2). The URL carries a KEY; the page draws the
 * message from here and nothing else, so a hand-made link can never put its own words on the pay page.
 */
export const PAY_CODE_ERRORS = {
  unchecked: PAY_CODE_UNCHECKED,
  empty: 'Type your code first.',
  settled: 'This one is already settled — a code can’t change it now.',
  permission: 'The couple has not approved payment handling for your access — ask them to re-invite you with payment permission.',
  sent: 'This one is already sent for checking — a code can’t change it now.',
  maya_open: 'Your Maya payment is already open at this price — finish it there.',
  has_code: 'A code is already on this one.',
  quoted: 'This price was set by our team — a code can’t change it. Please message us.',
  used: 'Looks like you’ve already used this code.',
  shape: 'Discount codes are 8 characters · letters and numbers only.',
  not_found: 'That code doesn’t look right. Double-check and try again.',
  suppliers_only: 'This code is for supplier accounts only.',
  inactive: 'That code is no longer active.',
  not_started: 'That code hasn’t started yet. Try again later.',
  expired: 'That code has expired.',
  used_up: 'That code has reached its usage limit.',
  not_yours: 'That code isn’t for your account.',
  not_usable: 'That code can’t be used on this one.',
  not_free: 'There is still an amount to pay on this one.',
} as const;
export type PayCodeErrorKey = keyof typeof PAY_CODE_ERRORS;

/** The message for a `?code_error=` value — null for anything that is not a known key (drawn as nothing). */
export function payCodeErrorFor(raw: unknown): string | null {
  return typeof raw === 'string' && Object.prototype.hasOwnProperty.call(PAY_CODE_ERRORS, raw) ? PAY_CODE_ERRORS[raw as PayCodeErrorKey] : null;
}

/** The voucher engine's own refusal (`lib/vouchers/validate.ts` `reason`) → its key here. Unknown words → `not_usable`. */
export function payCodeErrorKeyOfReason(reason: string | null | undefined): PayCodeErrorKey {
  const r = (reason ?? '').replace(/'/g, '’');
  if (!r) return 'unchecked';
  if (/^We couldn’t check/.test(r)) return 'unchecked';
  if (/^Discount codes are/.test(r)) return 'shape';
  if (/doesn’t look right/.test(r)) return 'not_found';
  if (/supplier accounts only/.test(r)) return 'suppliers_only';
  if (/no longer active/.test(r)) return 'inactive';
  if (/^That code starts on/.test(r)) return 'not_started';
  if (/has expired/.test(r)) return 'expired';
  if (/usage limit/.test(r)) return 'used_up';
  if (/already used this code/.test(r)) return 'used';
  if (/isn’t for your account/.test(r)) return 'not_yours';
  return 'not_usable';
}

/** The order statuses a code may still re-price: unpaid and nobody has sent anything. */
export const PAY_CODE_STATUSES: ReadonlySet<string> = new Set(['draft', 'awaiting_payment']);

export type PayCodeGate = { ok: true } | { ok: false; reason: PayCodeErrorKey };

/**
 * May a code re-price this order now? Only an UNPAID order nobody has started paying: no LOGGED payment (no receipt,
 * no Maya payment, nothing submitted — a bill's own empty placeholder row is not a payment, `lib/payment-logged.ts`), no open Maya checkout (Maya already holds a price — it is never re-priced), not
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
    return { ok: false, reason: 'sent' };
  }
  if (o.mayaCheckoutOpen) return { ok: false, reason: 'maya_open' };
  if (o.codeApplied) return { ok: false, reason: 'has_code' };
  if (o.quoted) return { ok: false, reason: 'quoted' };
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
