/**
 * GUARD — `public/sw.js` keeps the app's code on the phone across deploys.
 *
 * DECISION_LOG 2026-10-02 "A HOST'S WHOLE APP LOADS ONCE, IN THE BACKGROUND…
 * AND STAYS ON THE PHONE" (part 2). Before it, every deploy (~6 a day) stamped a
 * new VERSION into sw.js and `activate` deleted every cache not named with it —
 * so ALL cached code was thrown away and a returning host re-downloaded the
 * whole app. Next's content-hashed build files (/_next/static/chunks|css|media/)
 * now live in a cache whose name does not carry VERSION, keyed by path alone
 * (Vercel's per-deploy `?dpl=` query dropped), while everything that is NOT
 * content-hashed keeps the per-deploy wipe — so the 2026-06-14 "stale shell
 * after deploy" bug class stays dead.
 *
 * HOW: sw.js is a plain public script, so it is run for real here — in a `vm`
 * context with a fake CacheStorage, a fake `fetch`, a controllable clock and a
 * minimal `self`. A "deploy" is a second copy of the script with a different
 * VERSION (stamped the same way `scripts/stamp-sw.mjs` does it) sharing the
 * SAME CacheStorage, exactly as a new worker inherits the old one's caches.
 *
 * Mutation-tested 2026-10-02 (each turned the named test red, then reverted):
 *   - IMMUTABLE_CACHE named with `${VERSION}`          → "a content-hashed chunk survives a deploy"
 *   - IMMUTABLE_PATH widened to every /_next/static/   → "anything not content-hashed is still wiped"
 *   - clearAllCaches skipping the immutable cache      → "CACHE_BUST drops every cache"
 *   - `?dpl=` kept in the cache key                    → "a content-hashed chunk survives a deploy"
 *   - the text/html refusal removed                    → "an HTML answer is never pinned"
 *   - the 30-day prune / LRU budget disabled           → "evicts by last request"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SW_FILE = path.join(import.meta.dirname, '..', 'public', 'sw.js');
const ORIGIN = 'https://www.setnayan.com';
const DAY = 24 * 60 * 60 * 1000;
const IMMUTABLE = 'setnayan-static-immutable-v1';

// ── Fake CacheStorage ──────────────────────────────────────────────────────

type Keyish = string | { url: string };

function keyOf(k: Keyish): string {
  return typeof k === 'string' ? new URL(k, ORIGIN).href : k.url;
}

class FakeCache {
  readonly store = new Map<string, Response>();
  async match(k: Keyish): Promise<Response | undefined> {
    const hit = this.store.get(keyOf(k));
    return hit ? hit.clone() : undefined;
  }
  async put(k: Keyish, res: Response): Promise<void> {
    // Like the real thing: the body is read in full before the put resolves.
    const body = await res.arrayBuffer();
    this.store.set(
      keyOf(k),
      new Response(body, { status: res.status, headers: res.headers }),
    );
  }
  async delete(k: Keyish): Promise<boolean> {
    return this.store.delete(keyOf(k));
  }
  async addAll(urls: string[]): Promise<void> {
    for (const u of urls) this.store.set(keyOf(u), new Response(`shell ${u}`));
  }
  async keys(): Promise<Request[]> {
    return [...this.store.keys()].map((u) => new Request(u));
  }
}

class FakeCacheStorage {
  readonly byName = new Map<string, FakeCache>();
  async open(name: string): Promise<FakeCache> {
    let c = this.byName.get(name);
    if (!c) {
      c = new FakeCache();
      this.byName.set(name, c);
    }
    return c;
  }
  async keys(): Promise<string[]> {
    return [...this.byName.keys()];
  }
  async delete(name: string): Promise<boolean> {
    return this.byName.delete(name);
  }
  async match(k: Keyish): Promise<Response | undefined> {
    for (const c of this.byName.values()) {
      const hit = await c.match(k);
      if (hit) return hit;
    }
    return undefined;
  }
}

// ── Fake network ───────────────────────────────────────────────────────────

type Net = {
  calls: string[];
  respond: (url: string) => Response;
};

function basic(body: string, contentType: string, status = 200): Response {
  const res = new Response(body, { status, headers: { 'Content-Type': contentType } });
  // Node's Response reports type 'default'; a same-origin browser fetch is 'basic'.
  Object.defineProperty(res, 'type', { value: 'basic' });
  return res;
}

function defaultNet(): Net {
  return {
    calls: [],
    respond: (url) => {
      const p = new URL(url).pathname;
      if (p.endsWith('.css')) return basic(`/* ${p} */ body{}`, 'text/css');
      if (p.endsWith('.woff2')) return basic(`font ${p}`, 'font/woff2');
      return basic(`// ${p}`, 'application/javascript');
    },
  };
}

