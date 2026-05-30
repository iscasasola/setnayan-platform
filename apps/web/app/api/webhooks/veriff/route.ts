import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * Veriff webhook stub — Vendor Verification flow (locked 2026-05-16).
 *
 * Veriff is the secondary ID-verification provider considered alongside
 * Persona / Onfido for slot #4 + #8 of the 12-doc checklist. Owner-side
 * signup pending (see App_Build_Status.md). This route is a parallel stub
 * to /api/webhooks/persona so we can switch providers without re-routing
 * during the integration evaluation phase.
 *
 * Once the owner provisions Veriff:
 *   1. Wire `VERIFF_WEBHOOK_SECRET` (currently absent from .env.example —
 *      will be added when integration ships) and verify the HMAC per
 *      https://developers.veriff.com/#webhooks.
 *   2. Map `verification.status='approved'` events to the
 *      `vendor_verification_applications` row whose
 *      `doc_uploads.government_id.veriff_session_id` matches the session id.
 *   3. Flip docs_complete + admin_audit_log row once all 12 slots resolve.
 */

type VeriffWebhookPayload = {
  status?: string;
  verification?: {
    id?: string;
    status?: string;
    code?: number;
    reason?: string;
  };
  vendorData?: string; // Veriff carries the reference id here
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: VeriffWebhookPayload | null = null;
  try {
    payload = (await request.json()) as VeriffWebhookPayload;
  } catch {
    Sentry.captureMessage('veriff webhook received non-JSON body', {
      level: 'warning',
    });
    return NextResponse.json({ ok: true, stubbed: true }, { status: 200 });
  }

  // Stub provider hits flow through Sentry breadcrumbs only — the prior
  // `console.log` was redundant with this breadcrumb and polluted Vercel
  // Functions logs without adding signal. When the integration goes live
  // (owner action pending per App_Build_Status.md), the breadcrumb survives
  // every real inbound for trace context. Pre-pilot audit cleanup 2026-05-30.
  Sentry.addBreadcrumb({
    category: 'webhook',
    type: 'http',
    level: 'info',
    message: 'veriff webhook received (stub)',
    data: {
      status: payload?.status,
      verificationId: payload?.verification?.id,
      verificationStatus: payload?.verification?.status,
      vendorData: payload?.vendorData,
    },
  });

  return NextResponse.json(
    { ok: true, stubbed: true, message: 'Veriff integration owner-pending.' },
    { status: 200 },
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ok: true, stubbed: true, integration: 'veriff' },
    { status: 200 },
  );
}
