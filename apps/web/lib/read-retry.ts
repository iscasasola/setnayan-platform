/**
 * read-retry.ts — a database schema-cache BLIP retries; it never errors,
 * redirects or shows empty.
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * Every deploy that carries a migration makes PostgREST reload its schema
 * cache, and for 20 s – 1 min a read can answer `503 · PGRST002` ("Could not
 * query the database for the schema cache. Retrying."). supabase-js RESOLVES
 * with that as `{ error }`, and the read paths turned it into an answer about
 * the person:
 *
 *   EventLayout's `event_members` read → no membership → `notFound()`
 *   the Maker's membership read ........ not a host → `redirect()` out
 *   `fetchUserEvents` .................. `[]` → the board says nothing is yours
 *
 * Measured in prod at 2026-10-05 13:54Z and 2026-10-06 02:12Z: the Maker
 * failed to open and Home bounced away. Owner, 2026-10-07: "Yes" to
 * "show 'Reconnecting…' and retry instead of erroring".
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 *   1. A TRANSIENT read error (`isTransientReadError`) is retried for a few
 *      seconds with backoff (`withSchemaRetry`). Short on purpose: a real
 *      outage must still report quickly.
 *   2. Still transient after the window → THROW `SchemaBlipError`. Its
 *      `digest` survives to the browser, where `app/error.tsx` shows
 *      "Reconnecting…" and refreshes a few times before the honest error
 *      state ("Something on our end didn't work" + Try again). Never
 *      not-found, never a redirect, never an empty list.
 *   3. Anything else — an RLS denial, a 4xx, a phantom column — is NOT
 *      retried and keeps its caller's existing behaviour. Retrying a refusal
 *      only makes the refusal slower.
 *
 *   4. A read that NEVER REACHED the database (2026-10-11 — a dropped
 *      connection, a reset socket, DNS, a timeout: supabase-js resolves it as
 *      `status: 0` with the fetch error's text) is transient too, by rule 2 —
 *      it is the clearest case of "could not be made", and it used to fall
 *      through to rule 3: EventLayout answered `notFound()` ("This page
 *      doesn't exist on Setnayan.") and the Maker redirected silently to the
 *      event's home. It is NOT run again by `withSchemaRetry` (rule 1):
 *      postgrest-js has already retried that GET three times over seven
 *      seconds before it resolves, and five rounds of that is half a minute
 *      of blank page. The retry it gets is the browser's "Reconnecting…".
 *
 * ⚠ READS ONLY. Never wrap a write or a server action: a retried write is a
 * second write.
 *
 * 🔑 Pure and client-safe — `app/error.tsx` imports the digest test from here.
 * 🛡 lib/read-retry.test.ts.
 */

/** The digest a `SchemaBlipError` carries to the browser's error boundary. */
export const SCHEMA_BLIP_DIGEST = 'SETNAYAN_SCHEMA_BLIP';

/**
 * Server-side backoff between attempts: 4 retries, 3.25 s of waiting in all.
 * A deploy blip that outlasts this is handed to the browser's reconnect.
 */
export const SCHEMA_RETRY_DELAYS_MS: readonly number[] = [250, 500, 1000, 1500];

/**
 * PostgREST's own "the database is momentarily unreachable" codes — every one
 * a 503/504 that a moment later answers normally:
 *   PGRST000 could not connect · PGRST001 connection error ·
 *   PGRST002 schema cache not loaded · PGRST003 pool acquire timed out.
 */
const TRANSIENT_POSTGREST_CODES = new Set(['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003']);

/**
 * A statement timeout is a 5xx too, but the same query run again takes just as
 * long and loads the database once more — so it is reported, never retried.
 */
const NOT_RETRIED_5XX_CODES = new Set(['57014']);

type ErrorLike = { code?: unknown; message?: unknown } | null | undefined;

/**
 * What a fetch that never got an answer says, runtime by runtime — Node
 * ("fetch failed"), Chrome ("Failed to fetch"), Safari ("Load failed"),
 * Firefox ("NetworkError when attempting to fetch resource."). postgrest-js
 * hands it on as `message: '<ErrorName>: <that>'`.
 */
const NO_ANSWER_MESSAGE = /^(?:[a-z]*error: )?(?:fetch failed|failed to fetch|load failed|networkerror when attempting to fetch)/i;

/**
 * True when the read NEVER REACHED the database: no HTTP answer at all.
 * postgrest-js resolves such a read as `{ error, status: 0 }` (a failed or
 * aborted fetch — after its own three GET retries). Where the caller has no
 * status to give, the fetch error's own text decides. Never true without an
 * error, and never for a database answer (those carry a real status).
 */
