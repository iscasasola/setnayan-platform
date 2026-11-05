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
  OFFLINE_COPY_UNREAD,
  OFFLINE_REGISTRY_PATH,
  coordinatorSchedulePath,
  parseOfflineRegistry,
  savedAtFor,
  savedMark,
  staleFor,
  supplierSchedulePath,
} from '@/lib/offline-copies';
import { guestMePath, isOfflineCopyPath, offlineCopyEventId } from '@/lib/offline-copy-addresses';

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
// 📅 Each person's own day ("Your schedule").
const SCHED = coordinatorSchedulePath(E1)!; // the hosts' / coordinator's Schedule
const SUP = supplierSchedulePath(E1)!; // a supplier's (a Host/MC's) Customer › Schedule
const SLUG = 'ana-ben';
const ME = guestMePath(SLUG)!; // a guest's Event Hub › Me
const GUEST = 'g-0e0e0e0e-0000-4000-8000-0000000000aa'; // an accountless pass holder
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
  const server = {
    build: 'B1',
    viewer: ANA as string | null,
    down: false,
    sent: [] as string[],
    /** 🧾 The version each address's page draws (`data-sn-copy-version`), as a "Your schedule" page renders it. */
    versions: {} as Record<string, string>,
  };
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
      const address = url.pathname + url.search;
      const version = server.versions[address];
      const html = `<html><body data-build="${server.build}" data-viewer="${server.viewer}">${address}` +
        (version ? `<div data-schedule-saved="" data-sn-copy-version="${version}"></div>` : '') +
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
  for (const field of ['viewer', 'eventId', 'until', 'paths', 'force', 'version']) {
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
    SCHED, SUP, ME, `${SCHED}?maker=1`, `/vendor-dashboard/clients/${E1}`, `/vendor-dashboard/clients/${E1}?tab=files`,
    `${SUP}&x=1`, '/ana-ben?tab=home', '/dashboard?tab=me', '/login?tab=me', '/vendor-dashboard?tab=me', '/ab?tab=me',
    '/Ana-Ben?tab=me',
  ];
  for (const p of table) {
    assert.equal(swIs(p), isOfflineCopyPath(p), `sw.js and lib disagree whether ${p} may be kept`);
    assert.equal(swEvent(p), offlineCopyEventId(p), `sw.js and lib disagree whose event ${p} is`);
  }
  assert.ok(table.filter((p) => isOfflineCopyPath(p)).length >= 8, 'the table no longer exercises a kept address');
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

// ── 📅 YOUR SCHEDULE — each person's own day, saved for no signal ─────────────────────────────────────────────────

const meSave = (w: ReturnType<typeof boot>, extra: Record<string, unknown> = {}) =>
  w.post({ type: 'OFFLINE_SAVE', viewer: GUEST, eventId: SLUG, until: w.clock.now + 30 * HOUR, paths: [ME], ...extra });

test('a copy is written for each person’s schedule — the hosts’ / coordinator’s, a supplier’s (a Host/MC’s), a guest’s Me', async () => {
  const cases: Array<{ who: string; viewer: string; key: string; path: string }> = [
    { who: 'coordinator', viewer: ANA, key: E1, path: SCHED },
    { who: 'supplier', viewer: BEN, key: E1, path: SUP },
    { who: 'guest', viewer: GUEST, key: SLUG, path: ME },
  ];
  for (const c of cases) {
    const w = boot();
    w.server.viewer = c.viewer;
    w.server.versions[c.path] = 'v1aaaa.10';
    const r = await w.post({ type: 'OFFLINE_SAVE', viewer: c.viewer, eventId: c.key, until: w.clock.now + 30 * HOUR, paths: [c.path], version: 'v1aaaa.10' });
    assert.equal(r?.ok, true, `${c.who}: the save did not land (${JSON.stringify(r)})`);
    assert.ok(w.kept().includes(c.path), `${c.who}: ${c.path} was not kept (${w.kept()})`);
    const reg = await w.registry();
    assert.equal(reg.viewer, c.viewer);
    assert.equal(typeof reg.events[c.key].pages[c.path], 'number', `${c.who}: the registry does not list the copy`);
    assert.equal(reg.events[c.key].versions[c.path], 'v1aaaa.10', `${c.who}: the copy’s version was not recorded`);
    // No signal: that very day opens from the copy, marked as the copy — for a warm worker and a cold one.
    w.server.down = true;
    for (const cold of [false, true]) {
      if (cold) w.restart();
      const off = await w.nav(c.path);
      assert.ok(off.body?.includes(`>${c.path}<`), `${c.who}${cold ? ' (cold)' : ''}: no signal opened ${off.body}`);
      assert.ok(off.copy, `${c.who}: not marked as the saved copy`);
      assert.match(off.body ?? '', /<html data-sn-saved-copy="\d+"/);
      // …and the page’s mark, reading that copy, is the amber "No signal · showing the copy from …", never "Saved".
      const at = Number(off.copy);
      const mark = savedMark({ phase: 'saved', savedAt: at, now: w.clock.now, online: false, eventDay: true, onCopy: at });
      assert.equal(mark.tone, 'amber');
      assert.match(mark.text, /^No signal · showing the copy from /);
    }
  }
});

