/**
 * build3-reads-the-live-taxonomy.test.ts — two Build 3 reads ask the taxonomy's one source, never a key typed in code.
 *
 * Owner: "make sure the services are not hard coded … should live based on the taxonomy". Acceptance: an admin moves
 * or renames a category or service in Admin › Categories and the screen follows with no code change.
 *
 *   1. The supplier hero's placeholder picks its category from the LIVE snapshot (`getTaxonomy().map`) — the same
 *      snapshot its photos already came from — not the `TAXONOMY_MAP` constant.
 *   2. The Log-a-payment card's coordinator Agree asks `isCoordinatorTrade` (TS = SQL = taxonomy, held by
 *      `coordinator-trade-is-one-list.test.ts`), not a `'planner_coordinator'` literal — and answers today's data
 *      exactly as before.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { needsCoordinatorAgree } from './chat-cards';

const read = (f: string) => stripComments(readFileSync(join(__dirname, f), 'utf8'));

test('1 · the hero placeholder reads the live map, not the constant', () => {
  const src = read('supplier-hero.server.ts');
  assert.doesNotMatch(src, /\bTAXONOMY_MAP\b/);
  assert.match(src, /tax\.map\[first\]\?\.tile/);
});

test('2 · the coordinator Agree asks the one coordinator list', () => {
  const src = read('chat-cards.ts');
  assert.doesNotMatch(src, /'planner_coordinator'/);
  assert.match(src, /isCoordinatorTrade\(/);
  assert.equal(needsCoordinatorAgree('planner_coordinator'), true);
  assert.equal(needsCoordinatorAgree('photography'), false);
  assert.equal(needsCoordinatorAgree(null), false);
  assert.equal(needsCoordinatorAgree(''), false);
});