// ── One worker = one deploy ────────────────────────────────────────────────

type Listener = (ev: Record<string, unknown>) => void;

type Worker = {
  dispatch: (type: string, init?: Record<string, unknown>) => Promise<{
    responded: boolean;
    response: Response | undefined;
  }>;
  fetch: (
    pathAndQuery: string,
    opts?: { destination?: string; mode?: string; headers?: Record<string, string> },
  ) => Promise<{ responded: boolean; response: Response | undefined }>;
};

type World = { caches: FakeCacheStorage; net: Net; clock: { now: number } };

function newWorld(): World {
  return { caches: new FakeCacheStorage(), net: defaultNet(), clock: { now: Date.UTC(2026, 9, 2) } };
}

function bootWorker(world: World, version: string, edit?: (src: string) => string): Worker {
  let src = readFileSync(SW_FILE, 'utf8');
  // Same anchored regex as scripts/stamp-sw.mjs — a deploy is exactly this edit.
  const VERSION_RE = /^const VERSION = '[^']*';/m;
  assert.ok(VERSION_RE.test(src), "sw.js lost its `const VERSION = '…';` line (stamp-sw needs it)");
  src = src.replace(VERSION_RE, `const VERSION = '${version}';`);
  if (edit) src = edit(src);

  const listeners: Record<string, Listener[]> = {};
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, fn: Listener) => {
      (listeners[type] ??= []).push(fn);
    },
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
    registration: {},
  };
  const context = vm.createContext({
    self,
    caches: world.caches,
    fetch: async (req: Keyish) => {
      const url = keyOf(req);
      world.net.calls.push(url);
      return world.net.respond(url);
    },
    Request,
    Response,
    Headers,
    URL,
    Date: { now: () => world.clock.now },
    // The index flush waits 1s in the browser; here, the next turn.
    setTimeout: (fn: () => void) => setImmediate(fn),
    console,
  });
  vm.runInContext(src, context, { filename: 'sw.js' });

  const dispatch: Worker['dispatch'] = async (type, init = {}) => {
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
    return { responded: responded !== undefined, response };
  };

  return {
    dispatch,
    fetch: (pathAndQuery, opts = {}) =>
      dispatch('fetch', {
        request: {
          method: 'GET',
          url: new URL(pathAndQuery, ORIGIN).href,
          destination: opts.destination ?? 'script',
          mode: opts.mode ?? 'no-cors',
          headers: new Headers(opts.headers ?? {}),
        },
      }),
  };
}

async function deploy(world: World, version: string, edit?: (src: string) => string) {
  const w = bootWorker(world, version, edit);
  await w.dispatch('install');
  await w.dispatch('activate');
  return w;
}

const settle = () => new Promise((r) => setTimeout(r, 20));

function cacheUrls(world: World, name: string): string[] {
  const c = world.caches.byName.get(name);
  return c ? [...c.store.keys()].filter((u) => !u.includes('/__setnayan-sw/')).sort() : [];
}

// A real file name from a production build's shape: <route>-<16 hex>.js
const CHUNK = '/_next/static/chunks/app/dashboard/%5BeventId%5D/page-0a1b2c3d4e5f6789.js';
const CSS = '/_next/static/css/c627faead13e2e1f.css';
const FONT = '/_next/static/media/313510e2713fb214-s.p.woff2';
const BUILD_MANIFEST = '/_next/static/YD_d3FTrS8qc8BT1glHf6/_buildManifest.js';

// ── Tests ──────────────────────────────────────────────────────────────────