test('a schedule save names only its own event’s day — never another event’s, never a reserved word as a guest page', async () => {
  const w = boot();
  for (const [eventId, paths] of [
    [E2, [SCHED]],
    [E1, [ME]],
    [SLUG, [SCHED]],
    ['dashboard', ['/dashboard?tab=me']],
    [E1, [`/vendor-dashboard/clients/${E1}?tab=files`]],
    [E1, [`${SCHED}?maker=1`]],
  ] as const) {
    const r = await w.post({ type: 'OFFLINE_SAVE', viewer: ANA, eventId, until: w.clock.now + 30 * HOUR, paths });
    assert.equal(r?.ok, false, `a save of ${paths} under ${eventId} was accepted`);
  }
  assert.deepEqual(w.kept(), [], `something was kept: ${w.kept()}`);
});

test('with signal the schedule is the network’s answer; opening it refreshes the copy — and its version', async () => {
  const w = boot();
  w.server.viewer = GUEST;
  w.server.versions[ME] = 'v1aaaa.10';
  await meSave(w, { version: 'v1aaaa.10' });
  w.server.versions[ME] = 'v2bbbb.12'; // the hosts pressed Release
  w.clock.now += 5 * 60_000;
  const online = await w.nav(ME);
  assert.match(online.body ?? '', /data-sn-copy-version="v2bbbb.12"/, 'an online open was not the network’s page');
  assert.equal(online.copy, null, 'an online open was answered from the copy');
  const reg = await w.registry();
  assert.equal(reg.events[SLUG].versions[ME], 'v2bbbb.12', 'opening it did not record the new version');
  assert.equal(reg.events[SLUG].pages[ME], w.clock.now, 'opening it did not refresh the copy');
  assert.equal(staleFor(parseOfflineRegistry(reg), GUEST, SLUG, [ME], 'v2bbbb.12'), false);
});

test('a stale copy after a Release is re-saved on the next visit with signal, however fresh its clock — and never labelled fresh until it is', async () => {
  const w = boot();
  w.server.viewer = GUEST;
  w.server.versions[ME] = 'v1aaaa.10';
  await meSave(w, { version: 'v1aaaa.10' });
  const first = (await w.registry()).events[SLUG].pages[ME];
  // The same version, ten minutes on: nothing is rendered again (the 30-minute rule stands).
  w.clock.now += 10 * 60_000;
  w.server.sent.length = 0;
  await meSave(w, { version: 'v1aaaa.10' });
  assert.deepEqual(w.server.sent.filter((x) => x === ME), [], 'a current copy was rendered again');
  // Release: the page now draws v2. A copy ten minutes old is still stale.
  w.server.versions[ME] = 'v2bbbb.12';
  const reg1 = parseOfflineRegistry(await w.registry());
  assert.equal(staleFor(reg1, GUEST, SLUG, [ME], 'v2bbbb.12'), true, 'a copy from before the Release read as current');
  const fresh = savedMark({ phase: 'saved', savedAt: savedAtFor(reg1, GUEST, SLUG, [ME], w.clock.now), now: w.clock.now, online: true, eventDay: true, stale: true });
  assert.notEqual(fresh.tone, 'ok', `a copy from before the Release was drawn "${fresh.text}"`);
  // The venue Wi-Fi drops as the page asks: the save says it failed, the older copy stays, still stale.
  w.server.down = true;
  const failed = await meSave(w, { version: 'v2bbbb.12' });
  assert.equal(failed?.ok, false);
  assert.equal(failed?.savedAt, first, 'the failed save did not name the older copy');
  const reg2 = parseOfflineRegistry(await w.registry());
  assert.equal(staleFor(reg2, GUEST, SLUG, [ME], 'v2bbbb.12'), true, 'a failed save made the old copy current');
  const bad = savedMark({ phase: 'failed', savedAt: savedAtFor(reg2, GUEST, SLUG, [ME], w.clock.now), now: w.clock.now, online: true, eventDay: true, stale: true });
  assert.equal(bad.tone, 'bad');
  assert.match(bad.text, /^Couldn’t update · the copy from /);
  // Signal back: the next save re-renders it (not skipped as "fresh"), and only now is it current.
  w.server.down = false;
  w.server.sent.length = 0;
  const ok = await meSave(w, { version: 'v2bbbb.12' });
  assert.equal(ok?.ok, true);
  assert.deepEqual(w.server.sent.filter((x) => x === ME), [ME], 'the stale copy was skipped as fresh');
  const reg3 = parseOfflineRegistry(await w.registry());
  assert.equal(staleFor(reg3, GUEST, SLUG, [ME], 'v2bbbb.12'), false);
  w.server.down = true;
  assert.match((await w.nav(ME)).body ?? '', /data-sn-copy-version="v2bbbb.12"/, 'no signal opened the copy from before the Release');
});

