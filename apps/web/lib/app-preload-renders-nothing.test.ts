/**
 * app-preload-renders-nothing.test.ts — 🧯 A SIGNED-IN PAGE LOAD ASKS THE SERVER
 * TO RENDER NO OTHER PAGE — and still brings their code.
 *
 * Production, 2026-10-08: one person opened the Maker and, within nine seconds,
 * eleven `vendor-dashboard` routes were server-rendered that nobody had tapped.
 * It was the signed-in shell's "code preload" (`app/_components/app-preload.tsx`):
 * to learn which chunk files a page needs it FETCHED THE PAGE — a full server
 * render, layout and every database read — once for each page in the account's
 * plan, on every hard load of any signed-in page. 5 pages for a host, 9 more
 * with a shop. Around that one open the database saw ~1,090 requests; it allows
 * nine connections.
 *
 * The chunk names now come from the build (`lib/app-code-map.ts`,
 * `scripts/write-app-code-map.mjs`). This COUNTS, with a counting `fetch`, every
 * request the shell's preload makes when the real queue runs a whole realistic
 * plan to the end:
 *
 *     to an app route (a page the server must render):   0
 *     to `/_next/static/` (the CDN):                      1 map + the chunks
 *
 * …and when the map is not served: 1 request (the map, refused) and nothing else.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreloader } from './app-preload';
import { appPreloadPlan } from './app-preload-sets';
import { appCodeMapUrl, chunksForRoute, routePatternsOf, type AppCodeMap } from './app-code-map';
import { appPreloadJobs, forgetCodeMap } from '../app/_components/app-preload';
// The build step itself — a plain node module (imported as `no-card-guard.test.ts` imports its script).
import { appCodeMap, buildVersion, urlRouteOf } from '../scripts/write-app-code-map.mjs';

const EVENT = '22222222-2222-4222-8222-222222222222';
const ORIGIN = 'https://setnayan.test';

/** A build manifest the size of the real plan: every planned page, its layouts, shared and own chunks. */
function manifestFor(plan: readonly string[]): Record<string, string[]> {
  const pages: Record<string, string[]> = {
    '/layout': ['static/chunks/webpack-1.js', 'static/chunks/main-app-2.js', 'static/css/root.css'],
    '/dashboard/layout': ['static/chunks/dash-3.js'],
    '/dashboard/[eventId]/layout': ['static/chunks/event-4.js'],
    '/dashboard/[eventId]/loading': ['static/chunks/event-loading-5.js'],
    '/vendor-dashboard/layout': ['static/chunks/shop-6.js'],
    // Not the signed-in app: must never be listed.
    '/[slug]/page': ['static/chunks/guest-7.js'],
    '/admin/page': ['static/chunks/admin-8.js'],
  };
  plan.forEach((href, i) => {
    const route = href.replace(EVENT, '[eventId]');
    pages[`${route}/page`] = ['static/chunks/shared-9.js', `static/chunks/app${route}/page-${i}.js`];
  });
  return pages;
}

type Seen = { url: string; path: string };

function withCountingFetch<T>(map: AppCodeMap | null, run: (seen: Seen[]) => Promise<T>): Promise<T> {
  const g = globalThis as unknown as Record<string, unknown>;
  const before = { fetch: g.fetch, window: g.window, document: g.document };
  const seen: Seen[] = [];
  forgetCodeMap();
  g.window = { location: { origin: ORIGIN } };
  g.document = { scripts: [] };
  g.fetch = async (input: unknown) => {
    const url = String(input);
    const path = new URL(url, ORIGIN).pathname;
    seen.push({ url, path });
    if (path.startsWith('/_next/static/app-code/')) {
      return map ? new Response(JSON.stringify(map), { status: 200 }) : new Response('not found', { status: 404 });
    }
    if (path.startsWith('/_next/static/')) return new Response('/* chunk */', { status: 200 });
    // An app route: a server render. (Answered like one, so a job that asked would carry on and be counted.)
    return new Response('c:I[1,["9","static/chunks/9-abc.js"],"X"]', { status: 200, headers: { 'content-type': 'text/x-component' } });
  };
  return run(seen).finally(() => {
    g.fetch = before.fetch;
    g.window = before.window;
    g.document = before.document;
    forgetCodeMap();
  });
}

const toAppRoutes = (seen: Seen[]) => seen.filter((s) => !s.path.startsWith('/_next/static/'));