test('a content-hashed chunk survives a deploy; the shell cache does not', async () => {
  const world = newWorld();
  const a = await deploy(world, 'deployA');
  await a.fetch(`${CHUNK}?dpl=dpl_AAAA`);
  await a.fetch(`${CSS}?dpl=dpl_AAAA`, { destination: 'style' });
  await a.fetch(FONT, { destination: 'font' });
  assert.ok(world.caches.byName.has('setnayan-deployA'), 'deploy A shell cache exists');
  assert.deepEqual(cacheUrls(world, IMMUTABLE), [CHUNK, CSS, FONT].map((p) => ORIGIN + p).sort());

  // Next deploy: new VERSION, same CacheStorage.
  await deploy(world, 'deployB');
  const names = await world.caches.keys();
  assert.ok(!names.includes('setnayan-deployA'), 'old shell cache is deleted by the deploy');
  assert.ok(names.includes('setnayan-deployB'), 'new shell cache installed');
  assert.ok(names.includes(IMMUTABLE), 'the immutable cache is NOT deleted by the deploy');
  assert.deepEqual(cacheUrls(world, IMMUTABLE), [CHUNK, CSS, FONT].map((p) => ORIGIN + p).sort());

  // The new deploy's HTML asks for the same unchanged file under ITS `?dpl=`.
  const b = bootWorker(world, 'deployB');
  world.net.calls = [];
  const { responded, response } = await b.fetch(`${CHUNK}?dpl=dpl_BBBB`);
  assert.ok(responded, 'the worker answers the chunk request');
  assert.deepEqual(world.net.calls, [], 'served from the phone — no network request');
  assert.equal(await response?.text(), `// ${CHUNK}`);
});

test('anything not content-hashed is still wiped per deploy', async () => {
  const world = newWorld();
  const a = await deploy(world, 'deployA');
  // Per-build manifest: fixed name, bytes change every build.
  await a.fetch(`${BUILD_MANIFEST}?dpl=dpl_AAAA`);
  // A file in chunks/ with no hash in its name, and a plain public script.
  await a.fetch('/_next/static/chunks/polyfills.js');
  await a.fetch('/vendor-widget.js');
  // SWR stores in the background (not under waitUntil); let it land.
  await settle();
  const staticA = cacheUrls(world, 'setnayan-static-deployA');
  assert.deepEqual(
    staticA,
    [BUILD_MANIFEST + '?dpl=dpl_AAAA', '/_next/static/chunks/polyfills.js', '/vendor-widget.js']
      .map((p) => ORIGIN + p)
      .sort(),
    'non-hashed scripts go to the per-deploy static cache',
  );
  assert.deepEqual(cacheUrls(world, IMMUTABLE), [], 'and never into the immutable cache');

  await deploy(world, 'deployB');
  const names = await world.caches.keys();
  assert.ok(!names.includes('setnayan-static-deployA'), 'the per-deploy static cache is wiped');
  assert.ok(!names.includes('setnayan-deployA'), 'the shell cache is wiped');
});

test('CACHE_BUST drops every cache, the immutable one included', async () => {
  const world = newWorld();
  const a = await deploy(world, 'deployA');
  await a.fetch(CHUNK);
  await a.fetch('/vendor-widget.js');
  await settle();
  assert.ok((await world.caches.keys()).includes(IMMUTABLE));

  await a.dispatch('message', { data: { type: 'CACHE_BUST' } });
  assert.deepEqual(await world.caches.keys(), [], 'nothing survives a bust');

  // And the worker does not believe its forgotten index afterwards.
  world.net.calls = [];
  await a.fetch(CHUNK);
  assert.deepEqual(world.net.calls, [ORIGIN + CHUNK], 're-downloaded after the bust');
  assert.deepEqual(cacheUrls(world, IMMUTABLE), [ORIGIN + CHUNK]);
});

test('an HTML answer under a chunk name is never pinned', async () => {
  const world = newWorld();
  world.net.respond = () => basic('<!doctype html><title>Sign in</title>', 'text/html; charset=utf-8');
  const a = await deploy(world, 'deployA');
  await a.fetch(CHUNK);
  assert.deepEqual(cacheUrls(world, IMMUTABLE), [], 'a 200 HTML page is not kept as code');

  world.net.respond = () => basic('missing', 'text/plain', 404);
  await a.fetch(CSS, { destination: 'style' });
  assert.deepEqual(cacheUrls(world, IMMUTABLE), [], 'a 404 is not kept');
});