test('a page that could not read its schedule is never kept over the good copy — and the save says it failed', async () => {
  const w = boot();
  w.server.versions[SCHED] = 'v1aaaa.10';
  await w.saveFor(ANA, E1, [SCHED], { version: 'v1aaaa.10' });
  const good = (await w.registry()).events[E1].pages[SCHED];
  w.server.versions[SCHED] = OFFLINE_COPY_UNREAD; // the schedule read failed on the server
  w.clock.now += HOUR;
  await w.nav(SCHED); // an open with signal
  assert.equal((await w.registry()).events[E1].pages[SCHED], good, 'the open kept the failed page over the good copy');
  const r = await w.saveFor(ANA, E1, [SCHED], { force: true, version: OFFLINE_COPY_UNREAD });
  assert.equal(r?.ok, false, 'a save of a page that could not read its schedule said it landed');
  assert.deepEqual(plain(r?.failed), [SCHED]);
  w.server.down = true;
  assert.match((await w.nav(SCHED)).body ?? '', /data-sn-copy-version="v1aaaa.10"/, 'no signal did not open the good copy');
});

test('sign-out wipes it: a guest’s “Remove it from this browser” erases that event’s Me; an account sign-out erases all', async () => {
  // A guest pass holder: the POST to /<slug>/sign-out (every guest sign-out door) erases the saved Me.
  const g = boot();
  g.server.viewer = GUEST;
  await meSave(g);
  assert.ok(g.kept().includes(ME));
  await g.nav(`/${SLUG}/sign-out`, { method: 'POST' });
  assert.ok(!g.kept().includes(ME), `the guest’s Me survived their sign-out: ${g.kept()}`);
  assert.equal((await g.registry()).events[SLUG], undefined, 'the registry still lists the signed-out guest’s day');
  g.server.down = true;
  assert.equal((await g.nav(ME)).copy, null, 'the next person on the phone opened the signed-out guest’s Me');
  // A cold worker is told the same.
  const c = boot();
  c.server.viewer = GUEST;
  await meSave(c);
  c.restart();
  await c.nav(`/${SLUG.toUpperCase()}/sign-out`, { method: 'POST' });
  assert.ok(!c.kept().includes(ME), 'a cold worker missed the sign-out');

  // One account that is a guest at one wedding and coordinates another: signing out of the guest pass keeps the
  // coordinator’s own day; the account’s sign-out erases everything.
  const a = boot();
  a.server.viewer = ANA;
  await a.post({ type: 'OFFLINE_SAVE', viewer: ANA, eventId: SLUG, until: a.clock.now + 30 * HOUR, paths: [ME] });
  await a.saveFor(ANA, E1, [HOME, SCHED]);
  await a.nav(`/${SLUG}/sign-out`, { method: 'POST' });
  assert.deepEqual(a.kept().filter((k) => !k.startsWith('/__setnayan-sw')).sort(), [HOME, SCHED].sort(), 'the guest sign-out erased the wrong copies');
  await a.nav('/auth/sign-out');
  assert.deepEqual(a.kept(), [], `the account’s sign-out left ${a.kept()}`);
  // A reserved word is never read as a guest’s sign-out.
  const r = boot();
  await r.saveFor(ANA, E1, [HOME]);
  await r.nav('/dashboard/sign-out', { method: 'POST' });
  assert.ok(r.kept().includes(HOME));
});

