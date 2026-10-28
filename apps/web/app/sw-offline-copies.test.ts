/**
 * GUARD — THE SAVED COPY FOR A NO-SIGNAL VENUE (EV3, owner 2026-10-28): `public/sw.js` opens a coordinator's / supplier's
 * OWN saved event pages with no signal, and never anything else.
 *
 * DECISION_LOG "OFFLINE SAVING IS ALWAYS ON" · "APPROVED — EVENT DAY NEVER FAILS (always-on) … + BROWSER OFFLINE
 * SUPPORT" · "APP-WIDE SPEED RULE" — page HTML stays NETWORK-FIRST online; the saved copy is only the no-signal
 * fallback; never stale-while-revalidate for HTML; per-viewer; erased after the event window. Standing constraint: the
 * worker must never serve a stale or broken shell to an online user.
 *
 * HOW: sw.js is run for real in a `vm` context (as `sw-the-maker-asks-once.test.ts` does) with a fake CacheStorage, a
 * fake server that renders each page with the BUILD it is on and the VIEWER whose session asked, a clock, and a
 * `navigator` whose `onLine` and engine can be set. A "deploy" bumps the server's build; "no signal" makes every request
 * fail. The page side of the protocol (`OFFLINE_SAVE`, `OFFLINE_VIEWER`, `OFFLINE_FORGET`) is what
 * `app/_components/offline-ready/use-offline-copy.ts` and `offline-viewer-script.tsx` post — the first test reads them.
 *
 * Mutation-tested 2026-10-28 on scratch copies of sw.js (each turned the named test red, then was discarded) — listed in
 * the EV3 changelog fragment.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import {
  OFFLINE_COPIES_CACHE,
  OFFLINE_COPIES_WIPE_SCRIPT,
  OFFLINE_REGISTRY_PATH,
  isOfflineCopyPath,
  offlineCopyEventId,
} from '@/lib/offline-copies';

const SW_FILE = process.env.SW_OFFLINE_FROM || path.join(import.meta.dirname, '..', 'public', 'sw.js');
const HOOK = path.join(import.meta.dirname, '_components', 'offline-ready', 'use-offline-copy.ts');
const VIEWER_SCRIPT = path.join(import.meta.dirname, '_components', 'offline-ready', 'offline-viewer-script.tsx');
const ORIGIN = 'https://www.setnayan.com';
const E1 = '0e0e0e0e-0000-4000-8000-000000000001';
const E2 = '0e0e0e0e-0000-4000-8000-000000000002';
const ANA = 'user-ana-0000000001';
const BEN = 'user-ben-0000000002';
const HOME = `/dashboard/${E1}`;
const DESK = `/dashboard/${E1}/guests/checkin`;
const HUB = '/vendor-dashboard/on-the-day';
const LIVE = `/vendor-dashboard/on-the-day/live/${E1}`;
const HOUR = 3_600_000;
const CHROME_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

type Keyish = string | { url: string };
/** A value from inside the vm, as plain data (another realm's arrays are not deep-equal to ours). */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? null));
const keyOf = (k: Keyish) => (typeof k === 'string' ? new URL(k, ORIGIN).href : k.url);

