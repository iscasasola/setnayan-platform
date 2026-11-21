import 'server-only';

import { readMayaGate, hasOpenMayaCheckout, isInternalUser } from '@/lib/maya-checkout.server';
import { MAYA_BUSY_LINE, MAYA_NOT_FINISHED_LINE, mayaEnvironment, mayaReturnLine } from '@/lib/maya-checkout';
import { getMaxPaymentPhp } from '@/lib/max-payment.server';
import { paymentWithinCeiling } from '@/lib/payment-ceiling';
import { createAdminClient } from '@/lib/supabase/admin';
import { settleMaya } from '@/app/admin/payments/maya';

/**
 * 💳 What /pay/[reference] needs from Maya, in one call (v3 drawing, `prototypes/pay_maya_2026-11-21`). Called only
 * AFTER the page has proven the order is the viewer's (ship review 21 Nov, item 3).
 *
 *   · Back from Maya (`?maya=success`), OR any visit while this order has a Maya checkout still open — whatever the
 *     switch says now (item 1: turning Maya off must not put a BDO QR beside a Maya payment in flight) — asks
 *     `settleMaya` to re-verify with Maya's API. Confirmed → approved there (`settledNow`: the page reads the order
 *     again and paints Paid). Mismatch → queued (the page paints "We're checking this by hand"). A payment that exists
 *     at Maya but is not settled → `checking`: "Checking your payment…", no pay controls. No payment at Maya at all
 *     (they opened Maya and came back without paying) → a fresh try, and on `?maya=success` the one line
 *     "Payment not finished. Nothing has been charged." (ship review @3ca46aa6e, item 2).
 *   · `?maya=cancel|failure` → back on the Maya choices with one line.
 *   · `?maya=busy` → the BDO QR as the safety route, with the drawing's line — honoured ONLY when this order's own
 *     busy fallback set the short-lived cookie (item 2); a typed `?maya=busy` changes nothing.
 */
export type MayaPhase = 'pay' | 'checking' | 'busy';

export async function mayaPayState(args: {
  reference: string;
  orderId: string;
  param: string | undefined;
  /** The order id in the busy-fallback cookie, if any (`MAYA_BUSY_COOKIE`). */
  busyFor: string | null;
  /** Who is looking — on SANDBOX keys only an internal account is offered Maya. */
  viewerId: string;
}): Promise<{
  phase: MayaPhase;
  line: string | null;
  settledNow: boolean;
  railOpenFor: (amountPhp: number) => Promise<boolean>;
}> {
  const { reference, orderId, param } = args;
  let phase: MayaPhase = 'pay';
  let line: string | null = mayaReturnLine(param);
  let settledNow = false;

  if (param === 'busy' && args.busyFor === orderId) {
    phase = 'busy';
    line = MAYA_BUSY_LINE;
  } else if (param === 'success' || (param !== 'cancel' && param !== 'failure' && (await hasOpenMayaCheckout(orderId)))) {
    const result = await settleMaya({ reference });
    if (result.outcome === 'approved' || result.outcome === 'queued' || result.outcome === 'already') settledNow = true;
    else if (result.outcome === 'closed') line = param === 'success' ? mayaReturnLine('failure') : line;
    else if (result.outcome === 'none' && param === 'success') line = MAYA_NOT_FINISHED_LINE;
    else if (result.outcome === 'pending' || (result.outcome === 'unverifiable' && !result.queued)) phase = 'checking';
  }

  return {
    phase,
    line,
    settledNow,
    // Maya is the pay stage only while the switch is on with both keys, within the one-payment ceiling, and not busy.
    railOpenFor: async (amountPhp: number) => {
      if (phase === 'busy') return false;
      const { state, config } = await readMayaGate();
      if (!state.open) return false;
      // 🔒 SANDBOX KEYS ARE FOR THE OWNER'S TESTS (ship review @019beef4a, HIGH): payers never see a test checkout.
      if (mayaEnvironment(config.checkoutEndpoint) === 'sandbox' && !(await isInternalUser(args.viewerId))) return false;
      // The admin setting `max_payment_php` (owner 2026-11-17: nothing above ₱100,000), the same read the buy action makes.
      return paymentWithinCeiling(amountPhp, await getMaxPaymentPhp(createAdminClient()));
    },
  };
}