test('the day-of cache never keeps a guest’s Me — it is per person, kept only by the saved copy', async () => {
  for (const ua of [CHROME_UA, SAFARI_UA]) {
    const w = boot({ ua });
    w.server.viewer = GUEST;
    w.restart(); // cold: nothing in memory
    await w.nav(ME);
    await w.nav(`/${SLUG}`);
    const dayOf = [...(w.stores.get('setnayan-dayof-v4')?.keys() ?? [])].map((u) => new URL(u).pathname + new URL(u).search);
    assert.ok(!dayOf.includes(ME), `${ua.slice(0, 20)}: the day-of cache kept a guest’s Me (${dayOf})`);
    assert.ok(dayOf.includes(`/${SLUG}`), `${ua.slice(0, 20)}: the day-of cache stopped keeping the guest page itself (${dayOf})`);
    // Another person, no signal: the Me opens from nobody’s copy.
    w.server.down = true;
    const off = await w.nav(ME);
    assert.ok(!off.body?.includes(GUEST), `no signal opened the last guest’s Me: ${off.body}`);
  }
});

test('a guest’s sign-out erases their day-of pages too — the next person, with no signal, never opens their table page', async () => {
  const OTHER = 'cale-ice';
  const DAYOF = 'setnayan-dayof-v4';
  const IMAGES = 'setnayan-images-v4';
  const paths = (w: ReturnType<typeof boot>, name: string) =>
    [...(w.stores.get(name)?.keys() ?? [])].map((u) => new URL(u).pathname + new URL(u).search).sort();
  const visit = async (w: ReturnType<typeof boot>) => {
    await w.dispatch('install');
    w.server.viewer = GUEST;
    for (const p of [`/${SLUG}`, `/${SLUG}/find-my-table`, `/${SLUG}?tab=home`, `/${OTHER}`]) await w.nav(p);
    // GuestPreload: the page asks for its own address (kept in the image cache, which `caches.match` also reads).
    await w.post({ type: 'PRELOAD_ASSETS', urls: ['/icon-192.svg', `/${SLUG}`] });
  };

  const w = boot();
  await visit(w);
  assert.ok(paths(w, DAYOF).includes(`/${SLUG}/find-my-table`), `the walk kept nothing to erase: ${paths(w, DAYOF)}`);
  assert.ok(paths(w, IMAGES).includes(`/${SLUG}`), `GuestPreload kept nothing to erase: ${paths(w, IMAGES)}`);
  await w.nav(`/${SLUG}/sign-out`, { method: 'POST' });
  assert.deepEqual(paths(w, DAYOF), [`/${OTHER}`], 'the signed-out guest’s day-of pages survived (or another event’s went)');
  assert.deepEqual(paths(w, IMAGES), ['/icon-192.svg'], 'the preloaded guest page survived (or an icon went)');
  w.server.down = true;
  for (const p of [`/${SLUG}`, `/${SLUG}/find-my-table`, `/${SLUG}?tab=home`]) {
    const off = await w.nav(p);
    assert.ok(!off.body?.includes(GUEST), `no signal opened the signed-out guest’s ${p}: ${off.body}`);
  }
  assert.ok((await w.nav(`/${OTHER}`)).body?.includes(`>/${OTHER}<`), 'another event’s page was lost');

  // An account's sign-out: every guest page goes; icons and code stay.
  const a = boot();
  await visit(a);
  await a.nav('/auth/sign-out');
  assert.deepEqual(paths(a, DAYOF), [], `an account sign-out left guest pages: ${paths(a, DAYOF)}`);
  assert.deepEqual(paths(a, IMAGES), ['/icon-192.svg']);

  // A reserved route is never read as a guest's sign-out.
  const r = boot();
  await visit(r);
  await r.nav('/dashboard/sign-out', { method: 'POST' });
  assert.ok(paths(r, DAYOF).includes(`/${SLUG}/find-my-table`));
});
