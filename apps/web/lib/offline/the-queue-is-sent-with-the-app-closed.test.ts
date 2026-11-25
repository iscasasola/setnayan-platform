/**
 * GUARD — THE SUPPLIER'S QUEUE IS SENT WITH THE APP CLOSED (controller review #2 item 5 · owner R16, DECISION_LOG 24 Nov
 * "The supplier dashboard works offline and catches up when back online").
 *
 * THE FAULT: the Background Sync listener lived in `public/sw-offline.js`, which only posted `TRIGGER_SYNC` to OPEN
 * windows — with the app closed nothing was sent — and it registered at the same scope `/` as `public/sw.js`, so
 * whichever registered last REPLACED the other. And the only thing that armed the sync was the daemon's own mount, which is
 * switched OFF in production (measured 25 Nov 2026: neither `sw-offline` nor `TRIGGER_SYNC` is in any script the live
 * home page loads).
 *
 * THE CURE: `public/sw.js` owns the `setnayan-offline-sync` listener and sends `supplier_queue` itself, with the person's
 * own cookies, to the ONE stable route — the same POST `lib/offline/supplier-wire.ts` makes. Every keep arms it
 * (`queueSupplierAction` → `registerSyncDaemon`). `sw-offline.js` is gone.
 *
 * HOW: sw.js is run for real in a `vm` context (as `app/sw-is-a-pass-through-on-a-dev-host.test.ts` does), with a small
 * stand-in IndexedDB, a scripted network, a Web Lock and open windows; a `sync` event is dispatched as the browser does.
 *
 * Each rule below was turned red by a sabotage on a scratch copy of sw.js (listed in the PR's STATUS comment).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { SUPPLIER_OFFLINE_ROUTE, SUPPLIER_OFFLINE_WIRE } from '@/lib/supplier-offline/replies';
import { SYNC_STATUSES } from '@/lib/supplier-offline/kinds';
import { supplierWire } from './supplier-wire';
import { readSupplierOutcomes, useOutcomeStoreForTest, ANSWER_NOT_SHOWN } from './service-handlers/supplier-handler';

const WEB = path.join(import.meta.dirname, '..', '..');
const SW_FILE = process.env.SW_SEND_FROM || path.join(WEB, 'public', 'sw.js');
const SW = readFileSync(SW_FILE, 'utf8');
const ORIGIN = 'https://www.setnayan.com';
const DAEMON = readFileSync(path.join(WEB, 'lib', 'offline', 'sync-daemon.ts'), 'utf8');
/** The page's try cap (`sync-daemon.ts` — read from source: it is a browser module). */
const OFFLINE_MAX_RETRY_COUNT = Number(/export const OFFLINE_MAX_RETRY_COUNT = (\d+);/.exec(DAEMON)?.[1]);

type Row = Record<string, unknown>;
const KEYS: Record<string, string> = { supplier_queue: 'item_id', supplier_outcomes: 'id', supplier_keys: 'id' };
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const later = (fn: () => void) => setImmediate(fn);

/** A stand-in for the browser's IndexedDB: one database, `setnayan_offline`, or none at all. */
function fakeIndexedDb(stores: Record<string, Map<string, Row>> | null) {
  const state = { stores, created: 0 };
  const makeDb = () => ({
    objectStoreNames: { contains: (n: string) => Boolean(state.stores && n in state.stores) },
    close() {},
    onversionchange: null as unknown,
    transaction(names: string | string[], _mode: string) {
      const tx: Record<string, unknown> & { oncomplete?: () => void } = {};
      let pending = 0;
      const settle = () => later(() => (pending === 0 ? tx.oncomplete?.() : undefined));
      tx.objectStore = (n: string) => {
        const m = state.stores![n]!;
        const op = (fn: () => unknown) => {
          pending += 1;
          const r: { result?: unknown; onsuccess?: () => void } = {};
          later(() => {
            r.result = fn();
            pending -= 1;
            r.onsuccess?.();
            settle();
          });
          return r;
        };
        return {
          getAll: () => op(() => [...m.values()].map(copy)),
          put: (v: Row) => op(() => void m.set(String(v[KEYS[n]!]), copy(v))),
          delete: (k: string) => op(() => void m.delete(k)),
          clear: () => op(() => m.clear()),
        };
      };
      void names;
      settle();
      return tx;
    },
  });
  const indexedDB = {
    open(name: string) {
      const req: Record<string, unknown> & { onupgradeneeded?: () => void; onsuccess?: () => void; onerror?: () => void } = {};
      later(() => {
        if (name !== 'setnayan_offline') throw new Error(`unexpected database ${name}`);
        if (!state.stores) {
          // Opening a database that does not exist CREATES it — unless the upgrade is aborted.
          let aborted = false;
          req.transaction = { abort: () => (aborted = true) };
          req.result = makeDb();
          req.onupgradeneeded?.();
          if (aborted) return req.onerror?.();
          state.stores = {};
          state.created += 1;
        }
        req.result = makeDb();
        req.onsuccess?.();
      });
      return req;
    },
  };
  return { indexedDB, state };
}

