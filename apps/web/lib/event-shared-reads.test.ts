/**
 * event-shared-reads.test.ts — WHAT THE GUEST PAGE MAY REMEMBER, AND WHAT IT
 * NEVER MAY (event-day load L3, 2026-10-18 · `lib/event-shared-reads.ts`).
 *
 *   1 · THE PREDICATE, on the requests the page really sends (built by the
 *       installed supabase-js, never typed by hand): each shared read of the
 *       event is accepted; a read about ONE guest, another event, a column the
 *       stamp does not follow, an embed that could reach another event, money,
 *       a write, an RPC — refused.
 *   2 · THE KEY is the whole question and nothing about who asked: two viewers
 *       asking the identical question share it; any difference splits it.
 *   3 · THE SCOPE: only a render the page OPENED, for its own event, with its
 *       stamp read — outside a render (an action, a route, a job) never.
 *   4 · THE CACHE: a 2xx is filed and served without a request; a refusal is
 *       handed back and never filed; a cache that cannot run sends the read.
 *   5 · THE STAMP COVERS THE LIST: every table here has its trigger in the
 *       migration, and the `guests` trigger watches exactly
 *       `GUESTS_SHARED_COLUMNS` (the db test proves the same on the replayed
 *       schema).
 *   6 · ONLY THE GUEST PAGE OPENS IT, and never for the Maker's canvas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { stripComments } from './strip-comments';

// Next's server runtime puts `AsyncLocalStorage` on globalThis before any of its
// modules load; plain node does not — so it is set first, and the module under
// test (which loads `next/cache`) is required only after.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
const {
  GUESTS_SHARED_COLUMNS,
  HOST_ONLY_PARAMS,
  SHARED_EVENT_TABLES,
  hostAsksForCanvas,
  noteEventStamp,
  openSharedEventReads,
  sharedReadFor,
  sharedReadOf,
  withSharedEventReads,
  withSharedReadScopeForTest,
} = require('./event-shared-reads') as typeof import('./event-shared-reads');

const WEB = join(__dirname, '..');
const ROOT = join(WEB, '..', '..');
const E = '00000000-0000-4000-8000-0000000000e1';
const OTHER = '00000000-0000-4000-8000-0000000000e2';
const G = '00000000-0000-4000-8000-0000000000a1';
const ENTOURAGE_ROLES = ['principal_sponsor', 'best_man', 'maid_of_honor'];

type Sent = { method: string; url: string; headers: Headers };

/** The requests the installed supabase-js really sends for `ask` — captured, answered `[]`. */
async function requestsOf(ask: (db: SupabaseClient) => PromiseLike<unknown>): Promise<Sent[]> {
  const sent: Sent[] = [];
  const db: SupabaseClient = createClient('http://db.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input);
        sent.push({ method: (init?.method ?? 'GET').toUpperCase(), url, headers: new Headers(init?.headers) });
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      }) as typeof fetch,
    },
  });
  await ask(db);
  return sent;
}
const one = async (ask: Parameters<typeof requestsOf>[0]) => {
  const sent = await requestsOf(ask);
  assert.equal(sent.length, 1);
  return sent[0]!;
};
const accepted = async (what: string, ask: Parameters<typeof requestsOf>[0], eventId = E) =>
  assert.ok(sharedReadFor(await one(ask), eventId, 7), `${what} should be remembered`);
const refused = async (what: string, ask: Parameters<typeof requestsOf>[0], eventId = E) =>
  assert.equal(sharedReadFor(await one(ask), eventId, 7), null, `${what} must NEVER be remembered`);

/* ═══ 1 · THE PREDICATE ═════════════════════════════════════════════════ */

