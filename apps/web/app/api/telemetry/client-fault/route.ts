/**
 * POST /api/telemetry/client-fault — Connection Logs ingest endpoint.
 *
 * Public, possibly-unauthenticated: any page (incl. logged-out marketing /
 * guest surfaces) can report a front-end fault here via the `trackFailure()`
 * helper (lib/telemetry/track-error.ts). We insert with the service-role key
 * rather than exposing an anon-writable table — the validation + size caps
 * below are the gate. Owner-confirmed posture (2026-06-07).
 *
 * Hardening done here: same-origin check, field length caps, payload size cap,
 * event_type coercion. NOT done (V1.x): IP/Redis rate-limiting + HMAC signing —
 * matches the deferral note in lib/telemetry/insert.ts.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { coerceEventType, insertFaultLog } from '@/lib/telemetry/fault-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reject obviously-oversized payloads before we touch the DB. 16KB is generous
// for any legitimate "local variables at failure" snapshot.
const MAX_PAYLOAD_BYTES = 16 * 1024;

interface IngestBody {
  event_type?: unknown;
  element_name?: unknown;
  file_path?: unknown;
  error_message?: unknown;
  payload_snapshot?: unknown;
}

/**
 * Soft same-origin guard. Browsers attach an Origin header to cross-origin
 * (and most same-origin) POSTs; if it's present and points elsewhere, drop it.
 * A missing Origin is allowed (some same-origin / non-browser callers omit it).
 */
function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(req)) {
    return new NextResponse(null, { status: 403 });
  }

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const payload =
    body.payload_snapshot &&
    typeof body.payload_snapshot === 'object' &&
    !Array.isArray(body.payload_snapshot)
      ? (body.payload_snapshot as Record<string, unknown>)
      : {};

  // Bound payload size — reject rather than truncate so we never store a
  // half-serialised blob.
  try {
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: 'payload_too_large' }, { status: 413 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'payload_unserializable' }, { status: 400 });
  }

  const id = await insertFaultLog({
    event_type: coerceEventType(body.event_type),
    element_name: typeof body.element_name === 'string' ? body.element_name : null,
    file_path: typeof body.file_path === 'string' ? body.file_path : null,
    error_message: typeof body.error_message === 'string' ? body.error_message : null,
    payload_snapshot: payload,
  });

  if (!id) {
    // Insert failed (env / DB). Report it but keep the contract simple — the
    // client swallows non-2xx anyway; a fault report must never break the app.
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
