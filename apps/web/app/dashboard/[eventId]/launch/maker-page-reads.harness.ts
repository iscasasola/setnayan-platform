/**
 * maker-page-reads.harness.ts — RUNS THE REAL EVENT HUB MAKER PAGE (and then the
 * editor page it mounts, as React draws it after the page returns) AGAINST A
 * DATABASE THAT COUNTS. Not a test: `the-maker-reads-start-together.test.ts`
 * runs this file in its own process and reads the JSON it prints.
 *
 * Same stand-ins as `../guests/guests-page-reads.harness.ts` (the shape this
 * copies). The fixture is one couple on a wedding with the new Maker (Stages |
 * Studio) on, as production runs it — here through the internal viewer, the other door
 * `makerStagesStudioEnabled` opens, so no second module reads the flag.
 * Depth is the longest chain of database trips each waiting for the one before;
 * `MAKER_PAGE_READS_DELAY_MS=150` makes every answer take 150 ms and `ms` the
 * simulated wait; `MAKER_PAGE_READS_WHO=1` names who sent each request.
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

/** A module that exists only in memory, under a name nothing else can collide with. */
function stubModule(name: string, exports: unknown): string {
  const id = `/__maker_page_reads_stub__/${name}.js`;
  const mod = new M(id);
  mod.filename = id;
  mod.loaded = true;
  mod.exports = exports;
  mod.paths = [];
  M._cache[id] = mod;
  return id;
}

