import { AsyncLocalStorage } from 'node:async_hooks';
import { cache } from 'react';

/**
 * read-limit.ts — NO GUEST WAITS FOREVER FOR A READ.
 *
 * No database read on the guest path had a time limit. A stalled database held
 * every read for as long as it stalled, and the page with it: on 2026-10-11 a
 * 40-second stall ran reads at a median of 9.7 s while the guest page had
 * fifteen of them in a row. What a guest saw was nothing — no page, no words.
 *
 * ─── WHAT THIS DOES ──────────────────────────────────────────────────────────
 * Inside `withGuestReadLimit(…)` every READ the page sends is given a bounded
 * wait. It is done once, at the one door both Supabase clients go through
 * (`createLoggingFetch`, `lib/supabase/db-error-log.ts`), so no read on the
 * path can be missed and none has to be wrapped by hand.
 *
 *   · a read waits at most READ_LIMIT_MS on its own;
 *   · every read of one request shares ONE deadline, PAGE_BUDGET_MS after the
 *     first of them — a read that leaves after it gives up at once.
 *
 * So the worst a guest waits is the budget, however many reads stand in a row.
 *
 * ─── WHAT THE GUEST THEN SEES — IT IS DECIDED PER READ ────────────────────────
 * ESSENTIAL (the default: the event, the scenes, the guest's own row, the
 * schedule, the venue, seats — anything not listed below). The page does not
 * pretend. `withGuestReadLimit` throws `GuestPageDidNotLoad`, and the guest
 * boundary (`app/[slug]/error.tsx`) says its honest words: "This invitation
 * didn't load… Your link is fine…". 🔑 That is thrown even when the code had
 * already decided something ELSE from the read that never answered — a "not
 * found", a redirect, an empty list. A read that did not answer is not an
 * absence, and it must never be shown as one.
 *
 * DECORATION (`DECORATION_READS`). The read's own caller already has an honest
 * "leave it out" for a failure — a paid look falls to the free one, the album
 * door is not drawn, the arrival banner is skipped. That is what happens, for
 * this view only, and it is logged (`logQueryError(…, 'graceful_degrade')`).
 *
 * ─── ONE MORE TRY — FOR AN ESSENTIAL READ, INSIDE THE BUDGET (2026-10-20) ───
 * Production 2026-10-19 21:15:04Z: the whole database instance stalled for
 * 5–10 s (Auth slowed too; the query itself averages 6.6 ms). The layout's
 * `rpc/event_public_stamp` hit its own READ_LIMIT_MS and the owner's live
 * invitation said "didn't load" — while a read sent at 21:15:11.8 answered in
 * 1.9 s, with four seconds of the page's budget still unspent.
 * So an ESSENTIAL read that ran out its OWN limit is sent ONCE more, at once,
 * and only while budget remains; the second wait is the smaller of
 * READ_LIMIT_MS and what is left of the budget. Recovered or not, the retry
 * is logged on its own call site, `read-limit:retry` (Vercel and Sentry).
 *   · a read that still does not answer is a lapse exactly as before — the
 *     page still throws `GuestPageDidNotLoad`; a retry never hides a failure;
 *   · a read cut short by the BUDGET (not its own limit) is never retried —
 *     there is nothing left to retry in;
 *   · DECORATION is never retried: it already leaves its part out honestly;
 *   · a real error (an HTTP answer, a reset, the caller's own abort) is never
 *     retried here — only the `AbortError` of our own limit;
 *   · a POST to `/rpc/…` is retried only when the function is named in
 *     RETRIED_RPCS — each one proven STABLE/IMMUTABLE, i.e. it CANNOT write,
 *     by `tests/db/a-retried-guest-read-cannot-write.db.test.ts`.
 *
 * ─── IT DOES NOT MULTIPLY ────────────────────────────────────────────────────
 * postgrest-js retries a failed GET three times (1 s, 2 s, 4 s apart) — unless
 * the failure is an `AbortError`, which it rethrows at once. So the limit is
 * raised as an `AbortError`: postgrest-js adds no wait of its own on top of
 * ours. And because the deadline is shared, any retry — the one above, or one
 * postgrest-js makes for some OTHER failure — gives up the moment it leaves
 * late. Nothing on the guest path uses `withSchemaRetry`.
 * Worst case for the page: PAGE_BUDGET_MS, plus at most one of postgrest-js's
 * own pauses (≤ 4 s) if a retry of its own was already sleeping at the deadline.
 *
 * ⛔ ONLY READS. A PATCH, DELETE, PUT or a POST to a table is never limited: a
 * write that was cut off mid-flight is worse than a slow one. (A POST to
 * `/rpc/…` is limited — on a page render those are the ownership questions.)
 * ⛔ OUTSIDE `withGuestReadLimit` NOTHING CHANGES — no signal, no deadline.
 */
