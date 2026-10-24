/**
 * memories-page-reads.harness.ts — RUNS THE REAL MEMORIES PAGE, AND THEN THE
 * ALBUM SHELF IT DRAWS, AGAINST A DATABASE THAT COUNTS. Not a test:
 * `lib/the-memories-shelf-starts-with-the-wall.test.ts` runs this file in its
 * own process and reads the JSON it prints.
 *
 * Same stand-ins as `app/dashboard/[eventId]/guests/guests-page-reads.harness.ts`
 * (the shape this copies). One thing more: React draws `<AlbumShelf>` only once
 * the page function has returned, so the harness does the same — it awaits the
 * page, finds the shelf element in what it returned, and then runs the shelf.
 * The depth of that whole sequence is what a person waits for before the
 * Memories screen is complete.
 *
 * `MEMORIES_PAGE_READS_DELAY_MS=150` makes every answer take 150 ms.
 */
import Module from 'node:module';

type Resolve = (request: string, ...rest: unknown[]) => string;
type CjsModule = { filename: string; loaded: boolean; exports: unknown; paths: string[] };
const M = Module as unknown as {
  _resolveFilename: Resolve;
  _cache: Record<string, CjsModule>;
  new (id: string): CjsModule;
};
const resolveFilename = M._resolveFilename;

function stubModule(name: string, exports: unknown): string {
  const id = `/__memories_page_reads_stub__/${name}.js`;
  const mod = new M(id);
  mod.filename = id;
  mod.loaded = true;
  mod.exports = exports;
  mod.paths = [];
  M._cache[id] = mod;
  return id;
}