export function isNetworkReadFailure(error: unknown, status?: number | null): boolean {
  if (!error) return false;
  if (status === 0) return true;
  if (typeof status === 'number') return false;
  const msg = (error as ErrorLike)?.message;
  return typeof msg === 'string' && NO_ANSWER_MESSAGE.test(msg.trim());
}

/**
 * True when the read failed for a reason that says nothing about the row —
 * the database could not be asked, or could not answer just now — so the
 * caller must not turn it into "no such row" (rule 2).
 */
export function isTransientReadError(error: unknown, status?: number | null): boolean {
  if (!error) return false;
  const e = error as ErrorLike;
  const code = typeof e?.code === 'string' ? e.code : '';
  if (TRANSIENT_POSTGREST_CODES.has(code)) return true;
  const msg = typeof e?.message === 'string' ? e.message.toLowerCase() : '';
  if (msg.includes('could not query the database for the schema cache')) return true;
  if (NOT_RETRIED_5XX_CODES.has(code)) return false;
  if (isNetworkReadFailure(error, status)) return true;
  return typeof status === 'number' && status >= 500 && status <= 599;
}

/** The part of a supabase-js result this helper reads. */
export type ReadOutcome = { error: unknown; status?: number | null };

export type SchemaRetryOptions = {
  /** Waits between attempts (defaults to `SCHEMA_RETRY_DELAYS_MS`). */
  delaysMs?: readonly number[];
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
};

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run a READ, and run it again while it fails transiently (a read that never
 * reached the database is not run again here — rule 4). Returns the last
 * result unchanged — the caller still branches on `error` exactly as before;
 * use `isTransientReadError(result.error, result.status)` afterwards to tell a
 * blip that outlasted the window (→ `throw schemaBlipError(…)`) from a real
 * refusal (→ the caller's existing path).
 *
 * `read` must build a FRESH query each call: `() => supabase.from(…)…`.
 */
export async function withSchemaRetry<R extends ReadOutcome>(
  read: () => PromiseLike<R>,
  opts: SchemaRetryOptions = {},
): Promise<R> {
  const delays = opts.delaysMs ?? SCHEMA_RETRY_DELAYS_MS;
  const sleep = opts.sleep ?? realSleep;
  let result = await read();
  for (const ms of delays) {
    if (!isTransientReadError(result.error, result.status)) return result;
    /* Already retried by the client library, for seconds (rule 4) — the caller throws it as a blip now. */
    if (isNetworkReadFailure(result.error, result.status)) return result;
    await sleep(ms);
    result = await read();
  }
  return result;
}

/** Thrown when a read is still transiently failing after the retry window. */
export class SchemaBlipError extends Error {
  readonly digest = SCHEMA_BLIP_DIGEST;
  readonly callSite: string;
  constructor(callSite: string, cause?: unknown) {
    const m = (cause as ErrorLike)?.message;
    super(`Database reconnecting at ${callSite}${typeof m === 'string' ? `: ${m}` : ''}`);
    this.name = 'SchemaBlipError';
    this.callSite = callSite;
  }
}

export function schemaBlipError(callSite: string, cause?: unknown): SchemaBlipError {
  return new SchemaBlipError(callSite, cause);
}

/** True for a `SchemaBlipError`, on the server or as the browser receives it. */
export function isSchemaBlip(err: unknown): boolean {
  if (err instanceof SchemaBlipError) return true;
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && digest.split('@')[0] === SCHEMA_BLIP_DIGEST;
}

/** For a `.catch` that degrades to empty: a blip must not be swallowed into `[]`. */
export function rethrowIfSchemaBlip(err: unknown): void {
  if (isSchemaBlip(err)) throw err;
}

// ─── The browser's reconnect ───────────────────────────────────────────────

/** Waits before each browser refresh. After the last, the honest error state. */
export const RECONNECT_DELAYS_MS: readonly number[] = [2000, 4000, 8000];
/** A reconnect run older than this is a new blip, not the same one. */
export const RECONNECT_RUN_MS = 60_000;

export type ReconnectRun = { startedAt: number; attempts: number };

/**
 * Decide the browser's next step for a blip seen at `now`, given the run so far
 * (null = none stored). Returns the wait before the next refresh and the run to
 * store, or `null` when the reconnect is spent and the honest error must show.
 */
export function nextReconnect(
  run: ReconnectRun | null,
  now: number,
): { delayMs: number; run: ReconnectRun } | null {
  const fresh = !run || now - run.startedAt > RECONNECT_RUN_MS || run.attempts < 0;
  const current: ReconnectRun = fresh ? { startedAt: now, attempts: 0 } : run!;
  if (current.attempts >= RECONNECT_DELAYS_MS.length) return null;
  return {
    delayMs: RECONNECT_DELAYS_MS[current.attempts]!,
    run: { startedAt: current.startedAt, attempts: current.attempts + 1 },
  };
}
