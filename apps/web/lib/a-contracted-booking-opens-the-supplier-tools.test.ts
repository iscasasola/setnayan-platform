/**
 * CHAT-05 (W1 walk 16 Nov 2026): A CONTRACTED BOOKING IS BOOKED IN THE SUPPLIER'S CHAT TOO.
 *
 * Measured on prod: thread S89H-HHGNVVQP0H — `event_vendors.status = 'contracted'`, "Booked ✓" in the thread, ZERO
 * schedule-pool holds — and the supplier's ＋ menu greyed Payment · Form · Ask for access with "Opens once they book
 * you". `deriveThreadStage` read "booked" only from a live pool hold. The couple's list had already been fixed for the
 * same fact inline (F-W1-70, 13 Nov); this holds ONE predicate, `rowReadsBooked`, at all three readers.
 *
 * MUTATIONS (each turns this red): drop the `rowReadsBooked` check from `deriveThreadStage`; drop it from the
 * supplier's list; drop 'contracted' from `rowReadsBooked`; type the status compare inline again in conversation-list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { THREAD_STAGE_HAS_AGREEMENT } from './vendor-thread-tools';
import { resolveThreadStage, rowReadsBooked } from './vendor-thread-stage';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, rel), 'utf8'));

test('a contracted or deposit-paid booking row reads booked, and booked opens the ＋ tools', () => {
  assert.equal(rowReadsBooked({ status: 'contracted' }), true, 'the W1 booking: contracted, no pool hold');
  assert.equal(rowReadsBooked({ status: 'deposit_paid' }), true);
  for (const s of ['considering', 'shortlisted', null, undefined]) assert.equal(rowReadsBooked({ status: s }), false, String(s));
  assert.equal(rowReadsBooked(null), false);
  const stage = resolveThreadStage({ completed: false, booked: rowReadsBooked({ status: 'contracted' }), quoted: true, cancelled: false });
  assert.equal(stage, 'booked');
  assert.equal(THREAD_STAGE_HAS_AGREEMENT[stage], true, 'Payment / Form / Ask for access stay shut on a booked thread');
});

test('the thread page and both lists read booked from the booking row through the one predicate', () => {
  const derive = read('vendor-thread-stage.ts');
  const body = derive.slice(derive.indexOf('export async function deriveThreadStage'));
  assert.match(body, /if \(rowReadsBooked\(data/, 'deriveThreadStage no longer reads the booking row for booked');
  // It must run on the row the completion read already fetched — before the pool probe, no extra request.
  assert.ok(body.indexOf('rowReadsBooked(') < body.indexOf("from('vendor_schedule_pool_bookings')"), 'booked moved behind a second read');
  const list = read('conversation-list.ts');
  assert.match(list, /if \(rowReadsBooked\(r\)\) booked\.add\(r\.event_id\)/, "the supplier's list lost the contracted booking");
  assert.match(list, /r\.marketplace_vendor_id && rowReadsBooked\(r\)/, "the couple's list lost the contracted booking");
  assert.doesNotMatch(list, /status === 'contracted'/, 'a second, inline definition of booked is back');
});
