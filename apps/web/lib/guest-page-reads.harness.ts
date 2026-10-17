/**
 * guest-page-reads.harness.ts — RUNS THE GUEST PAGE'S LOADERS AGAINST A
 * DATABASE THAT COUNTS. Not a test: `lib/guest-page-reads.test.ts` runs this
 * file in its own process and reads the JSON it prints.
 *
 * WHY ITS OWN PROCESS. The loaders are `server-only` modules that lean on
 * React's per-request `cache()`. Neither exists in a plain test process, so
 * this file sets both up BEFORE it imports a loader:
 *   · `server-only` resolves to an empty module (it is a bundler marker);
 *   · `react`'s `cache` is replaced by a memo that lasts for one "view" — the
 *     same one-answer-per-request the page gets in production, including
 *     `lib/request-once.ts`, which is built on it.
 * Then the database's HTTP door (`fetch`) is replaced by a stand-in that
 * answers every table and counts every request — and how DEEP they ran: a
 * request that left only after another came back is one step further down;
 * requests that leave together are one step. Depth is what a guest waits for.
 *
 * ⚠ IT MIRRORS THE PAGE, IT IS NOT THE PAGE. `app/[slug]/page.tsx` is a server
 * component and cannot be called here. Each view below asks the loaders in the
 * order and shape the page does (what leaves together there leaves together
 * here) — keep it in step with `InvitationBody` when that changes. The reads
 * the page makes OUTSIDE these loaders (the session cookie's one check, the
 * signed-in account, the capability reads for a signed-in viewer) are not here.
 */
import Module from 'node:module';
import { join } from 'node:path';

type Resolve = (request: string, ...rest: unknown[]) => string;
const moduleInternals = Module as unknown as { _resolveFilename: Resolve };
const resolveFilename = moduleInternals._resolveFilename;
const EMPTY = join(__dirname, 'guest-page-reads.empty.cjs');
moduleInternals._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === 'server-only') return EMPTY;
  return resolveFilename.call(this, request, ...rest);
} as Resolve;

// ── One memo per view, standing in for React's per-request cache() ─────────
let viewMemo = new Map<unknown, Array<{ args: unknown[]; value: unknown }>>();
const react = require('react') as { cache: unknown };
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

// ── Next's data cache, standing in for production's (`unstable_cache`) ──────
// The platform's own settings (`lib/global-settings-cache.ts`) are remembered
// ACROSS requests, as they are in production. So the views below are measured
// WARM — after a first visit (`warmUp`, not reported) has filled the cache, the
// way every visit but the first few of each minute finds it.
// Next's server runtime provides `AsyncLocalStorage` on globalThis; plain node does not.
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

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// ── The counting database ─────────────────────────────────────────────────
const EVENT_ID = '00000000-0000-4000-8000-0000000000e1';
const GUEST_ID = '00000000-0000-4000-8000-0000000000a1';
const SLUG = 'maria-and-jose';
const EVENT_ROW: Record<string, unknown> = {
  event_id: EVENT_ID,
  public_id: 'S89E-0000000001',
  slug: SLUG,
  display_name: 'Maria & Jose',
  event_type: 'wedding',
  event_date: '2027-06-12',
  event_end_date: null,
  event_date_precision: 'day',
  landing_page_visibility: 'public',
  archived: false,
  venue_name: 'San Agustin Church',
  invite_theme: null,
};
const GUEST_ROW: Record<string, unknown> = {
  guest_id: GUEST_ID,
  event_id: EVENT_ID,
  first_name: 'Ana',
  last_name: 'Reyes',
  display_name: 'Ana Reyes',
  rsvp_status: 'pending',
  plus_one_of: null,
  is_tba: false,
};

/**
 * What the stand-in database holds that a view can change: the event's stamp
 * (`event_public_stamp`), its order rows and basket lines (an event WITH orders),
 * and its scene rows — so a write can be made between two views and the second
 * view shown to read it (the freshness proof, `freshAfterAWrite`).
 */
const STATE = {
  rev: 1,
  /** Which event the stamp names, and which event the address's row is — two different ones = a rename between the two reads. */
  stampEventId: EVENT_ID,
  rowEventId: EVENT_ID,
  orders: [] as Array<{ service_key: string; status: string }>,
  basket: [] as Array<{ service_code: string; order_id: string; status: string }>,
  widgets: [{ widget_id: 'w-hero', event_id: EVENT_ID, widget_type: 'hero', display_order: 0, is_visible: true }] as Row[],
};
type Row = Record<string, unknown>;

let sent: Array<{ step: number; what: string }> = [];
let returned = 0;
function resetCount() {
  sent = [];
  returned = 0;
}

