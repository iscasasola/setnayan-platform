/**
 * THE LOAD-TIME LOG (owner 2026-10-16) — the four promises, each held here and
 * each sabotaged once when it was written:
 *
 *   1 · NO RAW URL OR ID IS STORED — what the browser sends is id-blanked, what
 *       the ingest stores is a route PATTERN, and whatever survives both still
 *       passes the table's own CHECK (mirrored here, so a widening is seen).
 *   2 · THE REPORTER NEVER BLOCKS — it loads only through import() at idle (its
 *       own chunk), a hostile browser cannot make it throw, and the fetch and
 *       history calls it wraps return the original's answer untouched.
 *   3 · THE TARGET FALLS BACK TO 1.5 s — no override, a bad override, or an
 *       unread settings row: 1.5 s.
 *   4 · (the RLS half lives in tests/db/the-load-time-log.db.test.ts) — here:
 *       the admin read is only ever reached behind requireAdmin().
 *
 * Plus the arithmetic the admin reads: weighted percentiles, the send rule,
 * the honest-empty floor, the trend since the last build.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { normalizePath } from '@/lib/telemetry/fault-normalize';
import { makeRouteMatcher } from '@/lib/telemetry/route-pattern';
import {
  ALWAYS_SEND_MS,
  DEFAULT_TARGET_MS,
  SAMPLE_WEIGHT,
  TARGET_MIN_MS,
  clampTarget,
  coerceTargets,
  loadsFromWire,
  sendWeight,
  summarizeLoads,
  targetFor,
  weightedPercentile,
  type LoadRow,
} from '@/lib/telemetry/load-timing';
import { installLoadReporter, navBreakdown, pageLoadFrom } from '@/lib/telemetry/load-reporter';
import screens from '@/lib/ugat/screens.generated.json';
import { ADMIN_ROUTES } from '@/lib/admin-map/admin-routes.generated';

const ROOT = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

const PATTERNS = [
  ...(screens as { screens: Array<{ route: string }> }).screens.map((s) => s.route),
  ...ADMIN_ROUTES.map((r) => r.path),
];
const match = makeRouteMatcher(PATTERNS);
/** What the ingest does: re-blank, then name the pattern (load-timing.server.ts toRoutePattern). */
const toPattern = (p: string) => match(normalizePath(p));

/** The table's CHECK on `route` (migration 20271270180398), mirrored. */
function passesRouteCheck(route: string): boolean {
  return (
    route.length >= 1 &&
    route.length <= 200 &&
    /^\/[A-Za-z0-9._\[\]/…-]*$/.test(route) &&
    !/[0-9]{4,}/.test(route) &&
    !/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(route) &&
    !/S89[A-Z]{1,4}-/i.test(route) &&
    !/[^/]{41,}/.test(route)
  );
}

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

// ── 1 · NO RAW URL OR ID ─────────────────────────────────────────────────────

test('1 · an event page is stored as its route pattern — never its id, query or #section', () => {
  assert.equal(toPattern(`/dashboard/${UUID}/guests?filter=maria&t=abc#row-3`), '/dashboard/[eventId]/guests');
  assert.equal(toPattern(`/dashboard/${UUID}`), '/dashboard/[eventId]');
  assert.equal(toPattern('/maria-and-jose/invite'), '/[slug]/invite', "an event's own address is the couple's names");
  assert.equal(toPattern('/v/juan-photography'), '/v/[slug]');
  assert.equal(toPattern('/'), '/');
  assert.equal(toPattern('/admin/app-performance'), '/admin/app-performance');
});

test('1 · every real route pattern passes the table’s CHECK (so no real page is ever refused)', () => {
  const bad = PATTERNS.filter((p) => !passesRouteCheck(p));
  assert.deepEqual(bad, []);
});

test('1 · a path no route matches keeps only route words — free text becomes […]', () => {
  const out = toPattern('/admin/accounts/S89U-7K3M9QX2PA/maria.santos@example.com/notes');
  assert.ok(out);
  assert.ok(!/S89|maria|santos|example/.test(out!), out!);
  assert.ok(passesRouteCheck(out!), out!);
});