function boot(o: { ua?: string; host?: string } = {}) {
  const origin = o.host ?? ORIGIN;
  const stores = new Map<string, Map<string, Response>>();
  const open = (name: string) => {
    let s = stores.get(name);
    if (!s) stores.set(name, (s = new Map()));
    return {
      match: async (k: Keyish) => s!.get(new URL(keyOf(k), origin).href)?.clone(),
      put: async (k: Keyish, res: Response) => {
        s!.set(new URL(keyOf(k), origin).href, new Response(await res.arrayBuffer(), { status: res.status, headers: res.headers }));
      },
      delete: async (k: Keyish) => s!.delete(new URL(keyOf(k), origin).href),
      addAll: async (urls: string[]) => {
        for (const u of urls) s!.set(new URL(u, origin).href, new Response(`shell ${u}`, { headers: { 'Content-Type': 'text/html' } }));
      },
      keys: async () => [...s!.keys()].map((u) => new Request(u)),
    };
  };
  const caches = {
    has: async (name: string) => stores.has(name),
    open: async (name: string) => open(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (k: Keyish) => {
      for (const s of stores.values()) {
        const hit = s.get(new URL(keyOf(k), origin).href);
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  const clock = { now: Date.parse('2026-11-14T08:00:00+08:00') };
  class FakeDate extends Date {
    constructor(...a: unknown[]) {
      if (a.length) super(...(a as [string]));
      else super(clock.now);
    }
    static override now() {
      return clock.now;
    }
  }
  /** The fake server: who is signed in, which build is live, whether the network is there at all. */
  const server = { build: 'B1', viewer: ANA as string | null, down: false, sent: [] as string[] };
  const navigator = { onLine: true, userAgent: o.ua ?? CHROME_UA };
  const listeners: Record<string, Array<(ev: Record<string, unknown>) => void>> = {};
  const self = {
    location: new URL(`${origin}/sw.js`),
    navigator,
    addEventListener: (type: string, fn: (ev: Record<string, unknown>) => void) => void (listeners[type] ??= []).push(fn),
    skipWaiting: () => undefined,
    clients: { claim: async () => undefined },
    registration: {},
  };
  const makeContext = () => vm.createContext({
    self,
    caches,
    fetch: async (req: Keyish) => {
      const url = new URL(keyOf(req), origin);
      server.sent.push(url.pathname + url.search);
      if (server.down) throw new TypeError('Failed to fetch');
      if (url.pathname.startsWith('/_next/static/')) {
        const res = new Response(`code ${url.pathname}`, { status: 200, headers: { 'Content-Type': 'application/javascript' } });
        Object.defineProperty(res, 'type', { value: 'basic' });
        return res;
      }
      // A page for nobody signed in (or the wrong person) is a redirect to /login — never the page.
      if (!server.viewer) {
        const res = new Response('', { status: 307, headers: { Location: '/login' } });
        Object.defineProperty(res, 'type', { value: 'opaqueredirect' });
        return res;
      }
      const html = `<html><body data-build="${server.build}" data-viewer="${server.viewer}">${url.pathname}` +
        `<script src="/_next/static/chunks/app-${server.build}-0123456789abcdef.js?dpl=dpl_${server.build}"></script></body></html>`;
      const res = new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      Object.defineProperty(res, 'type', { value: 'basic' });
      return res;
    },
    Request,
    Response,
    Headers,
    URL,
    Date: FakeDate,
    setTimeout: (fn: () => void) => setImmediate(fn),
    console,
  });
  let context = makeContext();
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
    let response: Response | undefined;
    let threw = false;
    try {
      response = responded ? await responded : undefined;
    } catch {
      threw = true;
    }
    await Promise.all(waits);
    await new Promise((r) => setTimeout(r, 10));
    return { responded: responded !== undefined, response, threw };
  };
  /** A page posts a message; resolves with what the worker answered on the port. */
  const post = async (data: Record<string, unknown>) => {
    let answer: unknown;
    await dispatch('message', { data, ports: [{ postMessage: (m: unknown) => void (answer = m) }], source: { url: `${origin}${HOME}` } });
    return answer as { ok: boolean; savedAt: number | null; failed: string[]; refused?: boolean; dev?: boolean } | undefined;
  };
  const nav = async (p: string, init: Record<string, unknown> = {}) => {
    const r = await dispatch('fetch', {
      request: { method: 'GET', url: new URL(p, origin).href, destination: 'document', mode: 'navigate', referrer: '', headers: new Headers(), ...init },
    });
    const body = r.response ? await r.response.clone().text() : null;
    return { ...r, body, copy: r.response?.headers.get('X-Setnayan-Saved-Copy') ?? null };
  };
  const saveFor = (viewer: string, eventId: string, paths: string[], extra: Record<string, unknown> = {}) =>
    post({ type: 'OFFLINE_SAVE', viewer, eventId, until: clock.now + 30 * HOUR, paths, ...extra });
  const kept = () => [...(stores.get(OFFLINE_COPIES_CACHE)?.keys() ?? [])].map((u) => u.replace(origin, '')).sort();
  const registry = async () => {
    const r = await caches.match(`${origin}${OFFLINE_REGISTRY_PATH}`);
    return r ? JSON.parse(await r.text()) : null;
  };
  /** The worker went idle and was started again — its memory is gone, its caches are not. */
  const restart = () => {
    for (const k of Object.keys(listeners)) delete listeners[k];
    context = makeContext();
    vm.runInContext(readFileSync(SW_FILE, 'utf8'), context, { filename: 'sw.js' });
  };
  return { dispatch, post, nav, saveFor, kept, registry, restart, server, navigator, clock, stores, context: () => context, caches };
}

// ── the protocol the pages speak ──────────────────────────────────────────────

test('the messages driven here are the ones the pages post', () => {
  const hook = readFileSync(HOOK, 'utf8');
  assert.ok(hook.includes("type: 'OFFLINE_SAVE'"), 'use-offline-copy no longer posts OFFLINE_SAVE');
  for (const field of ['viewer', 'eventId', 'until', 'paths', 'force']) {
    assert.ok(new RegExp(`\\b${field}\\b`).test(hook), `use-offline-copy no longer sends "${field}"`);
  }
  const script = readFileSync(VIEWER_SCRIPT, 'utf8');
  assert.ok(script.includes('OFFLINE_VIEWER'), 'the signed-in layouts no longer tell the worker who is signed in');
});

test('the worker and lib/offline-copies.ts agree on every address', () => {
  const sw = boot();
  const swIs = (sw.context() as unknown as { isOfflineCopyPath: (p: string) => boolean }).isOfflineCopyPath;
  const swEvent = (sw.context() as unknown as { offlineCopyEventId: (p: string) => string | null | undefined }).offlineCopyEventId;
  const table = [
    HOME, DESK, HUB, LIVE, `/dashboard/S89E-0123456789`, `/dashboard/${E1}/guests`, `/dashboard/${E1}/`, '/dashboard',
    '/dashboard/notifications', `/dashboard/${E1}/guests/checkin/x`, '/vendor-dashboard', '/vendor-dashboard/on-the-day/',
    `/vendor-dashboard/on-the-day/live/${E1}/papic`, '/ana-ben', `/dashboard/${E1}.json`, '/dashboard/a/b', '/dashboard/short',
  ];
  for (const p of table) {
    assert.equal(swIs(p), isOfflineCopyPath(p), `sw.js and lib disagree whether ${p} may be kept`);
    assert.equal(swEvent(p), offlineCopyEventId(p), `sw.js and lib disagree whose event ${p} is`);
  }
  assert.ok(table.filter((p) => isOfflineCopyPath(p)).length >= 5, 'the table no longer exercises a kept address');
});

// ── network-first, always ─────────────────────────────────────────────────────

test('with signal, a kept page is always the network’s answer — after a deploy, never the old copy', async () => {
  const w = boot();
  assert.equal((await w.saveFor(ANA, E1, [HOME, DESK]))?.ok, true);
  w.server.build = 'B2'; // a deploy
  for (const p of [HOME, DESK]) {
    const r = await w.nav(p);
    assert.equal(r.responded, true);
    assert.match(r.body ?? '', /data-build="B2"/, `${p}: an online visit after a deploy got ${r.body}`);
    assert.equal(r.copy, null, `${p}: an online visit was answered from the saved copy`);
  }
  // …and the worker went cold in between: still the network's.
  w.restart();
  const cold = await w.nav(HOME);
  assert.match(cold.body ?? '', /data-build="B2"/);
});

test('with signal, the page’s own open refreshes its copy from that same answer (no second request)', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME]);
  w.server.build = 'B2';
  w.server.sent.length = 0;
  w.clock.now += HOUR;
  await w.nav(HOME);
  assert.equal(w.server.sent.filter((s) => s === HOME).length, 1, `opening Home cost ${w.server.sent.filter((s) => s === HOME).length} renders`);
  w.server.down = true;
  const r = await w.nav(HOME);
  assert.match(r.body ?? '', /data-build="B2"/, 'the copy was not refreshed by the open');
  assert.equal(Number(r.copy), w.clock.now, 'the refreshed copy does not carry the time it was taken');
  assert.equal((await w.registry()).events[E1].pages[HOME], w.clock.now, 'the registry does not know the copy was refreshed');
});