test('1 · the page’s shared reads of THIS event are remembered — as the installed client sends them', async () => {
  await accepted('the scenes', (db) => db.from('invitation_widgets').select('widget_id, event_id, widget_type, config_json').eq('event_id', E));
  await accepted('the entourage (an embed of its march, an `or` on two stamped columns)', (db) =>
    db
      .from('guests')
      .select('guest_id, display_name, name_prefix, first_name, middle_name, last_name, name_suffix, role, extra_roles, march:march_walks(walk_no, place_in_walk), plus_one_of_guest_id, couple_with_guest_id, attire, gender')
      .eq('event_id', E)
      .is('deleted_at', null)
      .or(`role.in.(${ENTOURAGE_ROLES.join(',')}),extra_roles.ov.{${ENTOURAGE_ROLES.join(',')}}`),
  );
  await accepted('the public schedule', (db) =>
    db.from('event_schedule_blocks').select('block_id, label, start_at').eq('event_id', E).eq('is_public', true).is('audience', null).order('start_at', { ascending: true }).order('sort_order'),
  );
  await accepted('the venue bookings', (db) =>
    db.from('event_vendors').select('category, status, vendor_name').eq('event_id', E).is('archived_at', null).in('category', ['venue', 'church_fees']),
  );
  await accepted('the credited suppliers', (db) =>
    db.from('event_vendors').select('marketplace_vendor_id, category, status').eq('event_id', E).in('status', ['contracted', 'complete']).not('marketplace_vendor_id', 'is', null),
  );
  await accepted('one row (`maybeSingle`)', (db) => db.from('event_floor_plan').select('published_at').eq('event_id', E).maybeSingle());
  await accepted('the march tray', (db) => db.from('march_not_walking').select('guest_id').eq('event_id', E));
});

test('1b · a read about ONE guest is never remembered — even of a stamped table, even scoped to the event', async () => {
  await refused('the guest’s own row', (db) => db.from('guests').select('guest_id, display_name').eq('guest_id', G).is('deleted_at', null).maybeSingle());
  await refused('the guest’s own row, with the event too', (db) => db.from('guests').select('guest_id, display_name').eq('event_id', E).eq('guest_id', G));
  await refused('a person named inside an `or`', (db) => db.from('guests').select('guest_id').eq('event_id', E).or(`guest_id.eq.${G},role.eq.best_man`));
  await refused('the session check', (db) => db.from('guests').select('qr_token').eq('guest_id', G).is('deleted_at', null).maybeSingle());
  await refused('who a plus-one belongs to', (db) => db.from('guests').select('guest_id').eq('event_id', E).eq('plus_one_of_guest_id', G));
  await refused('a guest’s blocks', (db) => db.from('event_blocked_users').select('id').eq('event_id', E).eq('blocked_guest_id', G));
});

test('1c · a `guests` read that reaches a column the stamp does not follow is never remembered', async () => {
  // The trigger fires only for `GUESTS_SHARED_COLUMNS` — an RSVP moves nothing, so a read of it could go stale.
  await refused('selecting the RSVP', (db) => db.from('guests').select('guest_id, rsvp_status').eq('event_id', E));
  await refused('filtering on the RSVP', (db) => db.from('guests').select('guest_id').eq('event_id', E).eq('rsvp_status', 'attending'));
  await refused('an `or` naming the RSVP', (db) => db.from('guests').select('guest_id').eq('event_id', E).or('rsvp_status.eq.attending,role.eq.best_man'));
  await refused('ordering by the RSVP', (db) => db.from('guests').select('guest_id').eq('event_id', E).order('rsvp_status'));
  await refused('every column', (db) => db.from('guests').select('*').eq('event_id', E));
  await refused('a photo', (db) => db.from('guests').select('guest_id, photo_url').eq('event_id', E));
});

test('1d · an embed that could reach ANOTHER event’s row, or a filter on an embed, is never remembered', async () => {
  await refused('a supplier’s profile inside a booking', (db) => db.from('event_vendors').select('category, vendor:vendor_profiles(display_name)').eq('event_id', E));
  await refused('a stamped table embedded by a key without the event', (db) => db.from('march_not_walking').select('guest_id, guests(display_name)').eq('event_id', E));
  await refused('a filter on the embedded march', (db) =>
    db.from('guests').select('guest_id, march:march_walks(walk_no)').eq('event_id', E).eq('march.walk_no', 1),
  );
  await refused('a JSON path', (db) => db.from('invitation_widgets').select('config_json->hero').eq('event_id', E));
  await refused('an aggregate', (db) => db.from('invitation_widgets').select('count()').eq('event_id', E));
});

