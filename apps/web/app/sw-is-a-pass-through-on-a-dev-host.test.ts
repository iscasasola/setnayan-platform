/**
 * GUARD — `public/sw.js` is a PASS-THROUGH on a development host, and behaves exactly as before on every other.
 *
 * THE FAULT (2026-10-09): the worker is registered wherever the app runs, `next dev` included. On a dev server the files behind
 * /_next/static are not content-hashed — one URL holds new bytes after every edit — and the worker's stale-while-revalidate
 * answered each such script from its cache FIRST. So the first load after every change ran the PREVIOUS page script against the
 * NEW html and css, and a reviewer judged (and reported faults in) code that had already been replaced.
 *
 * THE CURE: on a development host — localhost · 127.0.0.1 · [::1] · *.localhost · *.test · a private LAN address (10.* ·
 * 172.16–31.* · 192.168.*) — the worker never reads a cache, never writes one and never calls respondWith; on activate it
 * deletes every `setnayan-…` cache an earlier copy made and claims its clients, so a worker that was already installed (and is
 * serving stale scripts) is replaced and stops. It lives INSIDE sw.js, a static file: no bundle, no first-load cost.
 *
 * HOW: sw.js is run for real, in a `vm` context with a recording CacheStorage and a fake network (as `sw-keeps-code.test.ts`
 * does). Two halves:
 *  (1) PRODUCTION IS UNCHANGED — the same scenario (install · activate over old caches · every kind of request, twice · both
 *      messages) is run for each production origin, including look-alikes (`localhost.example.com`, `mytest.com`, `172.32.0.1`,
 *      `11.0.0.1`…), and its trace — what was answered, with which body, and every cache open / put / delete — is compared with
 *      `sw-production-trace.golden.json`, recorded from the worker as it was BEFORE this change (210c0195f). Regenerate only
 *      with `SW_TRACE_FROM=<path of an older sw.js> npx tsx --test app/sw-is-a-pass-through-on-a-dev-host.test.ts`.
 *  (2) A DEVELOPMENT HOST IS A PASS-THROUGH — for each dev host: no request is answered, nothing touches a cache, nothing is
 *      pre-cached on install, a preload writes nothing, and activate leaves only caches that are not the worker's.
 *
 * Mutation-tested (each turned a named test red, then reverted):
 *   - the `if (DEV_HOST) return;` at the top of `fetch` removed       → "a development host answers no request"
 *   - the install pre-cache left on for a dev host                     → "a development host pre-caches nothing"
 *   - the PRELOAD_ASSETS guard removed                                 → "a preload on a development host writes nothing"
 *   - the dev activate not deleting the old caches / not claiming      → "…deletes what an older copy made and claims"
 *   - a public-looking host treated as dev (172.32 · .example.com)    → "production looks the same as before"
 *   - a private range left out (172.31 · 10.*)                        → "every development host is recognised"
 *   - a production behaviour changed (e.g. images no longer cached)   → "production looks the same as before"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SW_FILE = path.join(import.meta.dirname, '..', 'public', 'sw.js');
const GOLDEN = path.join(import.meta.dirname, 'sw-production-trace.golden.json');

const DEV_HOSTS = [
  'http://localhost:3480',
  'http://127.0.0.1:3480',
  'http://[::1]:3480',
  'http://app.localhost:3000',
  'http://foo.test',
  'http://10.0.0.5:3480',
  'http://10.255.255.254',
  'http://172.16.0.1:3480',
  'http://172.31.255.1:3480',
  'http://192.168.254.117:3480',
  'http://192.168.0.1',
];
const PRODUCTION_HOSTS = [
  'https://www.setnayan.com',
  'https://setnayan.com',
  'https://setnayan-platform-web.vercel.app',
  // Look-alikes that are NOT development hosts — they must keep caching.
  'https://localhost.example.com',
  'https://notlocalhost.com',
  'https://mytest.com',
  'https://supertest',
  'https://test.example.com',
  'https://172.32.0.1',
  'https://172.15.0.1',
  'https://11.0.0.1',
  'https://193.168.0.1',
  'https://192.169.0.1',
  'https://8.8.8.8',
];

// ── Recording CacheStorage ─────────────────────────────────────────────────

type Keyish = string | { url: string };
const keyOf = (k: Keyish, origin: string) => (typeof k === 'string' ? new URL(k, origin).href : k.url);

type Log = string[];

function makeCaches(origin: string, log: Log) {
  const rel = (u: string) => u.replace(origin, '');
  class FakeCache {
    constructor(readonly name: string) {}
    readonly store = new Map<string, Response>();
    async match(k: Keyish) {
      const hit = this.store.get(keyOf(k, origin));
      log.push(`match ${this.name} ${rel(keyOf(k, origin))} ${hit ? 'hit' : 'miss'}`);
      return hit ? hit.clone() : undefined;
    }
    async put(k: Keyish, res: Response) {
      const body = await res.arrayBuffer();
      this.store.set(keyOf(k, origin), new Response(body, { status: res.status, headers: res.headers }));
      log.push(`put ${this.name} ${rel(keyOf(k, origin))}`);
    }
    async delete(k: Keyish) {
      log.push(`delete-entry ${this.name} ${rel(keyOf(k, origin))}`);
      return this.store.delete(keyOf(k, origin));
    }
    async addAll(urls: string[]) {
      log.push(`addAll ${this.name} ${urls.length}`);
      for (const u of urls) this.store.set(keyOf(u, origin), new Response(`shell ${u}`));
    }
    async keys() {
      return [...this.store.keys()].map((u) => new Request(u));
    }
  }
  const byName = new Map<string, FakeCache>();
  return {
    byName,
    async open(name: string) {
      log.push(`open ${name}`);
      let c = byName.get(name);
      if (!c) {
        c = new FakeCache(name);
        byName.set(name, c);
      }
      return c;
    },
    async keys() {
      log.push('keys');
      return [...byName.keys()];
    },
    async delete(name: string) {
      log.push(`delete-cache ${name}`);
      return byName.delete(name);
    },
    async match(k: Keyish) {
      log.push(`match-all ${rel(keyOf(k, origin))}`);
      for (const c of byName.values()) {
        const hit = c.store.get(keyOf(k, origin));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
}

// ── One worker, at one origin ──────────────────────────────────────────────

type Listener = (ev: Record<string, unknown>) => void;

function boot(origin: string, src: string) {
  const log: Log = [];
  const caches = makeCaches(origin, log);
  const netCalls: Record<string, number> = {};
  const listeners: Record<string, Listener[]> = {};
  const counters = { claims: 0, skipWaiting: 0 };
  const self = {
    location: new URL(`${origin}/sw.js`),
    addEventListener: (type: string, fn: Listener) => {
      (listeners[type] ??= []).push(fn);
    },
    skipWaiting: () => {
      counters.skipWaiting += 1;
    },
    clients: {
      claim: async () => {
        counters.claims += 1;
      },
    },
    registration: {},
  };
  const context = vm.createContext({
    self,
    caches,
    fetch: async (req: Keyish) => {
      const url = keyOf(req, origin);
      netCalls[url] = (netCalls[url] ?? 0) + 1;
      const p = new URL(url).pathname;
      const type = p.endsWith('.css') ? 'text/css' : p.endsWith('.woff2') ? 'font/woff2' : p.endsWith('.png') ? 'image/png' : 'application/javascript';
      const res = new Response(`${p} #${netCalls[url]}`, { status: 200, headers: { 'Content-Type': type } });
      Object.defineProperty(res, 'type', { value: 'basic' });
      return res;
    },
    Request,
    Response,
    Headers,
    URL,
    Date: { now: () => Date.UTC(2026, 9, 9) },
    setTimeout: (fn: () => void) => setImmediate(fn),
    console,
  });
  vm.runInContext(src, context, { filename: 'sw.js' });

  const dispatch = async (type: string, init: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    const ev = {
      ...init,
      waitUntil: (p: Promise<unknown>) => {
        waits.push(p);
      },
      respondWith: (p: Promise<Response>) => {
        responded = p;
      },
    };
    for (const fn of listeners[type] ?? []) fn(ev);
    const response = responded ? await responded : undefined;
    await Promise.all(waits);
    await new Promise((r) => setTimeout(r, 15));
    return { responded: responded !== undefined, response };
  };
  const request = (method: string, pathAndQuery: string, opts: { destination?: string; mode?: string; origin?: string } = {}) =>
    dispatch('fetch', {
      request: {
        method,
        url: new URL(pathAndQuery, opts.origin ?? origin).href,
        destination: opts.destination ?? 'script',
        mode: opts.mode ?? 'no-cors',
        headers: new Headers(),
      },
    });
  return { dispatch, request, log, caches, netCalls, counters };
}

/** Everything a worker does in one life, as plain data. URLs are origin-relative so every origin can be compared. */
async function scenario(origin: string, src: string) {
  const w = boot(origin, src);
  const out: Record<string, unknown> = {};
  const mark = () => w.log.splice(0, w.log.length);

  // A worker from an earlier deploy left these behind.
  for (const name of ['setnayan-v1', 'setnayan-images-v1', 'setnayan-static-immutable-v1', 'unrelated-cache']) await w.caches.open(name);
  mark();

  await w.dispatch('install');
  out.install = { ops: mark(), skipWaiting: w.counters.skipWaiting };
  await w.dispatch('activate');
  out.activate = { ops: mark(), claims: w.counters.claims, left: [...w.caches.byName.keys()].sort() };

  const requests: Array<[string, string, string, { destination?: string; mode?: string; origin?: string }?]> = [
    ['hashed chunk', 'GET', '/_next/static/chunks/main-app-9041524f5488b3f7.js?dpl=a', { destination: 'script' }],
    ['hashed chunk again', 'GET', '/_next/static/chunks/main-app-9041524f5488b3f7.js?dpl=b', { destination: 'script' }],
    ['unhashed script', 'GET', '/_next/static/abc123/_buildManifest.js', { destination: 'script' }],
    ['unhashed script again', 'GET', '/_next/static/abc123/_buildManifest.js', { destination: 'script' }],
    ['dev-style script', 'GET', '/_next/static/chunks/app/page.js?v=1', { destination: 'script' }],
    ['dev-style script again', 'GET', '/_next/static/chunks/app/page.js?v=1', { destination: 'script' }],
    ['stylesheet', 'GET', '/_next/static/css/app/layout.css', { destination: 'style' }],
    ['image', 'GET', '/icons/a.png', { destination: 'image' }],
    ['image again', 'GET', '/icons/a.png', { destination: 'image' }],
    ['font', 'GET', '/fonts/x.woff2', { destination: 'font' }],
    ['app navigation', 'GET', '/dashboard', { destination: 'document', mode: 'navigate' }],
    ['guest navigation', 'GET', '/maria-and-jose', { destination: 'document', mode: 'navigate' }],
    ['api', 'GET', '/api/health', { destination: '' }],
    ['auth', 'GET', '/auth/callback', { destination: 'document', mode: 'navigate' }],
    ['post', 'POST', '/login', { destination: '' }],
    ['other origin', 'GET', '/x.js', { destination: 'script', origin: 'https://cdn.other.example' }],
  ];
  const seen: unknown[] = [];
  for (const [label, method, p, opts] of requests) {
    mark();
    const r = await w.request(method, p, opts);
    seen.push({
      label,
      responded: r.responded,
      status: r.response?.status ?? null,
      body: r.response ? await r.response.text() : null,
      ops: mark(),
    });
  }
  out.requests = seen;

  mark();
  await w.dispatch('message', { data: { type: 'PRELOAD_ASSETS', urls: [`${origin}/icons/b.png`, `${origin}/icons/c.png`] } });
  out.preload = { ops: mark(), cached: [...(w.caches.byName.get('setnayan-images-v4')?.store.keys() ?? [])].map((u) => u.replace(origin, '')) };
  mark();
  await w.dispatch('message', { data: { type: 'CACHE_BUST' } });
  out.bust = { ops: mark(), left: [...w.caches.byName.keys()].sort() };
  return { out, w };
}

