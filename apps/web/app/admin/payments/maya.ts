import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { readMayaGate, mayaSettleDeps } from '@/lib/maya-checkout.server';
import { settleMayaPayment, type ApproveOutcome, type MayaSettleResult } from '@/lib/maya-settle';
import { approvePaymentCore } from './actions';

/**
 * 💳 THE ONE PLACE A MAYA PAYMENT REACHES THE MONEY PATH (owner 2026-11-21).
 *
 * `settleMaya` is called by exactly two doors — the webhook
 * (app/api/webhooks/maya/route.ts) and the payer's return to
 * /pay/[reference]?maya=success — and both hand it HINTS only. The decision is
 * `settleMayaPayment` (lib/maya-settle.ts), which asks Maya's API with our
 * secret key before anything is approved.
 *
 * The approval is `approvePaymentCore` — the admin's own path, not a copy — with
 * `gateway: 'maya'`, so the duplicate rule, the shortfall guard, the promote
 * precondition, the receipt, payouts, notices and activation all run as they do
 * for a manual approval. `promoteOrder` is TRUE: settle has already checked that
 * Maya's amount is exactly what the order owes today.
 *
 * 🔒 lib/an-ai-may-not-approve-money.test.ts holds this file to the money-gate
 * rules (no receipt reader, no model verdict) and pins it as the only gateway
 * caller of `approvePaymentCore`.
 */

async function approveMayaPayment(args: {
  paymentId: string;
  buyerUserId: string;
  note: string;
}): Promise<ApproveOutcome> {
  try {
    const out = await approvePaymentCore({
      admin: createAdminClient(),
      // The BUYER is the ledger's actor for a gateway approval (as the App Store path records it).
      userId: args.buyerUserId,
      paymentId: args.paymentId,
      adminNotes: args.note,
      promoteOrder: true,
      gateway: 'maya',
    });
    return out.ok ? { ok: true } : { ok: false, message: out.message };
  } catch (e) {
    // "Payment already resolved", a write error — never approved twice, never a 500 to Maya.
    return { ok: false, message: e instanceof Error ? e.message : 'The approval could not run.' };
  }
}

/** Settle one Maya payment from hints. Never throws. */
export async function settleMaya(hint: {
  mayaPaymentId?: string | null;
  reference?: string | null;
  claimedPaid?: boolean;
}): Promise<MayaSettleResult> {
  try {
    const { config } = await readMayaGate();
    return await settleMayaPayment(mayaSettleDeps(config, approveMayaPayment), hint);
  } catch (e) {
    console.error('[maya] settle threw', e instanceof Error ? e.message : e);
    return { outcome: 'unverifiable', queued: false };
  }
}
