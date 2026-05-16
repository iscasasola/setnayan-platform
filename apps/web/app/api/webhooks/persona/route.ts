import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * Persona webhook stub — Vendor Verification flow (locked 2026-05-16).
 *
 * Persona drives the government-ID liveness + biometric step of the 12-doc
 * checklist (slot #4 "Valid government ID (owner)" + slot #8 "Live selfie +
 * ID liveness check"). The owner-side signup for the Persona dashboard isn't
 * done yet (see App_Build_Status.md "Persona / Veriff / Onfido"), so this
 * route only:
 *
 *   • Logs the inbound payload (server console + Sentry breadcrumb).
 *   • Returns 200 so Persona's retry-on-non-2xx behaviour stays quiet during
 *     the integration roll-in.
 *
 * Once the owner provisions Persona:
 *   1. Wire `PERSONA_WEBHOOK_SECRET` and verify the HMAC signature per
 *      https://docs.withpersona.com/docs/webhooks#verifying-webhook-signatures.
 *   2. On `inquiry.completed` with `status='approved'`, look up the
 *      `vendor_verification_applications` row whose
 *      `doc_uploads.government_id.persona_inquiry_id` matches the inquiry id
 *      and patch it with the liveness outcome.
 *   3. Forward to a server action / direct supabase admin update that flips
 *      the application's docs_complete flag once all 12 slots resolve.
 *
 * The route is intentionally permissive on payload shape — Persona has a
 * documented event envelope but we don't enforce it server-side until the
 * integration is live. Bogus payloads get logged + 200'd so a misconfigured
 * test event from a future setup-step doesn't take down the route.
 */

type PersonaWebhookPayload = {
  type?: string;
  data?: {
    attributes?: {
      payload?: {
        data?: {
          id?: string;
          attributes?: {
            status?: string;
            'reference-id'?: string;
          };
        };
      };
    };
  };
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload: PersonaWebhookPayload | null = null;
  try {
    payload = (await request.json()) as PersonaWebhookPayload;
  } catch {
    // Persona docs: webhooks always send JSON bodies. A non-JSON body is
    // almost certainly a misconfigured test — log + 200.
    Sentry.captureMessage('persona webhook received non-JSON body', {
      level: 'warning',
    });
    return NextResponse.json({ ok: true, stubbed: true }, { status: 200 });
  }

  const inquiryId = payload?.data?.attributes?.payload?.data?.id ?? null;
  const status =
    payload?.data?.attributes?.payload?.data?.attributes?.status ?? null;
  const referenceId =
    payload?.data?.attributes?.payload?.data?.attributes?.['reference-id'] ??
    null;

  // V1 stub — log + 200. No DB write, no signature check (owner action
  // pending).
  console.log('[persona webhook] received (stub)', {
    type: payload?.type,
    inquiryId,
    status,
    referenceId,
  });
  Sentry.addBreadcrumb({
    category: 'webhook',
    type: 'http',
    level: 'info',
    message: 'persona webhook received (stub)',
    data: { type: payload?.type, inquiryId, status, referenceId },
  });

  return NextResponse.json(
    { ok: true, stubbed: true, message: 'Persona integration owner-pending.' },
    { status: 200 },
  );
}

export async function GET(): Promise<NextResponse> {
  // Persona has a no-payload "test webhook" button in their dashboard that
  // pings the configured URL — accept GET for that liveness check.
  return NextResponse.json(
    { ok: true, stubbed: true, integration: 'persona' },
    { status: 200 },
  );
}
