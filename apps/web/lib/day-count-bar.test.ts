/**
 * THE DAY BAR (Availability plan step 4, drawing `prototypes/availability_steps_3_4_2026-11-19.html` § Step 4):
 * orders by due date, pieces as the SUM of quantities, the dot, the strip, the summed answer line — and a refused read
 * is never "0 out".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countBarKind, countBarOf, countBarFillPct, freeWords } from './day-count-bar';
import { dayGroupsOf, dayAnswerOfGroups } from './vendor-dates';

test('orders: "3 of 5 orders due · 2 free", one piece per order up to ten, the dot by how many are left', () => {
  const b = countBarOf({ kind: 'orders', name: 'Orders due', taken: 3, total: 5 });
  assert.ok(!b.unread);
  if (b.unread) return;
  assert.equal(b.words, '3 of 5 orders due');
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
  const o = countBarOf({ kind: 'orders', name: 'Orders due', taken: 3, total: 5 });
  const p = countBarOf({ kind: 'pieces', name: 'Chairs', taken: 320, total: 500 });
  assert.equal(freeWords([o, p]), '2 orders and 180 pieces free');
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
  assert.equal(dayAnswerOfGroups([g!], 1)?.line, '179 pieces free');
  const [u] = dayGroupsOf(day, { ...base, pools, bookings: [row('a', 200), row('b', null)] });
  assert.equal(u!.bar?.unread, true);
});
