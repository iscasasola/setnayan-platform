/**
 * Problems · how a THROWN request error (Next `onRequestError`) becomes one
 * record. Pure — the action-name resolver is passed in — so the test drives the
 * exact shaping instrumentation.ts uses (via lib/telemetry/server-fault.ts).
 */

import type { RecordFaultInput } from '@/lib/telemetry/fault-log';
import { normalizePath } from '@/lib/telemetry/fault-normalize';

export type RequestLike = { path?: string; method?: string; headers?: Record<string, string | string[] | undefined> };
export type ContextLike = { routePath?: string; routeType?: string; renderSource?: string; routerKind?: string };

/** Next's own control-flow throws reach no user as a failure; never record them. */
export function isControlFlowError(err: unknown): boolean {
  const digest = (err as { digest?: unknown })?.digest;
  if (typeof digest === 'string' && /^(NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(digest)) {
    return true;
  }
  const msg = err instanceof Error ? err.message : '';
  return /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/.test(msg);
}

function header(req: RequestLike, name: string): string | null {
  const v = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

/** Pure shaping, exported for the test: the record a thrown request error becomes. */
export function shapeRequestError(
  err: unknown,
  req: RequestLike,
  ctx: ContextLike,
  resolve: (id: string | null) => string | null,
): RecordFaultInput | null {
  if (isControlFlowError(err)) return null;
  const actionId = header(req, 'next-action');
  const route = ctx.routePath || normalizePath(req.path);
  const action =
    ctx.routeType === 'action' || actionId ? (resolve(actionId) ?? `action@${route}`) : `${ctx.routeType ?? 'render'} ${route}`;
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? 'unknown error');
  const digest = (err as { digest?: unknown })?.digest;
  return {
    kind: 'SERVER_THROWN',
    action,
    message,
    filePath: route,
    trace: {
      page: route,
      route_type: ctx.routeType ?? null,
      render_source: ctx.renderSource ?? null,
      method: req.method ?? null,
      digest: typeof digest === 'string' ? digest : null,
      action_id: actionId,
      stack: err instanceof Error && err.stack ? err.stack.split('\n').slice(1, 6).map((l) => l.trim()) : null,
    },
  };
}

