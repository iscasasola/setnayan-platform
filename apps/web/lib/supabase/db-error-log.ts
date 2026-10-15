/**
 * Make failed PostgREST calls VISIBLE instead of silently empty.
 *
 * THE PROBLEM THIS SOLVES. Almost every read in this app is written as
 *
 *     const { data } = await admin.from('t').select('a,b').eq(…);
 *     const rows = (data ?? []) as Row[];
 *
 * — `error` is never destructured. When the query fails (a column that does not
 * exist → 42703, a table that does not exist → 42P01, an RLS policy that denies
 * the read), PostgREST answers 400/404 and supabase-js resolves with
 * `data: null`. The `?? []` then turns the failure into an empty list, and the
 * feature renders as "nothing here" — indistinguishable from a genuinely empty
 * result. Two shipped features (the date-selection vendor pool, and the
 * Setnayan-AI run-of-show clash check) were dead in production for weeks in
 * exactly this way, with no error anywhere.
 *
 * WHY AT THE FETCH LAYER. The obvious alternative — proxying `.from()` and
 * intercepting the thenable — has to re-implement the builder's chaining
 * contract, and a mistake there changes the behaviour of ~3,000 call sites. A
 * `fetch` wrapper cannot alter query semantics at all: it observes the HTTP
 * response and hands the untouched original back. It also covers strictly more
 * ground than a builder proxy — writes, RPCs, and RLS denials all surface here,
 * because all of them are just non-2xx PostgREST responses.
 *
 * The static guards (lib/security/select-column-scan.ts and the schema-drift
 * replay) catch phantom columns BEFORE merge. This is the runtime backstop for
 * what static analysis structurally cannot see: RLS denials, dynamically-built
 * selects, filter-only column references, and failed writes.
 *
 * RA 10173 — NO PII IN LOGS. A PostgREST URL carries filter values in its query
 * string (`?email=eq.someone@example.com`), and the error body's `details` field
 * can echo row values. We log the path with the query string REMOVED, and only
 * the `code` / `message` / `hint` fields — never `details`. A phantom-column
 * message ("column events.venue does not exist") names schema, not people.
 */

import { classifyPostgrest, isTargetedWrite, type PostgrestVerdict } from '@/lib/telemetry/fault-normalize';
import { fetchWithinReadLimit } from '@/lib/read-limit';

/** PostgREST error envelope. `details` is deliberately NOT read — it can echo row values. */
type PostgrestErrorBody = {
  code?: unknown;
  message?: unknown;
  hint?: unknown;
};

/**
 * Identical failures repeat once per render across a page tree, so collapse them
 * to one line each. Bounded so a pathological loop can't grow this without end;
 * once full we stop deduping rather than stop logging (a missed dedupe is noise,
 * a missed log is the bug we are trying to surface).
 */
const seen = new Set<string>();
const SEEN_CAP = 500;

function shouldLog(key: string): boolean {
  if (seen.has(key)) return false;
  if (seen.size < SEEN_CAP) seen.add(key);
  return true;
}

/** Strip the query string — it carries filter VALUES (emails, ids, names). */
function safePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

function describe(body: string): string {
  try {
    const parsed = JSON.parse(body) as PostgrestErrorBody;
    const code = typeof parsed.code === 'string' ? parsed.code : null;
    const message = typeof parsed.message === 'string' ? parsed.message : null;
    const hint = typeof parsed.hint === 'string' ? parsed.hint : null;
    return [code, message, hint ? `(hint: ${hint})` : null].filter(Boolean).join(': ');
  } catch {
    // Non-JSON body (HTML error page, gateway timeout). Cap it — we only need
    // enough to recognise the failure, and the body is not guaranteed PII-free.
    return body.slice(0, 200);
  }
}

/**
 * Where a classified response goes. The default records it on the Problems
 * list through the sink lib/telemetry/server-fault.ts installs at server
 * start; tests pass their own.
 */
export type DbFaultSink = {
  verdict: (v: NonNullable<PostgrestVerdict>, extra: Record<string, unknown>) => void;
  unreachable: (target: string, err: unknown) => void;
};

/** Installed by instrumentation.ts at server start (lib/telemetry/server-fault.ts). */
export const DB_FAULT_SINK = Symbol.for('setnayan.problems.db-fault-sink');

/**
 * The default sink is whatever the server installed on globalThis — never an
 * import: an import path ending at a `server-only` recorder fails the build
 * for any client bundle that can reach this file, and globalThis is what the
 * instrumentation bundle and the route bundles actually share.
 */
const defaultSink: DbFaultSink = {
  verdict(v, extra) {
    (globalThis as Record<symbol, DbFaultSink | undefined>)[DB_FAULT_SINK]?.verdict(v, extra);
  },
  unreachable(target, err) {
    (globalThis as Record<symbol, DbFaultSink | undefined>)[DB_FAULT_SINK]?.unreachable(target, err);
  },
};

/**
 * One RECORD per identical failure per 5 s per process. The console line keeps
 * its own once-per-process dedupe above; the record is per-occurrence-ish so
 * the issue's count means something, but a page tree that renders the same
 * failing query twenty times in one request is one hit, not twenty.
 */
const recordedAt = new Map<string, number>();
function shouldRecord(key: string, now = Date.now()): boolean {
  const last = recordedAt.get(key);
  if (last !== undefined && now - last < 5_000) return false;
  if (recordedAt.size > 1_000) recordedAt.clear();
  recordedAt.set(key, now);
  return true;
}

