/**
 * Problems · the public ingest's rules (app/api/telemetry/client-fault/route.ts),
 * kept here because a route file may export only its handlers, and kept PURE
 * (the action-name resolver is passed in) so the tests drive the exact shaping
 * the route does.
 */

import type { RecordFaultInput } from '@/lib/telemetry/fault-log';
import { coerceBrowserKind, normalizeLabel, normalizePath, scrubText } from '@/lib/telemetry/fault-normalize';
import { isKnownFlowStep } from '@/lib/telemetry/flows';

/** Per IP: a person's tab reports a handful a minute at most. */
export const INGEST_LIMIT_PER_IP = { limit: 40, windowSecs: 60 } as const;
/** Per warm instance, all callers together — a flood from many IPs still stops. */
export const INGEST_LIMIT_PER_INSTANCE = { limit: 1200, windowMs: 60_000 } as const;
/** 16KB is generous for any legitimate "local variables at failure" snapshot. */
export const MAX_PAYLOAD_BYTES = 16 * 1024;

export type ResolveAction = (id: string) => string | null;

/** A count key a browser may bump — anything else is dropped, never stored. */
export function countKeyFor(raw: unknown, resolve: ResolveAction): string | null {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  if (raw.startsWith('id:')) return resolve(raw.slice(3));
  if (raw.startsWith('route:')) return `route:${normalizePath(raw.slice(6))}`;
  if (raw.startsWith('flow:')) {
    const [, flow, step] = raw.split(':');
    return flow && step && isKnownFlowStep(flow, step) ? `flow:${flow}:${step}` : null;
  }
  return null;
}

/** Merge + clamp a browser's batched counts. */
export function countsFromWire(raw: unknown[], resolve: ResolveAction): Array<{ a: string; ok: number; fail: number }> {
  const merged = new Map<string, { a: string; ok: number; fail: number }>();
  for (const c of raw.slice(0, 200)) {
    if (!c || typeof c !== 'object') continue;
    const rec = c as { a?: unknown; ok?: unknown; fail?: unknown };
    const key = countKeyFor(rec.a, resolve);
    if (!key) continue;
    const cur = merged.get(key) ?? { a: key, ok: 0, fail: 0 };
    cur.ok += Math.max(0, Math.min(500, Math.floor(Number(rec.ok) || 0)));
    cur.fail += Math.max(0, Math.min(500, Math.floor(Number(rec.fail) || 0)));
    merged.set(key, cur);
  }
  return [...merged.values()];
}

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;
}

/**
 * One failure as a browser posted it → what `recordFault` records. Paths are
 * re-normalised and the kind re-coerced HERE, whatever the browser sent: a
 * query string, an event's own address (often the couple's names) or a forged
 * server-only kind never lands.
 */
export function wireToRecord(
  body: Record<string, unknown>,
  resolve: ResolveAction,
): { ok: true; record: RecordFaultInput } | { ok: false; error: 'payload_too_large' | 'payload_unserializable' } {
  const payload =
    body.payload_snapshot && typeof body.payload_snapshot === 'object' && !Array.isArray(body.payload_snapshot)
      ? { ...(body.payload_snapshot as Record<string, unknown>) }
      : {};
  try {
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) return { ok: false, error: 'payload_too_large' };
  } catch {
    return { ok: false, error: 'payload_unserializable' };
  }
  for (const k of ['page', 'from', 'to', 'landed'] as const) {
    if (typeof payload[k] === 'string') payload[k] = normalizePath(payload[k] as string, true);
  }
  const actionId = str(payload.action_id, 80);
  const resolved = actionId ? (resolve(actionId) ?? `action:${actionId.slice(0, 16)}`) : null;
  const claimed = str(payload.action, 300);
  const element = str(body.element_name, 256);
  const filePath = str(body.file_path, 512);
  const action =
    resolved ?? (claimed ? scrubText(claimed, 300) : null) ?? (element ? normalizeLabel(element) : null) ?? filePath ?? (payload.page as string | undefined) ?? '(unknown)';
  payload.action = action;
  return {
    ok: true,
    record: {
      kind: coerceBrowserKind(body.event_type),
      action,
      message: str(body.error_message, 4000),
      element,
      filePath,
      trace: payload,
    },
  };
}
