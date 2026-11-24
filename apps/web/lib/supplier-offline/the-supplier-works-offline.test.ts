/**
 * GUARD — THE SUPPLIER DASHBOARD WORKS OFFLINE AND CATCHES UP (owner 2026-11-24, DECISION_LOG "The supplier dashboard
 * works offline and catches up when back online"). One test per rule of the ruling; the database half (versions, first
 * save wins, expo holds, one code one entry, RLS) is `tests/db/the-supplier-works-offline.db.test.ts`.
 *
 *   1 · ONE ENGINE — the supplier queue is the shipped daemon's `supplier` store, sent by its `triggerSyncNow`; a shared
 *       phone never sends another account's work; an item given up on leaves an answer, never silence.
 *   2 · NO NEW SERVER ACTION — the engine rides the ONE dispatcher (`saveInPlace`, a stay door), and only a door's
 *       `{ stayReply }` is handed back through it.
 *   3 · EVERY KIND HAS A RULE — a role, and (when it names one) a real shipped door; nothing that buys or pays is a kind
 *       (R15: "Needs internet"); every write that names a row is applied only if its `updated_at` is unchanged.
 *   4 · MONEY — the live amounts are re-read through the ONE reader and compared BEFORE the shipped action runs; a moved
 *       amount is `needs_reconfirm {offline, live}`, never applied.
 *   5 · GIFTS — the live stock decides before Add a client runs; none left is `no_gifts_left`; nothing is bought.
 *   6 · A CLASH IS TYPED — `{why, by, at}`, said in the ruling's words, never read as saved.
 *   7 · EXPO HOLDS END ON SYNC — only once nothing is left on the phone; only Shop, Branch and Account Managers hold;
 *       a Shop Manager or that branch's Branch Manager lets anyone's go (and stops anyone's phone). Teammates see "last
 *       seen", never a count of another phone's changes (R5, corrected).
 *   8 · SIGN-OUT WIPES — the queue, the signing keys and the answers; the server stops the phone's key rows.
 *   9 · R14 — A BOOKING MADE OFFLINE COUNTS ON THAT PHONE AT ONCE: 12 Dec 2 PM booked offline is not offered again; a
 *       full day reads full; the QR's free-time check, "To collect" and the gift balance read the same copy + queue.
 *
 * Sabotages (2026-11-24), each turns its own test red:
 *   1 · dropping `if (p.member !== activeMember)` from supplier-handler.ts;
 *   4 · moving the `moneyMoved(` check below the first replay in engine.server.ts;
 *   5 · dropping the `fitsStock(` check in clientAdd;
 *   7 · `if (left === 0)` → `if (true)` in supplier-queue.ts;
 *   8 · dropping `forgetSupplierOffline()` from the worker's OFFLINE_FORGET;
 *   9 · dropping the queue's seats from `localSlot` (`copy.taken + q.seats` → `copy.taken`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { STAY_DOORS } from '@/lib/stay-doors';
import { stayReplyOf } from '@/lib/save-in-place';
import { SERVICE_CODES } from '@/lib/offline/types';
import { SUPPLIER_OFFLINE_OUTCOMES_KEY } from '@/lib/offline-copies';
import {
  BOOKED_NOT_CONFIRMED,
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

  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  try {
    const h = await import('@/lib/offline/service-handlers/supplier-handler');
    const queued = { item_id: 'i1', event_id: SHOP, queued_at: '2026-11-24T06:14:00.000Z', retry_count: 0, payload: item() };
    h.setSupplierMember('someone-else');
    assert.deepEqual(await h.syncOne(queued), { ok: false, error: 'Waiting for the account that made it.' }, 'another account’s phone sent Ana’s work');
    h.setSupplierMember(null);
    assert.equal((await h.syncOne(queued)).ok, false, 'work was sent with nobody signed in');
    h.noteGaveUp(queued);
    const notes = h.readSupplierOutcomes(ANA, SHOP);
    assert.equal(notes.length, 1, 'a given-up action left no answer');
    assert.equal(notes[0]!.reply.status, 'refused');
    assert.deepEqual(h.readSupplierOutcomes('someone-else', SHOP), [], 'another account reads Ana’s answers');
    assert.equal(h.SUPPLIER_OUTCOMES_KEY, SUPPLIER_OFFLINE_OUTCOMES_KEY, 'the sign-out wipe forgets a different key than the answers are kept under');
    h.dismissSupplierOutcome(ANA, notes[0]!.item.itemId);
    assert.deepEqual(h.readSupplierOutcomes(ANA, SHOP), []);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test('2 · no new server action: the engine is a stay door on the ONE dispatcher, and only a door’s reply comes back', () => {
  assert.ok((STAY_DOORS as readonly string[]).includes('supOffline.supplierOffline'), 'the supplier offline door is not a stay door');
  for (const f of ['lib/supplier-offline/engine.server.ts', 'lib/supplier-offline/claim.server.ts', 'lib/supplier-offline/kinds.ts', 'lib/supplier-offline/qr.ts']) {
    assert.doesNotMatch(readFileSync(path.join(root, f), 'utf8'), /^\s*['"]use server['"]/m, `${f} is a server action file — one more Vercel route`);
  }
  const registry = read('app/_actions/stay-registry/supOffline.ts');
  assert.match(registry, /'supOffline\.supplierOffline':\s*supOffline\(supplierOffline\)/);
  assert.deepEqual(stayReplyOf({ stayReply: { op: 'sync' } }), { op: 'sync' });
  assert.equal(stayReplyOf({ status: 'added', url: 'x' }), undefined, 'an action’s own returned state leaked through the door');
  assert.equal(stayReplyOf(undefined), undefined);
  assert.equal(stayReplyOf(null), undefined);
  const door = read('app/_actions/save-in-place.ts');
  assert.match(door, /const reply = stayReplyOf\(value\);/, 'the dispatcher no longer hands a door’s reply back');
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
  assert.ok(stale > -1 && stale < sync.indexOf('await moneyAction(') && stale < sync.indexOf('await replayDoor('), 'a write that names a row runs before the row is compared');
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

test('7 · expo holds end on sync; the right roles hold, release and stop; teammates see last seen, never a count', () => {
  const queue = read('lib/offline/supplier-queue.ts');
  const body = queue.slice(queue.indexOf('export async function sendQueuedSupplierActions'), queue.indexOf('export async function reconfirmMoney'));
  assert.match(body, /if \(left === 0\) await door\('holds\.synced'/, 'holds end while changes are still waiting (or never end)');
  assert.match(body, /door\('device\.seen'/, 'teammates are not told this phone was seen');
  assert.doesNotMatch(queue, /presence\.report|waiting: String/, 'a count of this phone’s changes is sent to the team (R5)');
  const engine = read('lib/supplier-offline/engine.server.ts');
  assert.match(engine, /HOLD_DUTIES: ReadonlyArray<VendorDuty> = \['shop_manager', 'branch_manager', 'account_manager'\]/, 'the roles that may hold dates changed');
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
  assert.match(forget, /forgetSupplierOffline\(\)/, 'a signed-out page’s wipe leaves the supplier’s work on the phone');
  assert.match(sw, /forget === '\*' \? forgetSupplierOffline\(\)/, 'an account’s sign-out leaves the supplier’s work on the phone');
  const wipe = read('lib/offline-copies.ts');
  assert.match(wipe, /localStorage\.removeItem\(\$\{JSON\.stringify\(SUPPLIER_OFFLINE_OUTCOMES_KEY\)\}\)/, 'the signed-out wipe keeps the supplier’s answers');
  const queue = read('lib/offline/supplier-queue.ts');
  assert.match(queue, /forgetSupplierOutcomes\(\);\s*await wipeSupplierOffline\(\)/, 'the in-app sign-out does not wipe everything');
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
