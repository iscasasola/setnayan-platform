/**
 * The "never a dead door" rule (S6 brief), pinned per row — and, since
 * 2026-10-03, "ONE PLACE PER DOOR" (owner, on the live Event Hub: "the places
 * of the different information is still not fixed. too many buttons. too much
 * going on"). Each failure names the ruling so a later edit that brings back a
 * dead door or a second door is caught by its own message.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEverythingElseRows, type EverythingElseInput } from './everything-else-rows';

const base: EverythingElseInput = {
  venueWalkHref: null,
  keepsakeHref: null,
  recapBodyReady: false,
  recapHasPhotos: false,
};
const at = (o: Partial<EverythingElseInput>) => resolveEverythingElseRows({ ...base, ...o });
const row = (rows: ReturnType<typeof at>, key: string) => rows.find((r) => r.key === key);

const ALL: Partial<EverythingElseInput> = {
  venueWalkHref: '/maria-and-jose/venue?t=TOKEN',
  keepsakeHref: '/maria-and-jose/recap',
  recapBodyReady: true,
  recapHasPhotos: true,
};

test('everything-else · every row is a live link — never a greyed row, never "#"', () => {
  const rows = at(ALL);
  assert.ok(rows.length > 0, 'fixture produced no rows to check');
  for (const r of rows) {
    assert.ok(typeof r.href === 'string' && r.href.length > 0, `${r.key} opens nothing`);
    assert.notEqual(r.href, '#', `${r.key} points at "#"`);
    assert.equal(Object.hasOwn(r, 'badge'), false, `${r.key} is a greyed row with a badge again`);
    assert.equal(Object.hasOwn(r, 'action'), false, `${r.key} is an action row again`);
  }
});

test('everything-else · ✂ no row is a SECOND door to something the page already offers', () => {
  // camera → the bar's Camera slot · watch → The Day's Live page · find-my-table
  // → the Welcome seat line / "Find your seat" · print → Post Event's own
  // "Print the keepsake" · share → the footer's Share (owner 2026-10-03).
  const keys = at(ALL).map((r) => r.key);
  for (const gone of ['camera', 'watch', 'find-my-table', 'print', 'share']) {
    assert.ok(!keys.includes(gone), `"${gone}" is back in Everything else — it already has a home on the page`);
  }
  assert.deepEqual(keys, ['venue-walk', 'keepsake']);
});

test('everything-else · walk-the-room mirrors doorways.venueWalk verbatim, personal token included', () => {
  assert.equal(row(at({ venueWalkHref: '/m/venue?t=TOKEN' }), 'venue-walk')?.href, '/m/venue?t=TOKEN');
  assert.equal(row(at({ venueWalkHref: null }), 'venue-walk'), undefined, 'unpublished seating still offers the room');
});

test('everything-else · the keepsake reel is a row only once the album has photos to open', () => {
  assert.equal(row(at({ ...ALL, recapHasPhotos: false }), 'keepsake'), undefined, 'an empty album is a row that opens nothing');
  assert.equal(row(at({ ...ALL, recapBodyReady: false }), 'keepsake'), undefined);
  assert.equal(row(at({ ...ALL, keepsakeHref: null }), 'keepsake'), undefined, 'the row builds the album door itself');
  assert.equal(row(at(ALL), 'keepsake')?.href, '/maria-and-jose/recap');
});

test('everything-else · nothing available at all returns an empty list — the caller must render no trigger', () => {
  assert.deepEqual(at({}), []);
});
