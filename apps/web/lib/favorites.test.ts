/**
 * favorites.test.ts — FAVORITES COME AFTER AN EVENT (owner 2026-11-06). Executes the rules (`lib/favorites.ts`), the
 * server gate + write (`lib/favorites.server.ts`) against an in-memory database, and holds the wiring of the one
 * action (`app/_actions/favorite-actions.ts`) and the screens that draw the ♡.
 *
 * Run from apps/web: `npx tsx --test lib/favorites.test.ts`
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  collapseFavorites,
  favoriteHref,
  favoriteSourceDetail,
  favoriteSourceLine,
  guestFavoriteVerdict,
  hostFavoriteVerdict,
  moreEventsFor,
  NOT_CHECKED_IN_LINE,
} from './favorites';

/* ── `server-only` cannot load outside Next; stub it the way the other server tests do ─────────────────────────── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_favorites__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return originalResolve.call(this, request, ...rest);
  };
}
let server: typeof import('./favorites.server');
before(async () => {
  server = await import('./favorites.server');
});

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

/* ── 1 · The rules ─────────────────────────────────────────────────────────────────────────────────────────────── */

const BOOKED = [{ shopId: 'shop', serviceId: 'bar' }];

test('host: a host after the day, the service booked → ok', () => {
  assert.deepEqual(
    hostFavoriteVerdict({ isHost: true, eventDate: '2026-10-01', today: '2026-11-06', booked: BOOKED, shopId: 'shop', serviceId: 'bar' }),
    { ok: true },
  );
});

test('host: before the day, and ON the day, is refused', () => {
  for (const eventDate of ['2026-12-12', '2026-11-06', null]) {
    assert.deepEqual(
      hostFavoriteVerdict({ isHost: true, eventDate, today: '2026-11-06', booked: BOOKED, shopId: 'shop', serviceId: 'bar' }),
      { ok: false, why: 'before_day' },
    );
  }
});

test('host: not a host (a coordinator, a guest) is refused', () => {
  assert.deepEqual(
    hostFavoriteVerdict({ isHost: false, eventDate: '2026-10-01', today: '2026-11-06', booked: BOOKED, shopId: 'shop', serviceId: 'bar' }),
    { ok: false, why: 'not_host' },
  );
});

test('host: a service not booked on the event is refused; a shop-level ask needs the shop booked', () => {
  const base = { isHost: true, eventDate: '2026-10-01', today: '2026-11-06', booked: BOOKED };
  assert.deepEqual(hostFavoriteVerdict({ ...base, shopId: 'shop', serviceId: 'cake' }), { ok: false, why: 'not_booked' });
  assert.deepEqual(hostFavoriteVerdict({ ...base, shopId: 'other', serviceId: null }), { ok: false, why: 'not_booked' });
  assert.deepEqual(hostFavoriteVerdict({ ...base, shopId: 'shop', serviceId: null }), { ok: true });
});

test('guest: no check-in → refused, with the Hub’s own words', () => {
  assert.deepEqual(guestFavoriteVerdict({ checkedIn: false, booked: BOOKED, shopId: 'shop', serviceId: 'bar' }), { ok: false, why: 'not_checked_in' });
  assert.equal(NOT_CHECKED_IN_LINE, 'Favorites open for guests who checked in at the door.');
  assert.deepEqual(guestFavoriteVerdict({ checkedIn: true, booked: BOOKED, shopId: 'shop', serviceId: 'bar' }), { ok: true });
  assert.deepEqual(guestFavoriteVerdict({ checkedIn: true, booked: BOOKED, shopId: 'shop', serviceId: 'x' }), { ok: false, why: 'not_booked' });
});

/* ── 2 · Where a favorite came from — host or guest, decided at read ─────────────────────────────────────────────── */

