/**
 * Roles read from what the supplier was booked to DO.
 *
 * The rule that matters most here is NO REGRESSION: every booking made before
 * services existed carries only the row's summary category, so the union must
 * keep returning exactly what it returned before. A "fix" that narrowed those
 * to nothing would blank the day-of console for every historic booking.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { eventTilesForBooking } from './vendor-event-roles';
import { tilesForVendorCategories } from './vendor-category-taxonomy';

test('🔴 the booking summary alone still answers exactly as before — no regression', () => {
  for (const cats of [['band_dj'], ['host_emcee'], ['planner_coordinator'], ['band_dj', 'florist']]) {
    assert.deepEqual(
      eventTilesForBooking({ bookedCategories: cats }),
      tilesForVendorCategories(cats),
      `changed the answer for ${JSON.stringify(cats)}`,
    );
  }
});

test('🔑 a supplier booked for TWO jobs now holds both tiles — the whole point', () => {
  const tiles = eventTilesForBooking({
    bookedCategories: ['band_dj'], // the row's single summary
    bookedServiceCategories: ['host_emcee'], // what they were actually booked to do
  });
  assert.ok(tiles?.includes('host_mc'), 'the emcee job must now be visible');
  assert.ok(tiles?.includes('live_band'), 'and the band job is not lost');
});

test('it can only ADD — the summary tile is never dropped', () => {
  const before = tilesForVendorCategories(['band_dj']) ?? [];
  const after = eventTilesForBooking({
    bookedCategories: ['band_dj'],
    bookedServiceCategories: ['host_emcee', 'florist'],
  }) ?? [];
  for (const t of before) assert.ok(after.includes(t), `lost ${t}`);
});

test('services already written in the TILE vocabulary work too', () => {
  // `vendor_services.category` is ambiguous today — tile key in one path, legacy
  // enum in another, zero rows to settle it. Both readings must work.
  const viaTile = eventTilesForBooking({ bookedServiceCategories: ['host_mc'] });
  const viaLegacy = eventTilesForBooking({ bookedServiceCategories: ['host_emcee'] });
  assert.ok(viaTile?.includes('host_mc'));
  assert.ok(viaLegacy?.includes('host_mc'));
});

test('nothing on either side means "the event cannot say" — null, not empty', () => {
  // An empty array is truthy; a caller treating it as a narrowing set would
  // exclude every tile and hide every desk. Null is the shipped contract.
  assert.equal(eventTilesForBooking({}), null);
  assert.equal(eventTilesForBooking({ bookedCategories: [], bookedServiceCategories: [] }), null);
  assert.equal(eventTilesForBooking({ bookedCategories: null, bookedServiceCategories: null }), null);
  assert.equal(eventTilesForBooking({ bookedCategories: ['  ', ''] }), null, 'blank strings are not roles');
});

test('duplicates across the two sources collapse', () => {
  const tiles = eventTilesForBooking({
    bookedCategories: ['host_emcee'],
    bookedServiceCategories: ['host_emcee', 'host_emcee'],
  });
  assert.deepEqual(tiles, ['host_mc']);
});

test('junk is skipped, never thrown on', () => {
  assert.doesNotThrow(() =>
    eventTilesForBooking({
      bookedCategories: [42 as unknown as string, 'band_dj'],
      bookedServiceCategories: [null as unknown as string, 'host_emcee'],
    }),
  );
  const tiles = eventTilesForBooking({
    bookedCategories: [42 as unknown as string, 'band_dj'],
    bookedServiceCategories: ['host_emcee'],
  });
  assert.ok(tiles?.includes('live_band') && tiles.includes('host_mc'));
});
