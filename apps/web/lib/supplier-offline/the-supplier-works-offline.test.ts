/**
 * GUARD — THE SUPPLIER DASHBOARD WORKS OFFLINE AND CATCHES UP (owner 2026-11-24, DECISION_LOG "The supplier dashboard
 * works offline and catches up when back online"). One test per rule of the ruling; the database half (versions, first
 * save wins, expo holds, one code one entry, RLS) is `tests/db/the-supplier-works-offline.db.test.ts`.
 *
 *   1 · ONE ENGINE — the supplier queue is the shipped daemon's `supplier` store, sent by its `triggerSyncNow`; a shared
 *       phone never sends another account's work; an item given up on leaves an answer, never silence.
 *   2 · NO NEW SERVER ACTION — the engine rides the ONE dispatcher (`saveInPlace`, a stay door), and only a door's
 *       `{ stayReply }` is handed back through it.
 *   3 · EVERY KIND HAS A RULE — a role, and (when it names one) a real shipped door; a purchase is answered "Pay when
 *       online" before anything else runs, and never reaches a writer.
 *   4 · MONEY — the live amounts are re-read through the ONE reader and compared BEFORE the shipped action runs; a moved
 *       amount is `needs_reconfirm {offline, live}`, never applied.
 *   5 · GIFTS — the live stock decides before Add a client runs; none left is `no_gifts_left`; nothing is bought.
 *   6 · A CLASH IS TYPED — `{why, by, at}`, said in the ruling's words, never read as saved.
 *   7 · EXPO HOLDS END ON SYNC — only once nothing is left on the phone.
 *   8 · SIGN-OUT WIPES — the queue, the codes and the answers.
 *
 * Sabotages (2026-11-24), each turns its own test red:
 *   1 · dropping `if (p.member !== activeMember)` from supplier-handler.ts;
 *   4 · moving the `moneyMoved(` check below the first replay in engine.server.ts;
 *   5 · dropping the `fitsStock(` check in clientAdd;
 *   7 · `if (left === 0)` → `if (true)` in supplier-queue.ts;
 *   8 · dropping `forgetSupplierOffline()` from the worker's OFFLINE_FORGET.
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
  SUPPLIER_OFFLINE_KINDS,
  isFinalOutcome,
  moneyMoved,
  outcomeFromSqlAnswer,
  outcomeLine,
  parseQueuedItem,
  parseSyncReply,
  pendingLine,
  type SupplierOfflineKind,
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

test('3 · every kind has a rule and a role; a named door is real; a purchase is "Pay when online" before anything runs', () => {
  const kinds = Object.keys(SUPPLIER_OFFLINE_KINDS) as SupplierOfflineKind[];
  // The ruling's list: schedule, client and lead, note, message draft, booking, payment record, gift.
  for (const want of ['schedule.client', 'schedule.edit', 'schedule.remove', 'qr.booking', 'client.add', 'lead.outcome', 'note.add', 'message.send', 'booking.accept', 'payment.confirm', 'payment.ask', 'deposit.ack', 'purchase']) {
    assert.ok(kinds.includes(want as SupplierOfflineKind), `${want} cannot be done offline`);
  }
  for (const k of kinds) {
    const r = SUPPLIER_OFFLINE_KINDS[k] as { rule: string; capability: string; door?: string };
    if (r.door) assert.ok((STAY_DOORS as readonly string[]).includes(r.door), `${k} replays through ${r.door}, which is not a shipped door`);
    if (r.rule === 'purchase') assert.equal(r.door, undefined, `${k} is a purchase that names a writer`);
  }
  assert.deepEqual(kinds.filter((k) => SUPPLIER_OFFLINE_KINDS[k].rule === 'purchase'), ['purchase']);
  const engine = read('lib/supplier-offline/engine.server.ts');
  const pay = engine.indexOf("done({ status: 'pay_when_online' })");
  assert.ok(pay > -1 && pay < engine.indexOf('await contextFor(item.shop'), 'a purchase reaches a check (or a writer) before it is answered "Pay when online"');
  assert.equal(parseQueuedItem(item({ kind: 'buy_anything' })), null, 'an unknown action was accepted into the queue');
  assert.equal(parseQueuedItem(item({ madeOffline: false })), null, 'an action without the made-offline mark was accepted');
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
  for (const s of ['applied', 'clash', 'needs_reconfirm', 'no_gifts_left', 'pay_when_online', 'refused'] as const) assert.equal(isFinalOutcome({ status: s }), true);
  assert.equal(parseSyncReply({ itemId: 'x', kind: 'schedule.client', status: 'clash', clash: { why: 'merged' } }), null, 'an unknown clash was accepted');
  assert.equal(pendingLine('Ben', 3, null), 'Ben: 3 changes waiting');
  assert.equal(pendingLine('Ben', 0, null), null);
});

test('7 · expo holds end on sync — only once nothing is left on the phone', () => {
  const queue = read('lib/offline/supplier-queue.ts');
  const body = queue.slice(queue.indexOf('export async function sendQueuedSupplierActions'), queue.indexOf('export async function reconfirmMoney'));
  assert.match(body, /if \(left === 0\) await door\('holds\.synced'/, 'holds end while changes are still waiting (or never end)');
  assert.match(body, /door\('presence\.report'/, 'teammates are not told how many changes are waiting');
  const engine = read('lib/supplier-offline/engine.server.ts');
  assert.match(engine, /may_release_any: dutyMay\(ctx\.duty, 'team'\)/, 'anyone can let another member’s hold go');
  assert.match(engine, /contextFor\(str\(fd, 'shop'\), 'schedule'\);\n\s*if \('why' in ctx\) return refusal\('codes\.cancel'/, 'cancelling a lost phone’s codes is not open to every teammate');
});

test('8 · sign-out wipes the queue, the codes and the answers', () => {
  const sw = readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  const fn = sw.slice(sw.indexOf('function forgetSupplierOffline'), sw.indexOf('// One event’s copies only') > -1 ? sw.indexOf('// One event’s copies only') : sw.indexOf('async function forgetOfflineEvent'));
  assert.match(fn, /indexedDB\.open\('setnayan_offline'\)/, 'the worker does not open the daemon’s database');
  assert.match(fn, /'supplier_queue', 'supplier_codes'/, 'the worker does not erase the supplier queue and codes');
  const at = sw.indexOf(": data.type === 'OFFLINE_FORGET'");
  const forget = sw.slice(at, sw.indexOf('withOfflineLock(async () =>', at));
  assert.match(forget, /forgetSupplierOffline\(\)/, 'a signed-out page’s wipe leaves the supplier’s work on the phone');
  assert.match(sw, /forget === '\*' \? forgetSupplierOffline\(\)/, 'an account’s sign-out leaves the supplier’s work on the phone');
  const wipe = read('lib/offline-copies.ts');
  assert.match(wipe, /localStorage\.removeItem\(\$\{JSON\.stringify\(SUPPLIER_OFFLINE_OUTCOMES_KEY\)\}\)/, 'the signed-out wipe keeps the supplier’s answers');
  const queue = read('lib/offline/supplier-queue.ts');
  assert.match(queue, /forgetSupplierOutcomes\(\);\s*await wipeSupplierOffline\(\)/, 'the in-app sign-out does not wipe everything');
});
