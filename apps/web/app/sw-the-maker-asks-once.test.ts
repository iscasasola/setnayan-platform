/**
 * GUARD — THE MAKER ASKS ONCE: `public/sw.js` makes no request of its own for a page the host's app asks for.
 *
 * THE FAULT (measured 2026-10-11 on a real event, Safari, with a temporary server logger): in 77 seconds of the Event Hub
 * Maker the guest page — a full server render, 31–34 database calls — was rendered about 22 times. After EVERY canvas load
 * one more request arrived for the BARE page (`/<slug>`; `referer: /sw.js`, `sec-fetch-mode: no-cors`, `sec-fetch-dest:
 * empty`). It is not the worker's navigation handler. It is the `PRELOAD_ASSETS` branch of its `message` listener: the guest
 * page mounts `GuestPreload` (`app/[slug]/_components/guest-preload.tsx`) in EVERY render, the Maker's canvas included, which
 * posts `/<slug>` to the worker to be kept for offline — and the worker fetches it (`fetch(url, { mode: 'no-cors' })`).
 * So every warm-up frame and every press cost two renders of the guest page, not one. The same canvas navigation was also
 * forwarded by the worker (`respondWith(fetch(request))`) and its HTML copied into the day-of cache, for nobody.
 *
 * THE CURE (all inside sw.js — `isHostAppNavigation` · `isHostCanvasClient`): a page the host's app asks for is the browser's
 * alone — no respondWith, no copy kept, and nothing it asks to be preloaded is fetched:
 *   (a) an address with `editor=1` or any `phase` query;
 *   (b) a navigation whose referrer is a document under /dashboard/ or /site-editor/, or is itself (a);
 *   (c) a page loaded into a frame (the guest page may only be framed by this origin — `frame-ancestors 'self'`).
 * A guest's own visit is exactly as before, and so is the caching of code, images and fonts.
 *
 * HOW: sw.js is run for real, in a `vm` context with a fake CacheStorage and a counting network (as
 * `sw-keeps-code.test.ts` and `sw-is-a-pass-through-on-a-dev-host.test.ts` do). One page load is driven as the browser drives
 * it: the navigation's fetch event, then — when the page hydrates under a controlling worker — the message `GuestPreload`
 * posts. A "render" is a request that reaches the server for the guest page: the browser's own (the worker did not answer)
 * or one the worker made.
 *
 * BEFORE → AFTER, counted by this file (`SW_ASKS_FROM=<path of the older sw.js> npx tsx --test
 * app/sw-the-maker-asks-once.test.ts` runs it against the worker as it was at d2e38b7c1):
 *   - one Maker canvas load ............................ 2 renders → 1
 *   - the warm-up (three other stages) ................. 6 → 3
 *   - six canvas loads (open · 3 warm · 2 presses) ..... 12 → 6   (11 in the measured session: its first had no worker yet)
 *   - a framed miniature that runs scripts ............. 2 → 1
 *   - a guest's own visit .............................. 2 → 2    (unchanged — see "A GUEST'S VISIT IS STILL TWO" below)
 *
 * Mutation-tested 2026-10-12 on a scratch copy of sw.js (each turned the named test red, then was discarded):
 *   - `isHostCanvasClient(event.source)` removed from the message listener → "one Maker canvas load is one render" (+4 more)
 *   - the `frameType === 'nested'` line removed        → "a framed page with a bare address…"
 *   - the client-address half removed                  → "…a browser that does not say the page is framed"
 *   - `isHostAppNavigation` removed from `fetch`       → "the worker answers no navigation the host's app makes"
 *   - the `editor`/`phase` test removed                → "…whatever the browser calls the request"
 *   - the frame destinations removed                   → "a framed page with a bare address…"
 *   - the referrer half removed                        → "a page opened from the host's app…"
 *   - the canvas-address filter on the preload list removed → "no sender can have a host canvas address kept"
 *   - a guest's preload refused as well (`return` for every sender) → "a guest's own visit is exactly as before"
 *
 * ⚠ A GUEST'S VISIT IS STILL TWO RENDERS, and this file pins that number rather than hiding it: the navigation, then the
 * preload of the same address. It is the guest's offline copy when they arrived on a personal link (a pass hop the worker
 * never caches), so it was left exactly as it is; removing the double is a guest-page decision, not a Maker one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SW_FILE = process.env.SW_ASKS_FROM || path.join(import.meta.dirname, '..', 'public', 'sw.js');
const GUEST_PRELOAD = path.join(import.meta.dirname, '[slug]', '_components', 'guest-preload.tsx');
const ORIGIN = 'https://www.setnayan.com';
const SLUG = 'ana-ben';
const MAKER = `${ORIGIN}/dashboard/S89E-0123456789/launch`;
const DAYOF = 'setnayan-dayof-v4';
const IMAGES = 'setnayan-images-v4';

type Keyish = string | { url: string };
const keyOf = (k: Keyish) => (typeof k === 'string' ? new URL(k, ORIGIN).href : k.url);
const rel = (u: string) => u.replace(ORIGIN, '');

type Listener = (ev: Record<string, unknown>) => void;
type Sent = { url: string; mode: string };
type Client = { url: string; frameType?: string; type?: string } | undefined;

function boot() {
  const stores = new Map<string, Map<string, Response>>();
  const open = (name: string) => {
    let s = stores.get(name);
    if (!s) stores.set(name, (s = new Map()));
    return {
      match: async (k: Keyish) => s!.get(keyOf(k))?.clone(),
      put: async (k: Keyish, res: Response) => {
        s!.set(keyOf(k), new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers }));
      },
      delete: async (k: Keyish) => s!.delete(keyOf(k)),
      addAll: async (urls: string[]) => {
        for (const u of urls) s!.set(keyOf(u), new Response(`shell ${u}`));
      },
      keys: async () => [...s!.keys()].map((u) => new Request(u)),
    };
  };
  const caches = {
    open: async (name: string) => open(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (k: Keyish) => {
      for (const s of stores.values()) {
        const hit = s.get(keyOf(k));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  /** Every request the WORKER put on the network, in order. */
  const sent: Sent[] = [];
  const net = { down: false };
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
    caches,
    fetch: async (req: Keyish & { mode?: string }, init?: { mode?: string }) => {
      const url = keyOf(req);
      sent.push({ url: rel(url), mode: init?.mode ?? (typeof req === 'string' ? 'cors' : (req.mode ?? 'cors')) });
      if (net.down) throw new TypeError('Failed to fetch');
      const p = new URL(url).pathname;
      const type = p.endsWith('.png') ? 'image/png' : p.endsWith('.svg') ? 'image/svg+xml' : p.endsWith('.json') ? 'application/json' : p.endsWith('.js') ? 'application/javascript' : 'text/html';
      const res = new Response(`${rel(url)} #${sent.filter((x) => x.url === rel(url)).length}`, { status: 200, headers: { 'Content-Type': type } });
      Object.defineProperty(res, 'type', { value: 'basic' });
      return res;
    },
    Request,
    Response,
    Headers,
    URL,
    Date,
    setTimeout: (fn: () => void) => setImmediate(fn),
    console,
  });
  vm.runInContext(readFileSync(SW_FILE, 'utf8'), context, { filename: 'sw.js' });

  const dispatch = async (type: string, init: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    const ev = {
      ...init,
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
      respondWith: (p: Promise<Response>) => void (responded = p),
    };
    for (const fn of listeners[type] ?? []) fn(ev);
    const response = responded ? await responded : undefined;
    await Promise.all(waits);
    await new Promise((r) => setTimeout(r, 15));
    return { responded: responded !== undefined, response };
  };

  /** Requests for the guest page that reached the server: the browser's own + the worker's. */
  let native = 0;
  const renders = () => native + sent.filter((x) => new URL(x.url, ORIGIN).pathname.split('/')[1] === SLUG).length;

  /**
   * ONE PAGE LOAD, as the browser drives it: the navigation, then — `hydrates` — the page's `GuestPreload` posting what
   * `guest-preload.tsx` posts, from the client the page is (`client`).
   */
  const load = async (
    pathAndQuery: string,
    o: { destination?: string; mode?: string; referrer?: string; client?: Client; hydrates?: boolean } = {},
  ) => {
    const url = new URL(pathAndQuery, ORIGIN).href;
    const nav = await dispatch('fetch', {
      request: { method: 'GET', url, destination: o.destination ?? 'document', mode: o.mode ?? 'navigate', referrer: o.referrer ?? '', headers: new Headers() },
    });
    if (!nav.responded) native += 1;
    if (o.hydrates !== false) {
      await dispatch('message', {
        data: { type: 'PRELOAD_ASSETS', urls: ['/manifest.json', '/icon-192.svg', '/icon-512.svg', `/${SLUG}`] },
        source: 'client' in o ? o.client : { url, frameType: 'top-level', type: 'window' },
      });
    }
    return nav;
  };
  const kept = (cache: string) => [...(stores.get(cache)?.keys() ?? [])].map(rel).sort();
  const keptAnywhere = () => [...stores.entries()].flatMap(([name, s]) => [...s.keys()].map((u) => `${name} ${rel(u)}`));
  return { dispatch, load, sent, net, renders, kept, keptAnywhere };
}