const DB = 'http://db.test';
const USER_ID = '00000000-0000-4000-8000-0000000000c1';
const EVENT_A = '00000000-0000-4000-8000-0000000000e1';
const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ACCESS = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: USER_ID, aud: 'authenticated', role: 'authenticated', exp: 4102444800, iat: 1760000000, email: 'me@setnayan.test', session_id: 'harness' })}.harness`;
const USER = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'me@setnayan.test', app_metadata: { provider: 'email' }, user_metadata: {}, is_anonymous: false, created_at: '2026-01-01T00:00:00Z' };
const SESSION = { access_token: ACCESS, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'harness-refresh', user: USER };
const COOKIES = [{ name: 'sb-db-auth-token', value: `base64-${Buffer.from(JSON.stringify(SESSION)).toString('base64url')}` }];
const jar = {
  get: (name: string) => COOKIES.find((c) => c.name === name),
  getAll: () => COOKIES,
  has: (name: string) => COOKIES.some((c) => c.name === name),
  set: () => undefined,
  delete: () => undefined,
};

const STUBS: Record<string, string> = {
  'server-only': stubModule('server-only', {}),
  'next/headers': stubModule('next-headers', {
    cookies: async () => jar,
    headers: async () => new Headers(),
    draftMode: async () => ({ isEnabled: false }),
  }),
};
M._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request in STUBS) return STUBS[request]!;
  if (/\.(css|scss)$/.test(request)) {
    return (STUBS['*.css'] ??= stubModule('css', new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : String(key)) })));
  }
  if (request === 'next/server') {
    const real = require(resolveFilename.call(this, request, ...rest)) as Record<string, unknown>;
    return (STUBS['next/server'] ??= stubModule('next-server', { ...real, after: () => undefined }));
  }
  return resolveFilename.call(this, request, ...rest);
} as Resolve;

let viewMemo = new Map<unknown, Array<{ args: unknown[]; value: unknown }>>();
const react = require('react') as { cache: unknown };
(globalThis as { React?: unknown }).React = react;
react.cache = <A extends unknown[], T>(fn: (...args: A) => T) =>
  (...args: A): T => {
    let slots = viewMemo.get(fn);
    if (!slots) viewMemo.set(fn, (slots = []));
    const hit = slots.find((s) => s.args.length === args.length && s.args.every((a, i) => Object.is(a, args[i])));
    if (hit) return hit.value as T;
    const value = fn(...args);
    slots.push({ args, value });
    return value;
  };

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = (require('node:async_hooks') as { AsyncLocalStorage: unknown }).AsyncLocalStorage;
const dataCache = new Map<string, unknown>();
(globalThis as { __incrementalCache?: unknown }).__incrementalCache = {
  isOnDemandRevalidate: false,
  async generateSimpleCacheKey(key: string) {
    return key;
  },
  async get(key: string) {
    const value = dataCache.get(key);
    return value ? { value, isStale: false } : null;
  },
  async set(key: string, value: unknown) {
    dataCache.set(key, value);
  },
};

process.env.NEXT_PUBLIC_SUPABASE_URL = DB;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'harness-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'harness-service-role-key';

// ── The counting database ─────────────────────────────────────────────────
const DELAY = Number(process.env.MEMORIES_PAGE_READS_DELAY_MS ?? 3);

type Sent = { step: number; what: string; key: string };
let sent: Sent[] = [];
let returned = 0;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const table = url.pathname.replace(/^\/rest\/v1\//, '');
  const select = url.searchParams.get('select') ?? '';
  const step = returned + 1;
  const who = String(headers.get('authorization') ?? '').includes('harness-service-role-key') ? 'service' : 'viewer';
  sent.push({ step, what: `${who === 'service' ? '[service] ' : ''}${url.pathname.startsWith('/auth/') ? url.pathname : table}(${select.slice(0, 50)})`, key: `${init?.method ?? 'GET'} ${who} ${url.pathname}${url.search}` });
  await new Promise((r) => setTimeout(r, DELAY));
  returned = Math.max(returned, step);
  const accept = headers.get('accept') ?? '';
  const json = (body: unknown, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...extra } });
  const rows = (list: unknown[]) => {
    if (accept.includes('vnd.pgrst.object')) return list.length ? json(list[0]) : json(null);
    const prefer = headers.get('prefer') ?? '';
    return json(list, prefer.includes('count=') ? { 'content-range': `0-${Math.max(list.length - 1, 0)}/${list.length}` } : {});
  };
  if (url.pathname.startsWith('/auth/v1/user')) return json(USER);
  if (url.pathname.startsWith('/auth/')) return json({});
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
  if (table.startsWith('rpc/')) return json(/count/.test(table) ? 0 : []);
  if (method !== 'GET') return json([]);
  if (table === 'users') return rows([{ user_id: USER_ID, display_name: 'Maria', email: USER.email, account_type: 'couple', is_internal: false, is_team_member: false, profile_photo_url: null, deleted_at: null }]);
  if (table === 'event_members') return rows([{ event_id: EVENT_A, member_type: 'couple', user_id: USER_ID, guest_id: null }]);
  if (table === 'events' || table === 'events_host')
    return rows([{ event_id: EVENT_A, public_id: 'S89E-0000000001', display_name: 'Maria & Jose', event_type: 'wedding', event_date: '2026-06-12', event_end_date: null, archived: false, slug: 'maria-and-jose', landing_page_visibility: 'public', monogram_text: 'M&J', timezone: 'Asia/Manila' }]);
  return rows([]);
}) as typeof fetch;

type ViewReport = { calls: number; depth: number; ms: number; steps: string[]; repeats: string[]; authReads: number; shelfDrawn: boolean };

async function main() {
  const { default: MemoriesPage } = await import('./page');
  // #6778 (Memories wears the Papic gallery): the shelf is gone — the page itself reads the albums beside the wall
  // (one `Promise.all`), so the page alone is the whole view.

  async function view(tab: string | undefined): Promise<ViewReport> {
    viewMemo = new Map();
    sent = [];
    returned = 0;
    const t0 = performance.now();
    await MemoriesPage({ searchParams: Promise.resolve(tab ? { tab } : {}) } as never);
    const keys = sent.map((s) => s.key);
    return {
      calls: sent.length,
      depth: Math.max(0, ...sent.map((s) => s.step)),
      ms: Math.round(performance.now() - t0),
      steps: sent.map((s) => `${s.step} ${s.what}`),
      repeats: [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))],
      authReads: sent.filter((s) => s.what.startsWith('/auth/v1/user')).length,
      shelfDrawn: sent.some((s) => /events\(event_id,slug/.test(s.what)),
    };
  }

  await view(undefined);
  const out = { defaultView: await view(undefined) };
  process.stdout.write(`MEMORIES_PAGE_READS ${JSON.stringify(out)}\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`MEMORIES_PAGE_READS_FAILED ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  },
);