const sw = () => readFileSync(SW_FILE, 'utf8');

// ── (1) production is unchanged ────────────────────────────────────────────

if (process.env.SW_TRACE_FROM) {
  test('regenerates the golden production trace from an older sw.js', async () => {
    const { out } = await scenario('https://www.setnayan.com', readFileSync(process.env.SW_TRACE_FROM!, 'utf8'));
    writeFileSync(GOLDEN, JSON.stringify(out, null, 2) + '\n');
  });
}

for (const origin of PRODUCTION_HOSTS) {
  test(`production looks the same as before — ${origin}`, async () => {
    assert.ok(existsSync(GOLDEN), 'the golden production trace is missing');
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    const { out } = await scenario(origin, sw());
    // Compare what was ANSWERED and what touched a cache, request by request — not a summary.
    assert.deepEqual(JSON.parse(JSON.stringify(out)), golden);
  });
}

test('the golden trace really does exercise the caches (so "unchanged" means something)', () => {
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  const answered = (golden.requests as Array<{ responded: boolean }>).filter((r) => r.responded).length;
  assert.ok(answered >= 8, `only ${answered} requests were answered in the golden trace`);
  const puts = JSON.stringify(golden).match(/"put /g)?.length ?? 0;
  assert.ok(puts >= 5, `only ${puts} cache writes in the golden trace`);
  assert.ok(golden.install.ops.some((o: string) => o.startsWith('addAll ')), 'production no longer pre-caches the shell on install');
  assert.ok(golden.activate.ops.includes('delete-cache setnayan-v1'), 'production no longer wipes an earlier deploy’s caches on activate');
  // The stale answer the dev server suffered is the production behaviour (and stays so): the 2nd unhashed-script request is the 1st's bytes.
  const byLabel = Object.fromEntries((golden.requests as Array<{ label: string; body: string }>).map((r) => [r.label, r.body]));
  assert.equal(byLabel['unhashed script'], byLabel['unhashed script again']);
});

// ── (2) a development host is a pass-through ───────────────────────────────

for (const origin of DEV_HOSTS) {
  test(`a development host is a pass-through — ${origin}`, async () => {
    const { out, w } = await scenario(origin, sw());
    const o = out as {
      install: { ops: string[]; skipWaiting: number };
      activate: { ops: string[]; claims: number; left: string[] };
      requests: Array<{ label: string; responded: boolean; ops: string[] }>;
      preload: { ops: string[]; cached: string[] };
    };

    // a development host answers no request, and no request touches a cache
    for (const r of o.requests) {
      assert.equal(r.responded, false, `${origin} answered "${r.label}" (a cached or networked answer for a dev server)`);
      assert.deepEqual(r.ops, [], `${origin} touched a cache for "${r.label}": ${r.ops.join(' · ')}`);
    }
    assert.deepEqual(w.netCalls, {}, 'the worker made a network call of its own');

    // a development host pre-caches nothing — and still takes over at once
    assert.deepEqual(o.install.ops, [], `${origin} pre-cached on install: ${o.install.ops.join(' · ')}`);
    assert.equal(o.install.skipWaiting, 1, 'install no longer calls skipWaiting, so an old worker would keep serving');

    // …deletes what an older copy made and claims, so an already-installed worker is replaced
    assert.deepEqual(o.activate.left, ['unrelated-cache'], `${origin} kept a worker cache: ${o.activate.left.join(', ')}`);
    assert.equal(o.activate.claims, 1, 'activate did not claim its clients');
    assert.ok(!o.activate.ops.some((x) => x.startsWith('open ') || x.startsWith('put ')), `${origin} wrote to a cache while activating`);

    // a preload on a development host writes nothing
    assert.deepEqual(o.preload.ops, [], `${origin} preloaded into a cache: ${o.preload.ops.join(' · ')}`);
    assert.deepEqual(o.preload.cached, []);
  });
}

test('every development host is recognised, and nothing public is mistaken for one', async () => {
  const intercepted = async (origin: string) => {
    const w = boot(origin, sw());
    const r = await w.request('GET', '/_next/static/abc123/_buildManifest.js', { destination: 'script' });
    return r.responded;
  };
  for (const origin of DEV_HOSTS) assert.equal(await intercepted(origin), false, `${origin} is not recognised as a development host`);
  for (const origin of PRODUCTION_HOSTS) assert.equal(await intercepted(origin), true, `${origin} is mistaken for a development host`);
});

test('the stamp still finds its line, and a stamp does not remove the dev-host handling', () => {
  const src = sw();
  const VERSION_RE = /^const VERSION = '[^']*';/m;
  assert.ok(VERSION_RE.test(src), "sw.js lost its `const VERSION = '…';` line (stamp-sw needs it)");
  const stamped = src.replace(VERSION_RE, "const VERSION = 'abcdef123456';");
  for (const needle of ['function isDevHost(', 'const DEV_HOST = isDevHost(self.location.hostname);', 'if (DEV_HOST) return;', 'forgetMyCaches()']) {
    assert.ok(stamped.includes(needle), `a stamped worker lost: ${needle}`);
  }
  assert.equal(stamped.match(/^const VERSION = /gm)?.length, 1, 'more than one VERSION line would be rewritten by the stamp');
});
