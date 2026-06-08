import { NextResponse, type NextRequest, after } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyVendorTokensCredited } from '@/lib/token-purchase-notify';

export const runtime = 'nodejs';

/**
 * Payment-provider webhook → auto-confirm a vendor token-pack purchase.
 *
 * This is the "automated later" half of the apply-then-pay flow. When a
 * provider (Maya / PayMongo / etc.) reports a successful payment carrying our
 * `TKN-xxxxxxxx` reference, this route credits the vendor's wallet by calling
 * `confirm_vendor_token_purchase_by_reference(ref)` — the same idempotent
 * credit core the admin "Confirm" button uses, so manual and automated
 * confirmations are byte-identical and safe to race.
 *
 * SECURITY
 *   • HMAC-SHA256 over the raw body, keyed by TOKEN_PURCHASE_WEBHOOK_SECRET,
 *     compared timing-safe against the `x-setnayan-signature` header. No secret
 *     configured → 503 (route is inert until the owner provisions it). Bad
 *     signature → 401.
 *   • The confirm RPC is service-role-only (a vendor can't reach it), and it's
 *     idempotent — a replayed webhook is a no-op.
 *
 * SETUP (owner): set TOKEN_PURCHASE_WEBHOOK_SECRET in Vercel, point the
 * provider's webhook at /api/webhooks/token-purchase, and have it sign the raw
 * body with that secret (hex HMAC-SHA256 in `x-setnayan-signature`). The
 * provider must echo our `TKN-` reference (as requestReferenceNumber / metadata
 * / reference_number) — we also scan the payload for it as a fallback.
 */

const REF_RE = /TKN-[A-Z0-9]{8}/;

/** Pull the TKN- reference from known provider fields, else scan the payload. */
function extractReference(payload: unknown): string | null {
  const known = [
    (p: any) => p?.requestReferenceNumber,
    (p: any) => p?.reference_code,
    (p: any) => p?.referenceNumber,
    (p: any) => p?.data?.attributes?.reference_number,
    (p: any) => p?.data?.attributes?.metadata?.reference_code,
    (p: any) => p?.metadata?.reference_code,
  ];
  for (const get of known) {
    const v = get(payload);
    if (typeof v === 'string') {
      const m = v.match(REF_RE);
      if (m) return m[0];
    }
  }
  // Fallback: walk the object for any string containing a TKN- code.
  let found: string | null = null;
  const seen = new Set<unknown>();
  const walk = (node: unknown) => {
    if (found || node == null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    for (const val of Object.values(node as Record<string, unknown>)) {
      if (found) return;
      if (typeof val === 'string') {
        const m = val.match(REF_RE);
        if (m) {
          found = m[0];
          return;
        }
      } else if (typeof val === 'object') {
        walk(val);
      }
    }
  };
  walk(payload);
  return found;
}

/** Treat an explicit failure/cancel status as "do not credit". */
function isFailureStatus(payload: any): boolean {
  const s = String(
    payload?.status ??
      payload?.paymentStatus ??
      payload?.data?.attributes?.status ??
      '',
  ).toUpperCase();
  return /FAIL|CANCEL|VOID|EXPIRE|DECLINE|REFUND|CHARGEBACK/.test(s);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.TOKEN_PURCHASE_WEBHOOK_SECRET;
  if (!secret) {
    // Inert until provisioned — fail closed (never credit without a secret).
    return NextResponse.json(
      { ok: false, reason: 'not_configured' },
      { status: 503 },
    );
  }

  const raw = await request.text();
  const provided = request.headers.get('x-setnayan-signature') ?? '';
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false, reason: 'bad_signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
  }

  if (isFailureStatus(payload)) {
    return NextResponse.json({ ok: true, ignored: 'non_success_status' }, { status: 200 });
  }

  const reference = extractReference(payload);
  if (!reference) {
    Sentry.addBreadcrumb({
      category: 'webhook',
      level: 'warning',
      message: 'token-purchase webhook: no TKN- reference found',
    });
    // 200 so the provider doesn't retry-storm a payload we can't map.
    return NextResponse.json({ ok: true, ignored: 'no_reference' }, { status: 200 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    'confirm_vendor_token_purchase_by_reference',
    { p_reference_code: reference },
  );

  if (error) {
    const msg = error.message ?? '';
    // Unknown reference → ack so the provider stops retrying a code we'll
    // never recognize. Anything else is a real server error → 500 (provider
    // retries, which is what we want).
    if (msg.toUpperCase().includes('NOT_FOUND')) {
      return NextResponse.json({ ok: true, ignored: 'unknown_reference' }, { status: 200 });
    }
    Sentry.captureException(error, { tags: { webhook: 'token-purchase', reference } });
    return NextResponse.json({ ok: false, reason: 'confirm_failed' }, { status: 500 });
  }

  const result = (data ?? {}) as { paid?: boolean; already?: boolean };

  // Notify the vendor only on a fresh credit — defer post-response so the
  // provider gets a fast 200 (cron-free background work via after()).
  if (result.paid) {
    after(async () => {
      const { data: p } = await admin
        .from('vendor_token_purchases')
        .select('purchase_id')
        .eq('reference_code', reference)
        .maybeSingle();
      if (p?.purchase_id) await notifyVendorTokensCredited(p.purchase_id);
    });
  }

  return NextResponse.json(
    { ok: true, credited: Boolean(result.paid), already: Boolean(result.already) },
    { status: 200 },
  );
}