export const READ_LIMIT_MS = 6_000;
export const PAGE_BUDGET_MS = 10_000;

/** The reads whose loss leaves a PART of the page out. Everything else is essential. */
const DECORATION_READS: ReadonlyArray<RegExp> = [
  // Ownership — a failure is already "not owned": the free look, for this view.
  /^orders$/,
  /^bundle_components$/,
  /^promo_free_windows$/,
  /^rpc\/event_(comp_active_skus|has_comp_for_sku|host_is_internal|host_holds_founder_seat|basket_orders_granting)$/,
  // The live layer's extras: the album door, the backdrop, the watch links, the wall, the camera.
  /^event_recaps$/,
  /^events\(rsvp_backdrop\)$/,
  /^events\(panood_watch_url,panood_watch_url_facebook\)$/,
  /^events\(papic_on\)$/,
  /^events\(pool_gallery_open\)$/,
  /^rpc\/papic_event_pool_status$/,
  /^(papic_limited_snapshots|papic_guest_captures|photo_tags)$/,
  // The arrival banner.
  /^guest_checkins$/,
  /^scan_events$/,
  // The Welcome door's open-wish count (`readOpenWishCount`, a HEAD count): unread is `null`, and the
  // door then names no list — never "0 things". Production 2026-10-15 08:50: during a database
  // stall this ONE read lapsed while the event itself had answered, and the guest was shown "This
  // invitation didn't load" over a line about a gift list. (On the gift page itself the list read
  // has its own honest `{ read: false }`; that page opens no read-limit scope.)
  /^event_wish_items$/,
];

/**
 * The `/rpc/…` reads that may be sent a second time (above). A POST could be a
 * write, so only functions that cannot write are named — each one is held
 * STABLE or IMMUTABLE in the replayed schema by
 * `tests/db/a-retried-guest-read-cannot-write.db.test.ts`. A guest-page RPC not
 * named here keeps its single wait; adding one is a reviewable line.
 */
export const RETRIED_RPCS: ReadonlyArray<string> = [
  'event_public_stamp', // the layout's and the page's first read — the 2026-10-19 lapse
  'event_entitlement_facts',
  'papic_guest_ceiling_spend',
  'papic_guest_share_weight',
  'papic_guest_spend_ceiling',
  'public_seat_lookup',
  'public_venue_scene',
  'visible_connection_names',
  'wall_visible_photos',
];

/** May this read be sent once more after it ran out its own limit? Essential reads only, never a write. */
export function isRetriedRead(what: string, method: string): boolean {
  if (isDecorationRead(what)) return false;
  if (method === 'GET' || method === 'HEAD') return true;
  return method === 'POST' && what.startsWith('rpc/') && RETRIED_RPCS.includes(what.slice('rpc/'.length));
}

export type ReadLapse = { what: string; essential: boolean; waitedMs: number };

type Scope = { route: string; lapsed: ReadLapse[]; deadline: number; readLimitMs: number };

const scopes = new AsyncLocalStorage<Scope>();

/**
 * One record per REQUEST, shared by every scope it opens (the metadata, the
 * layout, the page and its body each open one): one deadline, one list of
 * lapses. React's `cache()` is that per-request holder; outside a render (a
 * test) each call is its own, and the scope's own fields are what is used.
 */
const requestRecord = cache((): { lapsed: ReadLapse[]; deadline: number | null } => ({ lapsed: [], deadline: null }));
function shared(): { lapsed: ReadLapse[]; deadline: number | null } | null {
  try {
    const a = requestRecord();
    return a === requestRecord() ? a : null;
  } catch {
    return null;
  }
}

