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
 * Hardening: same-origin check · RATE LIMIT per IP (L1 in-memory + L2 durable,
 * `enforceRateLimit`) plus a per-instance ceiling · field + payload caps ·
 * kind coercion (a browser cannot claim a server-only kind) · count keys
 * restricted to `id:<action id>` / `route:<path>` / `flow:<known flow>:<known step>` ·
 * every message, label and path scrubbed of personal data server-side again,
 * whatever the browser already did.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { bumpActionCounts, insertFaultLog } from '@/lib/telemetry/fault-log';
import { coerceBrowserKind, normalizeLabel, normalizePath, scrubText } from '@/lib/telemetry/fault-normalize';
import { actionKey } from '@/lib/telemetry/server-fault';
import { INGEST_LIMIT_PER_INSTANCE, INGEST_LIMIT_PER_IP, countKeyFor } from '@/lib/telemetry/ingest';
import { enforceRateLimit } from '@/lib/with-rate-limit';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

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
  counts?: unknown;
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

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAllowedOrigin(req)) {
    return new NextResponse(null, { status: 403 });
  }

  // ── RATE LIMIT (2026-10-02). The comment here used to say "NOT done (V1.x)".
  // A public door that writes with the service role must not be a free write
  // amplifier, so it is done now: the per-instance ceiling first (no DB), then
  // the per-IP two-layer limit every other public write door uses.
  if (!rateLimit('telemetry_ingest:all', INGEST_LIMIT_PER_INSTANCE.limit, INGEST_LIMIT_PER_INSTANCE.windowMs).ok) {
    return new NextResponse(null, { status: 429 });
  }
  const rl = await enforceRateLimit('telemetry_ingest', clientIp(req.headers), INGEST_LIMIT_PER_IP);
  if (!rl.ok) {
    return new NextResponse(null, { status: 429, headers: { 'retry-after': String(rl.retryAfterSecs) } });
  }

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // ── COUNTS ──────────────────────────────────────────────────────────────
  if (Array.isArray(body.counts)) {
    const merged = new Map<string, { a: string; ok: number; fail: number }>();
    for (const c of body.counts.slice(0, 200)) {
      if (!c || typeof c !== 'object') continue;
      const rec = c as { a?: unknown; ok?: unknown; fail?: unknown };
      const key = countKeyFor(rec.a);
      if (!key) continue;
      const cur = merged.get(key) ?? { a: key, ok: 0, fail: 0 };
      cur.ok += Math.max(0, Math.min(500, Math.floor(Number(rec.ok) || 0)));
      cur.fail += Math.max(0, Math.min(500, Math.floor(Number(rec.fail) || 0)));
      merged.set(key, cur);
    }
    const n = await bumpActionCounts([...merged.values()]);
    return NextResponse.json({ ok: true, counted: n }, { status: 200 });
  }

  // ── ONE FAILURE ─────────────────────────────────────────────────────────
  const payload =
    body.payload_snapshot &&
    typeof body.payload_snapshot === 'object' &&
    !Array.isArray(body.payload_snapshot)
      ? { ...(body.payload_snapshot as Record<string, unknown>) }
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

  // Paths are re-normalised HERE, whatever the browser sent: a query string
  // or an event's own address (often the couple's names) never lands.
  if (typeof payload.page === 'string') payload.page = normalizePath(payload.page, true);
  if (typeof payload.from === 'string') payload.from = normalizePath(payload.from, true);
  if (typeof payload.to === 'string') payload.to = normalizePath(payload.to, true);

  const actionId = str(payload.action_id, 80);
  const resolved = actionId ? actionKey(actionId) : null;
  const claimed = str(payload.action, 300);
  payload.action = resolved ?? (claimed ? scrubText(claimed, 300) : null);

  const id = await insertFaultLog({
    event_type: coerceBrowserKind(body.event_type),
    element_name: str(body.element_name, 256) ? normalizeLabel(str(body.element_name, 256)) : null,
    file_path: str(body.file_path, 512),
    error_message: str(body.error_message, 4000),
    payload_snapshot: payload,
  });

  if (!id) {
    // Insert failed (env / DB). Report it but keep the contract simple — the
    // client swallows non-2xx anyway; a fault report must never break the app.
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
