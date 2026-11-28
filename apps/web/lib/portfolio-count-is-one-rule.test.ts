/**
 * 🔢 THE PORTFOLIO COUNT IS ONE RULE (L6 · S3, walk 27 Nov 2026: Today said 8 photos, Collections said 10 — Today
 * counted distinct keys, Collections the raw list with its repeats and empty slots).
 *   1 · the rule: distinct, non-empty keys of `vendor_profiles.portfolio_r2_keys`.
 *   2 · Today (`getPortfolioCount`), Collections and Your page count through it — no raw `.length` of the column.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { countPortfolioPhotos, portfolioPhotoKeys } from './portfolio-count-label';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · a repeated key is one photo, an empty slot is none, the order is kept', () => {
  assert.deepEqual(portfolioPhotoKeys(['a', 'b', 'a', '', '  ', null, 'c', 'b']), ['a', 'b', 'c']);
  assert.equal(countPortfolioPhotos(['a', 'b', 'a', '', 'c']), 3);
  assert.equal(countPortfolioPhotos(null), 0);
  assert.equal(countPortfolioPhotos([]), 0);
});

test('2 · Today, Collections and Your page count the page gallery one way', () => {
  assert.match(read('lib/portfolio-count.ts'), /const photos = countPortfolioPhotos\(row\.portfolio_r2_keys\)/, 'Today’s count left the rule');
  assert.match(read('app/vendor-dashboard/collections/collections-data.ts'), /const portfolioRefs = portfolioPhotoKeys\(/, 'Collections counts the raw list again');
  assert.match(read('app/vendor-dashboard/website/page-data.ts'), /photoCount: countPortfolioPhotos\(portfolioKeys\)/, 'Your page counts the raw list again');
  for (const rel of ['app/vendor-dashboard/collections/collections-data.ts', 'app/vendor-dashboard/website/page-data.ts', 'lib/portfolio-count.ts']) {
    assert.doesNotMatch(read(rel), /portfolio_r2_keys \?\? \[\]\)(?: as string\[\])?\)?\.length/, `${rel} counts the column raw`);
  }
});
