/**
 * app-preload-renders-nothing.test.ts — 🧯 A SIGNED-IN PAGE LOAD ASKS THE SERVER
 * TO RENDER NO OTHER PAGE.
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
 * So this COUNTS, with a counting `fetch`, the requests the shell's preload
 * makes when the queue runs a whole realistic plan to the end:
 *
 *     to an app route (a page the server must render):  0
 *
 * 🔎 The count is honest only if the counter can see such a request, so the
 * file also runs the old job ONCE by hand and requires it to be counted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreloader } from './app-preload';
import { appPreloadPlan } from './app-preload-sets';
import { APP_PRELOAD_RENDERS_ROUTES, appPreloadJobs, preloadRouteCode } from '../app/_components/app-preload';

const EVENT = '22222222-2222-4222-8222-222222222222';
const ORIGIN = 'https://setnayan.test';

type Seen = { url: string; rsc: boolean };

/** A browser's worth of globals for the job, and a `fetch` that records every request and answers like the app. */
function withCountingFetch<T>(run: (seen: Seen[]) => Promise<T>): Promise<T> {
  const g = globalThis as unknown as Record<string, unknown>;
  const before = { fetch: g.fetch, window: g.window, document: g.document };
  const seen: Seen[] = [];
  g.window = { location: { origin: ORIGIN } };
  g.document = { scripts: [] };
  g.fetch = async (input: unknown, init?: { headers?: Record<string, string> }) => {
    const url = String(input);
    seen.push({ url, rsc: init?.headers?.RSC === '1' || url.includes('_rsc=') });
    // An app route answers with an RSC payload naming one chunk; a chunk answers with bytes.
    if (url.includes('/_next/static/')) return new Response('/* chunk */', { status: 200 });
    return new Response('c:I[1,["9","static/chunks/9-abc.js"],"X"]', { status: 200, headers: { 'content-type': 'text/x-component' } });
  };
  return run(seen).finally(() => {
    g.fetch = before.fetch;
    g.window = before.window;
    g.document = before.document;
  });
}

const isAppRoute = (s: Seen) => {
  const path = new URL(s.url, ORIGIN).pathname;
  return !path.startsWith('/_next/static/');
};

/** Run the shell's jobs for `routes` through the real queue until it is empty. */
async function runShellPreload(routes: readonly string[]): Promise<number> {
  const idle: Array<() => void> = [];
  const q = createPreloader({ saveData: false, afterLoad: (cb) => cb(), whenIdle: (cb) => idle.push(cb) });
  const jobs = appPreloadJobs(routes);
  q.preload(jobs);
  // Every idle moment the queue asks for, until it asks for no more.
  for (let i = 0; i < 500 && idle.length > 0; i += 1) {
    idle.shift()!();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  }
  return jobs.length;
}

test('🔎 the counter sees a page render: the old job, run once by hand, is ONE request to an app route', async () => {
  await withCountingFetch(async (seen) => {
    await preloadRouteCode(`/dashboard/${EVENT}/guests`);
    const routes = seen.filter(isAppRoute);
    assert.equal(routes.length, 1, `expected the job's page fetch to be counted: ${JSON.stringify(seen)}`);
    assert.ok(routes[0]!.rsc, 'and it asks for the page the way the router does — a server render');
    assert.match(routes[0]!.url, new RegExp(`/dashboard/${EVENT}/guests\\?_rsc=preload`));
    // …then the chunk it named, from the static files.
    assert.equal(seen.filter((s) => !isAppRoute(s)).length, 1);
  });
});

test('a signed-in load by a host WITH a shop — the whole plan, run to the end — renders no other page: 0 requests to app routes', async () => {
  const plan = appPreloadPlan({ hostEventId: EVENT, hasShop: true }).routes;
  // 🔎 The plan is real and is the size the incident was: a handful of host pages and the shop's.
  assert.ok(plan.length >= 10, `the plan shrank to ${plan.length} — this test would pass on an empty list`);
  assert.ok(plan.includes(`/dashboard/${EVENT}/launch`) && plan.includes('/vendor-dashboard/customers'));
  await withCountingFetch(async (seen) => {
    await runShellPreload(plan);
    const routes = seen.filter(isAppRoute);
    assert.equal(routes.length, 0, `the shell's preload asked the server to render ${routes.length} page(s): ${routes.map((r) => r.url).join(' · ')}`);
  });
});

test('…and the same for a host alone, and for a supplier alone', async () => {
  for (const input of [
    { hostEventId: EVENT, hasShop: false },
    { hostEventId: null, hasShop: true },
  ]) {
    const plan = appPreloadPlan(input).routes;
    assert.ok(plan.length >= 4);
    await withCountingFetch(async (seen) => {
      await runShellPreload(plan);
      assert.equal(seen.filter(isAppRoute).length, 0, JSON.stringify(input));
    });
  }
});

test('the switch is one constant, and it is off', () => {
  assert.equal(APP_PRELOAD_RENDERS_ROUTES, false, 'a page render is never a cheap way to learn a chunk name — see app-preload.tsx "SWITCHED OFF"');
  assert.deepEqual(appPreloadJobs([`/dashboard/${EVENT}`, '/vendor-dashboard']), []);
});