type Answer = Response | 'no-signal' | ((body: { v: number; op: string; fields: { item: string } }) => Response | 'no-signal');

function boot(opts: { stores: Record<string, Map<string, Row>> | null; answers?: Answer[]; lockHeld?: boolean; windows?: number }) {
  const idb = fakeIndexedDb(opts.stores);
  const sent: { url: string; init: RequestInit; body: { v: number; op: string; fields: { item: string } } }[] = [];
  const answers = [...(opts.answers ?? [])];
  const posted: unknown[] = [];
  const held = new Set<string>(opts.lockHeld ? ['setnayan-offline-supplier'] : []);
  const listeners: Record<string, ((ev: Record<string, unknown>) => void)[]> = {};
  const windows = Array.from({ length: opts.windows ?? 0 }, () => ({ postMessage: (m: unknown) => posted.push(m) }));
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    navigator: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36',
      onLine: true,
      locks: {
        request: async (name: string, _o: unknown, cb: (lock: unknown) => unknown) => {
          if (held.has(name)) return cb(null);
          held.add(name);
          try {
            return await cb({ name });
          } finally {
            held.delete(name);
          }
        },
      },
    },
    addEventListener: (type: string, fn: (ev: Record<string, unknown>) => void) => {
      (listeners[type] ??= []).push(fn);
    },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined, matchAll: async () => windows },
    registration: {},
    indexedDB: idb.indexedDB,
  };
  const emptyCache = { keys: async () => [], match: async () => undefined, put: async () => undefined, delete: async () => true };
  const context = vm.createContext({
    self,
    indexedDB: idb.indexedDB,
    caches: { open: async () => emptyCache, keys: async () => [], delete: async () => true, match: async () => undefined },
    fetch: async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { v: number; op: string; fields: { item: string } };
      sent.push({ url, init, body });
      let a = answers.shift();
      if (typeof a === 'function') a = a(body);
      if (!a || a === 'no-signal') throw new TypeError('Failed to fetch');
      return a;
    },
    Request,
    Response,
    Headers,
    URL,
    Date,
    setTimeout: (fn: () => void) => setImmediate(fn),
    console,
  });
  vm.runInContext(SW, context, { filename: 'sw.js' });
  const dispatch = async (type: string, init: Record<string, unknown>) => {
    const waits: Promise<unknown>[] = [];
    const ev = { ...init, waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: () => undefined };
    for (const fn of listeners[type] ?? []) fn(ev);
    const settled = await Promise.allSettled(waits);
    await new Promise((r) => setTimeout(r, 15));
    return settled;
  };
  return { idb, sent, posted, dispatch, sync: () => dispatch('sync', { tag: 'setnayan-offline-sync' }) };
}

/** A queued supplier action, as `queueSupplierAction` keeps it. */
function queued(itemId: string, at: string, extra: Partial<Row> = {}): Row {
  return {
    item_id: itemId,
    event_id: 'shop-1',
    queued_at: at,
    retry_count: 0,
    payload: {
      v: 1,
      itemId,
      shop: 'shop-1',
      member: 'member-1',
      phoneTime: at,
      madeOffline: true,
      kind: 'schedule.client',
      baseVersion: null,
      rowVersion: null,
      seen: null,
      giftsAsOf: null,
      fields: { client_date: '2026-12-12', client_time: '14:00' },
      ageByTriesOnly: true,
    },
    ...extra,
  };
}

const stores = (...items: Row[]) => ({
  supplier_queue: new Map(items.map((i) => [String(i.item_id), i])),
  supplier_outcomes: new Map<string, Row>(),
  supplier_keys: new Map<string, Row>(),
});