// ── no signal ─────────────────────────────────────────────────────────────────

test('no signal: each kept view opens from the copy, not /offline.html', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME, DESK]);
  await w.saveFor(ANA, E1, [HUB, LIVE]);
  w.server.down = true;
  for (const p of [HOME, DESK, HUB, LIVE]) {
    const r = await w.nav(p);
    assert.equal(r.responded, true, `${p}: not answered with no signal`);
    assert.ok(r.body?.includes(`>${p}<`), `${p}: no signal opened ${r.body}`);
    assert.ok(r.copy, `${p}: not marked as the saved copy`);
  }
  // A cold worker (the phone was put away) opens it too.
  w.restart();
  const cold = await w.nav(DESK);
  assert.ok(cold.body?.includes(`>${DESK}<`), `a cold worker opened ${cold.body}`);
});

test('the copy says it is the copy — its <html> carries when it was saved; a network answer never does', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME]);
  const online = await w.nav(HOME);
  assert.doesNotMatch(online.body ?? '', /data-sn-saved-copy/, 'a page fresh from the network was marked as the copy');
  w.server.down = true;
  const off = await w.nav(HOME);
  const at = (await w.registry()).events[E1].pages[HOME];
  assert.match(off.body ?? '', new RegExp(`<html data-sn-saved-copy="${at}"`), `the copy is not marked: ${off.body?.slice(0, 80)}`);
});