/** Run the shell's jobs for `routes` through the real queue until it is empty. */
async function runShellPreload(routes: readonly string[]): Promise<{ jobs: number; loaded: number }> {
  const idle: Array<() => void> = [];
  const q = createPreloader({ saveData: false, afterLoad: (cb) => cb(), whenIdle: (cb) => idle.push(cb) });
  const jobs = appPreloadJobs(routes);
  q.preload(jobs);
  for (let i = 0; i < 2000 && idle.length > 0; i += 1) {
    idle.shift()!();
    for (let k = 0; k < 6; k += 1) await new Promise((r) => setTimeout(r, 0));
  }
  return { jobs: jobs.length, loaded: q.loadedKeys().size };
}

/* ═══ 1 · THE COUNT ══════════════════════════════════════════════════════ */

test('🔎 the counter sees a page render when one is asked for', async () => {
  await withCountingFetch(null, async (seen) => {
    await fetch(`/dashboard/${EVENT}/guests?_rsc=preload`, { headers: { RSC: '1' } });
    assert.equal(toAppRoutes(seen).length, 1, 'the counting fetch cannot tell an app route from a static file');
  });
});

test('a signed-in load by a host WITH a shop — the whole plan, run to the end: 0 requests to app routes, 1 map, each chunk once', async () => {
  const plan = appPreloadPlan({ hostEventId: EVENT, hasShop: true }).routes;
  // 🔎 The plan is real and is the size the incident was — an empty list cannot pass this.
  assert.ok(plan.length >= 10, `the plan shrank to ${plan.length}`);
  assert.ok(plan.includes(`/dashboard/${EVENT}/launch`) && plan.includes('/vendor-dashboard/customers'));
  const map = appCodeMap(manifestFor(plan));
  await withCountingFetch(map, async (seen) => {
    const ran = await runShellPreload(plan);
    assert.equal(ran.jobs, plan.length, 'one job per planned page');
    assert.equal(ran.loaded, plan.length, 'every page’s code was brought — the preload still does its job');
    const routes = toAppRoutes(seen);
    assert.equal(routes.length, 0, `the shell's preload asked the server to render ${routes.length} page(s): ${routes.map((r) => r.url).join(' · ')}`);
    assert.equal(seen.filter((s) => s.path === appCodeMapUrl(buildVersion({}))).length, 1, 'the code map is asked for ONCE per page load');
    const chunks = seen.filter((s) => s.path.startsWith('/_next/static/chunks/')).map((s) => s.path);
    // Every planned page's own chunk, and the layouts above them.
    assert.ok(chunks.length >= plan.length, `only ${chunks.length} chunk files were fetched for ${plan.length} pages`);
    assert.ok(chunks.includes('/_next/static/chunks/event-4.js') && chunks.includes('/_next/static/chunks/shop-6.js'), 'a layout’s code was not brought');
    assert.ok(!chunks.some((c) => c.includes('guest-7') || c.includes('admin-8')), 'code of a page outside the signed-in app was fetched');
  });
});

test('…the same for a host alone and for a supplier alone', async () => {
  for (const input of [
    { hostEventId: EVENT, hasShop: false },
    { hostEventId: null, hasShop: true },
  ]) {
    const plan = appPreloadPlan(input).routes;
    assert.ok(plan.length >= 4);
    await withCountingFetch(appCodeMap(manifestFor(plan)), async (seen) => {
      const ran = await runShellPreload(plan);
      assert.equal(ran.loaded, plan.length);
      assert.equal(toAppRoutes(seen).length, 0, JSON.stringify(input));
    });
  }
});

test('no code map (a host that does not serve it, a local dev server): ONE refused request and NOTHING else — never a page', async () => {
  const plan = appPreloadPlan({ hostEventId: EVENT, hasShop: true }).routes;
  await withCountingFetch(null, async (seen) => {
    const ran = await runShellPreload(plan);
    assert.equal(ran.loaded, 0, 'a job claimed to have loaded code with no map');
    assert.equal(seen.length, 1, `without a map the preload still made ${seen.length} requests: ${seen.map((s) => s.path).join(' · ')}`);
    assert.equal(toAppRoutes(seen).length, 0);
  });
});

test('a page the map does not know is skipped — never fetched to find out', async () => {
  const plan = [`/dashboard/${EVENT}/guests`, `/dashboard/${EVENT}/a-page-built-after-this-deploy`];
  const map = appCodeMap(manifestFor([plan[0]!]));
  await withCountingFetch(map, async (seen) => {
    const ran = await runShellPreload(plan);
    assert.equal(ran.loaded, 1);
    assert.equal(toAppRoutes(seen).length, 0);
  });
});

