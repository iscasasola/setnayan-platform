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
 * ─── IT DOES NOT MULTIPLY ────────────────────────────────────────────────────
 * postgrest-js retries a failed GET three times (1 s, 2 s, 4 s apart) — unless
 * the failure is an `AbortError`, which it rethrows at once. So the limit is
 * raised as an `AbortError`: one read, one wait, no retry. And because the
 * deadline is shared, a retry postgrest-js makes for some OTHER failure gives up
 * the moment it leaves late. Nothing on the guest path uses `withSchemaRetry`.
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
];

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

  const limit = new AbortController();
  const timer = setTimeout(() => limit.abort(), wait);
  const callers = init?.signal;
  const signal = callers ? AbortSignal.any([callers, limit.signal]) : limit.signal;
  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (limit.signal.aborted && !callers?.aborted) return lapse();
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
