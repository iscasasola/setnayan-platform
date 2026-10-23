/**
 * editorial-reads.harness.ts — RUNS THE REAL POST EVENT STORY (`EditorialContent` and the loader under it,
 * `loadEditorialData`) AGAINST A DATABASE THAT COUNTS. Not a test: `the-story-reads-start-together.test.ts`
 * runs this file in its own process and reads the JSON it prints.
 *
 * Why it exists (production, 2026-10-23): the guest page on Post Event took 3.7–3.9 s for the couple's
 * Maker canvas and ~2.3 s for a guest, while the page's own timer (`slug/invitation-body`) said 0.13–0.36 s —
 * the rest was this component, which reads while it renders, outside that timer.
 *
 * Same stand-ins as `app/dashboard/[eventId]/launch/maker-page-reads.harness.ts` (the shape this copies). The
 * fixture is one wedding whose day has passed, its story SHARED with the event, seen by its host and by a guest.
 * Depth is the longest chain of database trips each waiting for the one before; `STORY_READS_DELAY_MS=150`
 * makes every answer take 150 ms and `ms` the simulated wait; `STORY_READS_WHO=1` names who sent each request.
 *
 * ⚠ THE STAND-IN ANSWERS ONE ROW FOR AN EVENT AND ITS STORY AND NOTHING ELSE, so branches that need photos,
 * clips or guests are skipped here — what it measures is the ORDER the reads leave in, which is the same
 * either way. Fewer reads than production, never a different order.
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
  const id = `/__story_reads_stub__/${name}.js`;
  const mod = new M(id);
  mod.filename = id;
  mod.loaded = true;
  mod.exports = exports;
  mod.paths = [];
  M._cache[id] = mod;
  return id;
}

const DB = 'http://db.test';
const EVENT_ID = '00000000-0000-4000-8000-0000000000e2';
const jar = { get: () => undefined, getAll: () => [], has: () => false, set: () => undefined, delete: () => undefined };

const STUBS: Record<string, string> = {
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

// ── Next's data cache (`unstable_cache`) ────────────────────────────────────
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
process.env.R2_ACCOUNT_ID ??= 'harness0account';
process.env.R2_ACCESS_KEY_ID ??= 'harness-key';
process.env.R2_SECRET_ACCESS_KEY ??= 'harness-secret';

// ── The counting database ─────────────────────────────────────────────────
const DELAY = Number(process.env.STORY_READS_DELAY_MS ?? 3);
const EVENT: Record<string, unknown> = {
  event_id: EVENT_ID, id: 2, slug: 'tala-and-migo', display_name: 'Tala & Migo', event_type: 'wedding',
  event_date: '2026-09-11', event_end_date: null, timezone: 'Asia/Manila', venue_name: 'Manila Cathedral',
  venue_address: 'Intramuros, Manila', monogram_text: 'TM', monogram_color: '#C5A059', love_story: {},
  special_message: null, together_since: null, story_tone: null, role_palette: {}, ceremony_type: 'catholic',
};
const EDITORIAL: Record<string, unknown> = {
  status: 'event', draft_json: {}, impact_metrics: {}, editorial_tone: null, hero_photo_id: null,
  essay_photo_ids: [], generated_at: '2026-09-12T00:00:00Z', published_at: null, edition_volume: null, edition_no: null,
};
type Sent = { step: number; what: string };
let sent: Sent[] = [];
let returned = 0;
function whoAsked(): string {
  const holder: { stack?: string } = {};
  Error.stackTraceLimit = 60;
  Error.captureStackTrace(holder);
  return (holder.stack ?? '').split('\n').filter((l) => /apps\/web\/(lib|app)\//.test(l) && !/editorial-reads\.harness|db-error-log|read-limit/.test(l))
    .slice(0, 2).map((l) => l.replace(/^\s*at (async )?/, '').replace(/\(?[^() ]*apps\/web\//, '(').replace(/:\d+\)?$/, ')')).join(' ← ');
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
  const step = returned + 1;
  sent.push({ step, what: `${url.pathname.startsWith('/auth/') ? url.pathname : table}(${select.slice(0, 50)})${process.env.STORY_READS_WHO ? `  ← ${whoAsked()}` : ''}` });
  await new Promise((r) => setTimeout(r, DELAY));
  returned = Math.max(returned, step);
  const accept = headers.get('accept') ?? '';
  const json = (body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...extra } });
  const rows = (list: Record<string, unknown>[]) => {
    const shaped = list.map((r) => project(r, select));
    if (accept.includes('vnd.pgrst.object')) return json(shaped[0] ?? null);
    const prefer = headers.get('prefer') ?? '';
    return json(shaped, prefer.includes('count=') ? { 'content-range': `0-${Math.max(shaped.length - 1, 0)}/${shaped.length}` } : {});
  };
  if (url.pathname.startsWith('/auth/')) return json({});
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
  if (table.startsWith('rpc/')) return json(/count/.test(table) ? 0 : null);
  if (method !== 'GET') return json([]);
  if (table === 'events' || table === 'events_host') return rows([EVENT]);
  if (table === 'event_editorial') return rows([EDITORIAL]);
  return rows([]);
}) as typeof fetch;

type ViewReport = { calls: number; depth: number; ms: number; steps: string[] };

async function main() {
  const { EditorialContent } = await import('./editorial-content');
  async function view(viewer: { isHost: boolean; belongsToEvent: boolean }, hostPreview: boolean): Promise<ViewReport> {
    viewMemo = new Map();
    dataCache.clear();
    sent = [];
    returned = 0;
    const t0 = performance.now();
    await EditorialContent({ eventId: EVENT_ID, viewer, hostPreview, makerMarkers: hostPreview } as never);
    return {
      calls: sent.length,
      depth: Math.max(0, ...sent.map((s) => s.step)),
      ms: Math.round(performance.now() - t0),
      steps: sent.map((s) => `${s.step} ${s.what}`),
    };
  }
  await view({ isHost: true, belongsToEvent: true }, true);
  const host = await view({ isHost: true, belongsToEvent: true }, true);
  const guest = await view({ isHost: false, belongsToEvent: true }, false);
  /* A passer-by: the fixture's story is shared with the EVENT only, so the one gate turns them away — and
     nothing past the gate may have been started for them. */
  const stranger = await view({ isHost: false, belongsToEvent: false }, false);
  process.stdout.write(`STORY_READS ${JSON.stringify({ host, guest, stranger })}\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