const ok = (reply: unknown) =>
  new Response(JSON.stringify({ v: SUPPLIER_OFFLINE_WIRE, reply: { op: 'sync', ok: true, reply } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const applied = (itemId: string) => ok({ status: 'applied', itemId, kind: 'schedule.client' });
const retry = (itemId: string, why: string) => ok({ status: 'retry', why, itemId, kind: 'schedule.client' });
const clash = (itemId: string) =>
  ok({
    status: 'clash',
    itemId,
    kind: 'schedule.client',
    clash: { why: 'booked', by: { memberUserId: 'member-2', name: 'Ana' }, at: '2026-11-24T06:14:00.000Z', dates: ['2026-12-12'] },
  });

/** A const the worker declares, read from its source (a worker imports nothing, so it keeps its own copy). */
function workerConst(name: string): string {
  const m = new RegExp(`^const ${name} = (.+);$`, 'm').exec(SW);
  assert.ok(m, `public/sw.js declares ${name}`);
  return m[1]!;
}
const setOf = (literal: string) => new Set([...literal.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));

test('the worker sends what the page sends: the same route, payload, tag, lock, try cap and answers', async () => {
  assert.equal(workerConst('SUPPLIER_OFFLINE_ROUTE'), `'${SUPPLIER_OFFLINE_ROUTE}'`);
  assert.equal(workerConst('SUPPLIER_OFFLINE_WIRE'), String(SUPPLIER_OFFLINE_WIRE));
  assert.equal(workerConst('SUPPLIER_OFFLINE_MAX_TRIES'), String(OFFLINE_MAX_RETRY_COUNT));
  assert.ok(OFFLINE_MAX_RETRY_COUNT > 0);
  const daemon = DAEMON;
  const tag = /export const OFFLINE_SYNC_TAG = ('[^']+');/.exec(daemon)?.[1];
  assert.equal(workerConst('OFFLINE_SYNC_TAG'), tag, 'the page arms the tag the worker listens for');
  const lock = /locks\s*\.request\('([^']+)'/.exec(daemon)?.[1];
  assert.equal(workerConst('SUPPLIER_OFFLINE_LOCK'), `'${lock}'`, 'one lock for a tab and the worker');
  const handler = readFileSync(path.join(WEB, 'lib', 'offline', 'service-handlers', 'supplier-handler.ts'), 'utf8');
  const waiting = /const WAITING = new Set\(\[([^\]]+)\]\)/.exec(handler)?.[1] ?? '';
  assert.deepEqual(setOf(workerConst('SUPPLIER_OFFLINE_WAITING')), setOf(waiting), '"waiting" means the same in both');
  assert.deepEqual(
    setOf(workerConst('SUPPLIER_OFFLINE_FINAL')),
    new Set(SYNC_STATUSES.filter((s) => s !== 'retry')),
    'the answers that end an item are the page’s',
  );

  // The POST itself, byte for byte: the page's (supplier-wire.ts) and the worker's, for one item.
  const item = queued('A', '2026-11-24T06:00:00.000Z');
  let pageInit: RequestInit | null = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    pageInit = init;
    return applied('A');
  }) as typeof fetch;
  try {
    await supplierWire('sync', { item: JSON.stringify(item.payload) });
  } finally {
    globalThis.fetch = realFetch;
  }
  const w = boot({ stores: stores(item), answers: [applied('A')] });
  await w.sync();
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0]!.url, SUPPLIER_OFFLINE_ROUTE);
  const pick = (i: RequestInit | null) => ({ method: i?.method, credentials: i?.credentials, cache: i?.cache, headers: i?.headers, body: i?.body });
  assert.deepEqual(copy(pick(w.sent[0]!.init)), copy(pick(pageInit)));
});

test('applied leaves the queue; a clash leaves it as an answer the page then shows', async () => {
  const w = boot({ stores: stores(queued('B', '2026-11-24T06:05:00.000Z'), queued('A', '2026-11-24T06:00:00.000Z')), answers: [applied('A'), clash('B')] });
  await w.sync();
  assert.deepEqual(w.sent.map((s) => JSON.parse(s.body.fields.item).itemId), ['A', 'B'], 'oldest first');
  const s = w.idb.state.stores!;
  assert.equal(s.supplier_queue!.size, 0);
  assert.deepEqual([...s.supplier_outcomes!.keys()], ['B'], 'an applied change needs no answer; the clash does');
  // …and the page reads it as the clash it is (not "can't show it").
  useOutcomeStoreForTest({ all: async () => [...s.supplier_outcomes!.values()] as ({ id: string } & Row)[], put: async () => undefined, remove: async () => undefined });
  try {
    const notes = await readSupplierOutcomes('member-1', 'shop-1');
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.reply.status, 'clash');
    assert.equal(notes[0]!.item.itemId, 'B');
  } finally {
    useOutcomeStoreForTest(null);
  }
});

