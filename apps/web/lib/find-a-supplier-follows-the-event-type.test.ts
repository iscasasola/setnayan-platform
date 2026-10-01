/**
 * GUARD — Find a supplier lists ONLY the categories this event's type is scoped
 * to (P3, 2026-10-01; EVENT_TYPE_RELIGION_AUDIT footnote 13: Bridal car / Rings
 * / Honeymoon shown to a birthday).
 *
 * The page builds its list from the bench's own scope (`buildShortlistFolders`
 * with no vendor rows) and regroups it (`buildFindList`). These rules drive
 * that exact pair over a snapshot whose scopes are set by hand, so a scope
 * leak in EITHER half goes red. Each was sabotaged once when written.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildShortlistFolders } from './shortlist-taxonomy';
import { fallbackSnapshot } from './taxonomy-snapshot';
import { buildFindList, applyFindFilter } from './supplier-find';

function snapshot() {
  const snap = fallbackSnapshot();
  // Start from "every tile is wedding-only", then open a few to a birthday —
  // so anything a birthday sees beyond these is a leak.
  const scope: Record<string, string[] | null> = {};
  for (const t of snap.tileOrder) scope[t] = ['wedding'];
  scope.cake = ['wedding', 'birthday'];
  scope.photo_booth = ['wedding', 'birthday'];
  scope.catering = ['wedding', 'birthday', 'wake'];
  scope.chairs_tents = ['wake', 'birthday', 'simple_event'];
  return { ...snap, tileEventTypes: scope };
}

function findTiles(eventType: string, booked: Set<string> | null = new Set()) {
  const folders = buildShortlistFolders({
    vendorRows: [],
    eventType,
    faithSet: new Set(),
    taxonomy: snapshot(),
    eventId: 'ev-1',
  });
  const list = buildFindList({ folders, eventType, solemn: false, booked });
  return { list, tiles: list.groups.flatMap((g) => g.categories.map((c) => c.tile)), folders };
}

test('1 · a birthday lists no category outside its scope', () => {
  const { tiles } = findTiles('birthday');
  const allowed = new Set(['cake', 'photo_booth', 'catering', 'chairs_tents']);
  const leaked = tiles.filter((t) => !allowed.has(t));
  assert.deepEqual(leaked, [], `a birthday's Find a supplier lists ${leaked.join(', ')}`);
  assert.ok(tiles.includes('cake') && tiles.includes('chairs_tents'), 'the birthday list lost its own categories');
});

test('2 · wedding-only categories are hidden for a birthday', () => {
  const { tiles } = findTiles('birthday');
  for (const t of ['bridal_car', 'ceremony_venue', 'travel_honeymoon', 'jewelleries_accessories']) {
    assert.equal(tiles.includes(t), false, `a birthday is offered ${t}`);
  }
});

test('3 · 🔒 a wedding’s list is the bench’s list — Find drops nothing', () => {
  const { tiles, folders } = findTiles('wedding');
  const bench = [...new Set(folders.flatMap((f) => f.tiles.map((t) => t.tile as string)))].sort();
  assert.deepEqual([...tiles].sort(), bench);
  assert.ok(tiles.includes('bridal_car'));
  assert.equal(tiles.includes('chairs_tents'), false, 'Chairs & tents is not scoped to weddings');
});

test('4 · a refused booked read says nothing — never "Booked ✓", never "0 booked"', () => {
  const { list } = findTiles('birthday', null);
  for (const g of list.groups) {
    assert.equal(g.bookedCount, null);
    for (const c of g.categories) assert.equal(c.booked, null);
  }
  const ok = findTiles('birthday', new Set(['cake'])).list;
  const cake = ok.groups.flatMap((g) => g.categories).find((c) => c.tile === 'cake');
  assert.equal(cake?.booked, true);
});

test('5 · Popular can only REORDER, never add a category', () => {
  const { list, tiles } = findTiles('birthday');
  for (const c of list.popular) assert.ok(tiles.includes(c.tile), `Popular added ${c.tile}`);
});

test('6 · Filter ▾: area / rating drop, price sorts with unpriced last', () => {
  const rows = [
    { id: 'a', withinRadius: true, rating: 4.8, startsAtPhp: 50_000 },
    { id: 'b', withinRadius: false, rating: 4.9, startsAtPhp: 20_000 },
    { id: 'c', withinRadius: true, rating: 3.5, startsAtPhp: null },
    { id: 'd', withinRadius: true, rating: 4.1, startsAtPhp: 10_000 },
  ];
  assert.deepEqual(applyFindFilter(rows, []).map((r) => r.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(applyFindFilter(rows, ['area']).map((r) => r.id), ['a', 'c', 'd']);
  assert.deepEqual(applyFindFilter(rows, ['rating']).map((r) => r.id), ['a', 'b', 'd']);
  assert.deepEqual(applyFindFilter(rows, ['price']).map((r) => r.id), ['d', 'b', 'a', 'c']);
});

test('7 · the page builds its list from the bench scope, not a second rule', () => {
  const src = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'vendors', 'categories', 'page.tsx'),
    'utf8',
  );
  assert.match(src, /buildShortlistFolders\(\{\s*vendorRows: \[\]/);
  assert.match(src, /buildFindList\(\{/);
  assert.doesNotMatch(src, /PLAN_GROUPS/, 'Find a supplier walks the wedding ladder again');
});
