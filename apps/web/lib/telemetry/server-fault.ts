import 'server-only';

import { recordFault, type RecordFaultInput } from '@/lib/telemetry/fault-log';
import { normalizePath, type PostgrestVerdict } from '@/lib/telemetry/fault-normalize';

/**
 * Problems · the SERVER's central recorders. Nothing here is called per action:
 *
 *   • `recordRequestError` — Next's `onRequestError` (instrumentation.ts). Every
 *     error THROWN by a server action, a route handler or a server component
 *     lands here once, with the route pattern, the action's file#export and the
 *     digest the person's error screen shows.
 *   • `recordDbVerdict`    — the PostgREST fetch layer (lib/supabase/db-error-log.ts)
 *     that every server Supabase client already rides. A refused write, a
 *     refused read and a TARGETED write that matched no row (the "saved, but
 *     nothing was written" shape) are recorded there, for ~3,000 call sites at
 *     once.
 *
 * Both fire-and-forget through `after()` when a request is in scope, so the
 * person's response never waits on the recorder, and fall back to a detached
 * promise outside one.
 */

/** Schedule a recorder without holding the response; never throws. */
export function runDetached(task: () => Promise<unknown>): void {
  const swallow = () => task().catch(() => {});
  void import('next/server')
    .then((m) => {
      try {
        m.after(swallow);
      } catch {
        // Outside a request scope (`after` throws) — run it now, detached.
        void swallow();
      }
    })
    .catch(() => void swallow());
}

// ── action id → "file#export" ────────────────────────────────────────────────

type ManifestEntry = { filename?: string; exportedName?: string };
type ActionsManifest = { node?: Record<string, ManifestEntry>; edge?: Record<string, ManifestEntry> };

let fileManifest: ActionsManifest | null | undefined;

function readManifestFile(): ActionsManifest | null {
  if (fileManifest !== undefined) return fileManifest;
  fileManifest = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');
    for (const base of [process.cwd(), path.join(process.cwd(), 'apps/web')]) {
      const p = path.join(base, '.next/server/server-reference-manifest.json');
      if (fs.existsSync(p)) {
        fileManifest = JSON.parse(fs.readFileSync(p, 'utf8')) as ActionsManifest;
        break;
      }
    }
  } catch {
    fileManifest = null;
  }
  return fileManifest;
}

/**
 * A Server Action id is a hash; the list must say WHICH action. Next keeps the
 * build's actions manifest in a process singleton once any page has rendered,
 * and on disk beside the server bundle. Best-effort on both; the id survives
 * as `action:<id>` when neither answers.
 */
export function resolveActionName(id: string | null | undefined): string | null {
  if (!id || !/^[0-9a-f]{20,64}$/i.test(id)) return null;
  const lookup = (m: ActionsManifest | null | undefined): string | null => {
    const e = m?.node?.[id] ?? m?.edge?.[id];
    if (!e) return null;
    if (e.filename && e.exportedName) return `${e.filename}#${e.exportedName}`;
    return e.exportedName ?? null;
  };
  try {
    const singleton = (globalThis as Record<symbol, { serverActionsManifest?: ActionsManifest } | undefined>)[
      Symbol.for('next.server.action-manifests')
    ];
    const hit = lookup(singleton?.serverActionsManifest) ?? lookup(readManifestFile());
    return hit ? hit.replace(/^\.\/|^apps\/web\//, '') : null;
  } catch {
    return null;
  }
}

/** The action KEY used for grouping and for the success/failure counter. */
export function actionKey(id: string | null | undefined): string | null {
  if (!id) return null;
  return resolveActionName(id) ?? `action:${String(id).slice(0, 16)}`;
}

// ── thrown errors (onRequestError) ───────────────────────────────────────────

type RequestLike = { path?: string; method?: string; headers?: Record<string, string | string[] | undefined> };
type ContextLike = { routePath?: string; routeType?: string; renderSource?: string; routerKind?: string };

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
export function shapeRequestError(err: unknown, req: RequestLike, ctx: ContextLike): RecordFaultInput | null {
  if (isControlFlowError(err)) return null;
  const actionId = header(req, 'next-action');
  const route = ctx.routePath || normalizePath(req.path);
  const action =
    ctx.routeType === 'action' || actionId ? (actionKey(actionId) ?? `action@${route}`) : `${ctx.routeType ?? 'render'} ${route}`;
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

/** Called from instrumentation.ts `onRequestError`. Never throws. */
export async function recordRequestError(err: unknown, req: RequestLike, ctx: ContextLike): Promise<void> {
  try {
    const shaped = shapeRequestError(err, req, ctx);
    if (shaped) await recordFault(shaped);
  } catch {
    /* a recorder must not add a second failure to the first */
  }
}

// ── database responses (fetch layer) ─────────────────────────────────────────

/** Called from lib/supabase/db-error-log.ts for every classified PostgREST response. */
export function recordDbVerdict(verdict: NonNullable<PostgrestVerdict>, extra: Record<string, unknown> = {}): void {
  runDetached(() =>
    recordFault({
      kind: verdict.kind,
      action: verdict.action,
      message: verdict.message,
      trace: { db_target: verdict.action, ...extra },
    }),
  );
}

/** A Supabase call that never got an answer (network / DNS / timeout). */
export function recordDbUnreachable(target: string, err: unknown): void {
  runDetached(() =>
    recordFault({
      kind: 'DB_UNREACHABLE',
      action: target,
      message: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      trace: { db_target: target },
    }),
  );
}