/* ═══ 2 · THE MAP ════════════════════════════════════════════════════════ */

test('the build step lists only the signed-in app’s pages, with their layouts’ code, each chunk once, .js only', () => {
  const plan = appPreloadPlan({ hostEventId: EVENT, hasShop: true }).routes;
  const map: AppCodeMap = appCodeMap(manifestFor(plan));
  assert.equal(map.v, 1);
  assert.equal(new Set(map.chunks).size, map.chunks.length, 'a chunk is listed twice');
  assert.ok(map.chunks.every((c) => c.startsWith('/_next/static/chunks/') && c.endsWith('.js')), 'something that is not a chunk file is listed');
  assert.ok(Object.keys(map.routes).every((r) => r.startsWith('/dashboard/') || r === '/vendor-dashboard' || r.startsWith('/vendor-dashboard/')));
  assert.equal(Object.keys(map.routes).length, plan.length);
  const guests = chunksForRoute(map, `/dashboard/${EVENT}/guests`)!;
  for (const c of ['webpack-1', 'main-app-2', 'dash-3', 'event-4', 'event-loading-5', 'shared-9']) {
    assert.ok(guests.some((g) => g.includes(c)), `the Guests page is missing ${c}`);
  }
  assert.ok(!guests.some((g) => g.includes('shop-6')), 'the Guests page lists the shop’s layout');
  assert.ok(chunksForRoute(map, '/vendor-dashboard/customers')!.some((g) => g.includes('shop-6')));
  // A route group is not part of the address.
  assert.equal(urlRouteOf('/dashboard/(launcher)/settings'), '/dashboard/settings');
  const grouped = appCodeMap({ '/layout': ['static/chunks/w.js'], '/dashboard/(launcher)/layout': ['static/chunks/l.js'], '/dashboard/(launcher)/settings/page': ['static/chunks/s.js'] });
  assert.deepEqual(chunksForRoute(grouped, '/dashboard/settings'), ['/_next/static/chunks/w.js', '/_next/static/chunks/l.js', '/_next/static/chunks/s.js']);
});

test('an address finds its page by the event’s id; a map can only ever name the build’s own chunk files', () => {
  assert.deepEqual(routePatternsOf(`/dashboard/${EVENT}/guests?tab=all`), [`/dashboard/${EVENT}/guests`, '/dashboard/[eventId]/guests']);
  assert.deepEqual(routePatternsOf(`/dashboard/${EVENT}`), [`/dashboard/${EVENT}`, '/dashboard/[eventId]']);
  assert.deepEqual(routePatternsOf('/vendor-dashboard/shop/'), ['/vendor-dashboard/shop']);
  const hostile: AppCodeMap = { v: 1, chunks: ['/dashboard/x/guests', 'https://evil.test/a.js', '/_next/static/chunks/../../api/x.js', '/_next/static/chunks/ok-1.js'], routes: { '/vendor-dashboard': [0, 1, 2, 3, 99] } };
  assert.deepEqual(chunksForRoute(hostile, '/vendor-dashboard'), ['/_next/static/chunks/ok-1.js']);
  assert.equal(chunksForRoute(null, '/vendor-dashboard'), null);
  assert.equal(chunksForRoute({ v: 2 } as unknown as AppCodeMap, '/vendor-dashboard'), null);
  assert.equal(chunksForRoute(hostile, '/vendor-dashboard/unknown'), null);
});

test('the map’s address is the build version both sides read — and the build writes it after next build', async () => {
  assert.equal(buildVersion({ VERCEL_GIT_COMMIT_SHA: 'abcdef1234567' }), 'abcdef1');
  assert.equal(buildVersion({}), 'dev');
  assert.equal(appCodeMapUrl('abcdef1'), '/_next/static/app-code/abcdef1.json');
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { scripts: { build: string } };
  assert.match(pkg.scripts.build, /next build && .*node scripts\/write-app-code-map\.mjs/, 'the build no longer writes the code map — the app would silently stop preloading');
  const config = readFileSync(join(__dirname, '..', 'next.config.ts'), 'utf8');
  assert.match(config, /NEXT_PUBLIC_BUILD_VERSION:\s*process\.env\.VERCEL_GIT_COMMIT_SHA\?\.slice\(0, 7\) \?\? 'dev'/, 'next.config and the build script must derive the version the same way');
});