/** What one request is: its table (or rpc), and for `events` the columns it asked for. */
export function readName(url: string): string {
  try {
    const u = new URL(url);
    const table = u.pathname.replace(/^.*\/rest\/v1\//, '');
    if (table !== 'events') return table;
    const select = (u.searchParams.get('select') ?? '').replace(/\s+/g, '');
    return `events(${select})`;
  } catch {
    return 'unknown';
  }
}

export function isDecorationRead(what: string): boolean {
  return DECORATION_READS.some((re) => re.test(what));
}

function isLimitedRead(url: string, method: string): boolean {
  if (!url.includes('/rest/v1/')) return false;
  if (method === 'GET' || method === 'HEAD') return true;
  return method === 'POST' && url.includes('/rest/v1/rpc/');
}

/** The error a read past its limit ends with — an `AbortError`, so postgrest-js does not retry it. */
function limitError(what: string, waitedMs: number): Error {
  const e = new Error(`read limit: ${what} did not answer in ${Math.round(waitedMs)} ms`);
  e.name = 'AbortError';
  return e;
}

/**
 * `fetch`, with the bounded wait when — and only when — a guest read scope is
 * open and this is a read. Called by `createLoggingFetch`; nothing else should.
 */
export async function fetchWithinReadLimit(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
): Promise<Response> {
  const scope = scopes.getStore();
  if (!scope) return fetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  if (!isLimitedRead(url, method)) return fetch(input, init);

  const what = readName(url);
  const record = shared();
  const started = Date.now();
  if (record && record.deadline === null) record.deadline = scope.deadline;
  const deadline = record?.deadline ?? scope.deadline;
  const wait = Math.max(0, Math.min(scope.readLimitMs, deadline - started));

  const lapse = (): never => {
    const entry: ReadLapse = { what, essential: !isDecorationRead(what), waitedMs: Date.now() - started };
    scope.lapsed.push(entry);
    if (record && record.lapsed !== scope.lapsed) record.lapsed.push(entry);
    throw limitError(what, entry.waitedMs);
  };
  if (wait === 0) return lapse();

  const callers = init?.signal;
  /** One send with a bounded wait. `LAPSED` when — and only when — OUR limit ended it. */
  const attempt = async (ms: number): Promise<Response | typeof LAPSED> => {
    const limit = new AbortController();
    const timer = setTimeout(() => limit.abort(), ms);
    const signal = callers ? AbortSignal.any([callers, limit.signal]) : limit.signal;
    try {
      return await fetch(input, { ...init, signal });
    } catch (error) {
      if (limit.signal.aborted && !callers?.aborted) return LAPSED;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  const first = await attempt(wait);
  if (first !== LAPSED) return first;

  // 🔁 ONE MORE TRY (docblock): the read ran out its OWN limit, not the page's
  // budget; it is essential and cannot write; budget remains; it can be resent.
  const ranOutItsOwnLimit = wait >= scope.readLimitMs;
  const retryStarted = Date.now();
  const retryWait = Math.max(0, Math.min(scope.readLimitMs, deadline - retryStarted));
  if (!ranOutItsOwnLimit || retryWait === 0 || callers?.aborted || !isRetriedRead(what, method) || !canResend(input, init)) {
    return lapse();
  }
  const second = await attempt(retryWait);
  logRetry(scope.route, what, second !== LAPSED, retryStarted - started, Date.now() - retryStarted);
  if (second !== LAPSED) return second;
  return lapse();
}

const LAPSED = Symbol('read-limit:lapsed');

/** A body that a second send reads again unchanged — postgrest-js sends a string, or none. */
function canResend(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]): boolean {
  if (typeof input === 'object' && !(input instanceof URL) && input.body) return false;
  const body = init?.body;
  return body === undefined || body === null || typeof body === 'string';
}

/**
 * The retry, on its own call site — in the Vercel log (the repo's
 * `[supabase-query-error]` shape) and in Sentry, so how often a stall is
 * absorbed, and how often it is not, can be counted rather than guessed.
 */
function logRetry(route: string, what: string, recovered: boolean, firstMs: number, retryMs: number): void {
  const ctx = {
    call_site: 'read-limit:retry',
    severity: recovered ? 'graceful_degrade' : 'will_throw',
    error_code: 'READ_LIMIT_RETRY',
    error_message: recovered
      ? `${what} did not answer in ${Math.round(firstMs)} ms; one retry answered in ${Math.round(retryMs)} ms`
      : `${what} did not answer in ${Math.round(firstMs)} ms, nor on one retry (${Math.round(retryMs)} ms)`,
    route,
    what,
    recovered,
    first_ms: Math.round(firstMs),
    retry_ms: Math.round(retryMs),
  };
  try {
    console.error(`[supabase-query-error] ${JSON.stringify(ctx)}`);
  } catch {
    /* a log line never changes what the guest sees */
  }
  // Lazily, like `logQueryError` in the browser: this module sits under the one
  // fetch every Supabase client is built on, and must not import the SDK.
  void import('@sentry/nextjs').then(
    (S) =>
      S.captureMessage(`read-limit:retry ${recovered ? 'recovered' : 'did not recover'}: ${what}`, {
        level: recovered ? 'warning' : 'error',
        tags: { call_site: 'read-limit:retry', recovered: String(recovered), route },
        extra: ctx,
      }),
    () => {},
  );
}

/** An essential read of this request did not answer in time. The guest boundary says the honest words. */
export class GuestPageDidNotLoad extends Error {
  readonly lapsed: ReadLapse[];
  constructor(route: string, lapsed: ReadLapse[]) {
    super(`${route}: ${lapsed.map((l) => l.what).join(', ')} did not answer in time — the page is not shown as if it had`);
    this.name = 'GuestPageDidNotLoad';
    this.lapsed = lapsed;
  }
}

function essentialLapses(scope: Scope): ReadLapse[] {
  const all = [...scope.lapsed, ...(shared()?.lapsed ?? [])];
  return [...new Set(all)].filter((l) => l.essential);
}

function report(scope: Scope): void {
  if (scope.lapsed.length === 0) return;
  // The repo's `logQueryError(…, 'graceful_degrade')` shape, written here so this
  // module stays importable by the one fetch every Supabase client is built on.
  console.error(
    `[supabase-query-error] ${JSON.stringify({
      call_site: `read-limit:${scope.route}`,
      severity: scope.lapsed.some((l) => l.essential) ? 'will_throw' : 'graceful_degrade',
      error_code: 'READ_LIMIT',
      error_message: `${scope.lapsed.length} read(s) did not answer in time`,
      lapsed: scope.lapsed,
    })}`,
  );
}

type Limits = { readLimitMs?: number; pageBudgetMs?: number };

function open(route: string, limits: Limits): Scope {
  return {
    route,
    lapsed: [],
    deadline: Date.now() + (limits.pageBudgetMs ?? PAGE_BUDGET_MS),
    readLimitMs: limits.readLimitMs ?? READ_LIMIT_MS,
  };
}

/**
 * Run a guest page (or its body) with the bounded wait. If an ESSENTIAL read
 * did not answer, this throws `GuestPageDidNotLoad` — whatever `run` returned
 * or threw. A "not found", a redirect or an empty page decided from a read
 * that never answered is not the truth, and the guest is not told it.
 */
export async function withGuestReadLimit<T>(route: string, run: () => Promise<T>, limits: Limits = {}): Promise<T> {
  const scope = open(route, limits);
  try {
    const out = await scopes.run(scope, run);
    const missed = essentialLapses(scope);
    if (missed.length > 0) throw new GuestPageDidNotLoad(route, missed);
    return out;
  } catch (error) {
    if (error instanceof GuestPageDidNotLoad) throw error;
    const missed = essentialLapses(scope);
    if (missed.length > 0) throw new GuestPageDidNotLoad(route, missed);
    throw error;
  } finally {
    report(scope);
  }
}

/**
 * The same bounded wait for a part that must not be the one to throw — the
 * guest tree's layout (an error there lands on the app's boundary, not the
 * guest's) and the page's metadata. The lapse is still recorded for the
 * request, so the page itself says the honest words.
 */
export async function withGuestReadLimitQuiet<T>(route: string, run: () => Promise<T>, limits: Limits = {}): Promise<T> {
  const scope = open(route, limits);
  try {
    return await scopes.run(scope, run);
  } finally {
    report(scope);
  }
}
