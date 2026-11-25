/**
 * GUARD — THE SUPPLIER DASHBOARD WORKS OFFLINE AND CATCHES UP (owner 2026-11-24, DECISION_LOG "The supplier dashboard
 * works offline and catches up when back online"). One test per rule of the ruling; the database half (versions, first
 * save wins, expo holds, one code one entry, RLS) is `tests/db/the-supplier-works-offline.db.test.ts`.
 *
 *   1 · ONE ENGINE — the supplier queue is the shipped daemon's `supplier` store, sent by its `triggerSyncNow`; a shared
 *       phone never sends another account's work; an item given up on leaves an answer, never silence.
 *   2 · NO NEW SERVER ACTION — the queue goes to ONE stable, versioned route (`/api/offline/supplier-sync`), never a
 *       server action (their ids change every deploy — review #2 item 4).
 *   3 · EVERY KIND HAS A RULE — a role, and (when it names one) a real shipped door; nothing that buys or pays is a kind
 *       (R15: "Needs internet"); every write that names a row is applied only if its `updated_at` is unchanged.
 *   4 · MONEY — the live amounts are re-read through the ONE reader and compared BEFORE the shipped action runs; a moved
 *       amount is `needs_reconfirm {offline, live}`, never applied.
 *   5 · GIFTS — the live stock decides before Add a client runs; none left is `no_gifts_left`; nothing is bought.
 *   6 · A CLASH IS TYPED — `{why, by, at}`, said in the ruling's words, never read as saved.
 *   7 · EXPO HOLDS — a hold ends at its end date or by hand, never on a reconnect; only Shop, Branch and Account
 *       Managers hold; a Shop Manager or that branch's Branch Manager lets anyone's go (and stops anyone's phone).
 *       Teammates see "last seen", never a count of another phone's changes (R5, corrected).
 *   8 · SIGN-OUT WIPES — the queue, the signing keys and the answers; the server stops the phone's key rows.
 *   9 · R14 — A BOOKING MADE OFFLINE COUNTS ON THAT PHONE AT ONCE: 12 Dec 2 PM booked offline is not offered again; a
 *       full day reads full; the QR's free-time check, "To collect" and the gift balance read the same copy + queue.
 *  10 · EVERY SUPPLIER ACTION IS DECIDED — an offline kind, "needs internet" (R15), or a line on the area builders'
 *       shrink-only list (`not-yet-offline.baseline.txt`). A new supplier action can never be left undecided.
 *  14 · EACH KIND'S FIELDS ARE PINNED — a field a kind does not carry never reaches the shipped action, and a kind's
 *       fields cannot change without its schema version moving (old phones' items keep their meaning).
 *  13 · A HELD DAY IS SAID — the database refuses a booking on a teammate's held day (`date_held`); every couple door
 *       says it as the closed-day sentence (never who or why), and the supplier's yes says a teammate holds it.
 *
 * Sabotages (2026-11-24), each turns its own test red:
 *   1 · dropping `if (p.member !== activeMember)` from supplier-handler.ts;
 *   4 · moving the `moneyMoved(` check below the first replay in engine.server.ts;
 *   5 · dropping the `fitsStock(` check in clientAdd;
 *   7 · `if (left === 0)` → `if (true)` in supplier-queue.ts;
 *   8 · dropping `forgetSupplierOffline()` from the worker's OFFLINE_FORGET;
 *   9 · dropping the queue's seats from `localSlot` (`copy.taken + q.seats` → `copy.taken`);
 *  10 · deleting one line from not-yet-offline.baseline.txt (an undecided action);
 *  13 · (2026-11-25) each couple door's mapping undone in turn, and the yes's `date_held` flag removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { STAY_DOORS } from '@/lib/stay-doors';
import { SERVICE_CODES } from '@/lib/offline/types';
import { isOfflineItemExpired } from '@/lib/offline/sync-daemon';
import { readdirSync, statSync } from 'node:fs';
import {
  BOOKED_NOT_CONFIRMED,
  KIND_COVERS,
  KIND_SCHEMA,
  NEEDS_INTERNET_ACTIONS,
  SUPPLIER_OFFLINE_KINDS,
  giftsLeftWithQueue,
  isFinalOutcome,
  lastSeenLine,
  localSlot,
  moneyMoved,
  offerableTimes,
  outcomeFromSqlAnswer,
  outcomeLine,
  parseQueuedItem,
  parseSyncReply,
  rowUnchanged,
  toCollectWithQueue,
  waitingToSendLine,
  type LocalDayCopy,
  type SupplierOfflineKind,
  type SupplierQueuedItem,
} from './kinds';

const root = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => stripComments(readFileSync(path.join(root, p), 'utf8'));

const SHOP = '11111111-2222-4333-8444-555555555555';
const ANA = '0b6f1c2e-7a43-4d3e-9b1f-2c5d8e9a0f11';

const item = (over: Record<string, unknown> = {}) => ({
  v: 1,
  itemId: '9e8d7c6b-5a49-4382-a716-151413121110',
  shop: SHOP,
  member: ANA,
  phoneTime: '2026-11-24T06:14:00.000Z',
  madeOffline: true,
  kind: 'schedule.client',
  fields: { start_date: '2026-12-12', client_name: 'Liza' },
  ...over,
});

test('1 · one engine: the supplier queue is the shipped daemon, sent only by its own account, never lost silently', async () => {
  assert.ok(SERVICE_CODES.includes('supplier'), 'supplier is not one of the daemon’s queues');
  const queue = read('lib/offline/supplier-queue.ts');
  assert.match(queue, /enqueueOfflineItem\('supplier'/, 'a supplier action is no longer written to the daemon’s supplier store');
  assert.match(queue, /triggerSyncNow\(\)/, 'queued supplier actions are no longer sent by the daemon');
  assert.doesNotMatch(queue, /indexedDB\.open|new IDBFactory|idb-keyval/, 'supplier-queue.ts opened a database of its own — a second engine');
  const daemon = read('lib/offline/sync-daemon.ts');
  assert.match(daemon, /supplier:\s*syncOneSupplier/, 'the daemon has no handler for the supplier queue');
  assert.match(daemon, /supplier:\s*supplierGaveUp/, 'an evicted supplier action would vanish without an answer');
  // The daemon rides in every page's shared bundle: the supplier handler (and the engine's words) load on use only.
  assert.doesNotMatch(daemon, /^import[^;]*supplier-handler/m, 'the supplier handler is in every page’s first load');
  assert.match(daemon, /\(await import\('\.\/service-handlers\/supplier-handler'\)\)\.syncOne\(item\)/);
  const handler = read('lib/offline/service-handlers/supplier-handler.ts');
  assert.doesNotMatch(handler, /^import (?!type)[^;]*supplier-offline\//m, 'the supplier handler loads the engine’s modules up front');

  const h = await import('@/lib/offline/service-handlers/supplier-handler');
  const rows = new Map<string, { id: string } & Record<string, unknown>>();
  h.useOutcomeStoreForTest({
    all: async () => [...rows.values()],
    put: async (r) => void rows.set(r.id, r),
    remove: async (id) => void rows.delete(id),
  });
  try {
    const queued = { item_id: 'i1', event_id: SHOP, queued_at: '2026-11-24T06:14:00.000Z', retry_count: 0, payload: item() };
    h.setSupplierMember('someone-else');
    assert.deepEqual(await h.syncOne(queued), { ok: false, error: 'Waiting for the account that made it.', waiting: true }, 'another account’s phone sent Ana’s work (or the wait counted as a try)');
    h.setSupplierMember(null);
    assert.equal((await h.syncOne(queued)).ok, false, 'work was sent with nobody signed in');
    h.noteGaveUp(queued);
    await new Promise((r) => setTimeout(r, 0));
    const notes = await h.readSupplierOutcomes(ANA, SHOP);
    assert.equal(notes.length, 1, 'a given-up action left no answer');
    assert.equal(notes[0]!.reply.status, 'refused');
    assert.deepEqual(await h.readSupplierOutcomes('someone-else', SHOP), [], 'another account reads Ana’s answers');
    await h.dismissSupplierOutcome(ANA, notes[0]!.item.itemId);
    assert.deepEqual(await h.readSupplierOutcomes(ANA, SHOP), []);
  } finally {
    h.useOutcomeStoreForTest(null);
  }
  const handlerSrc = read('lib/offline/service-handlers/supplier-handler.ts');
  assert.doesNotMatch(handlerSrc, /localStorage/, 'answers are kept in localStorage — they belong in IndexedDB, wiped together (review #2 item 18)');
});

test('2 · no new server action: the queue goes to ONE stable, versioned route — never a server action', () => {
  for (const f of ['lib/supplier-offline/engine.server.ts', 'lib/supplier-offline/claim.server.ts', 'lib/supplier-offline/kinds.ts', 'lib/supplier-offline/qr.ts', 'app/api/offline/supplier-sync/route.ts']) {
    assert.doesNotMatch(readFileSync(path.join(root, f), 'utf8'), /^\s*['"]use server['"]/m, `${f} is a server action file — its id changes with every deploy`);
  }
  const route = read('app/api/offline/supplier-sync/route.ts');
  assert.match(route, /if \(body\.v !== SUPPLIER_OFFLINE_WIRE\) return NextResponse\.json\(\{ v: SUPPLIER_OFFLINE_WIRE, update: true \}, \{ status: 409 \}\)/, 'another payload version is guessed at');
  assert.match(route, /enforceRateLimit\(/, 'the route is not rate-limited');
  assert.match(route, /await supplierOffline\(fd\)/);
  const wire = read('lib/offline/supplier-wire.ts');
  assert.match(wire, /fetch\(SUPPLIER_OFFLINE_ROUTE,/, 'the phone does not send to the route');
  for (const f of ['lib/offline/service-handlers/supplier-handler.ts', 'lib/offline/supplier-queue.ts']) {
    assert.doesNotMatch(read(f), /save-in-place|saveInPlace/, `${f} sends through a server action`);
  }
  assert.ok(!(STAY_DOORS as readonly string[]).some((d) => d.startsWith('supOffline.')), 'a stay door for the offline engine came back');
});

test('3 · every kind has a rule and a role; a named door is real; nothing that buys is a kind; a named row must be unchanged', () => {
  const kinds = Object.keys(SUPPLIER_OFFLINE_KINDS) as SupplierOfflineKind[];
  // The ruling's list: schedule, client and lead, note, message draft, booking, payment record, gift.
  for (const want of ['schedule.client', 'schedule.edit', 'schedule.remove', 'qr.booking', 'client.add', 'lead.outcome', 'note.add', 'message.send', 'booking.accept', 'payment.confirm', 'payment.ask', 'deposit.ack']) {
    assert.ok(kinds.includes(want as SupplierOfflineKind), `${want} cannot be done offline`);
  }
  for (const k of kinds) {
    const r = SUPPLIER_OFFLINE_KINDS[k] as { rule: string; capability: string; door?: string };
    if (r.door) assert.ok((STAY_DOORS as readonly string[]).includes(r.door), `${k} replays through ${r.door}, which is not a shipped door`);
    assert.notEqual(r.capability, 'plan', `${k} buys something — R15: buying needs internet`);
    assert.doesNotMatch(k, /purchase|buy|pay_online|checkout/, `${k} reads like a purchase — R15: nothing is bought offline`);
  }
  assert.equal(parseQueuedItem(item({ kind: 'purchase' })), null, 'a purchase was accepted into the queue');
  assert.equal(parseQueuedItem(item({ kind: 'buy_anything' })), null, 'an unknown action was accepted into the queue');
  assert.equal(parseQueuedItem(item({ madeOffline: false })), null, 'an action without the made-offline mark was accepted');
  assert.equal(parseQueuedItem(item({ rowVersion: { table: 'users', id: 'x', updatedAt: '2026-11-24T00:00:00Z' } })), null, 'a queued item named a table it may not');
  assert.ok(parseQueuedItem(item({ rowVersion: { table: 'event_vendors', id: 'ev1', updatedAt: '2026-11-24T00:00:00Z' } })));
  assert.equal(rowUnchanged({ table: 'event_vendors', id: 'ev1', updatedAt: '2026-11-24T00:00:00Z' }, '2026-11-24T00:00:00+00:00'), true, 'the same instant spelled differently read as a change');
  assert.equal(rowUnchanged({ table: 'event_vendors', id: 'ev1', updatedAt: '2026-11-24T00:00:00Z' }, '2026-11-24T00:00:01Z'), false, 'a changed row read as unchanged');
  assert.equal(rowUnchanged({ table: 'event_vendors', id: 'ev1', updatedAt: '2026-11-24T00:00:00Z' }, null), false);
  const engine = read('lib/supplier-offline/engine.server.ts');
  const sync = engine.slice(engine.indexOf('async function syncOne'), engine.indexOf('/* ── the phone'));
  const stale = sync.indexOf('await rowStillAsSeen(ctx, item)');
  const money = sync.indexOf('moneyAction(ctx, item)');
  const door = sync.indexOf('replayDoor(door, item)');
  assert.ok(stale > -1 && money > stale && door > stale, 'a write that names a row runs before the row is compared');
  assert.ok(parseQueuedItem(item()));
});

test('4 · money: the live amount is re-read through the one reader and compared BEFORE the shipped action runs', () => {
  const seen = { totalPhp: 50000, depositPhp: 10000 };
  assert.equal(moneyMoved('payment.ask', seen, { totalPhp: 50000, depositPhp: 10000 }), false);
  assert.equal(moneyMoved('payment.ask', seen, { totalPhp: 55000, depositPhp: 10000 }), true, 'a changed total was applied');
  assert.equal(moneyMoved('booking.accept', seen, { totalPhp: 50000, depositPhp: 15000 }), true, 'a changed reservation fee was applied');
  assert.equal(moneyMoved('payment.confirm', { totalPhp: null, depositPhp: null, paymentPhp: 5000 }, { totalPhp: null, depositPhp: null, paymentPhp: 4500 }), true);
  assert.equal(moneyMoved('booking.accept', null, { totalPhp: 1, depositPhp: 0 }), true, 'an action that never said what it showed was applied');

  const engine = read('lib/supplier-offline/engine.server.ts');
  const body = engine.slice(engine.indexOf('async function moneyAction'), engine.indexOf('/* ── gifts'));
  const check = body.indexOf('moneyMoved(item.kind, item.seen, live)');
  const firstRun = Math.min(...['replayDoor(', 'runFor('].map((t) => body.indexOf(t)).filter((i) => i > -1));
  assert.ok(check > -1 && check < firstRun, 'the shipped money action runs before the live amount is compared');
  assert.match(body, /return \{ status: 'needs_reconfirm', offline: item\.seen \?\? null, live \}/, 'a moved amount does not come back with both numbers');
  const live = engine.slice(engine.indexOf('async function liveMoney'), engine.indexOf('async function moneyAction'));
  assert.match(live, /readOneBookingMoney\(/, 'a booking amount is read past the one reader (event_vendor_money_read)');
  assert.doesNotMatch(live, /from\('event_vendors'\)/, 'booking amounts are read off the row directly');
  assert.match(live, /return 'unread'/, 'an unread amount is decided on instead of asked again');

  const line = outcomeLine({ status: 'needs_reconfirm', offline: seen, live: { totalPhp: 55000, depositPhp: 10000 } });
  assert.match(line ?? '', /on your phone, .* now\. Confirm again\./, 'the re-confirm does not show both numbers');
});

test('5 · gifts: the live stock decides before Add a client runs; none left is no_gifts_left; nothing is bought', () => {
  const engine = read('lib/supplier-offline/engine.server.ts');
  const body = engine.slice(engine.indexOf('async function clientAdd'), engine.indexOf('async function joinTheClientsScan'));
  const fits = body.indexOf('fitsStock(needByKind(codes, packs), free)');
  const save = body.indexOf('saveOwnClient(');
  assert.ok(fits > -1 && save > -1 && fits < save, 'Add a client runs before the live gift stock is checked');
  assert.match(body, /return \{ status: 'no_gifts_left', asOf:/, 'an empty stock is not said as "no gifts left"');
  assert.match(body, /fd\.delete\('buying'\)/, 'an offline Add a client can buy gifts');
  assert.match(body, /fetchShopGiftStock\(ctx\.supabase, ctx\.shop, null\)/, 'the stock is not the live read Add a client itself makes');
  assert.equal(outcomeLine({ status: 'no_gifts_left', asOf: '2026-11-24T06:14:00Z' }), 'Gift not sent: no gifts left');
});

test('6 · a clash is typed — {why, by, at} — said in the ruling’s words, and never read as saved', () => {
  const names = new Map([[ANA, 'Ana']]);
  const booked = outcomeFromSqlAnswer({ status: 'clash', why: 'booked', by: ANA, by_kind: 'member', at: '2026-11-24T05:00:00Z', start_date: '2026-12-12' }, names);
  assert.equal(booked.status, 'clash');
  assert.ok(booked.status === 'clash' && booked.clash.by?.name === 'Ana' && booked.clash.at, 'the clash does not name who and when');
  assert.match(outcomeLine(booked) ?? '', /^Couldn’t save\. Ana booked Dec 12 while you were offline\.$/);
  const held = outcomeFromSqlAnswer({ status: 'clash', why: 'held', by: ANA, at: 'x', start_date: '2026-12-12', end_date: '2026-12-14' }, names);
  assert.match(outcomeLine(held) ?? '', /Ana is handling Dec 12–Dec 14/);
  const couple = outcomeFromSqlAnswer({ status: 'clash', why: 'booked', by: null, by_kind: 'couple', at: 'x', start_date: '2026-12-12' }, names);
  assert.match(outcomeLine(couple) ?? '', /A couple booked/);
  assert.equal(outcomeFromSqlAnswer(null, names).status, 'refused', 'no answer was read as saved');
  assert.equal(isFinalOutcome({ status: 'retry' }), false, 'a retry is dropped from the phone');
  for (const s of ['applied', 'clash', 'needs_reconfirm', 'no_gifts_left', 'refused'] as const) assert.equal(isFinalOutcome({ status: s }), true);
  assert.equal(parseSyncReply({ itemId: 'x', kind: 'schedule.client', status: 'clash', clash: { why: 'merged' } }), null, 'an unknown clash was accepted');
  assert.equal(lastSeenLine('Ana', null, { start: '2026-12-10', end: '2026-12-15' }), 'Ana · holding Dec 10–Dec 15');
  assert.doesNotMatch(lastSeenLine('Ana', '2026-11-24T06:14:00Z', null), /waiting|change/, 'a teammate’s line counts changes the server cannot see');
  assert.equal(waitingToSendLine(3), '3 changes waiting to send');
  assert.equal(waitingToSendLine(0), null);
});

test('7 · expo holds end by date or by hand; the right roles hold, release and stop; teammates see last seen', () => {
  const queue = read('lib/offline/supplier-queue.ts');
  const body = queue.slice(queue.indexOf('export async function sendQueuedSupplierActions'), queue.indexOf('export async function reconfirmMoney'));
  assert.doesNotMatch(body, /holds\.synced/, 'a reconnect ends an expo hold — a hold ends at its end date or by hand (review #2 item 14)');
  assert.match(body, /door\('device\.seen', \{ shop, device_id: key\.deviceId, queued: String\(left\) \}\)/, 'teammates are not told this phone was seen');
  assert.doesNotMatch(queue, /presence\.report|waiting: String/, 'a count of this phone’s changes is sent to the team (R5)');
  const engine = read('lib/supplier-offline/engine.server.ts');
  assert.match(read('lib/supplier-offline/kinds.ts'), /BOOKING_DUTIES: ReadonlyArray<VendorDuty> = \['shop_manager', 'branch_manager', 'account_manager'\]/, 'the roles that may book and hold dates changed');
  assert.match(engine, /HOLD_DUTIES: ReadonlyArray<VendorDuty> = BOOKING_DUTIES;/, 'holds read a second copy of the booking roles');
  assert.match(engine, /if \(rule === 'schedule' && !HOLD_DUTIES\.includes\(ctx\.duty\)\)/, 'a role that cannot book online can book offline');
  assert.match(engine, /if \(!HOLD_DUTIES\.includes\(ctx\.duty\)\) return refusal\(op,/, 'any role can hold dates');
  const may = engine.slice(engine.indexOf('async function mayStopFor'), engine.indexOf('/** "Stop QR codes from this phone"'));
  assert.match(may, /ctx\.duty === 'shop_manager'\) return true/);
  assert.match(may, /ctx\.duty !== 'branch_manager' \|\| !ctx\.branchId\) return false/, 'someone other than a Shop or Branch Manager can stop another person’s phone');
  assert.match(may, /r\.branch_id === ctx\.branchId/, 'a Branch Manager can stop a phone outside their branch');
  assert.match(engine, /may_release_any: anyone/, 'releasing anyone’s hold is not decided by the same rule');
  assert.doesNotMatch(engine, /from\('vendor_offline_presence'\)|vendor_offline_codes/, 'the retired stock or presence count is still read');
});

test('8 · sign-out wipes the queue, the codes and the answers', () => {
  const sw = readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  const fn = sw.slice(sw.indexOf('function forgetSupplierOffline'), sw.indexOf('// One event’s copies only') > -1 ? sw.indexOf('// One event’s copies only') : sw.indexOf('async function forgetOfflineEvent'));
  assert.match(fn, /indexedDB\.open\('setnayan_offline'\)/, 'the worker does not open the daemon’s database');
  assert.match(fn, /'supplier_queue', 'supplier_keys'/, 'the worker does not erase the supplier queue and signing keys');
  const at = sw.indexOf(": data.type === 'OFFLINE_FORGET'");
  const forget = sw.slice(at, sw.indexOf('withOfflineLock(async () =>', at));
  assert.doesNotMatch(forget, /forgetSupplierOffline\(\)/, 'a LOST session (no cookie) wipes the supplier’s unsent work — only a deliberate sign-out may (review #2 item 2)');
  assert.match(sw, /forget === '\*' \? forgetSupplierOffline\(\)/, 'a deliberate sign-out leaves the supplier’s work on the phone');
  assert.match(fn, /'supplier_queue', 'supplier_keys', 'supplier_outcomes'/, 'the sign-out wipe misses the answers');
  const copies = read('lib/offline-copies.ts');
  const wipeScript = copies.slice(copies.indexOf('export const OFFLINE_COPIES_WIPE_SCRIPT'), copies.indexOf(';', copies.indexOf('export const OFFLINE_COPIES_WIPE_SCRIPT')));
  assert.doesNotMatch(wipeScript, /supplier/i, 'the no-cookie wipe script touches the supplier’s work');
  const queue = read('lib/offline/supplier-queue.ts');
  assert.match(queue, /setSupplierMember\(null\);\s*await wipeSupplierOffline\(\)/, 'the in-app sign-out does not wipe everything');
  assert.match(read('lib/offline/supplier-keys.ts'), /\[storeNameForService\('supplier'\), SUPPLIER_KEYS_STORE, SUPPLIER_OUTCOMES_STORE\]/, 'the queue, keys and answers are not wiped together');
  const route = read('app/auth/sign-out/route.ts');
  assert.match(route, /stopOfflineDevicesOnSignOut\(admin, leaving\.id, request\.cookies\.get\(OFFLINE_DEVICES_COOKIE\)/, 'signing out leaves this phone’s QR key rows active');
  assert.ok(route.indexOf('stopOfflineDevicesOnSignOut(') < route.indexOf('supabase.auth.signOut()'), 'the key rows are stopped after the session that names them is gone');
  const stop = read('lib/supplier-offline/sign-out.server.ts');
  assert.match(stop, /\.eq\('member_user_id', userId\)/, 'signing out could stop another person’s phone');
  assert.match(stop, /OFFLINE_DEVICES_COOKIE = 'sn_offline_devices'/);
  assert.match(queue, /OFFLINE_DEVICES_COOKIE = 'sn_offline_devices'/, 'the phone writes a different cookie than the sign-out reads');
});

test('9 · R14 — a booking made offline counts on that phone at once', () => {
  const copy: LocalDayCopy = { poolId: 'POOL', date: '2026-12-12', capacity: 3, taken: 0, times: [], closed: false };
  const times = ['10:00', '14:00', '18:00'];
  assert.deepEqual(offerableTimes(copy, [], times), times);
  const booked12Dec2pm = item({ itemId: '9e8d7c6b-5a49-4382-a716-151413121111', kind: 'schedule.client', fields: { pool_id: 'POOL', start_date: '2026-12-12', client_time: '14:00', client_name: 'Liza' } }) as unknown as SupplierQueuedItem;
  assert.equal(localSlot(copy, [booked12Dec2pm], '14:00'), 'booked_not_confirmed', '12 Dec 2 PM booked offline is offered again on the same phone');
  assert.deepEqual(offerableTimes(copy, [booked12Dec2pm], times), ['10:00', '18:00'], 'the picker still offers a time this phone already booked');
  assert.equal(BOOKED_NOT_CONFIRMED, 'Booked · not confirmed yet');
  // an offline QR's date takes its seat too, and a day at capacity reads full
  const qr = item({ itemId: '9e8d7c6b-5a49-4382-a716-151413121112', kind: 'qr.booking', fields: { pool_id: '', start_date: '2026-12-12', client_time: '10:00', client_name: 'Mara' } }) as unknown as SupplierQueuedItem;
  const tight: LocalDayCopy = { ...copy, capacity: 2 };
  assert.equal(localSlot(tight, [booked12Dec2pm, qr], '18:00'), 'full', 'a day this phone filled still reads free');
  assert.equal(localSlot({ ...copy, taken: 2 }, [booked12Dec2pm], null), 'full', 'the copy and the queue are not added together');
  const closedDay = item({ itemId: '9e8d7c6b-5a49-4382-a716-151413121113', kind: 'schedule.block', fields: { scope: 'org', start_date: '2026-12-12', day_part: 'all_day' } }) as unknown as SupplierQueuedItem;
  assert.equal(localSlot(copy, [closedDay], '10:00'), 'closed', 'a day this phone closed still takes bookings');
  assert.equal(localSlot({ ...copy, date: '2026-12-13' }, [booked12Dec2pm], '14:00'), 'free', 'another day was taken by this booking');
  // the gift balance and "To collect" read the same copy + queue
  const gift = item({ itemId: '9e8d7c6b-5a49-4382-a716-151413121114', kind: 'client.add', fields: { client_name: 'Liza', gift: ['PAPIC_GUEST_150'] } }) as unknown as SupplierQueuedItem;
  assert.equal(giftsLeftWithQueue(8, [gift], 'PAPIC_GUEST_150'), 7, 'a gift given offline is still counted as in stock');
  assert.equal(giftsLeftWithQueue(null, [gift], 'PAPIC_GUEST_150'), null, 'an unread balance became a number');
  const paid = item({ itemId: '9e8d7c6b-5a49-4382-a716-151413121115', kind: 'payment.confirm', seen: { totalPhp: null, depositPhp: null, paymentPhp: 5000 }, fields: { vendor_id: 'EV1', payment_id: 'P1' } }) as unknown as SupplierQueuedItem;
  assert.equal(toCollectWithQueue(20000, [paid], 'EV1'), 15000, 'a payment recorded offline is still to collect');
  // the phone's QR and booking doors ask the same read before they take a time
  const queue = read('lib/offline/supplier-queue.ts');
  const qrBody = queue.slice(queue.indexOf('export async function makeOfflineQr'), queue.indexOf('export async function stopPhone'));
  assert.ok(qrBody.indexOf('localSlotNow(') > -1 && qrBody.indexOf('localSlotNow(') < qrBody.indexOf('signOfflineQr('), 'an offline QR is made into a time this phone already booked');
  assert.match(queue, /if \(slot !== 'free'\) return \{ refused: slot \};\n  return \{ queued: await queueSupplierAction/, 'an offline booking is queued into a time this phone already booked');
});

/** Every exported server action under app/vendor-dashboard/ (`<file> › <export>`). */
function supplierActions(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = path.join(d, n);
      if (statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.tsx?$/.test(n) || /\.test\.tsx?$/.test(n)) continue;
      const src = readFileSync(p, 'utf8');
      if (!/^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use server['"]/.test(src)) continue;
      for (const m of src.matchAll(/^export (?:async function|const) (\w+)/gm)) out.push(`${path.relative(root, p)} › ${m[1]}`);
    }
  };
  walk(path.join(root, 'app/vendor-dashboard'));
  return out.sort();
}

