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
// eslint-disable-next-line @typescript-eslint/no-require-imports
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
    const row = Object.fromEntries(select.split(',').map((c) => c.trim()).filter(Boolean).map((c) => [c, EVENT_ROW[c] ?? null]));
    body = single ? row : [row];
  }
  else if (table === 'guests') body = single ? GUEST_ROW : [GUEST_ROW];
  else if (table.startsWith('rpc/')) body = /skus|granting/.test(table) ? [] : false;
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

type ViewReport = { calls: number; eventsReads: number; shellExtraKeys: string[]; depth: number; byPhase: Record<string, { calls: number; depthAfter: number }>; steps: string[] };

async function main() {
  // Imported only now — after the three stand-ins above are in place.
  const L = await import('@/app/[slug]/_lib/loaders');
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { resolveProfile } = await import('@/lib/event-type-profile');
  const { startAhead } = await import('@/lib/start-ahead');
  const { isCoordinatorPrepReleaseEnabled } = await import('@/lib/coordinator-prep-release');
  const { EVENT_ROW_ONCE_EXTRA_COLUMNS } = await import('@/lib/event-row-once');

  async function view(kind: 'stranger' | 'invited', dayOfPhase: 'pre' | 'live'): Promise<ViewReport> {
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
    await phase('widgets', () => L.loadWidgets(admin, EVENT_ID));

    // The doorway facts and the entourage are started ahead of the live layer.
    startAhead(L.loadDoorwayFacts(admin, EVENT_ID, 'wedding'));
    startAhead(L.loadEntourage(admin, EVENT_ID, undefined, undefined));
    const live = await phase('live-layer', () => L.loadLiveLayer(admin, event, dayOfPhase as never));
    await phase('doorway-facts', () => L.loadDoorwayFacts(admin, EVENT_ID, 'wedding'));
    await phase('entourage', () => L.loadEntourage(admin, EVENT_ID, undefined, undefined));
    if (kind === 'invited') {
      const session = { event_id: EVENT_ID, guest_id: GUEST_ID } as never;
      await phase('guest-context', () => L.loadGuestContext(admin, event, session, dayOfPhase as never, SLUG, live.scheduleBlocks));
    }
    await phase('layout-look', () => layoutLook);
    return {
      calls: sent.length,
      eventsReads: sent.filter((r) => r.what.startsWith('events(')).length,
      shellExtraKeys,
      depth: Math.max(0, ...sent.map((s) => s.step)),
      byPhase,
      steps: sent.map((s) => `${s.step} ${s.what}`),
    };
  }

  const out = {
    strangerBeforeTheDay: await view('stranger', 'pre'),
    strangerOnTheDay: await view('stranger', 'live'),
    invitedBeforeTheDay: await view('invited', 'pre'),
    invitedOnTheDay: await view('invited', 'live'),
  };
  process.stdout.write(`GUEST_PAGE_READS ${JSON.stringify(out)}\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(`GUEST_PAGE_READS_FAILED ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  },
);