function errorFields(body: string): { code: string | null; message: string | null } {
  try {
    const parsed = JSON.parse(body) as PostgrestErrorBody;
    return {
      code: typeof parsed.code === 'string' ? parsed.code : null,
      message: typeof parsed.message === 'string' ? parsed.message : null,
    };
  } catch {
    return { code: null, message: body.slice(0, 200) };
  }
}

/**
 * 🧹 "REMOVE IT IF IT IS THERE" — a DELETE whose author has decided that matching no row is the
 * success it looks like. `DB_ZERO_ROW` exists for the write the code ASSUMED landed ("saved", and
 * nothing changed); a cleanup DELETE whose end state — the row is absent — holds either way is not
 * one. Production 2026-10-15: undoing a supplier lock clears the category's `complete` decision
 * ("deleting an absent row is a no-op", said the code) and the Problems list filed it as a fault.
 *
 * Set it at the call site, on the DELETE itself:
 *     .delete().eq(…).setHeader(ABSENT_IS_FINE_HEADER, '1')
 * ⚠ ONLY where RLS cannot hide a visible row from the delete (the table's DELETE policy is the same
 * as its SELECT policy) — otherwise "matched nothing" can mean "refused in silence", which is
 * exactly what `DB_ZERO_ROW` is for. Never on a PATCH: an update that matched nothing never did its
 * job. Server-side clients only (a custom header from the browser trips CORS).
 */
export const ABSENT_IS_FINE_HEADER = 'x-setnayan-absent-is-fine';

function absentIsFine(input: unknown, init: RequestInit | undefined): boolean {
  try {
    const own = init?.headers ? new Headers(init.headers).get(ABSENT_IS_FINE_HEADER) : null;
    const req = input && typeof input === 'object' && 'headers' in input ? (input as Request).headers.get(ABSENT_IS_FINE_HEADER) : null;
    return (own ?? req) === '1';
  } catch {
    return false;
  }
}

function methodOf(input: unknown, init: RequestInit | undefined): string {
  if (init?.method) return init.method.toUpperCase();
  if (input && typeof input === 'object' && 'method' in input) return String((input as Request).method).toUpperCase();
  return 'GET';
}

/**
 * Wrap `fetch` so non-2xx PostgREST responses are reported. The response is
 * returned untouched — we read a `clone()`, so the caller's body is unconsumed.
 *
 * `/auth/v1/` is skipped: a 400 from the token endpoint is the ordinary
 * "refresh token expired" path and is handled by the auth client.
 */
export function createLoggingFetch(label: string, sink: DbFaultSink = defaultSink): typeof fetch {
  return async function loggingFetch(input, init) {
    let res: Response;
    try {
      // The bounded wait for a guest page's reads (`lib/read-limit.ts`). Outside
      // such a page this is `fetch`, untouched.
      res = await fetchWithinReadLimit(input as Parameters<typeof fetch>[0], init);
    } catch (err) {
      // No answer at all (DNS, reset, timeout). Recorded, then re-thrown
      // unchanged — the caller's own error path is untouched.
      try {
        const url = typeof input === 'string' ? input : (input as Request | URL).toString();
        if (url.includes('/rest/v1/') && shouldRecord(`unreachable ${safePath(url)}`)) {
          sink.unreachable(safePath(url).replace(/^.*\/rest\/v1\//, ''), err);
        }
      } catch {
        /* never mask the original error */
      }
      throw err;
    }
    try {
      const url = typeof input === 'string' ? input : (input as Request | URL).toString();
      if (!url.includes('/rest/v1/') && !url.includes('/storage/v1/')) return res;
      const method = methodOf(input, init);

      if (res.ok) {
        // Only a TARGETED PATCH/DELETE can be "saved, but nothing written".
        if ((method === 'PATCH' || (method === 'DELETE' && !absentIsFine(input, init))) && isTargetedWrite(url)) {
          const contentRange = res.headers.get('content-range');
          const bodyText = contentRange?.startsWith('*/') ? '' : await res.clone().text();
          const verdict = classifyPostgrest({ method, url, status: res.status, contentRange, bodyText });
          if (verdict && shouldRecord(`${verdict.kind} ${verdict.action}`)) {
            sink.verdict(verdict, { status: res.status });
          }
        }
        return res;
      }

      const path = safePath(url);
      const text = await res.clone().text();
      const detail = describe(text);
      const key = `${res.status} ${path} ${detail}`;
      if (shouldLog(key)) {
        console.error(
          `[supabase:${label}] ${res.status} ${path} — ${detail}\n` +
            '    ^ this query FAILED. Any `data ?? []` downstream is rendering an ' +
            'empty result for a broken query, not an empty table.',
        );
      }
      if (url.includes('/rest/v1/')) {
        const { code, message } = errorFields(text);
        // The query string is NOT passed on — it carries filter VALUES.
        const verdict = classifyPostgrest({ method, url: path, status: res.status, errorCode: code, errorMessage: message });
        if (verdict && shouldRecord(`${verdict.kind} ${verdict.action} ${verdict.message}`)) {
          sink.verdict(verdict, { status: res.status, code, client: label });
        }
      }
    } catch {
      // The logger must never change what the caller sees.
    }
    return res;
  } as typeof fetch;
}