test('1e · another event, no event, money, the live day, a write or an RPC is never remembered', async () => {
  await refused('another event’s scenes', (db) => db.from('invitation_widgets').select('widget_id').eq('event_id', OTHER));
  await refused('scenes of no event', (db) => db.from('invitation_widgets').select('widget_id').eq('widget_type', 'hero'));
  await refused('two events at once', (db) => db.from('invitation_widgets').select('widget_id').in('event_id', [E, OTHER]));
  await refused('the order rows (money)', (db) => db.from('orders').select('service_key, status').eq('event_id', E));
  await refused('a paid camera (money)', (db) => db.from('paparazzi_seats').select('seat_id').eq('event_id', E).is('revoked_at', null).limit(1));
  await refused('a camera snapshot (money)', (db) => db.from('papic_limited_snapshots').select('snapshot_id').eq('event_id', E));
  await refused('the coordinator’s announcement (the live day)', (db) => db.from('coordinator_broadcasts').select('body').eq('event_id', E));
  await refused('an update', (db) => db.from('invitation_widgets').update({ is_visible: false }).eq('event_id', E));
  await refused('a delete', (db) => db.from('invitation_widgets').delete().eq('event_id', E));
  await refused('a count (HEAD)', (db) => db.from('invitation_widgets').select('widget_id', { count: 'exact', head: true }).eq('event_id', E));
  await refused('an RPC', (db) => db.rpc('event_entitlement_facts', { p_event_id: E }));
  await refused('another schema', (db) => db.schema('auth').from('users').select('id').eq('event_id', E));
});

/* ═══ 2 · THE KEY ═══════════════════════════════════════════════════════ */

test('2 · the key is the whole question and nothing about who asked', async () => {
  const ask = (db: SupabaseClient) => db.from('invitation_widgets').select('widget_id').eq('event_id', E);
  const a = sharedReadFor(await one(ask), E, 7)!;
  const b = sharedReadFor(await one(ask), E, 7)!;
  assert.equal(a.key, b.key, 'two viewers asking the identical question must share it');
  const single = sharedReadFor(await one((db) => db.from('invitation_widgets').select('widget_id').eq('event_id', E).single()), E, 7)!;
  assert.notEqual(single.key, a.key, 'one row and a list are different answers — `accept` is part of the question');
  const other = sharedReadFor(await one((db) => db.from('invitation_widgets').select('widget_type').eq('event_id', E)), E, 7)!;
  assert.notEqual(other.key, a.key);
  assert.equal(sharedReadFor(await one(ask), E, 8)!.rev, 8, 'the rev rides with the slot');
  assert.ok(!/test-key|authorization|apikey/i.test(a.key), 'a credential is in the key');
});

/* ═══ 3 · THE SCOPE ═════════════════════════════════════════════════════ */

test('3 · only a render that OPENED this event, with its stamp read, is served — and never outside a render', async () => {
  const req = await one((db) => db.from('invitation_widgets').select('widget_id').eq('event_id', E));
  const init = { method: req.method, headers: req.headers };
  // Plain node is not a render: opening and stamping here are forgotten at once.
  openSharedEventReads(E);
  noteEventStamp(E, 7);
  assert.equal(sharedReadOf(req.url, init), null, 'an action / a route / a job was served a remembered read');
  await withSharedReadScopeForTest(async () => {
    noteEventStamp(E, 7);
    assert.equal(sharedReadOf(req.url, init), null, 'a render the page did not open (the Maker’s canvas) was served');
  });
  await withSharedReadScopeForTest(async () => {
    openSharedEventReads(E);
    assert.equal(sharedReadOf(req.url, init), null, 'a render that did not read its stamp was served');
  });
  await withSharedReadScopeForTest(async () => {
    openSharedEventReads(OTHER);
    noteEventStamp(E, 7);
    noteEventStamp(OTHER, 7);
    assert.equal(sharedReadOf(req.url, init), null, 'a render opened for ANOTHER event was served this one’s read');
  });
  await withSharedReadScopeForTest(async () => {
    openSharedEventReads(E);
    noteEventStamp(E, 7);
    assert.equal(sharedReadOf(req.url, init)?.rev, 7);
  });
});