test('1 · whatever the browser sends, every stored route passes the table’s CHECK (fuzz)', () => {
  const pieces = [
    UUID, 'S89E-AB12CD34EF', '09171234567', 'maria@example.com', 'eyJhbGciOiJIUzI1NiJ9abcdefghijklmnopqrstuvwxyz',
    'guests', 'dashboard', 'admin', 'v', '[eventId]', '%E2%9C%93', '..', 'Juan dela Cruz', '2026-10-16', '?x=1', '#a',
  ];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) {
    const n = 1 + Math.floor(rnd() * 5);
    const path = '/' + Array.from({ length: n }, () => pieces[Math.floor(rnd() * pieces.length)]).join('/');
    const rows = loadsFromWire([{ kind: 'nav', route: path, total_ms: 2000, device: 'phone', weight: 1 }], toPattern);
    for (const r of rows) {
      assert.ok(passesRouteCheck(r.route), `${path} → ${r.route}`);
      assert.ok(!r.route.includes(UUID) && !/@|S89E|0917/.test(r.route), `${path} → ${r.route}`);
    }
  }
});

test('1 · the ingest drops anything malformed and never trusts the browser’s numbers', () => {
  const rows = loadsFromWire(
    [
      { kind: 'nav', route: `/dashboard/${UUID}/guests`, total_ms: 2400, server_ms: -5, device: 'phone', weight: 9999, connection: 'wifi' },
      { kind: 'evil', route: '/', total_ms: 10, device: 'phone' },
      { kind: 'page', route: 'https://elsewhere.test/x', total_ms: 10, device: 'phone' },
      { kind: 'page', route: '/', total_ms: 'NaN', device: 'phone' },
      { kind: 'page', route: '/', total_ms: 10, device: 'fridge' },
      'not an object',
    ],
    toPattern,
  );
  assert.equal(rows.length, 2, 'the good row, and the absolute URL reduced to a path');
  assert.equal(rows[0]!.route, '/dashboard/[eventId]/guests');
  assert.ok(!rows[1]!.route.includes('elsewhere'), 'a host never lands');
  assert.equal(rows[0]!.server_ms, null, 'a negative figure is dropped');
  assert.equal(rows[0]!.weight, 100, 'the weight is clamped');
  assert.equal(rows[0]!.connection, null, 'an unknown connection is dropped');
  assert.equal(loadsFromWire(Array.from({ length: 50 }, () => ({ kind: 'page', route: '/', total_ms: 1, device: 'phone' })), toPattern).length, 20);
});

test('1 · the reporter sends a route only through normalizePath — never href, search or hash', () => {
  const src = code('lib/telemetry/load-reporter.ts');
  const routes = [...src.matchAll(/route:\s*([^,}\n]+)/g)].map((m) => m[1]!.trim()).filter((r) => !r.endsWith(';'));
  assert.ok(routes.length >= 2, 'found the places a route is set');
  for (const r of routes) assert.match(r, /^(normalizePath\(|p\.route$)/, `a route set from ${r}`);
  assert.ok(!/location\.(search|hash)|loc\.(search|hash|href)\s*[,}]/.test(src), 'the reporter never reads the query or hash into a load');
  // …and the server re-blanks whatever it is handed.
  assert.match(code('lib/telemetry/load-timing.server.ts'), /matcher\(normalizePath\(path\)\)/);
  assert.match(code('app/api/telemetry/client-fault/route.ts'), /loadsFromWire\(body\.loads, toRoutePattern\)/);
});

// ── 2 · THE REPORTER NEVER BLOCKS ────────────────────────────────────────────

