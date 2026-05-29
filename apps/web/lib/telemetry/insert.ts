/**
 * V2 Phase E · Telemetry insert helper (DRY across 7 service endpoints).
 *
 * WHY THIS LIVES HERE
 * -------------------
 * The 7 V2 media services (papic / panood / patiktok / pabati / sde /
 * camera_bridge / live_wall) each expose a POST checkpoint endpoint at
 * /api/telemetry/<service>. The body shape + header guard + insert
 * statement are identical — only the `service_code` enum value differs.
 * Centralising the logic here keeps the 7 route handlers as thin shims +
 * means one place to change the contract (e.g., if we add HMAC signing
 * post-pilot or a Redis dedupe step).
 *
 * SECURITY POSTURE
 * ----------------
 * The header guard `x-internal-worker-secret` MUST match
 * `process.env.INTERNAL_WORKER_SECRET` (4-secret crypto rotation from
 * 2026-05-22 owner-action punch list · per CLAUDE.md 14th 2026-05-28 row
 * RED #3 follow-on). When the secret is missing or mismatched we return
 * 401 with NO body — minimises signal to an attacker probing the
 * surface. Service-role insert bypasses RLS · the header check IS the
 * gate.
 *
 * Source-of-truth: CLAUDE.md third 2026-05-28 row Phase E scope.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

export type TelemetryServiceCode =
  | 'papic'
  | 'panood'
  | 'patiktok'
  | 'pabati'
  | 'sde'
  | 'camera_bridge'
  | 'live_wall';

interface TelemetryRequestBody {
  checkpoint?: unknown;
  related_event_id?: unknown;
  related_vendor_profile_id?: unknown;
  payload?: unknown;
}

/**
 * Verify the worker secret header matches the env var.
 *
 * Returns `null` on success, or a 401 Response when the secret is
 * missing or mismatched. Uses string compare — V1 scope · constant-time
 * compare deferred to V1.x post-pilot when we add HMAC signing per the
 * existing /api/crew/register-device pattern.
 */
function verifyWorkerSecret(req: NextRequest): NextResponse | null {
  const expected = process.env.INTERNAL_WORKER_SECRET;
  if (!expected) {
    // Misconfiguration: env var unset in this environment. Fail closed.
    return new NextResponse(null, { status: 401 });
  }
  const supplied = req.headers.get('x-internal-worker-secret');
  if (!supplied || supplied !== expected) {
    return new NextResponse(null, { status: 401 });
  }
  return null;
}

/**
 * Insert a telemetry row for the given service.
 *
 * Returns the inserted `{ telemetry_id, received_at }` on success or
 * an error response shaped for the route handler to return verbatim.
 */
export async function insertTelemetryEvent(
  req: NextRequest,
  serviceCode: TelemetryServiceCode,
): Promise<NextResponse> {
  const denial = verifyWorkerSecret(req);
  if (denial) return denial;

  let body: TelemetryRequestBody;
  try {
    body = (await req.json()) as TelemetryRequestBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const checkpoint = typeof body.checkpoint === 'string' ? body.checkpoint.trim() : '';
  if (!checkpoint) {
    return NextResponse.json({ error: 'checkpoint_required' }, { status: 400 });
  }

  // Cap free-text checkpoint length to keep storage bounded · 256 is
  // generous for any legitimate service vocabulary.
  if (checkpoint.length > 256) {
    return NextResponse.json({ error: 'checkpoint_too_long' }, { status: 400 });
  }

  const relatedEventId =
    typeof body.related_event_id === 'string' && body.related_event_id.length > 0
      ? body.related_event_id
      : null;

  const relatedVendorProfileId =
    typeof body.related_vendor_profile_id === 'string' &&
    body.related_vendor_profile_id.length > 0
      ? body.related_vendor_profile_id
      : null;

  const payload =
    body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    // Env misconfiguration (NEXT_PUBLIC_SUPABASE_URL or
    // SUPABASE_SERVICE_ROLE_KEY missing). Fail closed.
    return new NextResponse(null, { status: 401 });
  }
  const { data, error } = await supabase
    .from('telemetry_events')
    .insert({
      service_code: serviceCode,
      checkpoint,
      related_event_id: relatedEventId,
      related_vendor_profile_id: relatedVendorProfileId,
      payload,
    })
    .select('event_id, received_at')
    .single();

  if (error || !data) {
    // FK violations (bad event_id / vendor_profile_id) surface here as
    // 23503 · we report a generic 400 so the worker logs it without
    // leaking schema detail.
    return NextResponse.json(
      { error: 'insert_failed', detail: error?.message ?? 'unknown' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      telemetry_id: data.event_id,
      received_at: data.received_at,
    },
    { status: 201 },
  );
}
