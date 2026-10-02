/**
 * POST /api/telemetry/client-fault — the Problems (Connection Logs) ingest.
 *
 * Public, possibly-unauthenticated: any page (incl. logged-out marketing /
 * guest surfaces) can report a front-end failure here — `trackFailure()`
 * (lib/telemetry/track-error.ts) and the central browser observer
 * (lib/telemetry/fault-observer.ts) both post here. We write with the
 * service-role key rather than exposing an anon-writable table — the checks
 * below are the gate. Owner-confirmed posture (2026-06-07).
 *
 * TWO BODY SHAPES, ONE DOOR (no second route — the route budget is real):
 *   • a FAILURE  `{ event_type, element_name, file_path, error_message, payload_snapshot }`
 *                → one `record_app_fault` call (issue upsert + sampled trace);
 *   • COUNTS     `{ counts: [{ a, ok, fail }] }` — batched successes and flow
 *                steps, sent with `sendBeacon` on pagehide. Never a row per
 *                success: `bump_app_action_counts` only increments counters.
 *
 * Hardening: same-origin check · RATE LIMIT (2026-10-02 — this comment used to
 * say "NOT done (V1.x)"): a per-instance ceiling first (no DB), then the per-IP
 * two-layer limit every other public write door uses · payload caps · kind
 * coercion (a browser cannot claim a server-only kind) · count keys restricted
 * to `id:` / `route:` / known `flow:` steps · every message, label and path
 * scrubbed server-side again (lib/telemetry/ingest-shape.ts).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { bumpActionCounts, recordFault } from '@/lib/telemetry/fault-log';
import { actionKey } from '@/lib/telemetry/server-fault';
import {
  INGEST_LIMIT_PER_INSTANCE,
  INGEST_LIMIT_PER_IP,
  countsFromWire,
  wireToRecord,
} from '@/lib/telemetry/ingest-shape';
import { enforceRateLimit } from '@/lib/with-rate-limit';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

const resolve = (id: string) => actionKey(id);

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(req)) {
    return new NextResponse(null, { status: 403 });
  }

  if (!rateLimit('telemetry_ingest:all', INGEST_LIMIT_PER_INSTANCE.limit, INGEST_LIMIT_PER_INSTANCE.windowMs).ok) {
    return new NextResponse(null, { status: 429 });
  }
  const rl = await enforceRateLimit('telemetry_ingest', clientIp(req.headers), INGEST_LIMIT_PER_IP);
  if (!rl.ok) {
    return new NextResponse(null, { status: 429, headers: { 'retry-after': String(rl.retryAfterSecs) } });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await req.json()) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (Array.isArray(body.counts)) {
    const n = await bumpActionCounts(countsFromWire(body.counts, resolve));
    return NextResponse.json({ ok: true, counted: n }, { status: 200 });
  }

  const shaped = wireToRecord(body, resolve);
  if (!shaped.ok) {
    return NextResponse.json(
      { ok: false, error: shaped.error },
      { status: shaped.error === 'payload_too_large' ? 413 : 400 },
    );
  }

  const id = await recordFault(shaped.record);
  if (!id) {
    // Insert failed (env / DB). Report it but keep the contract simple — the
    // client swallows non-2xx anyway; a fault report must never break the app.
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