/** The Maker's canvas, as `BufferedCanvasFrame` mounts it: an iframe of the stage's address, inside the Maker. */
const canvas = (phase: string) => `/${SLUG}?phase=${phase}&editor=1`;
const asCanvas = (phase: string) => ({
  destination: 'iframe',
  referrer: MAKER,
  client: { url: `${ORIGIN}${canvas(phase)}`, frameType: 'nested', type: 'window' },
});

// ── what the page really posts ─────────────────────────────────────────────

test('the message driven here is the one the guest page posts', () => {
  const src = readFileSync(GUEST_PRELOAD, 'utf8');
  assert.ok(src.includes("type: 'PRELOAD_ASSETS'"), 'GuestPreload no longer posts PRELOAD_ASSETS — this file drives a message nobody sends');
  assert.ok(src.includes('`/${eventSlug}`'), 'GuestPreload no longer asks for the bare `/<slug>` — re-read what it posts and drive that');
});

// ── the Maker ──────────────────────────────────────────────────────────────

test('one Maker canvas load is one render of the guest page', async () => {
  const w = boot();
  const nav = await w.load(canvas('rsvp'), asCanvas('rsvp'));
  assert.equal(nav.responded, false, 'the worker answered the canvas navigation itself');
  assert.deepEqual(w.sent, [], `the worker made requests of its own for a Maker canvas: ${JSON.stringify(w.sent)}`);
  assert.equal(w.renders(), 1, `a Maker canvas load cost ${w.renders()} renders of the guest page`);
  assert.deepEqual(w.keptAnywhere(), [], 'a copy of the host canvas was kept');
});

