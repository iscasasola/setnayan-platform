/**
 * THE DAY BAR (Availability plan step 4, drawing `prototypes/availability_steps_3_4_2026-11-19.html` § Step 4):
 * orders by due date, pieces as the SUM of quantities, the dot, the strip, the summed answer line — and a refused read
 * is never "0 out".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countBarKind, countBarOf, countBarFillPct, freeWords } from './day-count-bar';
import { dayGroupsOf, dayAnswerOfGroups } from './vendor-dates';

test('orders: "3 of 5 in progress · 2 free", one piece per order up to ten, the dot by how many are left', () => {
  const b = countBarOf({ kind: 'orders', name: 'Orders in progress', taken: 3, total: 5 });
  assert.ok(!b.unread);
  if (b.unread) return;
  assert.equal(b.words, '3 of 5 in progress');
  assert.equal(b.free, 2);
  assert.equal(b.strip, 'pieces');
  assert.equal(b.dot, 'some');
  assert.equal(countBarOf({ kind: 'orders', name: 'x', taken: 0, total: 5 }).unread ? null : 'ok', 'ok');
  const full = countBarOf({ kind: 'orders', name: 'x', taken: 5, total: 5 });
  assert.equal(full.unread ? null : full.dot, 'full');
  const fresh = countBarOf({ kind: 'orders', name: 'x', taken: 0, total: 5 });
  assert.equal(fresh.unread ? null : fresh.dot, 'ok');
});

test('pieces: "320 of 500 out · 180 free", a bar above ten', () => {
  const b = countBarOf({ kind: 'pieces', name: 'Tiffany chairs', taken: 320, total: 500 });
  assert.ok(!b.unread);
  if (b.unread) return;
  assert.equal(b.words, '320 of 500 out');
  assert.equal(b.free, 180);
  assert.equal(b.strip, 'fill');
  assert.equal(countBarFillPct(b), 64);
});

test('a refused read draws "unread", never 0 out — and the answer line keeps the day\'s own words', () => {
  const b = countBarOf({ kind: 'pieces', name: 'Chairs', taken: null, total: 500 });
  assert.equal(b.unread, true);
  assert.equal(freeWords([b]), null);
});

test('the answer line sums the free counts', () => {
  const o = countBarOf({ kind: 'orders', name: 'Orders in progress', taken: 3, total: 5 });
  const p = countBarOf({ kind: 'pieces', name: 'Tiffany chairs', noun: 'Chairs', taken: 320, total: 500 });
  // As drawn: the pieces in the schedule's own word ("180 chairs free"), never "180 pieces free" (review 2026-11-20).
  assert.equal(freeWords([o, p]), '2 orders and 180 chairs free');
  // A bar with no noun falls back to "pieces", and a single one to "piece".
  assert.equal(freeWords([countBarOf({ kind: 'pieces', name: 'x', taken: 320, total: 500 })]), '180 pieces free');
  assert.equal(freeWords([countBarOf({ kind: 'pieces', name: 'x', noun: ' ', taken: 499, total: 500 })]), '1 piece free');
  // The noun belongs to pieces only — an orders bar never carries it.
  const on = countBarOf({ kind: 'orders', name: 'Orders in progress', noun: 'Cakes', taken: 3, total: 5 });
  assert.equal(on.unread ? null : on.noun, undefined);
  assert.equal(freeWords([o, null]), null);
  assert.equal(countBarKind('day'), null);
  assert.equal(countBarKind(null), null);
});

test('dayGroupsOf counts a by-the-piece schedule by the SUM of quantities (NULL = 1), and a refused quantity is unread', () => {
  const day = '2027-03-06';
  const base = { today: '2027-03-01', blocks: [], holds: [] };
  const pools = [{ poolId: 'p1', label: 'Chairs', capacity: 500, style: 'piece' as const, barName: 'Tiffany chairs' }];
  const row = (key: string, quantity: number | null | undefined) => ({ key, poolId: 'p1', title: key, line: '', href: null, quantity });
  const [g] = dayGroupsOf(day, { ...base, pools, bookings: [row('a', 200), row('b', 120), row('c', undefined)] });
  assert.equal(g!.taken, 321);
  assert.ok(g!.bar && !g!.bar.unread);
  assert.equal(g!.bar && !g!.bar.unread ? g!.bar.words : '', '321 of 500 out');
  assert.equal(dayAnswerOfGroups([g!], 1)?.line, '179 chairs free');
  const [u] = dayGroupsOf(day, { ...base, pools, bookings: [row('a', 200), row('b', null)] });
  assert.equal(u!.bar?.unread, true);
});

test('a REFUSED count never reads "Free" — the group, the empty row and the day all say it could not be read (review 2026-11-19)', () => {
  const day = '2027-03-06';
  const base = { today: '2027-03-01', blocks: [], holds: [], bookings: [] };
  // The database count was refused (`vendor_day_pool_taken` errored → dbTaken null) and no booking rows came back.
  const [g] = dayGroupsOf(day, { ...base, pools: [{ poolId: 'p1', label: 'Cakes', capacity: 5, style: 'order' as const, dbTaken: null }] });
  assert.equal(g!.unread, true);
  assert.notEqual(g!.right.word, 'Free all day', 'a refused count was drawn as a free day');
  assert.equal(g!.rows.some((r) => r.badge?.word === 'Free'), false, 'the empty row said Free on a refused count');
  const answer = dayAnswerOfGroups([g!], 0);
  assert.equal(answer?.word, 'Couldn’t read');
  assert.equal(answer?.tone, 'warn');
  // Read fine → the same day is Free, so the test above is about the refusal, not the day.
  const [ok] = dayGroupsOf(day, { ...base, pools: [{ poolId: 'p1', label: 'Cakes', capacity: 5, style: 'order' as const, dbTaken: 0 }] });
  assert.equal(ok!.unread, false);
  assert.equal(dayAnswerOfGroups([ok!], 0)?.word, 'Free');
});

test('a FULL day of pieces or orders says it in their words — never "500 bookings already" (review 2026-11-19)', () => {
  const day = '2027-03-06';
  const base = { today: '2027-03-01', blocks: [], holds: [], bookings: [] };
  const [chairs] = dayGroupsOf(day, { ...base, pools: [{ poolId: 'p1', label: 'Chairs', capacity: 500, style: 'piece' as const, dbTaken: 500 }] });
  const a = dayAnswerOfGroups([chairs!], 0);
  assert.equal(a?.word, 'Full');
  assert.equal(a?.line, 'All 500 chairs out');
  const [cakes] = dayGroupsOf(day, { ...base, pools: [{ poolId: 'p2', label: 'Cakes', capacity: 5, style: 'order' as const, dbTaken: 5 }] });
  assert.equal(dayAnswerOfGroups([cakes!], 0)?.line, '5 of 5 orders in progress');
});
