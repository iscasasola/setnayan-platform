import { NextResponse, type NextRequest } from 'next/server';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { settleMaya } from '@/app/admin/payments/maya';

/**
 * 💳 Maya webhooks — the URL "Register webhooks" (Admin › Integrations › Maya)
 * gives Maya for PAYMENT_SUCCESS / PAYMENT_FAILED / PAYMENT_EXPIRED /
 * PAYMENT_CANCELLED (owner 2026-11-21, DECISION_LOG "MAYA CHECKOUT — BUILD IT").
 *
 * 🔑 THE BODY IS A HINT, NEVER A VERDICT. Maya POSTs a payment object; we read
 * only its `id` and `requestReferenceNumber` to know WHICH payment to ask about,
 * then `settleMaya` asks Maya's API with our SECRET key and decides from that
 * answer alone (lib/maya-settle.ts). A forged body naming a real checkout can
 * at worst make us ask Maya again — it cannot approve anything.
 *
 * ⚠ Maya also documents an RSA "Webhook Signature Version 1"
 * (developers.maya.ph/reference/webhook-security). It is not checked in V1:
 * the server-side re-verify is the security, and a signature failing closed
 * would only drop real payments. Maya's published source IPs are recorded in
 * `MAYA_WEBHOOK_SOURCE_IPS` (lib/maya-checkout.ts) for the owner's reference;
 * they are not a gate either.
 *
 * Maya wants 200 within 5 seconds and retries non-2xx at 5 · 15 · 45 minutes
 * (developers.maya.ph/reference/configuring-your-webhook-for-maya-checkout).
 * So: always 200, an empty `{ ok: true }` that says nothing about what we hold,
 * and the settle runs AFTER the response. A late or lost run is not lost money:
 * the payer's return to /pay re-verifies, and a queued payment waits in
 * /admin/payments.
 */
export const dynamic = 'force-dynamic';

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : null;

export async function POST(req: NextRequest) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const b = (body ?? {}) as { id?: unknown; status?: unknown; paymentStatus?: unknown; requestReferenceNumber?: unknown };
  const mayaPaymentId = text(b.id, 64);
  const reference = text(b.requestReferenceNumber, 36);
  // Maya's guide names `paymentStatus`; its schema names `status`. Either one
  // saying success only means "worth queueing if Maya's API cannot be reached".
  const claimedPaid = [b.status, b.paymentStatus].some((s) => s === 'PAYMENT_SUCCESS');

  if (mayaPaymentId || reference) {
    after(async () => {
      const result = await settleMaya({ mayaPaymentId, reference, claimedPaid });
      if (result.outcome === 'approved' || result.outcome === 'queued' || (result.outcome === 'unverifiable' && result.queued)) {
        revalidatePath('/admin/payments');
        revalidatePath('/admin/money');
        revalidatePath('/dashboard', 'layout');
      }
    });
  }
  return NextResponse.json({ ok: true });
}
