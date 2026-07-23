import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePaymongoConfig } from '@/lib/integration-config';
import { verifyPaymongoSignature, parsePaymongoEvent } from '@/lib/paymongo-webhook';

// POST /api/webhooks/paymongo — PayMongo booking-fee settlement webhook.
//
// DORMANT until PAYMONGO_WEBHOOK_SECRET is set (503) — mirrors the token-purchase
// webhook template. On a signature-verified `checkout_session.payment.paid`, flips
// the mapped booking_fee_charges row to paid via booking_fee_settle_charge
// (idempotent). Verify the RAW body BEFORE parsing; the signature scheme is the
// SDK-authoritative t=/te=/li= HMAC (see lib/paymongo-webhook).

export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Signing secret resolves DB-first (admin card) with env fallback.
  const { webhookSecret } = await resolvePaymongoConfig();
  if (!webhookSecret) {
    // Inert until provisioned — never process an unverifiable event.
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  // RAW body — must be the exact bytes PayMongo signed.
  const raw = await req.text();
  const sig = req.headers.get('paymongo-signature');
  if (!verifyPaymongoSignature(raw, sig, webhookSecret)) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  const evt = parsePaymongoEvent(raw);
  // Return 200 for anything we don't act on — a non-2xx makes PayMongo retry up
  // to 12×, which is pointless for an event we intentionally ignore.
  if (!evt || evt.type !== 'checkout_session.payment.paid' || !evt.chargeId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Settle synchronously (one fast idempotent RPC — well inside the 30s budget) so
  // a genuine transient failure returns 500 and PayMongo safely retries; an
  // already-paid charge (re-delivery) is a no-op that still reports success.
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('booking_fee_settle_charge', {
      p_charge_id: evt.chargeId,
      p_gateway: 'paymongo',
      p_payment_ref: evt.paymentId ?? evt.referenceNumber,
    });
    const result = data as { status?: string; settled?: boolean } | null;
    const ok = !error && (result?.settled === true || result?.status === 'paid');
    if (!ok) {
      return NextResponse.json({ error: 'settle_failed' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'settle_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
