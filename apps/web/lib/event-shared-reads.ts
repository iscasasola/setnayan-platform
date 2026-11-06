import { cache } from 'react';
import { unstable_cache } from 'next/cache';

/**
 * apps/web/lib/event-shared-reads.ts — THE GUEST PAGE REMEMBERS WHAT EVERY
 * VIEWER SEES ALIKE, UNTIL THE EVENT CHANGES (event-day load, lane L3 ·
 * 2026-10-18).
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 * `/{slug}` re-read the same rows of one event on every view — 13 requests for
 * a stranger, 17–21 for an invited guest — while those rows change a few times
 * a day and hundreds of guests open the page in the hour of the event. The
 * owner, 2026-10-18: "make sure app will not collapse when a lot of users are
 * … connecting to the event". This settles PR #6454's open call ("Option A").
 *
 * ── HOW IT STAYS TRUE: THE STAMP ───────────────────────────────────────────
 * The database keeps one value per event, `event_public_revs.rev`, replaced at
 * the COMMIT of any write to a table listed in `SHARED_EVENT_TABLES` (migration
 * 20271275959355 — deferred triggers on each). Every view asks for it once
 * (`event_public_stamp(slug)`, inside `loadEventShell`), and every remembered
 * read is filed under it. A write → a new rev → the next view's key has never
 * been seen → it reads the database. Nothing is remembered "for a while": a
 * read is remembered for exactly as long as the rows it read are unchanged.
 *
 * ── WHAT MAY BE REMEMBERED: decided FROM THE REQUEST, never declared ───────
 * The service-role client's `fetch` (`lib/supabase/admin.ts`) asks
 * `sharedReadOf` about every request. It answers yes only when ALL hold:
 *   · the guest page opened this render for THIS event (`openSharedEventReads`
 *     — the page does it for a guest's or a stranger's view, never for the
 *     Maker's canvas or any host preview), and this render read its stamp;
 *   · it is a GET of a table in `SHARED_EVENT_TABLES`, filtered
 *     `event_id=eq.<that event>` — the rows of THAT event, all stamped;
 *   · every column it selects, filters on or orders by is stamped (all of a
 *     table's columns, except `guests`: `GUESTS_SHARED_COLUMNS` only — the
 *     trigger there fires only when one of those changes);
 *   · every embed is a stamped table joined by a key that includes `event_id`
 *     (`SAME_EVENT_EMBEDS`), and nothing is filtered on an embedded table;
 *   · no filter names a person (`VIEWER_FILTER_KEYS`) — a read about ONE guest
 *     is never remembered, even though its key would keep it theirs;
 *   · the default schema.
 * The key is the WHOLE request — URL, `accept`, `prefer`, `range` — plus the
 * event, the rev and the deployment. Two viewers share an answer only by asking
 * the byte-identical question about the same event at the same rev, which the
 * database answers identically for both (the service role sees no viewer).
 *
 * ⛔ NEVER REMEMBERED: anything this predicate does not accept — every RPC
 * (`event_entitlement_facts` included: a comp grant expires by the clock),
 * money (`orders`, `paparazzi_seats`, `papic_limited_snapshots` are not in the
 * list), the live day's announcement, every read about the viewer, every read
 * outside a render (a server action, a route handler, a job: the scope below
 * is per render and outside one it is always empty), and any answer that was
 * not a 2xx (a refusal is never filed).
 *
 * ⏱ `SHARED_READ_SECONDS` is NOT the freshness rule — the rev is. It is a
 * backstop: a write that somehow skipped its trigger (a hand-run statement
 * with triggers off) is still seen within that bound plus one view.
 *
 * Held by `lib/event-shared-reads.test.ts` (the predicate, the key, a refusal
 * is never filed), `lib/guest-page-reads.test.ts` (requests per view, and a
 * write seen by the very next view) and
 * `tests/db/the-guest-page-stamp-moves-with-every-shared-write.db.test.ts`
 * (every table here has its trigger; the `guests` columns are the WHEN list).
 */

/**
 * The tables whose EVERY write moves the stamp (migration 20271275959355).
 * Each row of each carries `event_id`. Adding one here without its trigger
 * fails the db test above — and without that test, a remembered read of it
 * would outlive the write that changed it.
 */
export const SHARED_EVENT_TABLES = [
  'events',
  'invitation_widgets',
  'event_editorial',
  'event_vendors',
  'event_recaps',
  'event_floor_plan',
  'event_schedule_blocks',
  'march_not_walking',
  'march_walks',
  'creator_chapters',
  'guests',
] as const;