test('10 · every supplier action is decided: an offline kind, "needs internet", or on the shrink-only list', () => {
  const all = supplierActions();
  assert.ok(all.length > 150, `only ${all.length} supplier actions found — the scan is not reading the tree`);
  const covered = new Set(Object.values(KIND_COVERS).flat());
  const online = new Set(NEEDS_INTERNET_ACTIONS);
  const baseline = readFileSync(path.join(root, 'lib/supplier-offline/not-yet-offline.baseline.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const listed = new Set(baseline);
  for (const c of [...covered, ...online]) assert.ok(all.includes(c), `${c} is named but is not a supplier action any more`);
  for (const c of covered) assert.ok(!online.has(c), `${c} is both offline and "needs internet"`);
  const undecided = all.filter((a) => !covered.has(a) && !online.has(a) && !listed.has(a));
  assert.deepEqual(undecided, [], 'A supplier action is neither an offline kind, "needs internet" (R15), nor on not-yet-offline.baseline.txt — decide it.');
  const stale = baseline.filter((l) => !all.includes(l) || covered.has(l) || online.has(l));
  assert.deepEqual(stale, [], 'These lines are decided (or gone) — take them off not-yet-offline.baseline.txt (it only shrinks).');
  assert.equal(new Set(baseline).size, baseline.length, 'a line is listed twice');
});

test('11 · a phone never loses work it did not really send; dependent and newer items are never guessed at', () => {
  const old = { queued_at: '2020-01-01T00:00:00.000Z', retry_count: 0 };
  assert.equal(isOfflineItemExpired(old), true, 'the shipped TTL changed for the other queues');
  assert.equal(isOfflineItemExpired(old, Date.now(), false), false, 'a supplier item was aged out by the phone’s clock');
  assert.equal(isOfflineItemExpired({ ...old, payload: { ageByTriesOnly: true } }), false, 'the item’s own mark is not read');
  assert.equal(isOfflineItemExpired({ ...old, retry_count: 50 }, Date.now(), false), true, 'real tries no longer end an item');
  const daemon = read('lib/offline/sync-daemon.ts');
  assert.match(daemon, /retry_count: result\.waiting \? item\.retry_count : item\.retry_count \+ 1/, 'waiting burns a try');
  assert.match(read('lib/offline/supplier-queue.ts'), /payload: \{ \.\.\.item, ageByTriesOnly: true \}/, 'supplier items are aged by the clock');
  assert.match(daemon, /locks\s*\.request\('setnayan-offline-supplier', \{ ifAvailable: true \}/, 'two tabs can send the supplier queue at once');
  assert.match(read('lib/offline/db.ts'), /request\.result\.onversionchange = \(\) => request\.result\.close\(\)/, 'an old tab blocks the database upgrade');
  const engine = read('lib/supplier-offline/engine.server.ts');
  assert.match(engine, /if \(!o\) return \{ status: 'retry', why: 'waiting_parent' \}/, 'an edit of an unsent offline booking is sent first');
  assert.match(engine, /o\.status !== 'applied' \|\| !o\.block_id\) return \{ status: 'refused'/, 'an edit of an offline booking that failed is applied anyway');
  for (const k of Object.keys(SUPPLIER_OFFLINE_KINDS) as SupplierOfflineKind[]) assert.ok(KIND_SCHEMA[k] >= 1, `${k} has no payload version`);
  assert.equal(parseQueuedItem(item({ schema: KIND_SCHEMA['schedule.client'] + 1 })), null, 'a payload newer than this server knows was accepted');
  assert.ok(parseQueuedItem(item({ dependsOn: '9e8d7c6b-5a49-4382-a716-151413121199', kind: 'schedule.edit' })));
  assert.match(engine, /You’re no longer on this team, so this wasn’t saved\./, 'a removed member’s work waits forever instead of a final answer');
  assert.match(engine, /The shop is paused, so this wasn’t saved\./);
  assert.match(engine, /if \(!\(await eventHostIsTheClient\(ctx\.admin, eventId, contact\)\)\)/, 'a passed-on QR gives the gift to a stranger’s event');
});

test('12 · a change this browser would lose is never accepted; the phone says what it cannot see; offline is said', async () => {
  const { offlineHereFrom, APP_OFFLINE_OFF, PRIVATE_WINDOW_OFF, HOME_SCREEN_WARNING } = await import('@/lib/offline/supplier-here');
  const ok = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', standalone: false, hasIdb: true, hasWorker: true, quotaBytes: 2e9, writeReadsBack: true };
  assert.deepEqual(offlineHereFrom(ok), { ok: true, warning: null });
  assert.deepEqual(offlineHereFrom({ ...ok, userAgent: `${ok.userAgent} SetnayanApp SetnayanSignIn/1` }), { ok: false, why: APP_OFFLINE_OFF }, 'the App Store app accepted offline work it cannot keep');
  assert.doesNotMatch(APP_OFFLINE_OFF, /install/i, 'the words say "install the app" (they must say Add to Home Screen)');
  assert.deepEqual(offlineHereFrom({ ...ok, writeReadsBack: false }), { ok: false, why: PRIVATE_WINDOW_OFF }, 'a private window accepted work it will delete');
  assert.deepEqual(offlineHereFrom({ ...ok, quotaBytes: 10e6 }), { ok: false, why: PRIVATE_WINDOW_OFF });
  const iphone = { ...ok, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1' };
  assert.deepEqual(offlineHereFrom(iphone), { ok: true, warning: HOME_SCREEN_WARNING }, 'iPhone Safari outside Home Screen mode is not warned');
  assert.deepEqual(offlineHereFrom({ ...iphone, standalone: true }), { ok: true, warning: null });
  const queue = read('lib/offline/supplier-queue.ts');
  const q = queue.slice(queue.indexOf('export async function queueSupplierAction'), queue.indexOf('export async function queuedSupplierActions'));
  assert.ok(q.indexOf('await offlineHere()') > -1 && q.indexOf('await offlineHere()') < q.indexOf('enqueueOfflineItem('), 'work is queued before the browser is asked whether it can keep it');
  assert.match(queue, /const lost = left === 0 && sent === 0 && lastQueued > 0 \? lastQueued : 0;/, 'an erased queue is not noticed');
  const engine = read('lib/supplier-offline/engine.server.ts');
  assert.match(engine, /\$\{typed\}\\n\\n\$\{writtenOfflineLine\(item\.phoneTime\)\}/, 'a message written offline is not stamped');
  assert.match(read('app/vendor-dashboard/calendar/actions.ts'), /\/date_held\/\.test\(error\.message \?\? ''\) \? 'date_held' : 'save_failed'/, 'a teammate’s hold is said online as "try again"');
});

test('13 · a held day is said: as a closed day to the couple at every door, as a teammate’s hold at the supplier’s yes', async () => {
  const { couplesWordsForBookingRefusal, isDateHeldRefusal, CLOSED_DAY_COUPLE_MESSAGE } = await import('@/lib/closed-day');
  assert.equal(couplesWordsForBookingRefusal('date_held'), CLOSED_DAY_COUPLE_MESSAGE);
  assert.equal(couplesWordsForBookingRefusal('duplicate key'), 'duplicate key', 'another refusal was reworded');
  assert.ok(!/held|teammate|expo/i.test(CLOSED_DAY_COUPLE_MESSAGE), 'the couple is told who or why');
  assert.ok(isDateHeldRefusal('ERROR: date_held') && !isDateHeldRefusal('dated_heldx'));
  // Each couple door, at the error of the write that books (the one place `date_held` can come back):
  const doors: [string, RegExp][] = [
    ['app/dashboard/[eventId]/vendors/actions.ts', /return \{ status: 'error', message: couplesWordsForBookingRefusal\(lockErr\.message\) \};/],
    ['app/dashboard/[eventId]/vendors/actions.ts', /throw new Error\(couplesWordsForBookingRefusal\(error\.message\)\);/],
    ['app/dashboard/[eventId]/vendors/packages/actions.ts', /return \{ status: 'error', message: couplesWordsForBookingRefusal\(cascadeErr\.message\) \};/],
    ['app/dashboard/[eventId]/wizard-actions.ts', /if \(insertErr\) throw new Error\(couplesWordsForBookingRefusal\(insertErr\.message\)\);/],
    ['lib/chat-lock-booking.server.ts', /if \(isDateHeldRefusal\(error\.message\)\) return \{ status: 'date_closed' \};/],
  ];
  for (const [file, re] of doors) assert.match(read(file), re, `${file}: a held day reaches the couple as a raw code`);
  // The supplier's yes: the refusal is named, and the notice says it.
  assert.match(read('app/vendor-dashboard/clients/[eventId]/actions.ts'), /\/date_held\/\.test\(error\.message \?\? ''\) \? 'date_held'/, 'the yes says a teammate’s hold as "did not go through"');
  const { lockAgreeNotice } = await import('@/lib/lock-answer-notice');
  const n = lockAgreeNotice('date_held');
  assert.equal(n?.tone, 'refused');
  assert.match(n!.text, /teammate is holding this date/);
});

test('14 · each kind’s fields are pinned: nothing else reaches the shipped action; a change moves the schema version', async () => {
  const { KIND_FIELDS, KIND_SCHEMA, parseQueuedItem, SUPPLIER_OFFLINE_KINDS } = await import('./kinds');
  // ⚠ THE PIN. To change a kind's fields: bump its KIND_SCHEMA, add its adapter (`adaptQueuedItem`), then move BOTH lines
  // here. A field list that moves while its schema number stays is an old phone's item changing meaning in silence.
  const PIN: Record<string, { schema: number; fields: string[] }> = {
    'schedule.client': { schema: 1, fields: ['pool_id', 'start_date', 'end_date', 'client_name', 'client_contact', 'client_note', 'client_time'] },
    'schedule.block': { schema: 1, fields: ['scope', 'start_date', 'end_date', 'label', 'day_part'] },
    'schedule.edit': { schema: 1, fields: ['block_id', 'label', 'client_name', 'client_contact', 'client_note', 'start_date', 'end_date', 'client_time'] },
    'schedule.remove': { schema: 1, fields: ['block_id'] },
    'schedule.day': { schema: 1, fields: ['pool_id', 'state_date', 'day_state', 'note'] },
    'qr.booking': { schema: 1, fields: ['token', 'code_id', 'start_date', 'client_time', 'pool_id', 'client_name', 'client_contact', 'client_note'] },
    'client.add': { schema: 1, fields: ['client_name', 'client_contact', 'client_note', 'gift', 'code_id'] },
    'lead.outcome': { schema: 1, fields: ['thread_id', 'outcome', 'reason_code', 'free_text'] },
    'note.add': { schema: 1, fields: ['event_id', 'body', 'remind_at'] },
    'note.done': { schema: 1, fields: ['event_id', 'note_id', 'done'] },
    'note.delete': { schema: 1, fields: ['event_id', 'note_id'] },
    'message.send': { schema: 2, fields: ['thread_id', 'body', 'attachment_ref', 'attachment_name'] },
    'payment.ask': { schema: 1, fields: ['event_id', 'vendor_id', 'amount_php', 'due_date', 'note', 'inline'] },
    'payment.ask_withdraw': { schema: 1, fields: ['event_id', 'ask_id'] },
    'payment.confirm': { schema: 1, fields: ['payment_id', 'thread_id', 'vendor_id'] },
    'deposit.ack': { schema: 1, fields: ['event_id', 'vendor_id'] },
    'booking.accept': { schema: 1, fields: ['event_id', 'vendor_id', 'booked_quantity', 'regift', 'gift'] },
  };
  assert.deepEqual(Object.keys(PIN).sort(), Object.keys(SUPPLIER_OFFLINE_KINDS).sort(), 'a kind has no pin');
  for (const [kind, pin] of Object.entries(PIN)) {
    const k = kind as keyof typeof KIND_FIELDS;
    assert.equal(KIND_SCHEMA[k], pin.schema, `${kind}: its schema version moved without its pin`);
    assert.deepEqual([...KIND_FIELDS[k]], pin.fields, `${kind}: its fields changed — bump its KIND_SCHEMA and add the adapter first`);
  }
  // Every name the shipped action reads is pinned (a pin that drops a real field would break the replay in silence).
  const reads: [string, string, string[]][] = [
    ['lead.outcome', 'app/vendor-dashboard/messages/[threadId]/outcome-actions.ts', ['thread_id', 'outcome', 'reason_code', 'free_text']],
    ['note.add', 'app/vendor-dashboard/clients/[eventId]/actions.ts', ['event_id', 'body', 'remind_at']],
    ['payment.ask', 'app/vendor-dashboard/clients/[eventId]/actions.ts', ['amount_php', 'due_date', 'note']],
    ['booking.accept', 'app/vendor-dashboard/clients/[eventId]/actions.ts', ['booked_quantity', 'regift']],
    ['client.add', 'app/vendor-dashboard/invite/own-client-actions.ts', ['client_name', 'client_contact', 'client_note']],
  ];
  for (const [kind, file, names] of reads) {
    const src = read(file);
    for (const n of names) {
      assert.match(src, new RegExp(`\\.get\\('${n}'\\)|getAll\\('${n}'\\)`), `${file} no longer reads ${n} — re-derive ${kind}'s pin`);
      assert.ok(KIND_FIELDS[kind as keyof typeof KIND_FIELDS].includes(n), `${kind} drops ${n}, which its action reads`);
    }
  }
  // Nothing else reaches the action: an extra field on a queued item is dropped where it is first read.
  const parsed = parseQueuedItem({ ...item({ kind: 'booking.accept', fields: { vendor_id: 'EV1', return_to: 'https://evil.example', buying: '1' } }) });
  assert.ok(parsed);
  assert.deepEqual(parsed!.fields, { vendor_id: 'EV1' }, 'a field this kind does not carry reached the shipped action');
});
