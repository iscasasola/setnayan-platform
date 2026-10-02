import 'server-only';

import { normalizePath } from '@/lib/telemetry/fault-normalize';
import { actionKey } from '@/lib/telemetry/server-fault';
import { isKnownFlowStep } from '@/lib/telemetry/flows';

/**
 * The public ingest's rules (app/api/telemetry/client-fault/route.ts), kept
 * here because a route file may export only its handlers.
 */

/** Per IP: a person's tab reports a handful a minute at most. */
export const INGEST_LIMIT_PER_IP = { limit: 40, windowSecs: 60 } as const;
/** Per warm instance, all callers together — a flood from many IPs still stops. */
export const INGEST_LIMIT_PER_INSTANCE = { limit: 1200, windowMs: 60_000 } as const;

/** A count key a browser may bump — anything else is dropped, never stored. */
export function countKeyFor(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  if (raw.startsWith('id:')) return actionKey(raw.slice(3));
  if (raw.startsWith('route:')) return `route:${normalizePath(raw.slice(6))}`;
  if (raw.startsWith('flow:')) {
    const [, flow, step] = raw.split(':');
    return flow && step && isKnownFlowStep(flow, step) ? `flow:${flow}:${step}` : null;
  }
  return null;
}