test('evicts by last request: 30-day prune and the LRU entry cap, across worker restarts', async () => {
  const world = newWorld();
  // Shrink the cap so the test does not need 1,500 files.
  const small = (src: string) => src.replace(/maxEntries: 1500,/, 'maxEntries: 3,');
  const file = (n: number) => `/_next/static/chunks/${n}-${String(n).repeat(16).slice(0, 16)}.js`;

  const a = await deploy(world, 'deployA', small);
  const t0 = world.clock.now;
  await a.fetch(file(1));
  world.clock.now = t0 + 1 * DAY;
  await a.fetch(file(2));
  world.clock.now = t0 + 2 * DAY;
  await a.fetch(file(3));
  world.clock.now = t0 + 3 * DAY;
  await a.fetch(file(1)); // file 1 is requested again — now the most recent

  // A FRESH worker (new deploy: empty memory) must still know the order — it is
  // persisted, not held in memory. A 4th file evicts the least recent: file 2.
  const b = await deploy(world, 'deployB', small);
  world.clock.now = t0 + 4 * DAY;
  await b.fetch(file(4));
  assert.deepEqual(
    cacheUrls(world, IMMUTABLE),
    [file(1), file(3), file(4)].map((p) => ORIGIN + p).sort(),
    'least-recently-requested file evicted at the cap',
  );

  // Day 33½: files 3 (day 2) and 1 (day 3) were last asked for over 30 days
  // ago, file 4 (day 4) under. A restart prunes on activate, before any fetch.
  world.clock.now = t0 + 33 * DAY + DAY / 2;
  await deploy(world, 'deployC', small);
  assert.deepEqual(
    cacheUrls(world, IMMUTABLE),
    [file(4)].map((p) => ORIGIN + p),
    'files not requested for 30 days are pruned',
  );
});

test('evicts by size: the byte budget holds even under the entry cap', async () => {
  const world = newWorld();
  const tiny = (src: string) => src.replace(/maxBytes: 100 \* 1024 \* 1024,/, 'maxBytes: 100,');
  world.net.respond = (url) => basic('x'.repeat(40) + new URL(url).pathname.slice(-4), 'application/javascript');
  const a = await deploy(world, 'deployA', tiny);
  const file = (n: number) => `/_next/static/chunks/${n}-${String(n).repeat(16).slice(0, 16)}.js`;
  for (const n of [1, 2, 3]) {
    world.clock.now += 1000;
    await a.fetch(file(n));
  }
  // 3 × 44 bytes > 100 → the oldest goes.
  assert.deepEqual(cacheUrls(world, IMMUTABLE), [file(2), file(3)].map((p) => ORIGIN + p).sort());
});

test('navigations and Range requests are left to the browser', async () => {
  const world = newWorld();
  const a = await deploy(world, 'deployA');
  const nav = await a.fetch('/dashboard', { destination: 'document', mode: 'navigate' });
  assert.equal(nav.responded, false, 'app-shell navigations stay un-intercepted (Safari crash)');
  const ranged = await a.fetch('/_next/static/media/intro.0a1b2c3d.mp4', {
    destination: 'video',
    headers: { Range: 'bytes=0-' },
  });
  assert.equal(ranged.responded, false, 'a Range request goes straight to the network');
});

test('the immutable cache name never carries the per-deploy VERSION', () => {
  const src = readFileSync(SW_FILE, 'utf8');
  const line = src.match(/^const IMMUTABLE_CACHE = (.+);$/m);
  assert.ok(line, 'sw.js declares `const IMMUTABLE_CACHE = …;`');
  assert.doesNotMatch(line[1] ?? '', /VERSION/, 'IMMUTABLE_CACHE must not be derived from VERSION');
  assert.match(src, /KNOWN_CACHES = \[[^\]]*IMMUTABLE_CACHE/, 'activate must keep it');
});