/**
 * `guests` moves the stamp on insert, on delete, and on an update of THESE
 * columns only — so an RSVP, a face-tagging answer or a new avatar on the day
 * does not empty every guest's cache. A `guests` read naming any other column
 * is never remembered. The trigger's WHEN list must be exactly this set (the db
 * test reads it back from `pg_trigger`).
 */
export const GUESTS_SHARED_COLUMNS = [
  'event_id',
  'guest_id',
  'deleted_at',
  'display_name',
  'name_prefix',
  'first_name',
  'middle_name',
  'last_name',
  'name_suffix',
  'role',
  'extra_roles',
  'plus_one_of_guest_id',
  'couple_with_guest_id',
  'attire',
  'gender',
  // 🧍 The entourage prints "(represented by …)" (owner 2026-10-27) — the stamp watches the link (migration 20271292712479).
  'represented_by_guest_id',
] as const;

/**
 * The embeds that may ride inside a remembered read: `<table>><embedded>`. Only
 * pairs whose foreign key INCLUDES `event_id` — so every embedded row is the
 * same event's, and its writes move the same stamp. (`march_walks` → `guests`
 * by `(event_id, guest_id)`, migration 20271258783396.) Any other embed, even of
 * a stamped table, could pull in another event's row and is never remembered.
 */
export const SAME_EVENT_EMBEDS: ReadonlySet<string> = new Set(['guests>march_walks']);

/** A filter on any of these is a read about ONE person — never remembered. */
export const VIEWER_FILTER_KEYS: ReadonlySet<string> = new Set([
  'guest_id',
  'user_id',
  'person_id',
  'blocked_guest_id',
  'blocked_user_id',
  'viewer_id',
  'member_id',
  'created_by',
  'qr_token',
  'email',
  'mobile',
  'plus_one_of_guest_id',
  'couple_with_guest_id',
  'pair_with_guest_id',
  'represented_by_guest_id',
]);

/** The backstop (seconds) — see the docblock: the rev is the freshness rule, not this. */
export const SHARED_READ_SECONDS = 3600;

const SHARED = new Set<string>(SHARED_EVENT_TABLES);
const GUEST_COLUMNS = new Set<string>(GUESTS_SHARED_COLUMNS);
/** Query-string keys that are not filters. */
const NOT_FILTERS = new Set(['select', 'order', 'limit', 'offset']);
const IDENT = /^[a-z_][a-z0-9_]*$/;

/** Every column of a stamped table is stamped — except `guests`. */
function columnStamped(table: string, column: string): boolean {
  if (!SHARED.has(table) || !IDENT.test(column)) return false;
  return table === 'guests' ? GUEST_COLUMNS.has(column) : true;
}

/** Split at commas that are not inside (), {} or "". Null when unbalanced. */
function splitTop(text: string): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    if (quoted) continue;
    if (c === '(' || c === '{') depth += 1;
    else if (c === ')' || c === '}') {
      depth -= 1;
      if (depth < 0) return null;
    } else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (depth !== 0 || quoted) return null;
  parts.push(text.slice(start));
  return parts.map((p) => p.trim());
}

/**
 * Is every part of this `select` a stamped column of `table`, or an embed of a
 * stamped table whose own select passes the same test? `*` is every column —
 * accepted only where every column is stamped. Anything else (a JSON path, an
 * aggregate, a spread, a computed name this cannot read) → no.
 */
function selectStamped(table: string, select: string): boolean {
  const items = splitTop(select.replace(/\s+/g, ''));
  if (!items || items.length === 0) return false;
  for (const item of items) {
    if (item === '') return false;
    const body = item.includes(':') && !item.includes('::') ? item.slice(item.indexOf(':') + 1) : item.replace(/::[a-z_]+$/, '');
    if (body === '*') {
      if (table === 'guests') return false;
      continue;
    }
    const embed = /^([a-z_][a-z0-9_]*)(?:![a-z_][a-z0-9_]*)?\((.*)\)$/.exec(body);
    if (embed) {
      if (!SAME_EVENT_EMBEDS.has(`${table}>${embed[1]}`) || !selectStamped(embed[1]!, embed[2]!)) return false;
      continue;
    }
    if (!columnStamped(table, body)) return false;
  }
  return true;
}