test('the warm-up — three other stages — is three renders, never six', async () => {
  const w = boot();
  for (const phase of ['rsvp', 'event', 'editorial']) await w.load(canvas(phase), asCanvas(phase));
  assert.equal(w.renders(), 3, `warming three stages cost ${w.renders()} renders`);
  assert.deepEqual(w.sent, []);
});

test('the measured session’s canvas loads: six loads, six renders', async () => {
  const w = boot();
  // Open (save_the_date) · the three warm stages · the canvas after "Earlier" · after "Later".
  for (const phase of ['save_the_date', 'rsvp', 'event', 'editorial', 'rsvp', 'rsvp']) await w.load(canvas(phase), asCanvas(phase));
  assert.equal(w.renders(), 6, `six canvas loads cost ${w.renders()} renders`);
});

test('the worker answers no navigation the host’s app makes, whatever the browser calls the request', async () => {
  // Chrome names a framed navigation `iframe`; an older WebKit names it `document`, or nothing at all.
  for (const destination of ['iframe', 'frame', 'document', '']) {
    const w = boot();
    const nav = await w.load(canvas('event'), { destination, referrer: MAKER, hydrates: false });
    assert.equal(nav.responded, false, `destination "${destination}": the worker answered the canvas navigation`);
    assert.deepEqual(w.sent, [], `destination "${destination}": the worker fetched ${JSON.stringify(w.sent)}`);
  }
  // …and with no referrer at all (a reload inside the frame, a stripped header): the address alone says it.
  const w = boot();
  const nav = await w.load(canvas('event'), { destination: 'document', referrer: '', hydrates: false });
  assert.equal(nav.responded, false);
  // A stage preview tab (`?phase=…&preview=draft`) is the host's too.
  const p = await w.load(`/${SLUG}?phase=rsvp&preview=draft`, { destination: 'document', referrer: MAKER, client: { url: `${ORIGIN}/${SLUG}?phase=rsvp&preview=draft`, frameType: 'top-level' } });
  assert.equal(p.responded, false);
  assert.deepEqual(w.sent, []);
});

