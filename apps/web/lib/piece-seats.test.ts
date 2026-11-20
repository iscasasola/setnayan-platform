/**
 * 🔢 PIECES NEVER TAKE A SEAT (owner 2026-11-19, AVAILABILITY FINALIZED 2c; review of #8012). A chair booking on a
 * schedule left at "1 a day" is LISTED on the day but never fills it — in the Clients calendar, Check a date and the
 * chat's day answer alike, because all three count through `buildCustomerCalendarMonth` with `seat` from
 * `pieceBookingIdsOf`. The database's own count (`schedule_pool_taken_on`) is pinned by the step 4 DB test 9.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerCalendarMonth } from './vendor-customers';
import { pieceBookingIdsOf } from './piece-seats';

const ONE_A_DAY = [{ poolId: 'p1', label: 'Rentals', capacity: 1, categories: [], calendarName: null, isVendorCreated: true, serviceIds: [] }] as unknown as Parameters<
  typeof buildCustomerCalendarMonth
>[0];
const dayOf = (bookings: unknown[]) =>
  buildCustomerCalendarMonth(ONE_A_DAY, bookings as never, [], [], [], '2026-12', '2026-12-01').days.find((d) => d.date === '2026-12-12')!;

test('a chair booking is listed on its day but never fills a 1-a-day schedule; an ordinary booking still does', () => {
  const chairs = dayOf([{ poolId: 'p1', bookedDate: '2026-12-12', eventName: '200 chairs', seat: false }]);
  assert.equal(chairs.consumed, 0, 'chairs took a seat');
  assert.notEqual(chairs.state, 'full', 'chairs filled the schedule');
  const booth = dayOf([
    { poolId: 'p1', bookedDate: '2026-12-12', eventName: '200 chairs', seat: false },
    { poolId: 'p1', bookedDate: '2026-12-12', eventName: 'Photo booth' },
  ]);
  assert.equal(booth.consumed, 1);
  assert.equal(booth.state, 'full');
});

/** A fake client: `from(table).select(cols).in(col, ids)` → the rows given, filtered by id. */
function fakeClient(tables: Record<string, Record<string, unknown>[]>, fail?: string) {
  return {
    from: (table: string) => ({
      select: () => ({
        in: async (col: string, ids: string[]) =>
          fail === table
            ? { data: null, error: { message: 'refused' } }
            : { data: (tables[table] ?? []).filter((r) => ids.includes(String(r[col]))), error: null },
      }),
    }),
  } as never;
}

test('pieceBookingIdsOf names the bookings whose card rents by the piece — and a refused read is said, never "none"', async () => {
  const tables = {
    event_vendors: [
      { vendor_id: 'ev-chairs', service_id: 'card-chairs' },
      { vendor_id: 'ev-booth', service_id: 'card-booth' },
    ],
    vendor_services: [
      { vendor_service_id: 'card-chairs', availability_style: 'piece' },
      { vendor_service_id: 'card-booth', availability_style: 'day' },
    ],
  };
  const r = await pieceBookingIdsOf(fakeClient(tables), ['ev-chairs', 'ev-booth', null]);
  assert.deepEqual([...(r.ids ?? [])], ['ev-chairs']);
  const refused = await pieceBookingIdsOf(fakeClient(tables, 'vendor_services'), ['ev-chairs']);
  assert.equal(refused.ids, null, 'a refused read came back as "no pieces"');
  assert.ok(refused.error);
});