/* ═══ 4 · THE CACHE ═════════════════════════════════════════════════════ */

type FakeCache = { entries: Map<string, unknown> };
function installDataCache(): FakeCache {
  const fake: FakeCache = { entries: new Map() };
  (globalThis as { __incrementalCache?: unknown }).__incrementalCache = {
    isOnDemandRevalidate: false,
    async generateSimpleCacheKey(key: string) {
      return key;
    },
    async get(key: string) {
      const value = fake.entries.get(key);
      return value ? { value, isStale: false } : null;
    },
    async set(key: string, value: unknown) {
      fake.entries.set(key, value);
    },
  };
  return fake;
}
const removeDataCache = () => delete (globalThis as { __incrementalCache?: unknown }).__incrementalCache;

function countingDb(answer: () => Response) {
  let sent = 0;
  const inner = (async () => {
    sent += 1;
    return answer();
  }) as unknown as typeof fetch;
  return { fetch: withSharedEventReads(inner), sent: () => sent };
}
const WIDGETS_URL = `http://db.test/rest/v1/invitation_widgets?select=widget_id&event_id=eq.${E}`;
const ok = () => new Response('[{"widget_id":"w-hero"}]', { status: 200, headers: { 'content-type': 'application/json', 'content-range': '0-0/*' } });

test('4 · a 2xx is filed and the next view sends nothing; a new rev reads again', async () => {
  const fake = installDataCache();
  try {
    const db = countingDb(ok);
    const view = (rev: number) =>
      withSharedReadScopeForTest(async () => {
        openSharedEventReads(E);
        noteEventStamp(E, rev);
        const res = await db.fetch(WIDGETS_URL, { method: 'GET', headers: { accept: 'application/json' } });
        return { status: res.status, body: await res.text(), range: res.headers.get('content-range') };
      });
    const first = await view(7);
    const second = await view(7);
    assert.deepEqual(second, first, 'the remembered answer is not the answer');
    assert.equal(db.sent(), 1, 'the second view asked the database again');
    assert.equal(second.range, '0-0/*', 'the header PostgREST answers with was not kept');
    await view(8);
    assert.equal(db.sent(), 2, 'a new stamp was served the old answer');
    assert.ok(fake.entries.size >= 2);
  } finally {
    removeDataCache();
  }
});

test('4b · a refusal is handed back as it came and never filed — the next view asks again', async () => {
  const fake = installDataCache();
  try {
    let status = 503;
    const db = countingDb(() => new Response('{"code":"PGRST003"}', { status }));
    const view = () =>
      withSharedReadScopeForTest(async () => {
        openSharedEventReads(E);
        noteEventStamp(E, 7);
        return (await db.fetch(WIDGETS_URL, { method: 'GET' })).status;
      });
    assert.equal(await view(), 503);
    assert.equal(await view(), 503);
    assert.equal(db.sent(), 2, 'a refusal was remembered');
    assert.equal(fake.entries.size, 0);
    status = 200;
    assert.equal(await view(), 200);
    assert.equal(db.sent(), 3);
  } finally {
    removeDataCache();
  }
});

test('4c · a data cache that cannot run sends the read — the cache is never why a read failed', async () => {
  removeDataCache();
  const db = countingDb(ok);
  const status = await withSharedReadScopeForTest(async () => {
    openSharedEventReads(E);
    noteEventStamp(E, 7);
    return (await db.fetch(WIDGETS_URL, { method: 'GET' })).status;
  });
  assert.equal(status, 200);
  assert.equal(db.sent(), 1);
});