test('2 · it is loaded ONLY by import() at idle — never in the shared first-load chunk', () => {
  const deferred = code('app/_components/deferred-observability.tsx');
  assert.match(
    deferred,
    /scheduleIdle\(\(\) => \{[\s\S]*?void import\('@\/lib\/telemetry\/load-reporter'\)/,
    'the reporter is installed from the idle callback, by import()',
  );
  // No static import of it anywhere in app/ or components/.
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const hits = execSync(
    `/usr/bin/grep -rlE "from ['\\"]@/lib/telemetry/load-reporter['\\"]" app components lib --include=*.ts --include=*.tsx || true`,
    { cwd: ROOT, encoding: 'utf8' },
  )
    .split('\n')
    .filter((f) => f && !f.endsWith('.test.ts'));
  assert.deepEqual(hits, [], `a static import pulls the reporter into a first-load chunk: ${hits.join(', ')}`);
  // It sends by beacon and never awaits anything.
  const src = code('lib/telemetry/load-reporter.ts');
  assert.match(src, /sendBeacon\(INGEST/);
  assert.ok(!/\bawait\b/.test(src), 'the reporter awaits nothing');
  assert.ok(!/XMLHttpRequest/.test(src), 'no synchronous request');
});

type Listener = (e: { timeStamp: number; target?: unknown }) => void;

/** A browser stripped to what the reporter touches — with a clock we drive. */
function fakeBrowser(opts: { startPath: string; hostile?: boolean }) {
  let clock = 0;
  let path = opts.startPath;
  const winL: Record<string, Listener[]> = {};
  const docL: Record<string, Listener[]> = {};
  const intervals = new Map<number, () => void>();
  let nextId = 1;
  const beacons: string[] = [];
  const fetchCalls: unknown[] = [];
  const realPromise = Promise.resolve(new Response('ok'));
  let busy = false;
  let onMutation: (() => void) | null = null;
  (globalThis as { MutationObserver?: unknown }).MutationObserver = class {
    constructor(cb: () => void) {
      onMutation = cb;
    }
    observe() {}
    disconnect() {}
  };
  const doc = {
    visibilityState: 'visible',
    readyState: 'complete',
    body: {},
    addEventListener: (t: string, f: Listener) => void (docL[t] ??= []).push(f),
    querySelector: (sel: string) => (busy && sel === '[aria-busy="true"]' ? {} : null),
  };
  const pushes: string[] = [];
  const win = {
    document: doc,
    performance: opts.hostile
      ? new Proxy({}, { get: () => { throw new Error('hostile'); } })
      : {
          now: () => clock,
          getEntriesByType: (t: string) =>
            t === 'navigation'
              ? [{ responseStart: 400, responseEnd: 650, domContentLoadedEventEnd: 900, loadEventEnd: 1300, loadEventStart: 1250 }]
              : [],
          getEntriesByName: (n: string) => (n === 'first-contentful-paint' ? [{ startTime: 1400 }] : []),
        },
    location: {
      get pathname() {
        return path;
      },
      get href() {
        return `https://lab.test${path}?secret=1#x`;
      },
      origin: 'https://lab.test',
    },
    fetch: (...args: unknown[]) => {
      fetchCalls.push(args);
      return realPromise;
    },
    navigator: {
      sendBeacon: (_url: string, blob: Blob) => {
        void blob.text().then((t) => beacons.push(t));
        return true;
      },
    },
    history: {
      pushState: (_s: unknown, _t: string, u: string) => {
        pushes.push(u);
        path = new URL(u, 'https://lab.test').pathname;
        return 'orig-result';
      },
      replaceState: () => undefined,
    },
    screen: { width: 390, height: 844 },
    matchMedia: () => ({ matches: true }),
    addEventListener: (t: string, f: Listener) => void (winL[t] ??= []).push(f),
    setTimeout: (f: () => void) => {
      f();
      return 0;
    },
    clearTimeout: () => {},
    setInterval: (f: () => void) => {
      const id = nextId++;
      intervals.set(id, f);
      return id;
    },
    clearInterval: (id: number) => void intervals.delete(id),
    requestAnimationFrame: (f: () => void) => {
      f();
      return 0;
    },
  };
  return {
    win,
    realPromise,
    fetchCalls,
    pushes,
    beacons,
    tick(ms: number) {
      clock += ms;
      for (const f of [...intervals.values()]) f();
    },
    /** The route's skeleton is up (true) / replaced by its content (false — a DOM change). */
    setBusy(b: boolean) {
      busy = b;
      if (!b) onMutation?.();
    },
    hide() {
      doc.visibilityState = 'hidden';
      for (const f of docL.visibilitychange ?? []) f({ timeStamp: clock });
    },
  };
}

test('2 · a hostile browser cannot make it throw', () => {
  const b = fakeBrowser({ startPath: '/', hostile: true });
  assert.doesNotThrow(() => installLoadReporter(b.win as never));
});

test('2 · the calls it wraps return the original’s answer, untouched', () => {
  const b = fakeBrowser({ startPath: '/dashboard' });
  installLoadReporter(b.win as never);
  const p = (b.win.fetch as (u: string, i?: RequestInit) => Promise<Response>)('/x', { headers: { rsc: '1' } });
  assert.equal(p, b.realPromise, 'fetch returns the very same promise');
  assert.equal(b.fetchCalls.length, 1, 'the real fetch ran once');
  const r = (b.win.history.pushState as (s: unknown, t: string, u: string) => unknown)(null, '', '/dashboard/x');
  assert.equal(r, 'orig-result');
  assert.deepEqual(b.pushes, ['/dashboard/x']);
});

test('2 · a real flow: the page load and a slow tap are sent — id-free, by beacon, on hide', async () => {
  const b = fakeBrowser({ startPath: `/dashboard/${UUID}` });
  installLoadReporter(b.win as never);
  b.setBusy(true); // the router shows the Guests skeleton…
  (b.win.history.pushState as (s: unknown, t: string, u: string) => unknown)(null, '', `/dashboard/${UUID}/guests?q=maria`);
  b.tick(1000);
  b.tick(700); // …still up at 1.7 s
  b.setBusy(false); // the content replaces it at 1.7 s
  b.tick(200); // quiet → painted
  b.hide();
  await new Promise((r) => setTimeout(r, 10));
  const loads = b.beacons.flatMap((t) => (JSON.parse(t) as { loads: Array<Record<string, unknown>> }).loads);
  const page = loads.find((l) => l.kind === 'page');
  const nav = loads.find((l) => l.kind === 'nav');
  assert.ok(page, 'the full page load was sent (1.4 s ≥ 1 s)');
  assert.equal(page!.route, '/dashboard/[id]');
  assert.equal(page!.total_ms, 1400);
  assert.equal(page!.weight, 1);
  assert.ok(nav, 'the tap was sent');
  assert.equal(nav!.route, '/dashboard/[id]/guests');
  assert.equal(nav!.outcome, 'painted');
  assert.equal(nav!.total_ms, 1700, 'from the move to the paint after the skeleton went');
  assert.ok(!JSON.stringify(loads).includes(UUID) && !JSON.stringify(loads).includes('maria'), 'no id, no query');
});

test('2 · the browser-side arithmetic', () => {
  assert.deepEqual(
    pageLoadFrom({ responseStart: 300, responseEnd: 500, domContentLoadedEventEnd: 800, loadEventEnd: 0, loadEventStart: 1000 }, { lcp: 1700, fcp: 900 }),
    { total_ms: 1700, server_ms: 300, download_ms: 200, render_ms: 1200, ttfb_ms: 300, dcl_ms: 800, load_ms: 1000, lcp_ms: 1700 },
  );
  // A prerendered page counts from activation, not from the prerender.
  assert.equal(
    pageLoadFrom({ responseStart: 300, responseEnd: 500, domContentLoadedEventEnd: 800, loadEventEnd: 900, loadEventStart: 890, activationStart: 2000 }, { lcp: 2600, fcp: null })!.total_ms,
    600,
  );
  assert.deepEqual(navBreakdown(100, 2100, { startTime: 120, responseStart: 900, responseEnd: 1500 }), {
    total_ms: 2000,
    server_ms: 800,
    download_ms: 600,
    render_ms: 600,
  });
  assert.deepEqual(navBreakdown(0, 300, null), { total_ms: 300, server_ms: null, download_ms: null, render_ms: 300 });
});

// ── 3 · THE TARGET FALLS BACK TO 1.5 s ───────────────────────────────────────

test('3 · a page with no target, a bad target, or an unread settings row is judged against 1.5 s', () => {
  assert.equal(DEFAULT_TARGET_MS, 1500, 'the owner’s number');
  assert.equal(targetFor('/x', {}), 1500);
  assert.equal(targetFor('/x', null), 1500);
  assert.equal(targetFor('/x', coerceTargets(null)), 1500, 'unread → empty map → default');
  assert.equal(targetFor('/x', coerceTargets({ '/x': 'fast' })), 1500);
  assert.equal(targetFor('/x', coerceTargets({ '/x': -3 })), 1500);
  assert.equal(targetFor('/x', coerceTargets({ '/x': 0 })), 1500);
  assert.equal(targetFor('/x', coerceTargets([1, 2])), 1500);
  assert.equal(targetFor('/x', { '/x': 2500 }), 2500, 'an override wins');
  assert.equal(targetFor('/y', { '/x': 2500 }), 1500, 'only for its own page');
  assert.equal(clampTarget(200), TARGET_MIN_MS, 'never below what is always sent');
  assert.ok(TARGET_MIN_MS >= ALWAYS_SEND_MS, 'every load over ANY allowed target is always sent');
});

test('3 · the admin read falls back too — a refused settings read is every page on 1.5 s, and says so', () => {
  const src = code('lib/telemetry/load-timing.server.ts');
  assert.match(src, /return \{ targets: \{\}, error: 'page targets unread/);
});

// ── 4 · ADMIN ONLY ───────────────────────────────────────────────────────────

test('4 · the read is reached only behind requireAdmin()', () => {
  const surface = code('app/admin/app-performance/_surfaces/slow-loads-surface.tsx');
  assert.ok(surface.indexOf('await requireAdmin()') >= 0 && surface.indexOf('await requireAdmin()') < surface.indexOf('fetchLoadTimeStats('));
  const page = code('app/admin/app-performance/page.tsx');
  assert.ok(page.indexOf('await requireAdmin()') < page.indexOf('activeSurface(tab'), 'the studio gates every tab, the overview included');
  const action = code('app/admin/app-performance/actions.ts');
  const save = action.slice(action.indexOf('export async function saveLoadTarget'));
  assert.match(save.slice(0, 120), /await requireAdmin\(\)/);
  // Importers of the server read: only these.
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const users = execSync(`/usr/bin/grep -rl "fetchLoadTimeStats" app lib --include=*.ts --include=*.tsx || true`, { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.endsWith('.test.ts'))
    .sort();
  assert.deepEqual(users, [
    'app/admin/app-performance/_surfaces/overview-surface.tsx',
    'app/admin/app-performance/_surfaces/slow-loads-surface.tsx',
    'lib/telemetry/load-timing.server.ts',
  ]);
});

test('4 · the phone answers, it does not edit: the target form stands down below lg, and a line says so', () => {
  const s = code('app/admin/app-performance/_surfaces/slow-loads-surface.tsx');
  assert.match(s, /<div className="hidden [^"]*lg:flex">\s*<form action=\{saveLoadTarget\}/);
  assert.equal((s.match(/<form action=\{saveLoadTarget\}/g) ?? []).length, 2, 'both target forms sit inside the lg-only wrapper');
  assert.match(s, /Targets are set on the computer\./);
});

// ── the arithmetic ───────────────────────────────────────────────────────────

test('the send rule: ≥ 1 s always (weight 1); faster about 1 in 10 (weight 10)', () => {
  assert.equal(sendWeight(1000, 0.99), 1);
  assert.equal(sendWeight(5000, 0.5), 1);
  assert.equal(sendWeight(999, 0.05), SAMPLE_WEIGHT);
  assert.equal(sendWeight(999, 0.2), null);
  assert.equal(sendWeight(-1, 0), null);
});

test('weighted percentiles: a sampled fast load stands for ten', () => {
  assert.equal(weightedPercentile([], 0.5), null);
  // 9 slow rows (weight 1) + 1 fast row standing for 10 → the median is fast.
  const vals = [...Array.from({ length: 9 }, () => ({ v: 3000, w: 1 })), { v: 400, w: 10 }];
  assert.equal(weightedPercentile(vals, 0.5), 400);
  assert.equal(weightedPercentile(vals, 0.95), 3000);
});

function row(p: Partial<LoadRow>): LoadRow {
  return {
    created_at: '2026-10-16T00:00:00Z',
    kind: 'nav',
    route: '/a',
    total_ms: 500,
    server_ms: null,
    download_ms: null,
    render_ms: null,
    lcp_ms: null,
    inp_ms: null,
    outcome: 'painted',
    device: 'phone',
    connection: null,
    signed_in: true,
    build_sha: 'aaaaaaa',
    weight: 1,
    ...p,
  };
}

test('the summary: slow = over the CURRENT target; honest-empty below the floor; trend since the last build', () => {
  const rows: LoadRow[] = [
    ...Array.from({ length: 8 }, (_, i) => row({ route: '/a', total_ms: 1000, build_sha: 'aaaaaaa', created_at: `2026-10-10T00:00:0${i}Z` })),
    ...Array.from({ length: 8 }, (_, i) => row({ route: '/a', total_ms: 2000, build_sha: 'bbbbbbb', created_at: `2026-10-15T00:00:0${i}Z` })),
    row({ route: '/b', total_ms: 1600, build_sha: 'bbbbbbb', created_at: '2026-10-16T00:00:00Z' }),
  ];
  const s = summarizeLoads(rows, { '/a': 2500 }, { minN: 8 });
  const a = s.pages.find((p) => p.route === '/a')!;
  const b = s.pages.find((p) => p.route === '/b')!;
  assert.equal(a.target, 2500);
  assert.equal(a.overPct, 0, 'nothing on /a is over its 2.5 s target');
  assert.deepEqual(a.trend, { current: 2000, previous: 1000, pct: 1 });
  assert.equal(b.target, DEFAULT_TARGET_MS);
  assert.equal(b.p50, null, 'one load is below the floor — no number');
  assert.equal(s.slow.length, 1);
  assert.equal(s.slow[0]!.route, '/b', 'the 1.6 s load on a 1.5 s page is slow');
  // A changed target re-judges history.
  assert.equal(summarizeLoads(rows, { '/a': 1500 }, { minN: 8 }).slow.length, 9);
  // A page with a target and no loads is still listed (so the admin can clear it).
  assert.ok(summarizeLoads([], { '/c': 3000 }, { minN: 8 }).pages.some((p) => p.route === '/c'));
});
