/**
 * 🔒 THE SUPPLIER HERO'S PHOTO (lib/supplier-hero.ts — Build 3 Lane E items 11–12).
 *   · Today = the most-viewed portfolio photo; ties → the latest; no views (or unread) → the latest; none → null.
 *   · A count for a photo no longer on the portfolio never brings it back.
 *   · The placeholder chain = the category's picture, then its group's, then the shipped file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HERO_PLACEHOLDER_FILE, latestPhotoKey, mostViewedPhotoKey, placeholderRefs, viewsOf } from './supplier-hero';

const KEYS = ['r2://m/a', 'r2://m/b', 'r2://m/c'];

test('latest = the last key the uploader appended', () => {
  assert.equal(latestPhotoKey(KEYS), 'r2://m/c');
  assert.equal(latestPhotoKey([]), null);
  assert.equal(latestPhotoKey(null), null);
});

test('most viewed wins; ties go to the newer photo; no views → latest', () => {
  assert.equal(mostViewedPhotoKey(KEYS, new Map([['r2://m/a', 9], ['r2://m/b', 3]])), 'r2://m/a');
  assert.equal(mostViewedPhotoKey(KEYS, new Map([['r2://m/a', 4], ['r2://m/b', 4]])), 'r2://m/b', 'a tie goes to the later photo');
  assert.equal(mostViewedPhotoKey(KEYS, new Map()), 'r2://m/c');
  assert.equal(mostViewedPhotoKey(KEYS, null), 'r2://m/c', 'an unread count falls back to the latest, never to nothing');
  assert.equal(mostViewedPhotoKey([], new Map([['r2://m/a', 9]])), null);
});

test('a removed photo’s count never makes it the hero', () => {
  assert.equal(mostViewedPhotoKey(['r2://m/b'], new Map([['r2://m/gone', 99]])), 'r2://m/b');
  assert.equal(viewsOf('r2://m/a', new Map([['r2://m/a', 412]])), 412);
  assert.equal(viewsOf(null, new Map([['r2://m/a', 412]])), 0);
});

test('the placeholder chain: category → group → the shipped file', () => {
  const photos = { mobile_bar: 'r2://s/bar', booths: 'r2://s/booths', florist: null };
  const parent = { mobile_bar: 'booths', florist: 'styling' };
  assert.deepEqual(placeholderRefs('mobile_bar', photos, parent), ['r2://s/bar', 'r2://s/booths']);
  assert.deepEqual(placeholderRefs('florist', photos, parent), []);
  assert.deepEqual(placeholderRefs(null, photos, parent), []);
  assert.equal(HERO_PLACEHOLDER_FILE, '/placeholders/vendor.webp');
  assert.ok(existsSync(join(process.cwd(), 'public', HERO_PLACEHOLDER_FILE)), 'the shipped placeholder file is gone');
});
