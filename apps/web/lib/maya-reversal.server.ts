import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { readMayaGate } from '@/lib/maya-checkout.server';
import { fetchMayaPayment, postMayaReversal } from '@/lib/maya-api';
import { MAYA_CHANNEL } from '@/lib/maya-checkout';
import {
  readMayaReversal,
  runMayaReversal,
  type MayaReversalDeps,
  type MayaReversalOutcome,
  type MayaReversalRead,
  type MayaPaymentWithFlags,
} from '@/lib/maya-reversal';

/**
 * The live wiring for lib/maya-reversal.ts — the stored keys and the real fetch. The rail switch is NOT consulted:
 * it governs whether new payers are offered Maya, not whether money Maya already took can be handed back.
 */
async function liveDeps(): Promise<MayaReversalDeps> {
  const { config } = await readMayaGate();
  return {
    fetchPayment: async (id) => (await fetchMayaPayment(config, id)) as MayaPaymentWithFlags | null | 'error',
    postReversal: (input) => postMayaReversal(config, input),
    now: () => Date.now(),
  };
}

/** The Maya payment id behind a paid order: its approved Maya payment row's reference (null = not Maya-paid). */
export async function mayaPaymentIdForOrder(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
): Promise<string | null | 'error'> {
  const { data, error } = await admin
    .from('payments')
    .select('reference_number')
    .eq('order_id', orderId)
    .eq('channel', MAYA_CHANNEL)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(1);
  if (error) return 'error';
  const ref = (data ?? [])[0]?.reference_number;
  return typeof ref === 'string' && ref.trim() ? ref.trim() : null;
}

/** What the desk draws for this Maya payment. Never throws. */
export async function readMayaReversalLive(mayaPaymentId: string): Promise<MayaReversalRead> {
  try {
    return await readMayaReversal(await liveDeps(), mayaPaymentId);
  } catch {
    return { kind: 'error' };
  }
}

/** Ask Maya to hand the payment back. Never throws; only `ok: true` may be recorded. */
export async function reverseOnMaya(input: {
  mayaPaymentId: string;
  reason: string;
  expectAmountPhp?: number;
}): Promise<MayaReversalOutcome> {
  try {
    return await runMayaReversal(await liveDeps(), input);
  } catch {
    return { ok: false, line: 'Couldn’t reach Maya — try again. Nothing was recorded.' };
  }
}