/** The columns a PostgREST logic tree (`or=(a.eq.1,and(b.is.null,c.gt.2))`) names. Null when unreadable. */
function logicColumns(tree: string): string[] | null {
  const inner = /^\((.*)\)$/.exec(tree);
  if (!inner) return null;
  const parts = splitTop(inner[1]!);
  if (!parts) return null;
  const out: string[] = [];
  for (const part of parts) {
    const nested = /^(?:not\.)?(?:and|or)(\(.*\))$/.exec(part);
    if (nested) {
      const cols = logicColumns(nested[1]!);
      if (!cols) return null;
      out.push(...cols);
      continue;
    }
    const col = part.slice(0, part.indexOf('.'));
    if (!col || part.indexOf('.') < 0) return null;
    out.push(col);
  }
  return out;
}

/** Every `order` term is a stamped column of `table` (an embedded order → no). */
function orderStamped(table: string, order: string): boolean {
  const terms = order.split(',').map((t) => t.trim());
  return terms.every((t) => t !== '' && !t.includes('(') && columnStamped(table, t.split('.')[0]!));
}

export type SharedRead = {
  eventId: string;
  rev: number;
  /** The whole question: method, URL and the headers that change the answer. */
  key: string;
};

/**
 * The pure half: would THIS request, about THIS event at THIS rev, be
 * remembered? Exported for the test; the fetch below adds the render's scope.
 */
export function sharedReadFor(
  request: { method: string; url: string; headers: Headers },
  eventId: string,
  rev: number,
): SharedRead | null {
  if (request.method !== 'GET') return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  const match = /\/rest\/v1\/([a-z_][a-z0-9_]*)$/.exec(url.pathname);
  if (!match) return null;
  const table = match[1]!;
  if (!SHARED.has(table)) return null;
  const profile = request.headers.get('accept-profile');
  if (profile && profile !== 'public') return null;

  const select = url.searchParams.get('select') ?? '*';
  if (!selectStamped(table, select)) return null;
  for (const order of url.searchParams.getAll('order')) if (!orderStamped(table, order)) return null;
  for (const n of [...url.searchParams.getAll('limit'), ...url.searchParams.getAll('offset')]) {
    if (!/^\d+$/.test(n)) return null;
  }

  let scoped = false;
  for (const [key, value] of url.searchParams) {
    if (NOT_FILTERS.has(key)) continue;
    let columns: string[] | null;
    if (/^(?:not\.)?(?:and|or)$/.test(key)) columns = logicColumns(value);
    else if (IDENT.test(key)) columns = [key];
    else columns = null; // an embedded filter (`march.walk_no`) or anything unreadable
    if (!columns) return null;
    for (const column of columns) {
      if (VIEWER_FILTER_KEYS.has(column) || !columnStamped(table, column)) return null;
    }
    if (key === 'event_id') {
      if (value !== `eq.${eventId}`) return null;
      scoped = true;
    }
  }
  if (!scoped) return null;

  const h = (name: string) => request.headers.get(name) ?? '';
  return {
    eventId,
    rev,
    key: JSON.stringify(['GET', url.toString(), h('accept'), h('prefer'), h('range'), h('range-unit'), profile ?? '']),
  };
}

// ── The render's scope: which events this render may remember, at which rev ──

type Scope = { stamps: Map<string, number>; open: Set<string> };

/** One per server render. Outside a render (an action, a route, a job) a NEW, empty one on every call. */
const renderScope = cache((): Scope => ({ stamps: new Map(), open: new Set() }));
let testScope: Scope | null = null;
const scope = (): Scope => testScope ?? renderScope();

/** Called by `loadEventShell` with the stamp it just read — every guest-tree render reads it once. */
export function noteEventStamp(eventId: string, rev: number): void {
  if (eventId && Number.isSafeInteger(rev)) scope().stamps.set(eventId, rev);
}

/** This render's stamp for an event, or null (not read, or the database had none). */
export function eventStampOf(eventId: string): number | null {
  return scope().stamps.get(eventId) ?? null;
}

/**
 * The guest page — and only the guest page — opens its render to remembered
 * reads, for its own event, for a guest's or a stranger's view. Never the
 * Maker's canvas or a host preview (`hostAsksForCanvas`).
 */
export function openSharedEventReads(eventId: string): void {
  if (eventId) scope().open.add(eventId);
}

/**
 * The query words that make `/{slug}` a host's canvas or preview (`?editor=1`,
 * `?preview=draft`, a theme tile, a Stages miniature, "See as"…). Their mere
 * presence keeps the render out of the cache — verified host or not; it costs
 * a guest nothing, because a guest's link never carries them.
 */
