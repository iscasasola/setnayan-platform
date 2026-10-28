/**
 * guests-page-reads.harness.ts — RUNS THE COUPLE'S REAL GUESTS PAGE (and the
 * event layout around it) AGAINST A DATABASE THAT COUNTS. Not a test:
 * `the-guests-page-asks-once.test.ts` runs this file in its own process and
 * reads the JSON it prints.
 *
 * ── WHAT IT CALLS ──────────────────────────────────────────────────────────
 * The page's own default export (`GuestsPage`) and the layout's
 * (`EventLayout`) — the real functions, not a mirror of them — with the three
 * things a plain node process lacks stood in for BEFORE they are imported:
 *   · `server-only` → an empty module (a bundler marker), and a CSS module →
 *     its own class names;
 *   · `next/headers` → a cookie jar holding one signed-in couple's session,
 *     and empty request headers (`next/server`'s `after` → a no-op);
 *   · `react`'s `cache` → a memo that lasts one "view", the one-answer-per-
 *     request the page gets in production (`lib/request-once.ts` and
 *     `lib/event-row-once.ts` are built on it).
 * Then the database's HTTP door (`fetch` — PostgREST and the auth server) is a
 * stand-in that answers every table and counts every request, and how DEEP it
 * ran: a request that left only after another came back is one step further
 * down. Depth is what the couple waits for before the first name is drawn —
 * the page's function resolves exactly when every read its list needs is in.
 *
 * ⚠ WHAT IT DOES NOT SEE: the components the layout RENDERS (the rail, the
 * co-host card) — those are counted by the lab walk named in the test — and
 * the session check in `middleware.ts`, which verifies the token locally.
 *
 * `GUESTS_PAGE_READS_DELAY_MS=150` makes every answer take 150 ms and adds the
 * wall time of each view — the "simulated time to first names" in the PR.
 * `GUESTS_PAGE_READS_WHO=1` names who sent each request.
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
  const id = `/__guests_page_reads_stub__/${name}.js`;
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

// ── The counting database ─────────────────────────────────────────────────
const DELAY = Number(process.env.GUESTS_PAGE_READS_DELAY_MS ?? 3);
const EVENT: Record<string, unknown> = {
  event_id: EVENT_ID,
  public_id: 'S89E-0000000001',
  display_name: 'Maria & Jose',
  event_date: '2027-06-12',
  event_end_date: null,
  event_date_precision: 'day',
  archived: false,
  event_type: 'wedding',
  ceremony_type: 'catholic',
  slug: 'maria-and-jose',
  timezone: 'Asia/Manila',
  cleared_at: null,
  role_palette: {},
  estimated_pax: 120,
  landing_page_visibility: 'public',
};
const FIRST = ['Ana', 'Ben', 'Carla', 'Dino', 'Ella', 'Felix'];
const GUESTS = FIRST.map((first, i) => ({
  guest_id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  public_id: `S89G-${String(i + 1).padStart(10, '0')}`,
  event_id: EVENT_ID,
  first_name: first,
  last_name: 'Reyes',
  name_prefix: null,
  middle_name: null,
  name_suffix: null,
  pair_with_guest_id: null,
  display_name: null,
  side: i % 2 ? 'bride' : 'groom',
  group_category: 'friends',
  role: i === 0 ? 'bride' : i === 1 ? 'groom' : 'guest',
  extra_roles: [],
  plus_one_allowed: false,
  plus_one_count: 0,
  plus_one_name: null,
  plus_one_of_guest_id: null,
  plus_one_mode: null,
  email: null,
  mobile: null,
  meal_preference: null,
  dietary_restrictions: null,
  photo_consent: true,
  faceblock_enabled: false,
  face_recognition_excluded: false,
  photo_url: null,
  photo_source: null,
  photo_updated_at: null,
  invited_to_blocks: [],
  rsvp_status: 'pending',
  notes: null,
  guest_note: null,
  qr_token: `qr${i}`,
  custom_tags: [],
  seating_priority: null,
  attire: null,
  gender: null,
  seniority_rank: null,
  relation: null,
  created_at: '2026-10-01T00:00:00Z',
  rsvp_responded_at: null,
  invitation_sent_at: null,
  entry_source: 'host_seeded',
  passed_away: false,
  deleted_at: null,
}));

/** What a view can change about the stand-in database. */
const STATE = {
  /** The database refuses the dashboard's ONE read of the row (a column it does not know yet). */
  refuseOneRead: false,
  /** The viewer is a delegate (an accepted co-host) the couple never shared the guest list with. */
  delegateWithoutGuestList: false,
};