test('the row line: host vs guest, and "and N more"', () => {
  const host = { role: 'host' as const, hostsName: 'Ana & Miguel', eventWord: 'wedding', eventDate: '2026-12-12', moreEvents: 0 };
  assert.equal(favoriteSourceLine(host), 'From your wedding · Dec 2026');
  assert.equal(favoriteSourceDetail(host), 'From your wedding · 12 Dec 2026 · you were a host');
  const guest = { role: 'guest' as const, hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-03-01', moreEvents: 0 };
  assert.equal(favoriteSourceLine(guest), 'From Maria & Jose’s wedding · you were a guest');
  assert.equal(favoriteSourceLine({ ...guest, moreEvents: 1 }), 'From Maria & Jose’s wedding · you were a guest · and 1 more event');
  assert.equal(favoriteSourceLine({ ...host, moreEvents: 2 }), 'From your wedding · Dec 2026 · and 2 more events');
  // A name that already says the word is not doubled; a guest at an unnamed event is not "your".
  assert.equal(favoriteSourceLine({ ...guest, hostsName: 'Lola’s 80th birthday', eventWord: 'birthday' }), 'From Lola’s 80th birthday · you were a guest');
  assert.equal(favoriteSourceLine({ ...guest, hostsName: null }), 'From the wedding · you were a guest');
});

test('one favorite per shop + service, the FIRST kept; duplicates fold in', () => {
  const rows = [
    { id: 3, shopId: 's', serviceId: 'bar', sourceEventId: 'B', savedAt: '2026-11-03T00:00:00Z' },
    { id: 1, shopId: 's', serviceId: 'bar', sourceEventId: 'A', savedAt: '2026-11-01T00:00:00Z' },
    { id: 2, shopId: 's', serviceId: 'cake', sourceEventId: 'A', savedAt: '2026-11-02T00:00:00Z' },
    { id: 4, shopId: 's', serviceId: null, sourceEventId: 'A', savedAt: '2026-11-04T00:00:00Z' },
    { id: 5, shopId: 's', serviceId: null, sourceEventId: 'C', savedAt: '2026-11-05T00:00:00Z' },
  ];
  const out = collapseFavorites(rows);
  assert.equal(out.length, 3, 'bar · cake · the whole shop');
  const bar = out.find((f) => f.serviceId === 'bar')!;
  assert.equal(bar.sourceEventId, 'A', 'the first event is kept');
  assert.deepEqual(bar.ids.sort(), [1, 3]);
  const shop = out.find((f) => f.serviceId === null)!;
  assert.deepEqual(shop.ids.sort(), [4, 5]);
  assert.equal(out[0]?.serviceId, null, 'newest first');
});

test('"and N more" counts OTHER events with the same service; a shop favorite counts any booking of the shop', () => {
  const experienced = [
    { eventId: 'A', shopId: 's', serviceId: 'bar' },
    { eventId: 'B', shopId: 's', serviceId: 'bar' },
    { eventId: 'B', shopId: 's', serviceId: 'cake' },
    { eventId: 'C', shopId: 's', serviceId: 'cake' },
    { eventId: 'D', shopId: 'other', serviceId: 'bar' },
  ];
  assert.equal(moreEventsFor({ shopId: 's', serviceId: 'bar', sourceEventId: 'A' }, experienced), 1);
  assert.equal(moreEventsFor({ shopId: 's', serviceId: null, sourceEventId: 'A' }, experienced), 2);
});

test('the door opens the shop at that service', () => {
  assert.equal(favoriteHref('setnaprod', 'S89S-ABC'), '/v/setnaprod?service=S89S-ABC');
  assert.equal(favoriteHref('setnaprod', null), '/v/setnaprod');
  assert.equal(favoriteHref(null, 'S89S-ABC'), null);
});

/* ── 3 · The server gate + write, on an in-memory database ──────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>, refuse: ReadonlySet<string> = new Set()) {
  const writes: { table: string; op: string; row: Row }[] = [];
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'insert' | 'upsert' | 'delete' = 'select';
    let payload: Row | null = null;
    let limit = Infinity;
    const run = () => {
      if (refuse.has(table)) return { data: null, error: { message: 'refused' } };
      const rows = (tables[table] ??= []);
      if (op === 'select') return { data: rows.filter((r) => filters.every((f) => f(r))).slice(0, limit), error: null };
      if (op === 'delete') {
        const keep = rows.filter((r) => !filters.every((f) => f(r)));
        tables[table] = keep;
        writes.push({ table, op, row: {} });
        return { data: null, error: null };
      }
      rows.push({ id: rows.length + 1, ...payload });
      writes.push({ table, op, row: payload! });
      return { data: null, error: null };
    };
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
      is: (c: string, v: null) => (filters.push((r) => (r[c] ?? null) === v), q),
      not: (c: string, _o: string, _v: null) => (filters.push((r) => r[c] != null), q),
      or: (expr: string) => {
        const parts = [...expr.matchAll(/(\w+)\.in\.\(([^)]*)\)/g)].map((m) => [m[1] ?? '', (m[2] ?? '').split(',')] as const);
        filters.push((r) => parts.some(([c, vs]) => vs.includes(String(r[c]))));
        return q;
      },
      limit: (n: number) => ((limit = n), q),
      maybeSingle: () => Promise.resolve(run()).then((r) => ({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data })),
      insert: (row: Row) => ((op = 'insert'), (payload = row), q),
      upsert: (row: Row) => ((op = 'upsert'), (payload = row), q),
      delete: () => ((op = 'delete'), q),
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    };
    return q;
  };
  return { client: { from } as never, writes, tables };
}

const NOW = Date.parse('2026-11-06T04:00:00Z');
function world(eventDate: string, extra: Partial<Record<string, Row[]>> = {}) {
  return {
    events: [{ event_id: 'ev', event_date: eventDate }],
    event_vendors: [
      { vendor_id: 'evv1', event_id: 'ev', marketplace_vendor_id: 'shop', service_id: 'bar', status: 'contracted' },
      { vendor_id: 'evv2', event_id: 'ev', marketplace_vendor_id: 'other', service_id: null, status: 'considering' },
    ],
    event_members: [
      { event_id: 'ev', user_id: 'host', member_type: 'couple', guest_id: null, hidden_at: null },
      { event_id: 'ev', user_id: 'coord', member_type: 'coordinator', guest_id: null, hidden_at: null },
      { event_id: 'ev', user_id: 'g-in', member_type: 'guest', guest_id: 'seat-in', hidden_at: null },
      { event_id: 'ev', user_id: 'g-out', member_type: 'guest', guest_id: 'seat-out', hidden_at: null },
    ],
    people: [{ person_id: 'p1', claimed_by_user_id: 'g-person' }],
    guests: [
      { guest_id: 'seat-in', event_id: 'ev', person_id: null, deleted_at: null },
      { guest_id: 'seat-out', event_id: 'ev', person_id: null, deleted_at: null },
      { guest_id: 'seat-p', event_id: 'ev', person_id: 'p1', deleted_at: null },
    ],
    guest_checkins: [
      { event_id: 'ev', guest_id: 'seat-in' },
      { event_id: 'ev', guest_id: 'seat-p' },
    ],
    guest_saved_vendors: [],
    ...extra,
  } as Record<string, Row[]>;
}

const gate = (db: ReturnType<typeof fakeDb>, userId: string, as: 'host' | 'guest', serviceId: string | null = 'bar', shopId = 'shop') =>
  server.favoriteGate(db.client, { userId, eventId: 'ev', shopId, serviceId, as, now: NOW });

test('server gate: a guest with no check-in is refused', async () => {
  const db = fakeDb(world('2026-10-01'));
  assert.deepEqual(await gate(db, 'g-out', 'guest'), { ok: false, why: 'not_checked_in' });
  assert.deepEqual(await gate(db, 'stranger', 'guest'), { ok: false, why: 'not_checked_in' });
});

test('server gate: a checked-in guest — bound by membership OR by the claimed person — may', async () => {
  const db = fakeDb(world('2026-10-01'));
  assert.deepEqual(await gate(db, 'g-in', 'guest'), { ok: true });
  assert.deepEqual(await gate(db, 'g-person', 'guest'), { ok: true });
  assert.deepEqual(await gate(db, 'g-in', 'guest', null, 'other'), { ok: false, why: 'not_booked' }, 'only BOOKED suppliers');
});

test('server gate: a coordinator is refused as a host', async () => {
  const db = fakeDb(world('2026-10-01'));
  assert.deepEqual(await gate(db, 'coord', 'host'), { ok: false, why: 'not_host' });
});

test('server gate: before the day, and a supplier not booked, are refused for a host', async () => {
  assert.deepEqual(await gate(fakeDb(world('2026-12-12')), 'host', 'host'), { ok: false, why: 'before_day' });
  assert.deepEqual(await gate(fakeDb(world('2026-10-01')), 'host', 'host', null, 'other'), { ok: false, why: 'not_booked' });
});

test('server gate: a refused read is "unread", never a no', async () => {
  const db = fakeDb(world('2026-10-01'), new Set(['guest_checkins']));
  assert.deepEqual(await gate(db, 'g-in', 'guest'), { ok: false, why: 'unread' });
});

test('host after the day → saved with the event id and the service; a second press changes nothing', async () => {
  const db = fakeDb(world('2026-10-01'));
  assert.deepEqual(await gate(db, 'host', 'host'), { ok: true });
  assert.deepEqual(await server.writeFavorite(db.client, { userId: 'host', eventId: 'ev', shopId: 'shop', serviceId: 'bar' }), { ok: true });
  const w = db.writes.find((x) => x.table === 'guest_saved_vendors')!;
  assert.deepEqual(w.row, { user_id: 'host', vendor_profile_id: 'shop', vendor_service_id: 'bar', source_event_id: 'ev' });
  // shop-level: checked before inserting (the unique key does not fold NULLs)
  await server.writeFavorite(db.client, { userId: 'host', eventId: 'ev', shopId: 'shop', serviceId: null });
  await server.writeFavorite(db.client, { userId: 'host', eventId: 'ev2', shopId: 'shop', serviceId: null });
  assert.equal((db.tables.guest_saved_vendors ?? []).filter((r) => r.vendor_service_id == null).length, 1);
});

test('the host’s ♡ is offered only after the day, only to a host, per booked row', async () => {
  assert.equal(await server.offerHostFavorites(fakeDb(world('2026-12-12')).client, 'host', 'ev', NOW), null);
  assert.equal(await server.offerHostFavorites(fakeDb(world('2026-10-01')).client, 'coord', 'ev', NOW), null);
  const offers = await server.offerHostFavorites(
    fakeDb(world('2026-10-01', { guest_saved_vendors: [{ id: 1, user_id: 'host', vendor_profile_id: 'shop', vendor_service_id: null }] })).client,
    'host',
    'ev',
    NOW,
  );
  assert.deepEqual([...offers!.entries()], [['evv1', { shopId: 'shop', serviceId: 'bar', on: true }]], 'a shop-level favorite keeps its services; a shortlisted row has no heart');
});

/* ── 4 · The wiring ─────────────────────────────────────────────────────────────────────────────────────────────── */

test('the one action re-checks before every write, and the old guest action is gone', () => {
  const src = read('app/_actions/favorite-actions.ts');
  for (const op of ["op === 'guest'", "op === 'host'"]) {
    const at = src.indexOf(op);
    assert.ok(at > -1, op);
    const body = src.slice(at, src.indexOf('writeFavorite(', at));
    assert.match(body, /favoriteGate\(/, `${op} writes without the gate`);
    assert.match(body, /if \(!verdict\.ok\)/, `${op} ignores the verdict`);
  }
  assert.doesNotMatch(read('app/[slug]/actions.ts'), /export async function saveAttendedVendorAction/);
});

test('the Hub draws ♡ only for an open door, else names + the line', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /eventIsBehind &&\s*eventVendorCredits\.length > 0 \? \(\s*<HubSuppliersMadeThisDay/);
  assert.match(body, /favorites=\{hubFavorites\}/);
  const block = read('app/[slug]/_components/hub-suppliers-made-this-day.tsx');
  assert.match(block, /favorites\?\.door === 'open' \? \(/);
  assert.match(block, /\{NOT_CHECKED_IN_LINE\}/);
  assert.match(block, /op: 'guest'/);
});

test('Library › Suppliers: Shortlisted + Favorites, rows by swipe with Undo, the empty sentence', () => {
  const tab = read('app/dashboard/(account)/library/_components/vendors-tab.tsx');
  assert.match(tab, /\{SHORTLIST_GROUP\}/);
  assert.match(tab, /\{FAVORITES_GROUP\}/);
  assert.match(tab, /\{FAVORITES_EMPTY\}/);
  const rows = read('app/dashboard/(account)/library/_components/favorite-rows.tsx');
  assert.match(rows, /<SwipeToDelete/);
  assert.match(rows, /deleteWithUndo\(/);
  assert.match(rows, /op: 'remove'/);
});
