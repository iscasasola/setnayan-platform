/**
 * YOUR COLLECTIONS — one list of every store (lib/supplier-collections.ts). The switch only where a shipped column
 * says "shown"; a count that was not read is never 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionRows, collectionsLine, filterRows, type CollectionsInput } from './supplier-collections';

const studio: CollectionsInput = {
  page: { photos: 24, videos: 4, shown: true },
  cards: { cards: 3, photos: 15, videos: 0 },
  albums: { photos: 312, events: 9 },
  own: { items: 95 },
  delivered: { couples: 9, items: 14 },
  instagram: { configured: true, connected: true, posts: 140, shown: 24 },
  moodboard: { allowed: true, looks: 18, declined: 1 },
};

test('every store is a row, in one list', () => {
  assert.deepEqual(
    collectionRows(studio).map((r) => r.key),
    ['page', 'cards', 'albums', 'own', 'delivered', 'instagram', 'moodboard'],
  );
});

test('only the page gallery carries the "show on my page" switch', () => {
  assert.deepEqual(
    collectionRows(studio).filter((r) => r.pageSwitch).map((r) => r.key),
    ['page'],
  );
});

test('the private album and your own shots are Private, never on the page', () => {
  const rows = collectionRows(studio);
  for (const k of ['albums', 'own'] as const) {
    const r = rows.find((x) => x.key === k)!;
    assert.equal(r.who, 'private');
    assert.match(r.line, /only you/);
  }
});

test('the page gallery switched off reads Private — and so does Instagram, which shows in that gallery', () => {
  const rows = collectionRows({ ...studio, page: { ...studio.page, shown: false } });
  assert.equal(rows.find((r) => r.key === 'page')!.who, 'private');
  assert.equal(rows.find((r) => r.key === 'instagram')!.who, 'private');
});

test('a count that could not be read says so — never "nothing yet", never 0', () => {
  const rows = collectionRows({ ...studio, albums: null, own: null });
  for (const k of ['albums', 'own'] as const) {
    const r = rows.find((x) => x.key === k)!;
    assert.equal(r.unread, true);
    assert.equal(r.line, 'Could not be read just now');
  }
  assert.equal(collectionsLine(rows), '7 collections · one place');
});

test('Instagram not switched on for the product, and a shop that supplies no looks, have no row', () => {
  const rows = collectionRows({
    ...studio,
    instagram: { configured: false, connected: false, posts: 0, shown: 0 },
    moodboard: { allowed: false, looks: 0, declined: 0 },
  });
  assert.deepEqual(rows.map((r) => r.key), ['page', 'cards', 'albums', 'own', 'delivered']);
});

test('the filter dropdown keeps only the rows for who sees them', () => {
  const rows = collectionRows(studio);
  assert.deepEqual(filterRows(rows, 'private').map((r) => r.key), ['albums', 'own']);
  assert.deepEqual(filterRows(rows, 'couple').map((r) => r.key), ['delivered', 'moodboard']);
  assert.equal(filterRows(rows, 'all').length, rows.length);
});

test('the answer line totals only what was read', () => {
  assert.equal(collectionsLine(collectionRows(studio)), '7 collections · about 608 photos and videos · one place');
});
