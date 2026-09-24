/**
 * collection-pagination.test.ts — the collection template's pages, executed.
 *
 * Owner-approved 2026-09-24 (DECISION_LOG, "the template is good"): ten per
 * page · "1 · 2 · … · Last" · "1–10 of N" · the pager appears only when a page
 * fills · the dashed tile only while the page has room. Every expectation below
 * is read off the approved prototype's own states
 * (`prototypes/collection_template_posters_add_flow_v4_2026-09-24.html`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLLECTION_PAGE_SIZE,
  paginateCollection,
  parseCollectionPage,
  type CollectionPagerStop,
} from './collection-pagination';

/** The pager as a person reads it: "1 · 2 · … · Last", current in [brackets]. */
function read(stops: CollectionPagerStop[]): string {
  return stops
    .map((s) => (s.kind === 'gap' ? '…' : s.current ? `[${s.label}]` : s.label))
    .join(' · ');
}

test('ten per page', () => {
  assert.equal(COLLECTION_PAGE_SIZE, 10);
});

test('three events: one page, no pager, and the tile has room', () => {
  const p = paginateCollection(3, 1);
  assert.equal(p.showPager, false);
  assert.deepEqual(p.stops, []);
  assert.equal(p.hasRoomForNewTile, true);
  assert.deepEqual([p.from, p.to], [0, 3]);
});

test('exactly ten: the page is full — no tile, and still no pager', () => {
  // The prototype's "10" state: ten posters, no dashed tile, no pager. A pager
  // with one page on it would be a control that goes nowhere.
  const p = paginateCollection(10, 1);
  assert.equal(p.hasRoomForNewTile, false, 'a full page has no room for the tile');
  assert.equal(p.showPager, false, 'one page needs no pager');
});

test('eleven: the pager appears, and the tile moves to page 2 beside the one card', () => {
  const one = paginateCollection(11, 1);
  assert.equal(one.showPager, true);
  assert.equal(one.hasRoomForNewTile, false);
  assert.equal(read(one.stops), '[1] · Last');
  assert.equal(one.rangeLabel, '1–10 of 11');

  const two = paginateCollection(11, 2);
  assert.deepEqual([two.from, two.to], [10, 11]);
  assert.equal(two.hasRoomForNewTile, true);
  assert.equal(read(two.stops), '1 · [Last]');
  assert.equal(two.rangeLabel, '11–11 of 11');
});

test('a hundred: "1 · 2 · … · Last" and "1–10 of 100", stop by stop off the prototype', () => {
  const at = (page: number) => paginateCollection(100, page);
  assert.equal(read(at(1).stops), '[1] · 2 · … · Last');
  assert.equal(read(at(2).stops), '1 · [2] · 3 · … · Last');
  assert.equal(read(at(3).stops), '1 · 2 · [3] · 4 · … · Last');
  assert.equal(read(at(4).stops), '1 · … · 3 · [4] · 5 · … · Last');
  assert.equal(read(at(8).stops), '1 · … · 7 · [8] · 9 · Last');
  assert.equal(read(at(9).stops), '1 · … · 8 · [9] · Last');
  assert.equal(read(at(10).stops), '1 · … · 9 · [Last]');
  assert.equal(at(1).rangeLabel, '1–10 of 100');
  assert.equal(at(4).rangeLabel, '31–40 of 100');
  assert.equal(at(10).rangeLabel, '91–100 of 100');
  // Every page of an exact multiple is full — the tile never fits, the (+) is the door.
  for (let p = 1; p <= 10; p++) assert.equal(at(p).hasRoomForNewTile, false, `page ${p}`);
});

test('"Last" always points at the last page', () => {
  for (const page of [1, 4, 10]) {
    const stops = paginateCollection(100, page).stops;
    const last = stops[stops.length - 1];
    assert.ok(last && last.kind === 'page');
    assert.equal(last.page, 10);
    assert.equal(last.label, 'Last');
  }
});

test('a page past the end shows the last page, never an empty one', () => {
  const p = paginateCollection(25, 9);
  assert.equal(p.page, 3);
  assert.deepEqual([p.from, p.to], [20, 25]);
});

test('an empty collection is one page with room — the empty state, not a pager', () => {
  const p = paginateCollection(0, 1);
  assert.equal(p.showPager, false);
  assert.equal(p.hasRoomForNewTile, true);
  assert.equal(p.rangeLabel, '');
});

test('?page= is read forgivingly — anything odd is page 1', () => {
  assert.equal(parseCollectionPage(undefined), 1);
  assert.equal(parseCollectionPage(''), 1);
  assert.equal(parseCollectionPage('0'), 1);
  assert.equal(parseCollectionPage('-2'), 1);
  assert.equal(parseCollectionPage('2.5'), 1);
  assert.equal(parseCollectionPage('abc'), 1);
  assert.equal(parseCollectionPage('3'), 3);
  assert.equal(parseCollectionPage(['4', '5']), 4);
});
