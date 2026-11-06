/**
 * ONE SOURCE · THE COARSE CATEGORY (③0-c) — the resolver reads the snapshot, and the admin delete
 * refuses to strand a couple-side category. The db half (seed equality, admin edits) is
 * `tests/db/one-source-category-key.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { fallbackSnapshot } from './taxonomy-snapshot';
import { categoryForBranch } from './vendor-branch-category';
import { deletionWouldBreakCoupleLinks } from './vendor-category-taxonomy';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('categoryForBranch answers from the snapshot it is handed, not from the code map', () => {
  const tax = fallbackSnapshot();
  assert.equal(categoryForBranch('fireworks', tax), 'reception_decor', 'premise: the seed');
  const edited = { ...tax, tileCoarseCategory: { ...tax.tileCoarseCategory, fireworks: 'performers' as const } };
  assert.equal(categoryForBranch('fireworks', edited), 'performers');
  assert.equal(categoryForBranch('a_category_an_admin_made', { tileCoarseCategory: { a_category_an_admin_made: 'florist' } }), 'florist');
  const src = read('lib/vendor-branch-category.ts');
  const body = src.slice(src.indexOf('export function categoryForBranch'));
  assert.ok(!/BRANCH_TO_VENDOR_CATEGORY\[/.test(body.slice(0, body.indexOf('\n}'))), 'categoryForBranch reads the code map again');
});

test('deleting a category couples are anchored on is refused; an unanchored one is not', () => {
  const tax = fallbackSnapshot();
  assert.ok(deletionWouldBreakCoupleLinks(tax, 'reception').some((d) => d.category === 'venue'));
  assert.ok(deletionWouldBreakCoupleLinks(tax, 'photo_video').some((d) => d.category === 'photographer'));
  assert.deepEqual(deletionWouldBreakCoupleLinks(tax, 'not_a_category'), []);
});

test('only NEW breakage refuses — a link already broken does not block an unrelated delete', () => {
  const tax = fallbackSnapshot();
  const withoutReception = { ...tax, tileOrder: tax.tileOrder.filter((t) => t !== 'reception') };
  // Reception is already gone, so deleting it "again" breaks nothing new.
  assert.deepEqual(deletionWouldBreakCoupleLinks(withoutReception, 'reception'), []);
});

test('the admin delete runs the refusal before it deletes anything', () => {
  const src = read('app/admin/categories/actions.ts');
  const at = src.indexOf('export async function deleteTileWithDestination');
  assert.ok(at > 0, 'premise: deleteTileWithDestination moved');
  const body = src.slice(at, src.indexOf('\nexport ', at + 10));
  const refuse = body.indexOf('deletionWouldBreakCoupleLinks(');
  const firstDelete = body.indexOf('.delete()');
  assert.ok(refuse > 0, 'the delete no longer asks whether couples are anchored on the category');
  assert.ok(firstDelete > refuse, 'the refusal must run before the first delete');
});
