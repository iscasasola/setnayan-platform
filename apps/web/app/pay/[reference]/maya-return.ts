import 'server-only';

import { readMayaGate } from '@/lib/maya-checkout.server';
import { MAYA_BUSY_LINE, mayaReturnLine } from '@/lib/maya-checkout';
import { getMaxPaymentPhp } from '@/lib/max-payment.server';
import { paymentWithinCeiling } from '@/lib/payment-ceiling';
import { createAdminClient } from '@/lib/supabase/admin';
import { settleMaya } from '@/app/admin/payments/maya';

/**
 * 💳 What /pay/[reference] needs from Maya, in one call (v3 drawing, `prototypes/pay_maya_2026-11-21`).
 *
 *   · `?maya=success` is an ADDRESS anyone can type, so it decides nothing: it asks `settleMaya` to re-verify with
 *     Maya's API (by our reference — the same path the webhook takes). Confirmed → approved there, and the page's own
 *     order read that follows paints Paid. Mismatch → queued, and the page's payment read paints "We're checking this
 *     by hand". Not settled yet → `checking`: "Checking your payment…", no pay controls (never a live QR beside a
 *     started payment — ship review item 5).
 *   · `?maya=cancel|failure` → back on the Maya choices with one line.
 *   · `?maya=busy` (Maya would not open) → `busy`: the BDO QR, as the safety route, with the drawing's one line.
 */
export type MayaPhase = 'pay' | 'checking' | 'busy';

export async function mayaPayState(
  reference: string,
  param: string | undefined,
): Promise<{ phase: MayaPhase; line: string | null; railOpenFor: (amountPhp: number) => Promise<boolean> }> {
  let phase: MayaPhase = 'pay';
  let line: string | null = mayaReturnLine(param);
  if (param === 'busy') {
    phase = 'busy';
    line = MAYA_BUSY_LINE;
  } else if (param === 'success') {
    const result = await settleMaya({ reference });
    if (result.outcome === 'closed') line = mayaReturnLine('failure');
    else if (result.outcome === 'pending' || (result.outcome === 'unverifiable' && !result.queued)) phase = 'checking';
  }
  return {
    phase,
    line,
    // Maya is the pay stage only while the switch is on with both keys, within the one-payment ceiling, and not busy.
    railOpenFor: async (amountPhp: number) => {
      if (phase === 'busy') return false;
      const { state } = await readMayaGate();
      if (!state.open) return false;
      // The admin setting `max_payment_php` (owner 2026-11-17: nothing above ₱100,000), the same read the buy action makes.
      return paymentWithinCeiling(amountPhp, await getMaxPaymentPhp(createAdminClient()));
    },
  };
}