export const HOST_ONLY_PARAMS = [
  'editor',
  'preview',
  'bars',
  'tabs',
  'only',
  'style',
  'theme',
  'palette',
  'board',
  'scene',
  'tool',
  'film',
  'phase',
  'as',
  'asrole',
] as const;

export function hostAsksForCanvas(search: Readonly<Record<string, unknown>> | undefined): boolean {
  return HOST_ONLY_PARAMS.some((p) => search?.[p] !== undefined);
}

/** The render-aware half: this request's remembered-read slot, or null. */
export function sharedReadOf(input: Parameters<typeof fetch>[0], init?: RequestInit): SharedRead | null {
  const s = scope();
  if (s.open.size === 0) return null;
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET') return null;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const scoped = /[?&]event_id=eq\.([0-9a-f-]{36})(?:&|$)/i.exec(url);
  if (!scoped) return null;
  const eventId = scoped[1]!;
  const rev = s.open.has(eventId) ? s.stamps.get(eventId) : undefined;
  if (rev === undefined) return null;
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return sharedReadFor({ method, url, headers }, eventId, rev);
}

// ── The data cache ─────────────────────────────────────────────────────────

/** Which build answered — a deploy follows every migration, so a new schema starts a new cache. */
const DEPLOY = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'local';

export const eventSharedTag = (eventId: string) => `event-shared:${eventId}`;

type Kept = { status: number; statusText: string; headers: Array<[string, string]>; body: string };
const KEPT_HEADERS = ['content-type', 'content-range', 'preference-applied'];

const toResponse = (k: Kept) => new Response(k.body, { status: k.status, statusText: k.statusText, headers: k.headers });

/**
 * `send` through the data cache under `[deploy, event, rev, key]`. Only a 2xx
 * is filed; any other answer is handed back as the database gave it, and the
 * next view asks again. If the cache itself cannot run (plain node, a test),
 * the request is simply sent — the cache can never be the reason a read
 * failed.
 */
export async function rememberedEventRead<T>(
  slot: { eventId: string; rev: number; key: string },
  send: () => Promise<T>,
  keep: (value: T) => boolean,
  encode: (value: T) => Promise<unknown> | unknown = (v) => v,
  decode: (stored: unknown) => T = (v) => v as T,
): Promise<T> {
  let direct: { value: T } | null = null;
  let sent = false;
  const remembered = unstable_cache(
    async () => {
      sent = true;
      const value = await send();
      direct = { value };
      if (!keep(value)) throw NOT_KEPT;
      return encode(value);
    },
    ['event-shared-read', DEPLOY, slot.eventId, String(slot.rev), slot.key],
    { revalidate: SHARED_READ_SECONDS, tags: [eventSharedTag(slot.eventId)] },
  );
  try {
    const stored = await remembered();
    // A hit never ran `send`; a miss hands back the very value it read.
    return direct ? (direct as { value: T }).value : decode(stored);
  } catch (error) {
    if (direct) return (direct as { value: T }).value;
    if (sent) throw error; // `send` itself threw — exactly as an unremembered read would have
    return send(); // the cache machinery could not run
  }
}
const NOT_KEPT = new Error('event-shared-read: not a value to keep');

/** The admin client's `fetch`, remembering what `sharedReadOf` accepts. */
export function withSharedEventReads(inner: typeof fetch): typeof fetch {
  return async function sharedEventReadFetch(input, init) {
    let slot: SharedRead | null = null;
    try {
      slot = sharedReadOf(input, init);
    } catch {
      slot = null;
    }
    if (!slot) return inner(input, init);
    // A Response can be read once: a hit or a fresh miss each hand back their own.
    const kept = await rememberedEventRead<Kept | Response>(
      slot,
      async () => {
        const res = await inner(input, init);
        if (!res.ok) return res;
        return {
          status: res.status,
          statusText: res.statusText,
          headers: KEPT_HEADERS.flatMap((h) => {
            const v = res.headers.get(h);
            return v === null ? [] : [[h, v] as [string, string]];
          }),
          body: await res.text(),
        };
      },
      (v) => !(v instanceof Response),
    );
    return kept instanceof Response ? kept : toResponse(kept);
  } as typeof fetch;
}

/** TEST ONLY — run `fn` as one render: its stamps and opened events last for its duration. */
export async function withSharedReadScopeForTest<T>(fn: () => Promise<T>): Promise<T> {
  const before = testScope;
  testScope = { stamps: new Map(), open: new Set() };
  try {
    return await fn();
  } finally {
    testScope = before;
  }
}