test('a canvas on a browser that does not say the page is framed still costs one render', async () => {
  const w = boot();
  // No `frameType` on the client, no `iframe` destination: only the address is left to go by.
  await w.load(canvas('rsvp'), { destination: 'document', referrer: MAKER, client: { url: `${ORIGIN}${canvas('rsvp')}` } });
  assert.equal(w.renders(), 1);
  assert.deepEqual(w.sent, []);
});

test('a framed page with a bare address (a miniature that runs scripts) is one render too', async () => {
  const w = boot();
  // No `editor`, no `phase` — only "it is in a frame" says this is not a guest's visit.
  const nav = await w.load(`/${SLUG}`, { destination: 'iframe', referrer: '', client: { url: `${ORIGIN}/${SLUG}`, frameType: 'nested' } });
  assert.equal(nav.responded, false, 'the worker answered a framed navigation');
  assert.equal(w.renders(), 1, `a framed page cost ${w.renders()} renders`);
  assert.deepEqual(w.keptAnywhere(), []);
});

test('a page opened from the host’s app, or from inside a canvas, is left to the browser', async () => {
  const w = boot();
  const fromMaker = await w.load(`/${SLUG}`, { destination: 'document', referrer: MAKER, hydrates: false });
  assert.equal(fromMaker.responded, false, 'a navigation from /dashboard/ was answered by the worker');
  const fromEditor = await w.load(`/${SLUG}`, { destination: 'document', referrer: `${ORIGIN}/site-editor/S89E-0123456789`, hydrates: false });
  assert.equal(fromEditor.responded, false, 'a navigation from /site-editor/ was answered by the worker');
  const fromCanvas = await w.load(`/${SLUG}/find-my-table`, { destination: 'document', referrer: `${ORIGIN}${canvas('event')}`, hydrates: false });
  assert.equal(fromCanvas.responded, false, 'a link followed inside the canvas was answered by the worker');
  assert.deepEqual(w.sent, []);
  // Another site's /dashboard/ is not ours: that visitor is a guest.
  const other = await w.load(`/${SLUG}`, { destination: 'document', referrer: 'https://example.com/dashboard/x', hydrates: false });
  assert.equal(other.responded, true, 'a referrer on another origin was read as the host’s app');
});

test('no sender can have a host canvas address kept', async () => {
  const w = boot();
  await w.dispatch('message', {
    data: { type: 'PRELOAD_ASSETS', urls: [canvas('rsvp'), `${ORIGIN}${canvas('event')}`, `/${SLUG}?phase=rsvp`, '/icons/a.png'] },
    source: { url: `${ORIGIN}/${SLUG}`, frameType: 'top-level' },
  });
  assert.deepEqual(w.sent.map((x) => x.url), ['/icons/a.png'], 'a host canvas address was fetched for the offline cache');
});

test('the Maker’s code, images and fonts are cached as before', async () => {
  const w = boot();
  const req = (p: string, destination: string) =>
    w.dispatch('fetch', { request: { method: 'GET', url: `${ORIGIN}${p}`, destination, mode: 'no-cors', referrer: `${ORIGIN}${canvas('rsvp')}`, headers: new Headers() } });
  assert.equal((await req('/photos/cover.png', 'image')).responded, true);
  assert.equal((await req('/photos/cover.png', 'image')).responded, true);
  assert.equal((await req('/_next/static/chunks/maker-9041524f5488b3f7.js', 'script')).responded, true);
  assert.equal((await req('/_next/static/chunks/maker-9041524f5488b3f7.js', 'script')).responded, true);
  assert.deepEqual(w.sent.map((x) => x.url), ['/photos/cover.png', '/_next/static/chunks/maker-9041524f5488b3f7.js'], 'an asset asked from the canvas was not served from the cache the second time');
});