// ── The signed-in couple, and the cookie jar that carries their session ────
const DB = 'http://db.test';
const EVENT_ID = '00000000-0000-4000-8000-0000000000e1';
const USER_ID = '00000000-0000-4000-8000-0000000000c1';
const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ACCESS = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: USER_ID, aud: 'authenticated', role: 'authenticated', exp: 4102444800, iat: 1760000000, email: 'couple@setnayan.test', session_id: 'harness' })}.harness`;
const USER = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'couple@setnayan.test', app_metadata: { provider: 'email' }, user_metadata: {}, is_anonymous: false, created_at: '2026-01-01T00:00:00Z' };
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
  // A font is a bundler's import: every face is an empty class name here.
  'next/font/local': stubModule('next-font-local', Object.assign(() => ({ className: '', variable: '', style: {} }), { default: () => ({ className: '', variable: '', style: {} }) })),
  'next/font/google': stubModule('next-font-google', new Proxy({}, { get: (_, key) => (key === '__esModule' ? true : () => ({ className: '', variable: '', style: {} })) })),
  'server-only': stubModule('server-only', {}),
  'next/headers': stubModule('next-headers', {
    cookies: async () => jar,
    headers: async () => new Headers(),
    draftMode: async () => ({ isEnabled: false }),
  }),
};
M._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request in STUBS) return STUBS[request]!;
  // A CSS module is a bundler's import: every class name is itself.
  if (/\.(css|scss)$/.test(request)) {
    return (STUBS['*.css'] ??= stubModule('css', new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : String(key)) })));
  }
  if (request === 'next/server') {
    const real = require(resolveFilename.call(this, request, ...rest)) as Record<string, unknown>;
    return (STUBS['next/server'] ??= stubModule('next-server', { ...real, after: () => undefined }));
  }
  return resolveFilename.call(this, request, ...rest);
} as Resolve;

// ── One memo per view, standing in for React's per-request cache() ─────────
let viewMemo = new Map<unknown, Array<{ args: unknown[]; value: unknown }>>();
const react = require('react') as { cache: unknown };
// The page's JSX compiles to `React.createElement` here (classic runtime under tsx).
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

// ── Next's data cache (`unstable_cache`), as the guest harness stands it in ──
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
// Object storage is signed locally (HMAC); these only shape the URLs.
process.env.R2_ACCOUNT_ID ??= 'harness0account';
process.env.R2_ACCESS_KEY_ID ??= 'harness-key';
process.env.R2_SECRET_ACCESS_KEY ??= 'harness-secret';

// ── The counting database ─────────────────────────────────────────────────
const DELAY = Number(process.env.MAKER_PAGE_READS_DELAY_MS ?? 3);
const EVENT: Record<string, unknown> = {
  event_id: EVENT_ID, id: 1, public_id: 'S89E-0000000001', display_name: 'Maria & Jose', event_date: '2027-06-12',
  event_end_date: null, event_date_precision: 'day', archived: false, event_type: 'wedding', ceremony_type: 'catholic',
  slug: 'maria-and-jose', timezone: 'Asia/Manila', cleared_at: null, role_palette: {}, estimated_pax: 120,
  landing_page_visibility: 'public', planning_mode: 'self', std_invitation_launch_date: null, invite_theme: 'classic',
  print_details: {}, special_message: null, pabuya_message: null, rsvp_ask_config: null, style_preferences: null,
  love_story: null, mood_feel_key: null, launch_mode: 'manual', manual_phase: null,
};
type Sent = { step: number; what: string; key: string; by?: string; late?: boolean };
let sent: Sent[] = [];
/* Two lanes since the tools arrive behind the Maker (`makerLateWork` in `./page.tsx`): the CANVAS's — the page,
   then its editor — and the TOOLS', which runs beside it. One counter for both would add a trip of one lane to
   the other's depth; each lane counts its own, the tools' starting from where the canvas's stood when it began. */
let returned = 0;
let returnedLate = 0;
let lateBase: number | null = null;
function inLateLane(): boolean {
  const holder: { stack?: string } = {};
  Error.stackTraceLimit = 60;
  Error.captureStackTrace(holder);
  return /makerLateWork/.test(holder.stack ?? '');
}
function whoAsked(): string {
  const holder: { stack?: string } = {};
  Error.stackTraceLimit = 60;
  Error.captureStackTrace(holder);
  return (holder.stack ?? '').split('\n').filter((l) => /apps\/web\/(lib|app)\//.test(l) && !/maker-page-reads\.harness|db-error-log|read-limit/.test(l))
    .slice(0, 3).map((l) => l.replace(/^\s*at (async )?/, '').replace(/\(?[^() ]*apps\/web\//, '(').replace(/:\d+\)?$/, ')')).join(' ← ');
}
function project(row: Record<string, unknown>, select: string): Record<string, unknown> {
  if (!select || select.includes('*') || select.includes('(')) return row;
  return Object.fromEntries(select.split(',').map((c) => c.trim()).filter(Boolean).map((c) => [c, row[c] ?? null]));
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const table = url.pathname.replace(/^\/rest\/v1\//, '');
  const select = url.searchParams.get('select') ?? '';
  const late = inLateLane();
  if (late && lateBase === null) lateBase = returned;
  const step = (late ? Math.max(lateBase ?? 0, returnedLate) : returned) + 1;
  const who = String(headers.get('authorization') ?? '').includes('harness-service-role-key') ? 'service' : 'viewer';
  sent.push({ step, what: `${who === 'service' ? '[service] ' : ''}${url.pathname.startsWith('/auth/') ? url.pathname : table}(${select.slice(0, 50)})`, key: `${init?.method ?? 'GET'} ${who} ${url.pathname}${url.search}`, ...(late ? { late: true } : {}), ...(process.env.MAKER_PAGE_READS_WHO ? { by: whoAsked() } : {}) });
  await new Promise((r) => setTimeout(r, DELAY));
  if (late) returnedLate = Math.max(returnedLate, step);
  else returned = Math.max(returned, step);
  const accept = headers.get('accept') ?? '';
  const json = (body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...extra } });
  const rows = (list: Record<string, unknown>[]) => {
    const shaped = list.map((r) => project(r, select));
    if (accept.includes('vnd.pgrst.object')) return json(shaped[0] ?? null);
    const prefer = headers.get('prefer') ?? '';
    return json(shaped, prefer.includes('count=') ? { 'content-range': `0-${Math.max(shaped.length - 1, 0)}/${shaped.length}` } : {});
  };
  if (url.pathname.startsWith('/auth/v1/user')) return json(USER);
  if (url.pathname.startsWith('/auth/')) return json({});
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
  if (table === 'rpc/event_entitlement_facts') return json({ orders: [], comp_skus: [], host_internal: false, founder_seat: false, basket: [] });
  if (table.startsWith('rpc/')) return json(/count/.test(table) ? 0 : /skus|granting/.test(table) ? [] : null);
  if (method !== 'GET') return json([]);
  if (table === 'events' || table === 'events_host') return rows([EVENT]);
  if (table === 'event_members') return rows([{ event_id: EVENT_ID, user_id: USER_ID, member_type: 'couple', guest_id: null }]);
  if (table === 'users') return rows([{ user_id: USER_ID, display_name: 'Maria', email: USER.email, account_type: 'couple', is_internal: true, is_team_member: false, tour_seen_keys: [], deleted_at: null }]);
  return rows([]);
}) as typeof fetch;

type ViewReport = {
  calls: number;
  /** The canvas's lane: the page, then its editor — what a couple waits for before the canvas can load. */
  depth: number;
  ms: number;
  steps: string[];
  repeats: string[];
  editorDrawn: boolean;
  pageDepth: number;
  /** ⚡ The tools' lane (`makerLateWork`), running beside the canvas's: its depth, and the time until it is in too. */
  lateDepth: number;
  lateCalls: number;
  allMs: number;
};

function findEl(tree: unknown, type: unknown, seen = new Set<unknown>()): { props: Record<string, unknown> } | null {
  if (!tree || typeof tree !== 'object' || seen.has(tree)) return null;
  seen.add(tree);
  if (Array.isArray(tree)) {
    for (const t of tree) { const hit = findEl(t, type, seen); if (hit) return hit; }
    return null;
  }
  const el = tree as { type?: unknown; props?: Record<string, unknown> };
  if (el.type === type && el.props) return el as { props: Record<string, unknown> };
  if (!el.props) return null;
  for (const v of Object.values(el.props)) { const hit = findEl(v, type, seen); if (hit) return hit; }
  return null;
}

async function main() {
  const { default: LaunchHubPage } = await import('./page');
  const { default: WebsiteEditorPage } = await import('../website/editor/page');
  const { MakerShell } = await import('./_components/maker-shell');
  async function view(): Promise<ViewReport> {
    viewMemo = new Map();
    sent = [];
    returned = 0;
    returnedLate = 0;
    lateBase = null;
    const t0 = performance.now();
    const tree = await LaunchHubPage({ params: Promise.resolve({ eventId: EVENT_ID }), searchParams: Promise.resolve({}) } as never);
    const pageDepth = returned;
    const editor = findEl(tree, WebsiteEditorPage);
    if (editor) {
      try { await (WebsiteEditorPage as (p: never) => Promise<unknown>)(editor.props as never); }
      catch (error) { const d = String((error as { digest?: unknown })?.digest ?? ''); if (!d.startsWith('NEXT_REDIRECT')) throw error; }
    }
    const ms = Math.round(performance.now() - t0);
    const canvas = sent.filter((s) => !s.late);
    /* The tools' lane is awaited too, so its reads are counted here and never spill into the next view. */
    const late = findEl(tree, MakerShell)?.props.late as Promise<unknown> | null | undefined;
    if (late) await late;
    const lateSent = sent.filter((s) => s.late);
    const keys = sent.map((s) => s.key);
    return {
      calls: sent.length, depth: Math.max(0, ...canvas.map((s) => s.step)), ms, pageDepth,
      lateDepth: Math.max(0, ...lateSent.map((s) => s.step)), lateCalls: lateSent.length, allMs: Math.round(performance.now() - t0),
      steps: sent.map((s) => `${s.late ? 'L' : ''}${s.step} ${s.what}${s.by ? `  ← ${s.by}` : ''}`), repeats: [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))], editorDrawn: Boolean(editor),
    };
  }
  await view();
  process.stdout.write(`MAKER_PAGE_READS ${JSON.stringify({ maker: await view() })}\n`);
}
main().then(() => process.exit(0), (error) => { process.stderr.write(`MAKER_PAGE_READS_FAILED ${error instanceof Error ? error.stack : String(error)}\n`); process.exit(1); });
