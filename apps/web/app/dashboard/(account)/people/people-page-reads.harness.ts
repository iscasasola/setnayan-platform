/**
 * people-page-reads.harness.ts — RUNS THE REAL PEOPLE ROSTER AND PAGE AGAINST A
 * DATABASE THAT COUNTS. Not a test: `the-people-roster-reads-together.test.ts`
 * runs this file in its own process and reads the JSON it prints.
 *
 * Same stand-ins as `app/dashboard/[eventId]/guests/guests-page-reads.harness.ts`
 * (the shape this copies): `server-only` → an empty module, `next/headers` → one
 * signed-in person's cookie jar, React's `cache` → one memo per view, Next's
 * data cache → a map, and the database's HTTP door (`fetch`) → a stand-in that
 * answers every table and records how DEEP each request ran (a request that
 * left only after another came back is one step further down). Depth is what
 * the person waits for before the People screen can be drawn.
 *
 * The fixture is one person with every branch the roster has: a confirmed
 * partner (the "do we share an event?" read), a request to me sent from an
 * event (the event-name read), a friend, a samahan they organise, and a loved
 * one in their care — so every read the roster can make is made.
 *
 * `PEOPLE_PAGE_READS_DELAY_MS=150` makes every answer take 150 ms; the report's
 * `ms` is then the simulated wait.
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
  const id = `/__people_page_reads_stub__/${name}.js`;
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
const ME = 'p-me';
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
// Both People flags are ON in production (read 2026-09-21, recorded on the page).
process.env.NEXT_PUBLIC_PEOPLE_CONNECTIONS = '1';
process.env.NEXT_PUBLIC_DEPENDENT_PEOPLE = '1';

// ── The counting database ─────────────────────────────────────────────────
const DELAY = Number(process.env.PEOPLE_PAGE_READS_DELAY_MS ?? 3);
const OTHER_USER = { 'p-ana': 'u-ana', 'p-ben': 'u-ben', 'p-cai': 'u-cai' } as const;
const CONNECTIONS = [
  { connection_id: 'c-partner', relation: 'partner', proposed_relation: null, proposed_status: null, status: 'confirmed', declared_name: 'Ana', from_person_id: ME, to_person_id: 'p-ana', created_by_event_id: null },
  { connection_id: 'c-asked', relation: 'friend', proposed_relation: null, proposed_status: null, status: 'pending', declared_name: 'You', from_person_id: 'p-ben', to_person_id: ME, created_by_event_id: 'e-1' },
  { connection_id: 'c-friend', relation: 'friend', proposed_relation: null, proposed_status: null, status: 'confirmed', declared_name: 'Cai', from_person_id: ME, to_person_id: 'p-cai', created_by_event_id: null },
];

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
  sent.push({ step, what: `${who === 'service' ? '[service] ' : ''}${table}(${select.slice(0, 50)})`, key: `${init?.method ?? 'GET'} ${who} ${url.pathname}${url.search}` });
  await new Promise((r) => setTimeout(r, DELAY));
  returned = Math.max(returned, step);
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.pathname.startsWith('/auth/v1/user')) return json(USER);
  if (url.pathname.startsWith('/auth/')) return json({});
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
  const q = url.search;
  const accept = headers.get('accept') ?? '';
  const one = (row: unknown) => json(accept.includes('vnd.pgrst.object') ? row : [row]);
  switch (table) {
    case 'rpc/visible_connection_names':
      return json([
        { person_id: 'p-ana', display_name: 'Ana Reyes' },
        { person_id: 'p-ben', display_name: 'Ben Cruz' },
        { person_id: 'p-cai', display_name: 'Cai Santos' },
      ]);
    case 'rpc/connection_request_events':
      return json([{ connection_id: 'c-asked', event_name: 'Ben & Lea', event_type: 'wedding' }]);
    case 'rpc/current_spouse_user_ids':
      return json([]);
    case 'people':
      if (who === 'viewer') return one({ person_id: ME });
      return json(Object.entries(OTHER_USER).map(([person_id, claimed_by_user_id]) => ({ person_id, claimed_by_user_id })));
    case 'person_connections':
      return json(CONNECTIONS);
    case 'community_members':
      if (q.includes('user_id=eq.')) return json([{ community_id: 'k-1', role: 'organizer' }]);
      return json([
        { community_id: 'k-1', user_id: USER_ID },
        { community_id: 'k-1', user_id: 'u-cai' },
      ]);
    case 'communities':
      return json([{ community_id: 'k-1', name: 'Barkada', archived: false }]);
    case 'event_members':
      if (who === 'service') return json([{ event_id: 'e-9', user_id: USER_ID }, { event_id: 'e-9', user_id: 'u-ana' }]);
      return json([]);
    case 'data_privacy_controls':
      return json([{ control_key: 'dependent_minor_profiles', status: 'active' }]);
    case 'dependents':
      return json([{ dependent_id: 'd-1', name: 'Lola Nena', relationship: 'grandparent', dependent_kind: 'person', handed_over_at: null, owner_user_id: USER_ID, handed_over_by_user_id: null, shared_with_spouse: false }]);
    case 'users':
      return one({ civil_status: 'single' });
    default:
      return json([]);
  }
}) as typeof fetch;

type ViewReport = { calls: number; depth: number; ms: number; steps: string[]; repeats: string[] };

async function main() {
  const { getPeopleRoster } = await import('@/lib/people-roster');
  const { default: PeoplePage } = await import('./page');

  async function view<T>(run: () => Promise<T>): Promise<ViewReport & { value: T }> {
    viewMemo = new Map();
    sent = [];
    returned = 0;
    const t0 = performance.now();
    const value = await run();
    const keys = sent.map((s) => s.key);
    return {
      value,
      calls: sent.length,
      depth: Math.max(0, ...sent.map((s) => s.step)),
      ms: Math.round(performance.now() - t0),
      steps: sent.map((s) => `${s.step} ${s.what}`),
      repeats: [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))],
    };
  }

  // Warm the remembered platform reads once (production finds them warm).
  await view(() => getPeopleRoster(USER_ID));
  const roster = await view(() => getPeopleRoster(USER_ID));
  const page = await view(() => PeoplePage({ searchParams: Promise.resolve({ view: 'connected' }) } as never));
  const out = {
    roster: { ...roster, value: undefined },
    /** What the roster handed the screen — the proof that only WHEN moved. */
    rosterShape: {
      people: roster.value.people.map((p) => [p.kind, p.name, p.state, p.relation, p.sharesAnEvent, p.fromEvent?.name ?? null, p.samahan.join('|'), p.careLabel]),
      mySamahan: roster.value.mySamahan,
      counts: roster.value.counts,
      samahanUnavailable: roster.value.samahanUnavailable,
      connectionsUnavailable: roster.value.connectionsUnavailable,
    },
    page: { ...page, value: undefined },
  };
  process.stdout.write(`PEOPLE_PAGE_READS ${JSON.stringify(out)}\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`PEOPLE_PAGE_READS_FAILED ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  },
);
