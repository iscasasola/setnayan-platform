/**
 * The Setnayan-vs-outside split on the vendor's calendar (design § 2.7b).
 *
 * A day was `booked` whether Setnayan brought the client or the vendor booked
 * them personally, so a full month said nothing about where the work came from —
 * which is the one thing a vendor weighing the platform actually wants to know.
 *
 * New file on purpose: the existing calendar tests are untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerCalendarMonth } from './vendor-customers';

const POOL = [
  {
    poolId: 'p1',
    name: 'Main',
    dailyCapacity: 3,
    serviceKey: null,
    isActive: true,
  },
] as unknown as Parameters<typeof buildCustomerCalendarMonth>[0];

const dayOf = (m: ReturnType<typeof buildCustomerCalendarMonth>, date: string) => {
  const d = m.days.find((x) => x.date === date);
  assert.ok(d, `no day ${date}`);
  return d;
};

test('a pool booking is Setnayan-sourced', () => {
  const month = buildCustomerCalendarMonth(
    POOL,
    [{ poolId: 'p1', bookedDate: '2026-12-12', eventName: 'A wedding', eventId: 'e1' }] as never,
    [],
    [],
    [],
    '2026-12',
    '2026-12-01',
  );
  const d = dayOf(month, '2026-12-12');
  assert.equal(d.consumed, 1);
  assert.equal(d.setnayanConsumed, 1);
  assert.equal(d.state, 'booked');
});

test("🔑 an external_client block consumes the day but is NOT Setnayan's", () => {
  // The spec's named assertion: consumed = 1, setnayanConsumed = 0.
  const month = buildCustomerCalendarMonth(
    POOL,
    [],
    [
      {
        poolId: 'p1',
        startDate: '2026-12-14',
        endDate: '2026-12-14',
        source: 'external_client',
      },
    ] as never,
    [],
    [],
    '2026-12',
    '2026-12-01',
  );
  const d = dayOf(month, '2026-12-14');
  assert.equal(d.consumed, 1, 'it still consumes capacity');
  assert.equal(d.setnayanConsumed, 0, 'but Setnayan did not bring it');
  assert.equal(d.state, 'booked', 'and the day is still booked — precedence untouched');
});

test('a mixed day reports both, and the outside share is derivable', () => {
  const month = buildCustomerCalendarMonth(
    POOL,
    [{ poolId: 'p1', bookedDate: '2026-12-16', eventName: 'A wedding', eventId: 'e1' }] as never,
    [
      {
        poolId: 'p1',
        startDate: '2026-12-16',
        endDate: '2026-12-16',
        source: 'external_client',
      },
    ] as never,
    [],
    [],
    '2026-12',
    '2026-12-01',
  );
  const d = dayOf(month, '2026-12-16');
  assert.equal(d.consumed, 2);
  assert.equal(d.setnayanConsumed, 1);
  assert.equal(d.consumed - d.setnayanConsumed, 1, 'the outside share');
});

test('🪤 a manual closure blocks the day and consumes nothing at all', () => {
  // A non-external block CLOSES rather than consumes; counting it either way
  // would report work that was never booked.
  const month = buildCustomerCalendarMonth(
    POOL,
    [],
    [
      { poolId: 'p1', startDate: '2026-12-18', endDate: '2026-12-18', source: 'manual' },
    ] as never,
    [],
    [],
    '2026-12',
    '2026-12-01',
  );
  const d = dayOf(month, '2026-12-18');
  assert.equal(d.state, 'blocked');
  assert.equal(d.consumed, 0);
  assert.equal(d.setnayanConsumed, 0);
});

test('an untouched day reports zero for both', () => {
  const month = buildCustomerCalendarMonth(POOL, [], [], [], [], '2026-12', '2026-12-01');
  const d = dayOf(month, '2026-12-05');
  assert.equal(d.consumed, 0);
  assert.equal(d.setnayanConsumed, 0);
  assert.equal(d.state, null);
});
