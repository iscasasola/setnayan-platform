import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { readMayaGate } from '@/lib/maya-checkout.server';
import { mayaReturnLine } from '@/lib/maya-checkout';
import { getMaxPaymentPhp } from '@/lib/max-payment.server';
import { paymentWithinCeiling } from '@/lib/payment-ceiling';
import { settleMaya } from '@/app/admin/payments/maya';

/**
 * 💳 What /pay/[reference] needs from the Maya rail, in one call.
 *
 * `?maya=success` is an ADDRESS anyone can type, so it decides nothing: it only
 * asks `settleMaya` to re-verify with Maya's API (by our reference) — the same
 * path the webhook takes. A confirmed payment is approved there, and the page's
 * own order read that follows paints it as Paid. Anything short of confirmed
 * gets one honest line and the QR stays where it was.
 */
export async function mayaPayState(
  reference: string,
  param: string | undefined,
): Promise<{ line: string | null; railOpenFor: (amountPhp: number) => Promise<boolean> }> {
  let line: string | null = mayaReturnLine(param);
  if (param === 'success') {
    const result = await settleMaya({ reference });
    if (result.outcome === 'closed') line = mayaReturnLine('failure');
    else if (result.outcome === 'pending' || (result.outcome === 'unverifiable' && !result.queued)) {
      line = 'Maya is still confirming your payment. Refresh in a minute.';
    }
  }
  return {
    line,
    railOpenFor: async (amountPhp: number) => {
      const { state } = await readMayaGate();
      if (!state.open) return false;
      return paymentWithinCeiling(amountPhp, await getMaxPaymentPhp(createAdminClient()));
    },
  };
}