test('4d · outside an opened render the fetch is the plain fetch — every request sent', async () => {
  installDataCache();
  try {
    const db = countingDb(ok);
    await db.fetch(WIDGETS_URL, { method: 'GET' });
    await db.fetch(WIDGETS_URL, { method: 'GET' });
    assert.equal(db.sent(), 2);
  } finally {
    removeDataCache();
  }
});

/* ═══ 5 · THE STAMP COVERS THE LIST ═════════════════════════════════════ */

const MIGRATION = readFileSync(join(ROOT, 'supabase', 'migrations', '20271275959355_the_guest_page_reads_a_stamp.sql'), 'utf8');

test('5 · every table the page may remember moves the stamp — and `guests` watches exactly its shared columns', () => {
  const loop = /FOREACH t IN ARRAY ARRAY\[([\s\S]*?)\] LOOP/.exec(MIGRATION)?.[1] ?? '';
  const looped = [...loop.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(looped.length > 5, 'the trigger loop was not found — update this guard');
  for (const table of SHARED_EVENT_TABLES) {
    if (table === 'guests') continue;
    assert.ok(looped.includes(table), `${table} may be remembered but no trigger moves its stamp — a write to it would never be seen`);
  }
  assert.match(MIGRATION, /CREATE CONSTRAINT TRIGGER guests_event_public_rev\s+AFTER INSERT OR DELETE ON public\.guests\s+DEFERRABLE INITIALLY DEFERRED/);
  const when = /CREATE CONSTRAINT TRIGGER guests_event_public_rev_upd[\s\S]*?WHEN \(\(([\s\S]*?)\) IS DISTINCT FROM \(([\s\S]*?)\)\)/.exec(MIGRATION);
  assert.ok(when, 'the guests update trigger’s WHEN was not found — update this guard');
  const oldCols = when[1]!.split(',').map((c) => c.trim().replace(/^OLD\./, ''));
  const newCols = when[2]!.split(',').map((c) => c.trim().replace(/^NEW\./, ''));
  assert.deepEqual(oldCols, newCols, 'the WHEN compares different columns on each side');
  assert.deepEqual([...oldCols].sort(), [...GUESTS_SHARED_COLUMNS].sort(), 'the guests trigger and GUESTS_SHARED_COLUMNS disagree — a remembered read could miss a change');
});

/* ═══ 6 · ONLY THE GUEST PAGE OPENS IT, AND NEVER FOR THE CANVAS ════════ */

test('6 · every host-only word keeps the render out; a guest’s own words do not', () => {
  for (const p of HOST_ONLY_PARAMS) assert.equal(hostAsksForCanvas({ [p]: '1' }), true, `?${p}= opened the cache`);
  for (const p of ['tab', 'rsvp', 'save', 'from', 'keep', 'added', 'invite_error', 'utm_source', 'src']) {
    assert.equal(hostAsksForCanvas({ [p]: '1' }), false, `?${p}= — a guest's own word — closed the cache`);
  }
  assert.equal(hostAsksForCanvas({}), false);
  assert.equal(hostAsksForCanvas(undefined), false);
});

test('6b · `openSharedEventReads` is called by the guest page alone, each time behind `hostAsksForCanvas`', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$|guest-page-reads\.harness\.ts$/.test(name)) {
        const src = stripComments(readFileSync(p, 'utf8'));
        for (const m of src.matchAll(/^.*openSharedEventReads\(.*$/gm)) {
          if (/export function openSharedEventReads/.test(m[0]) || /import /.test(m[0])) continue;
          hits.push(`${relative(WEB, p)}: ${m[0].trim()}`);
        }
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.equal(hits.length, 2, `expected the page and its metadata, found:\n${hits.join('\n')}`);
  for (const hit of hits) {
    assert.ok(hit.startsWith('app/[slug]/page.tsx: '), `opened outside the guest page: ${hit}`);
    assert.match(hit, /if \(!hostAsksForCanvas\(search\)\) openSharedEventReads\(event\.event_id\);/, `opened without the canvas check: ${hit}`);
  }
});
