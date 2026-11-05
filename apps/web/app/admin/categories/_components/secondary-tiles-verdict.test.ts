/**
 * "Also listed under" saves against the LIVE categories (③0-d one source). Pure rule; the db half
 * is `tests/db/one-source-admin-path.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { secondaryTilesVerdict } from './model';

const HERE = dirname(fileURLToPath(import.meta.url));

test('a category the admin just made is accepted', () => {
  assert.deepEqual(secondaryTilesVerdict(['drone_shows'], 'fireworks', ['fireworks', 'drone_shows']), {
    ok: true,
    next: ['drone_shows'],
  });
});

test('an id that is not a live category is refused, by name', () => {
  assert.deepEqual(secondaryTilesVerdict(['drone_shows', 'nope'], null, ['drone_shows']), { ok: false, unknown: ['nope'] });
});

test('the home category is dropped, duplicates collapse, the result is sorted', () => {
  assert.deepEqual(secondaryTilesVerdict(['b', 'home', 'a', 'b', ' a '], 'home', ['a', 'b', 'home']), {
    ok: true,
    next: ['a', 'b'],
  });
});

test('"None" is [] — never NULL (the column is NOT NULL)', () => {
  assert.deepEqual(secondaryTilesVerdict([], 'x', ['x']), { ok: true, next: [] });
});

test('the action reads the live categories and no longer the code tile list', () => {
  const src = readFileSync(join(HERE, '../actions.ts'), 'utf8');
  const at = src.indexOf('export async function setServiceSecondaryTiles');
  assert.ok(at > 0, 'premise: setServiceSecondaryTiles moved');
  const body = src.slice(at, src.indexOf('\nexport ', at + 10));
  assert.match(body, /\.from\('service_categories'\)[\s\S]*?\.eq\('tier', 2\)/, 'the action stopped reading the live categories');
  assert.match(body, /secondaryTilesVerdict\(/, 'the action stopped using the shared rule');
  assert.ok(!/WEDDING_TILE_ORDER/.test(src), 'actions.ts reads the code tile list again');
  assert.ok(!/secondary_tiles: next[^,]*\?\s*[^:]*:\s*null/.test(body), 'the action writes NULL to a NOT NULL column again');
});