test('the browser says it is offline: the copy opens at once, with no request', async () => {
  const w = boot({ ua: SAFARI_UA });
  await w.saveFor(ANA, E1, [HOME]);
  w.restart(); // cold, on WebKit
  w.navigator.onLine = false;
  w.server.sent.length = 0;
  const r = await w.nav(HOME);
  assert.ok(r.copy, 'an offline Safari did not get the copy');
  assert.deepEqual(w.server.sent, [], 'the worker waited on a network the browser said was gone');
});

test('the code a copy needs is kept with it — across a deploy', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME]);
  const code = [...(w.stores.get('setnayan-static-immutable-v1')?.keys() ?? [])].map((u) => new URL(u).pathname);
  assert.ok(code.includes('/_next/static/chunks/app-B1-0123456789abcdef.js'), `the copy's code was not kept: ${code}`);
});

test('no signal and nothing kept: no copy is invented — the browser’s page or /offline.html, as before', async () => {
  for (const ua of [CHROME_UA, SAFARI_UA]) {
    const w = boot({ ua });
    await w.dispatch('install');
    w.restart(); // cold: the registry is not in memory
    w.server.down = true;
    const r = await w.nav(HOME);
    assert.equal(r.copy, null);
    assert.ok(!r.responded || r.body?.startsWith('shell /offline.html'), `no copy, no signal opened ${r.body}`);
  }
});

// ── one viewer ────────────────────────────────────────────────────────────────

test('another account on the phone never opens the copies — a signed-in page erases them', async () => {
  const w = boot();
  await w.dispatch('install');
  await w.saveFor(ANA, E1, [HOME, DESK]);
  await w.post({ type: 'OFFLINE_VIEWER', viewer: BEN });
  assert.deepEqual(w.kept(), [], `Ben's first signed-in page left ${w.kept()}`);
  w.server.down = true;
  const r = await w.nav(HOME);
  assert.ok(!r.body?.includes(ANA) && !r.copy, `Ben opened Ana's copy: ${r.body}`);
});

test('a save by another account erases the first account’s copies before keeping its own', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME]);
  w.server.viewer = BEN;
  await w.saveFor(BEN, E2, [`/dashboard/${E2}`]);
  assert.deepEqual(w.kept().filter((k) => !k.startsWith('/__setnayan-sw')), [`/dashboard/${E2}`]);
  assert.equal((await w.registry()).viewer, BEN);
  assert.equal((await w.registry()).events[E1], undefined, 'Ana’s event is still in the registry');
});

test('the same account says who it is: nothing is erased', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME]);
  await w.post({ type: 'OFFLINE_VIEWER', viewer: ANA });
  assert.ok(w.kept().includes(HOME));
});

test('sign-out: the signed-out landing page deletes the copies and tells the worker', async () => {
  const run = (cookie: string) => {
    const deleted: string[] = [];
    const posted: unknown[] = [];
    vm.runInNewContext(OFFLINE_COPIES_WIPE_SCRIPT, {
      document: { cookie },
      self: { caches: {} },
      caches: { delete: (n: string) => void deleted.push(n) },
      navigator: { serviceWorker: { controller: { postMessage: (m: unknown) => void posted.push(m) } } },
    });
    return { deleted, posted };
  };
  const out = run('theme=dark');
  assert.deepEqual(plain(out.deleted), [OFFLINE_COPIES_CACHE]);
  assert.deepEqual(plain(out.posted), [{ type: 'OFFLINE_FORGET' }]);
  const signedIn = run('sb-abcd-auth-token.0=xyz; theme=dark');
  assert.deepEqual(plain(signedIn), { deleted: [], posted: [] }, 'a signed-in page erased the copies');
  const w = boot();
  await w.saveFor(ANA, E1, [HOME]);
  await w.post({ type: 'OFFLINE_FORGET' });
  w.server.down = true;
  assert.equal((await w.nav(HOME)).copy, null, 'OFFLINE_FORGET left a copy that opens');
});

// ── only their own event views ────────────────────────────────────────────────