test('waiting is not a try; an answer that could not be decided is; an answer it does not know keeps the item', async () => {
  const w = boot({
    stores: stores(queued('A', '2026-11-24T06:00:00.000Z'), queued('B', '2026-11-24T06:01:00.000Z'), queued('C', '2026-11-24T06:02:00.000Z'), queued('D', '2026-11-24T06:03:00.000Z')),
    answers: [
      retry('A', 'other_member'),
      retry('B', 'unread'),
      ok({ status: 'bogus', itemId: 'C', kind: 'schedule.client' }),
      new Response('', { status: 409 }),
    ],
  });
  await w.sync();
  const q = w.idb.state.stores!.supplier_queue!;
  assert.deepEqual([...q.keys()].sort(), ['A', 'B', 'C', 'D'], 'nothing left the queue');
  assert.equal(q.get('A')!.retry_count, 0, 'made by another account: nothing was really sent');
  assert.equal(q.get('B')!.retry_count, 1, 'Setnayan could not check it: one try');
  assert.equal(q.get('C')!.retry_count, 1, 'an answer the worker does not know: one try, and it stays');
  assert.equal(q.get('D')!.retry_count, 0, 'an older payload: nothing was really sent');
  assert.equal(w.idb.state.stores!.supplier_outcomes!.size, 0);
});

test('no signal after all: nothing changes, the rest waits, and the browser is told to try the sync again', async () => {
  const w = boot({ stores: stores(queued('A', '2026-11-24T06:00:00.000Z'), queued('B', '2026-11-24T06:01:00.000Z')), answers: ['no-signal', applied('B')] });
  const settled = await w.sync();
  assert.equal(w.sent.length, 1, 'the pass stops at the first item that could not go');
  assert.ok(settled.some((s) => s.status === 'rejected'), 'the sync event fails, so the browser retries it');
  const q = w.idb.state.stores!.supplier_queue!;
  assert.equal(q.size, 2);
  assert.equal(q.get('A')!.retry_count, 0);
});

test('a refusal of the send itself becomes an answer; an item past its tries is left for the page', async () => {
  const refusal = new Response(JSON.stringify({ v: 1, reply: { op: 'sync', ok: false, why: 'The shop is paused.', retry: false } }), { status: 200 });
  const w = boot({ stores: stores(queued('A', '2026-11-24T06:00:00.000Z'), queued('Z', '2026-11-24T06:09:00.000Z', { retry_count: OFFLINE_MAX_RETRY_COUNT })), answers: [refusal] });
  await w.sync();
  assert.equal(w.sent.length, 1, 'the item past its tries is not sent (the page gives up on it, with a note)');
  const s = w.idb.state.stores!;
  assert.deepEqual([...s.supplier_queue!.keys()], ['Z']);
  const note = s.supplier_outcomes!.get('A') as { reply: { status: string; why: string } };
  assert.equal(note.reply.status, 'refused');
  assert.equal(note.reply.why, 'The shop is paused.');
});

test('one sender at a time: a tab already sending means the worker sends nothing', async () => {
  const w = boot({ stores: stores(queued('A', '2026-11-24T06:00:00.000Z')), answers: [applied('A')], lockHeld: true });
  await w.sync();
  assert.equal(w.sent.length, 0);
  assert.equal(w.idb.state.stores!.supplier_queue!.size, 1);
});

test('open windows are still told, so a page that is open sends its other queues', async () => {
  const w = boot({ stores: stores(), windows: 2 });
  await w.sync();
  assert.deepEqual(copy(w.posted), [{ type: 'TRIGGER_SYNC' }, { type: 'TRIGGER_SYNC' }]);
});