/** `GUEST_PAGE_READS_WHO=1` — name who sent each request (the app's own frames), for whoever is cutting reads. */
function whoAsked(): string {
  const holder: { stack?: string } = {};
  Error.stackTraceLimit = 60;
  Error.captureStackTrace(holder);
  return (holder.stack ?? '')
    .split('\n')
    .filter((l) => /apps\/web\/(lib|app)\//.test(l) && !/guest-page-reads\.harness|db-error-log|read-limit/.test(l))
    .slice(0, 4)
    .map((l) => l.replace(/^\s*at (async )?/, '').replace(/\(?[^() ]*apps\/web\//, '(').replace(/:\d+\)?$/, ')'))
    .join(' ← ');
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
  const table = url.pathname.replace(/^\/rest\/v1\//, '');
  const select = url.searchParams.get('select') ?? '';
  const step = returned + 1;
  const what = table === 'events' ? `events(${select.split(',').slice(0, 2).join(',')}${select.split(',').length > 2 ? ',…' : ''})` : table;
  sent.push({ step, what: process.env.GUEST_PAGE_READS_WHO ? `${what}  ← ${whoAsked()}` : what });
  await new Promise((r) => setTimeout(r, 3));
  returned = Math.max(returned, step);
  const method = init?.method ?? 'GET';
  const single = new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object') ?? false;
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '*/0' } });
  let body: unknown = single ? null : [];
  if (table === 'events') {
    // Like PostgREST: exactly the columns that were asked for, null where the stand-in holds none.
    const whole: Record<string, unknown> = { ...EVENT_ROW, event_id: STATE.rowEventId };
    const row = Object.fromEntries(select.split(',').map((c) => c.trim()).filter(Boolean).map((c) => [c, whole[c] ?? null]));
    body = single ? row : [row];
  }
  else if (table === 'guests') body = single ? GUEST_ROW : [GUEST_ROW];
  else if (table === 'invitation_widgets') body = STATE.widgets;
  else if (table === 'orders') body = STATE.orders;
  else if (table === 'rpc/event_public_stamp') body = [{ event_id: STATE.stampEventId, rev: STATE.rev }];
  else if (table === 'rpc/event_entitlement_facts')
    body = { orders: STATE.orders, comp_skus: [], host_internal: false, founder_seat: false, basket: STATE.basket };
  else if (table === 'rpc/event_basket_orders_granting') {
    const code = (JSON.parse(String(init?.body ?? '{}')) as { p_service_code?: string }).p_service_code;
    body = STATE.basket.filter((b) => b.service_code === code).map((b) => ({ order_id: b.order_id, status: b.status }));
  } else if (table.startsWith('rpc/')) body = /skus|granting/.test(table) ? [] : false;
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

type ViewReport = {
  calls: number;
  eventsReads: number;
  shellExtraKeys: string[];
  depth: number;
  byPhase: Record<string, { calls: number; depthAfter: number }>;
  steps: string[];
  /** The scene ids the view's `loadWidgets` answered — what a guest would be shown. */
  widgetIds: string[];
  /** How many of the view's requests were the viewer's OWN guest row (`guests?guest_id=eq.…`). */
  ownRowReads: number;
  /** Which event's row the view was handed. */
  shellEventId: string;
};

async function main() {
  // Imported only now — after the three stand-ins above are in place.
  const L = await import('@/app/[slug]/_lib/loaders');
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { resolveProfile } = await import('@/lib/event-type-profile');
  const { startAhead } = await import('@/lib/start-ahead');
  const { isCoordinatorPrepReleaseEnabled } = await import('@/lib/coordinator-prep-release');
  const { EVENT_ROW_ONCE_EXTRA_COLUMNS } = await import('@/lib/event-row-once');
  const { openSharedEventReads } = await import('@/lib/event-shared-reads');
  let ownRowReads = 0;
  const countingFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/guests?') && url.includes(`guest_id=eq.${GUEST_ID}`)) ownRowReads += 1;
    return countingFetch(input, init);
  }) as typeof fetch;

  /**
   * `opened`: the page opens its render to remembered reads (`openSharedEventReads`)
   * for a guest's or a stranger's view — false stands for the Maker's canvas,
   * which never opens it.
   */
  async function view(kind: 'stranger' | 'invited', dayOfPhase: 'pre' | 'live', opened = true): Promise<ViewReport> {
    ownRowReads = 0;
    viewMemo = new Map();
    resetCount();
    const byPhase: ViewReport['byPhase'] = {};
    const phase = async <T>(label: string, run: () => Promise<T>): Promise<T> => {
      const before = sent.length;
      try {
        return await run();
      } finally {
        byPhase[label] = { calls: sent.length - before, depthAfter: Math.max(0, ...sent.map((s) => s.step)) };
      }
    };
    const admin = createAdminClient() as never;

    // The page and the layout both begin here; `cache()` makes it one read.
    const event = (await phase('shell', () => L.loadEventShell(SLUG))) as never;
    if (!event) throw new Error('the stand-in did not answer the shell read');
    // `publicInvitationPage`: a guest's or a stranger's view opens its shared reads here.
    if (opened) openSharedEventReads(EVENT_ID);
    // The page's own row must be the row it always was — none of the one read's extras on it.
    const shellExtraKeys = (EVENT_ROW_ONCE_EXTRA_COLUMNS as readonly string[]).filter((c) => c in (event as object));
    // The layout dresses the tree beside the page (`app/[slug]/layout.tsx`).
    const layoutLook = startAhead(L.loadGuestLook(SLUG));
    await phase('profile', () => resolveProfile('wedding'));

    // `InvitationBody`: the scene list and the prep-release switch are started
    // ahead, the media awaited first.
    startAhead(L.loadWidgets(admin, EVENT_ID));
    startAhead(isCoordinatorPrepReleaseEnabled());
    await phase('media', () => L.loadMedia(admin, event, null));
    const widgets = (await phase('widgets', () => L.loadWidgets(admin, EVENT_ID))) as Array<{ widget_id?: string }>;

    // The doorway facts and the entourage are started ahead of the live layer.
    startAhead(L.loadDoorwayFacts(admin, EVENT_ID, 'wedding'));
    startAhead(L.loadEntourage(admin, EVENT_ID, undefined, undefined));
    // …and, for a cookie that names this event, the guest's own reads — handed the schedule as a promise.
    const scheduleAhead = startAhead(startAhead(L.loadLiveLayer(admin, event, dayOfPhase as never)).then((layer) => layer.scheduleBlocks));
    const session = { event_id: EVENT_ID, guest_id: GUEST_ID } as never;
    if (kind === 'invited') startAhead(L.loadGuestContext(admin, event, session, dayOfPhase as never, SLUG, scheduleAhead));
    await phase('live-layer', () => L.loadLiveLayer(admin, event, dayOfPhase as never));
    await phase('doorway-facts', () => L.loadDoorwayFacts(admin, EVENT_ID, 'wedding'));
    await phase('entourage', () => L.loadEntourage(admin, EVENT_ID, undefined, undefined));
    if (kind === 'invited') {
      await phase('guest-context', () => L.loadGuestContext(admin, event, session, dayOfPhase as never, SLUG, scheduleAhead));
    }
    await phase('layout-look', () => layoutLook);
    return {
      calls: sent.length,
      eventsReads: sent.filter((r) => r.what.startsWith('events(')).length,
      shellExtraKeys,
      depth: Math.max(0, ...sent.map((s) => s.step)),
      byPhase,
      steps: sent.map((s) => `${s.step} ${s.what}`),
      widgetIds: widgets.map((w) => String(w.widget_id)),
      shellEventId: String((event as { event_id?: unknown }).event_id),
      ownRowReads,
    };
  }

  // The first visit after the event last changed — fills the data cache.
  const coldInvitedOnTheDay = await view('invited', 'live');
  const out: Record<string, ViewReport | string[]> = {
    coldInvitedOnTheDay,
    strangerBeforeTheDay: await view('stranger', 'pre'),
    strangerOnTheDay: await view('stranger', 'live'),
    invitedBeforeTheDay: await view('invited', 'pre'),
    invitedOnTheDay: await view('invited', 'live'),
    // 🎨 The Maker's canvas: the page never opens its reads — only the shell rides the stamp.
    hostCanvas: await view('stranger', 'pre', false),
  };
  // ✓ A HOST'S APPLY: a scene added + the stamp it moves (what the migration's trigger does at COMMIT).
  STATE.widgets = [...STATE.widgets, { widget_id: 'w-applied', event_id: EVENT_ID, widget_type: 'countdown', display_order: 1, is_visible: true }];
  STATE.rev += 1;
  out.freshAfterAWrite = await view('stranger', 'pre');
  out.warmAgainAfterTheWrite = await view('stranger', 'pre');
  // 💳 AN EVENT WITH ORDERS (a bought Event Hub Pro, an add-on, and a basket line).
  STATE.orders = [
    { service_key: 'COUPLE_WEBSITE_PRO', status: 'paid' },
    { service_key: 'PAPIC_UNLOCK', status: 'paid' },
    { service_key: 'ONBOARDING_BASKET', status: 'paid' },
  ];
  STATE.basket = [{ service_code: 'SETNAYAN_AI', order_id: 'o-basket', status: 'paid' }];
  STATE.rev += 1;
  out.coldWithOrders = await view('invited', 'live');
  out.strangerWithOrders = await view('stranger', 'live');
  out.invitedWithOrders = await view('invited', 'live');
  // 🔀 THE ADDRESS MOVED BETWEEN THE TWO READS: the stamp names another event than the row the
  // address returns (a rename landing between them). That row must not be filed under the stamp…
  STATE.stampEventId = '00000000-0000-4000-8000-0000000000e2';
  STATE.rev = 500;
  out.addressMovedMidRead = await view('stranger', 'pre', false);
  // …so the next view, where both agree on the other event, reads that event's own row.
  STATE.rowEventId = '00000000-0000-4000-8000-0000000000e2';
  out.addressMovedNextView = await view('stranger', 'pre', false);
  // What the data cache holds — every key, so the test can show none is about one guest.
  out.rememberedKeys = [...dataCache.keys()];
  process.stdout.write(`GUEST_PAGE_READS ${JSON.stringify(out)}\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`GUEST_PAGE_READS_FAILED ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  },
);