// ── a guest (and the host's own dashboard) — unchanged ─────────────────────

test('a guest’s own visit is exactly as before: answered, kept for the day, and its preload fetched', async () => {
  for (const referrer of ['', 'https://www.facebook.com/', `${ORIGIN}/`, `${ORIGIN}/${SLUG}`]) {
    const w = boot();
    await w.dispatch('install');
    const nav = await w.load(`/${SLUG}`, { referrer });
    assert.equal(nav.responded, true, `referrer "${referrer}": the guest's navigation is no longer answered (no offline copy)`);
    assert.equal(await nav.response!.text(), `/${SLUG} #1`);
    assert.deepEqual(w.kept(DAYOF), [`/${SLUG}`], 'the guest’s page is no longer kept for the day');
    assert.deepEqual(w.kept(IMAGES), ['/ana-ben', '/icon-192.svg', '/icon-512.svg', '/manifest.json'], 'the guest’s preload is no longer kept');
    assert.deepEqual(
      w.sent,
      [
        { url: `/${SLUG}`, mode: 'navigate' },
        { url: '/manifest.json', mode: 'no-cors' },
        { url: '/icon-192.svg', mode: 'no-cors' },
        { url: '/icon-512.svg', mode: 'no-cors' },
        { url: `/${SLUG}`, mode: 'no-cors' },
      ],
      'what the worker asks the network for on a guest’s visit changed',
    );
    // ⚠ Two renders, as today — pinned, not hidden (see the header).
    assert.equal(w.renders(), 2);
  }
});

test('a guest with no signal still gets the kept page, and the offline page for one never seen', async () => {
  const w = boot();
  await w.dispatch('install');
  await w.load(`/${SLUG}`, { hydrates: false });
  await w.load(`/${SLUG}/find-my-table`, { hydrates: false });
  w.net.down = true;
  const again = await w.load(`/${SLUG}`, { hydrates: false });
  assert.equal(await again.response!.text(), `/${SLUG} #1`, 'offline, the guest no longer gets the page kept from the last visit');
  const table = await w.load(`/${SLUG}/find-my-table`, { hydrates: false });
  assert.equal(await table.response!.text(), `/${SLUG}/find-my-table #1`);
  const unseen = await w.load('/maria-jose', { hydrates: false });
  assert.equal(await unseen.response!.text(), 'shell /offline.html', 'offline, an unseen page no longer falls back to offline.html');
});

test('a guest who arrived on a personal link keeps the offline copy the preload made', async () => {
  const w = boot();
  await w.dispatch('install');
  // The pass hop is the browser's alone — never answered, never kept…
  const hop = await w.load(`/${SLUG}?invite=abc123`, { client: { url: `${ORIGIN}/${SLUG}?invite=abc123`, frameType: 'top-level' } });
  assert.equal(hop.responded, false, 'a pass hop was answered by the worker');
  assert.deepEqual(w.kept(DAYOF), []);
  // …so the page's preload is that guest's only copy, and it is still made.
  w.net.down = true;
  const back = await w.load(`/${SLUG}`, { hydrates: false });
  assert.equal(await back.response!.text(), `/${SLUG} #1`, 'the preload’s copy no longer serves the guest offline');
});

test('the host’s dashboard can still warm its event-day pictures', async () => {
  const w = boot();
  await w.dispatch('message', {
    data: { type: 'PRELOAD_ASSETS', urls: ['/avatars/a.png', '/avatars/b.png'] },
    source: { url: `${ORIGIN}/dashboard/S89E-0123456789`, frameType: 'top-level' },
  });
  assert.deepEqual(w.kept(IMAGES), ['/avatars/a.png', '/avatars/b.png'], 'a preload from the dashboard itself was refused');
  // A message with no source at all (an older browser) is treated as before.
  await w.dispatch('message', { data: { type: 'PRELOAD_ASSETS', urls: ['/avatars/c.png'] } });
  assert.ok(w.kept(IMAGES).includes('/avatars/c.png'));
});