type Sent = { step: number; what: string; key: string; table: string; select: string; who: string; by?: string };
let sent: Sent[] = [];
let returned = 0;

function whoAsked(): string {
  const holder: { stack?: string } = {};
  Error.stackTraceLimit = 60;
  Error.captureStackTrace(holder);
  return (holder.stack ?? '')
    .split('\n')
    .filter((l) => /apps\/web\/(lib|app)\//.test(l) && !/guests-page-reads\.harness|db-error-log|read-limit/.test(l))
    .slice(0, 4)
    .map((l) => l.replace(/^\s*at (async )?/, '').replace(/\(?[^() ]*apps\/web\//, '(').replace(/:\d+\)?$/, ')'))
    .join(' ← ');
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
  const who = String(headers.get('authorization') ?? '').includes('harness-service-role-key') ? 'service' : 'viewer';
  sent.push({ step, what: `${table}(${select.slice(0, 60)})`, key: `${init?.method ?? 'GET'} ${who} ${url.pathname}${url.search}`, table, select, who, ...(process.env.GUESTS_PAGE_READS_WHO ? { by: whoAsked() } : {}) });
  await new Promise((r) => setTimeout(r, DELAY));
  returned = Math.max(returned, step);
  const method = (init?.method ?? 'GET').toUpperCase();
  const json = (body: unknown, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...extra } });
  if (url.pathname.startsWith('/auth/v1/user')) return json(USER);
  if (url.pathname.startsWith('/auth/')) return json({});
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
  if (table === 'rpc/event_entitlement_facts') return json({ orders: [], comp_skus: [], host_internal: false, founder_seat: false, basket: [] });
  if (table === 'rpc/count_unread_message_threads') return json(0);
  if (table.startsWith('rpc/')) return json(/skus|granting/.test(table) ? [] : null);
  if (method !== 'GET') return json([]);
  const filters = Object.fromEntries([...url.searchParams].filter(([k]) => !['select', 'order', 'limit', 'offset'].includes(k)));
  let rows: Record<string, unknown>[] = [];
  if (table === 'events' && STATE.refuseOneRead && select.split(',').length > 20)
    return new Response(JSON.stringify({ code: '42703', message: 'column events.a_new_column does not exist', details: null, hint: null }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  if (table === 'events') rows = [project(EVENT, select)];
  else if (table === 'event_members')
    rows = STATE.delegateWithoutGuestList
      ? []
      : select === 'member_type'
        ? [{ member_type: 'couple' }]
        : select.includes('member_type')
          ? [{ event_id: EVENT_ID, member_type: 'couple' }]
          : [];
  else if (table === 'event_moderators' && STATE.delegateWithoutGuestList)
    rows = [{ moderator_id: 'm1', permissions_json: { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { schedule: 'edit' } } }];
  else if (table === 'guests') rows = filters.entry_source ? [] : GUESTS.map((g) => project(g, select));
  else if (table === 'users') rows = [project({ user_id: USER_ID, display_name: 'Maria', email: USER.email, account_type: 'couple', is_internal: false }, select)];
  const prefer = headers.get('prefer') ?? '';
  return json(rows, prefer.includes('count=') ? { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } : {});
}) as typeof fetch;

type ViewReport = {
  /** Where the page sent the viewer instead of drawing (a `redirect()`), or null when it drew. */
  redirectedTo: string | null;
  /** How many guests the page handed its list — the names a couple sees first. */
  namesHanded: number | null;
  calls: number;
  /** The deepest step: requests one after another, the longest chain. */
  depth: number;
  /** Requests for THIS event's one row (`events?…event_id=eq.<it>`) by the signed-in viewer's own client. */
  eventRowReads: number;
  /** `event_members?select=member_type&event_id=…&user_id=…` — "what is this person on this event?" */
  memberTypeReads: number;
  /** Identical requests (same table, select and filters) sent more than once. */
  repeats: string[];
  /** Wall time of the view, ms — meaningful with GUESTS_PAGE_READS_DELAY_MS=150. */
  ms: number;
  steps: string[];
};

async function main() {
  const { default: GuestsPage } = await import('./page');
  const { default: EventLayout } = await import('../layout');

  async function view(run: () => Promise<unknown>): Promise<ViewReport> {
    viewMemo = new Map();
    sent = [];
    returned = 0;
    const t0 = performance.now();
    let redirectedTo: string | null = null;
    let drawn: unknown = null;
    try {
      drawn = await run();
    } catch (error) {
      // `redirect()` throws; its digest carries the address (`NEXT_REDIRECT;replace;/path;307;`).
      const digest = String((error as { digest?: unknown })?.digest ?? '');
      if (!digest.startsWith('NEXT_REDIRECT')) throw error;
      redirectedTo = digest.split(';')[2] ?? '?';
    }
    const ms = Math.round(performance.now() - t0);
    const keys = sent.map((s) => s.key);
    return {
      redirectedTo,
      namesHanded: namesIn(drawn),
      calls: sent.length,
      depth: Math.max(0, ...sent.map((s) => s.step)),
      eventRowReads: sent.filter((s) => s.table === 'events' && s.who === 'viewer' && s.key.includes(`event_id=eq.${EVENT_ID}`)).length,
      memberTypeReads: sent.filter((s) => s.table === 'event_members' && s.select === 'member_type').length,
      repeats: [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))],
      ms,
      steps: sent.map((s) => `${s.step} ${s.who === 'service' ? '[service] ' : ''}${s.what}${s.by ? `  ← ${s.by}` : ''}`),
    };
  }
  /** The roster the page handed its screen: the `guests` prop of the one element that carries it. */
  function namesIn(tree: unknown, seen = new Set<unknown>()): number | null {
    if (!tree || typeof tree !== 'object' || seen.has(tree)) return null;
    seen.add(tree);
    if (Array.isArray(tree)) {
      for (const t of tree) {
        const n = namesIn(t, seen);
        if (n !== null) return n;
      }
      return null;
    }
    const props = (tree as { props?: Record<string, unknown> }).props;
    if (!props) return null;
    const list = props.guests;
    if (Array.isArray(list) && list.every((g) => g && typeof g === 'object' && 'first_name' in g)) return list.length;
    for (const value of Object.values(props)) {
      const n = namesIn(value, seen);
      if (n !== null) return n;
    }
    return null;
  }
  const params = Promise.resolve({ eventId: EVENT_ID });
  const page = (search: Record<string, string> = {}) => GuestsPage({ params, searchParams: Promise.resolve(search) } as never);

  // Warm the cross-request settings cache once (production finds it warm on every visit but the first of a minute).
  await view(() => page());
  const out = {
    /** The page alone — what stands between a tap on Guests and the first name. */
    page: await view(() => page()),
    /** The page with a guest's card open (`?inspect=`) — the card's reads ride beside the list's. */
    pageWithCard: await view(() => page({ inspect: GUESTS[2]!.guest_id })),
    /** The layout and the page together, as Next renders them — one request's worth of reads. */
    layoutAndPage: await view(() => Promise.all([EventLayout({ children: null, params } as never), page()]).then(([, drawn]) => drawn)),
    /** ONE guest's card alone — the card-only read a tap on a row costs (`openGuestCard`), no list. */
    cardAlone: await view(() => import('./open-guest-card').then((m) => m.openGuestCard(EVENT_ID, GUESTS[2]!.guest_id, 'list'))),
    oneReadRefused: undefined as unknown as ViewReport,
    delegateWithoutGuestList: undefined as unknown as ViewReport,
  };
  // 🧯 THE ONE READ IS REFUSED: every asker must send its own read and the list must still be drawn.
  STATE.refuseOneRead = true;
  out.oneReadRefused = await view(() => page());
  STATE.refuseOneRead = false;
  // 🚪 A delegate who may not see the guest list is still sent to their own view, never drawn an empty list.
  STATE.delegateWithoutGuestList = true;
  out.delegateWithoutGuestList = await view(() => page());
  STATE.delegateWithoutGuestList = false;
  process.stdout.write(`GUESTS_PAGE_READS ${JSON.stringify(out)}\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`GUESTS_PAGE_READS_FAILED ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  },
);