test('nothing is created: a phone with no saved work gets no database — from the send or from a sign-out', async () => {
  const w = boot({ stores: null, answers: [applied('A')] });
  await w.sync();
  assert.equal(w.idb.state.created, 0, 'the send');
  assert.equal(w.sent.length, 0);
  const signOut = { url: `${ORIGIN}/auth/sign-out`, method: 'GET', mode: 'navigate', destination: 'document', headers: new Headers() };
  await w.dispatch('fetch', { request: signOut });
  assert.equal(w.idb.state.created, 0, 'the sign-out wipe');
});

test('a malformed answer the worker filed is shown as one it can’t show — never dropped, never drawn as something else', async () => {
  const bad = { id: 'X', member: 'member-1', shop: 'shop-1', item: queued('X', '2026-11-24T06:00:00.000Z').payload, reply: { status: 'clash', itemId: 'X' }, answeredAt: '2026-11-24T07:00:00.000Z' };
  useOutcomeStoreForTest({ all: async () => [bad] as unknown as ({ id: string } & Row)[], put: async () => undefined, remove: async () => undefined });
  try {
    const notes = await readSupplierOutcomes('member-1', 'shop-1');
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.reply.status, 'refused');
    assert.equal((notes[0]!.reply as { why: string }).why, ANSWER_NOT_SHOWN);
  } finally {
    useOutcomeStoreForTest(null);
  }
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|js|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('there is ONE worker: sw-offline.js is gone and nothing registers any worker but /sw.js', () => {
  assert.equal(existsSync(path.join(WEB, 'public', 'sw-offline.js')), false);
  const calls: string[] = [];
  for (const f of [...walk(path.join(WEB, 'app')), ...walk(path.join(WEB, 'lib')), ...walk(path.join(WEB, 'components'))]) {
    for (const m of readFileSync(f, 'utf8').matchAll(/serviceWorker\s*\.register\(\s*([^,)]+)/g)) calls.push(`${path.relative(WEB, f)}: ${m[1]!.trim()}`);
  }
  assert.ok(calls.length >= 1, 'the layout registers /sw.js');
  assert.deepEqual(calls.filter((c) => !/:\s*'\/sw\.js'$/.test(c)), []);
});

test('every keep arms the background send — not left to the daemon mount, which is off in production', () => {
  const q = readFileSync(path.join(WEB, 'lib', 'offline', 'supplier-queue.ts'), 'utf8');
  const body = /export async function queueSupplierAction\([\s\S]*?\n\}\n/.exec(q)?.[0] ?? '';
  const keep = body.indexOf("enqueueOfflineItem('supplier'");
  assert.ok(keep > 0, 'queueSupplierAction keeps the item');
  assert.ok(body.indexOf('registerSyncDaemon()', keep) > keep, 'and then arms the sync');
});

test('a message whose file is not uploaded yet waits for the page; with its ref it goes — and bytes never ride', async () => {
  const withFile = queued('F', '2026-11-24T06:00:00.000Z');
  (withFile.payload as Record<string, unknown>).kind = 'message.send';
  (withFile.payload as Record<string, unknown>).fields = { thread_id: 'T1', body: 'layout' };
  (withFile.payload as Record<string, unknown>).file = { name: 'layout.jpg', type: 'image/jpeg', buffer: 'BYTES' };
  const uploaded = queued('G', '2026-11-24T06:01:00.000Z');
  (uploaded.payload as Record<string, unknown>).kind = 'message.send';
  (uploaded.payload as Record<string, unknown>).fields = { thread_id: 'T1', body: 'menu', attachment_ref: 'r2://thread-files/x/menu.pdf', attachment_name: 'menu.pdf' };
  (uploaded.payload as Record<string, unknown>).file = { name: 'menu.pdf', type: 'application/pdf', buffer: 'STALE' };
  const w = boot({ stores: stores(withFile, uploaded), answers: [ok({ status: 'applied', itemId: 'G', kind: 'message.send' })] });
  await w.sync();
  assert.deepEqual(w.sent.map((s) => JSON.parse(s.body.fields.item).itemId), ['G'], 'the worker sent a message whose file only the page can upload');
  assert.equal('file' in JSON.parse(w.sent[0]!.body.fields.item), false, 'bytes rode the sync');
  assert.deepEqual([...w.idb.state.stores!.supplier_queue!.keys()], ['F'], 'the page’s item was touched');
  assert.equal(w.idb.state.stores!.supplier_queue!.get('F')!.retry_count, 0, 'waiting for the page counted as a try');
});