test('a save may name only its own event’s pages, of the four shapes', async () => {
  const w = boot();
  for (const paths of [[`/dashboard/${E2}`], [`/dashboard/${E1}/vendors`], ['/ana-ben'], [`/dashboard/${E1}?x=1`], ['/api/x'], [HOME, DESK, HUB, LIVE, HOME]]) {
    const r = await w.saveFor(ANA, E1, paths);
    assert.equal(r?.ok, false, `a save of ${paths} was accepted`);
  }
  assert.deepEqual(w.kept(), [], `something was kept: ${w.kept()}`);
  assert.equal((await w.saveFor('x', E1, [HOME]))?.ok, false, 'a nameless viewer was accepted');
  assert.equal((await w.post({ type: 'OFFLINE_SAVE', viewer: ANA, eventId: E1, until: w.clock.now + 400 * HOUR, paths: [HOME] }))?.ok, false, 'a copy kept for weeks was accepted');
});

test('a refused or signed-out render is never kept — and the save says it failed', async () => {
  const w = boot();
  w.server.viewer = null; // the session ended: every page redirects to /login
  const r = await w.saveFor(ANA, E1, [HOME, DESK]);
  assert.equal(r?.ok, false);
  assert.deepEqual(plain(r?.failed), [HOME, DESK]);
  assert.equal(r?.savedAt, null, 'a failed save reported a saved time');
  assert.deepEqual(w.kept().filter((k) => !k.startsWith('/__setnayan-sw')), []);
});

test('no signal while saving: the save fails, the older copy stays', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME]);
  const first = (await w.registry()).events[E1].pages[HOME];
  w.server.down = true;
  w.clock.now += HOUR;
  const r = await w.saveFor(ANA, E1, [HOME], { force: true });
  assert.equal(r?.ok, false);
  assert.equal(r?.savedAt, first, 'the failed save did not report the older copy’s time');
  assert.ok((await w.nav(HOME)).copy, 'the older copy was lost');
});

test('an automatic save does not re-render a fresh copy; Update now does', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME]);
  w.server.sent.length = 0;
  w.clock.now += 10 * 60_000;
  await w.saveFor(ANA, E1, [HOME]);
  assert.deepEqual(w.server.sent.filter((s) => s === HOME), [], 'a fresh copy was rendered again');
  await w.saveFor(ANA, E1, [HOME], { force: true });
  assert.deepEqual(w.server.sent.filter((s) => s === HOME), [HOME], 'Update now did not render it');
});

// ── erased after the event ────────────────────────────────────────────────────

test('after the event window the copies are erased and never opened', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME, DESK]);
  w.clock.now += 31 * HOUR; // past `until`
  w.server.down = true;
  assert.equal((await w.nav(HOME)).copy, null, 'an expired copy opened');
  await w.dispatch('activate');
  assert.deepEqual(w.kept().filter((k) => !k.startsWith('/__setnayan-sw')), [], `activate left ${w.kept()}`);
});

test('the Hub kept by two events survives the first one’s erasure', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HUB]);
  await w.post({ type: 'OFFLINE_SAVE', viewer: ANA, eventId: E2, until: w.clock.now + 60 * HOUR, paths: [HUB] });
  w.clock.now += 31 * HOUR;
  await w.dispatch('activate');
  assert.ok(w.kept().includes(HUB), 'the Hub was erased while another event still keeps it');
});

// ── nothing else changes ──────────────────────────────────────────────────────

test('a page nobody keeps: WebKit leaves it to the browser; elsewhere it passes straight through, kept nowhere', async () => {
  const safari = boot({ ua: SAFARI_UA });
  safari.restart();
  const s = await safari.nav(HOME);
  assert.equal(s.responded, false, 'a cold Safari worker answered a navigation it keeps nothing for (the 2026-07-03 crash class)');
  const chrome = boot();
  chrome.restart();
  const c = await chrome.nav(HOME);
  assert.match(c.body ?? '', /data-build="B1"/);
  assert.deepEqual(chrome.kept(), [], 'a page nobody asked to keep was kept');
});

test('a framed page, a page with a query, or any other address is never answered', async () => {
  const w = boot();
  await w.saveFor(ANA, E1, [HOME, DESK]);
  w.server.down = true;
  for (const [p, init] of [
    [HOME, { destination: 'iframe' }],
    [`${HOME}?sai=1`, {}],
    [`/dashboard/${E1}/guests`, {}],
    ['/dashboard', {}],
  ] as const) {
    const r = await w.nav(p, init);
    assert.ok(!r.copy, `${p} ${JSON.stringify(init)} was answered from a copy`);
  }
});

test('a development host keeps nothing and says so', async () => {
  const w = boot({ host: 'http://localhost:3480' });
  const r = await w.saveFor(ANA, E1, [HOME]);
  assert.equal(r?.ok, false);
  assert.equal(r?.dev, true);
  assert.deepEqual(w.kept(), []);
});
