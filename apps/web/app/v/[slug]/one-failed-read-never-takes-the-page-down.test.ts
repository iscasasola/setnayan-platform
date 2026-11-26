/**
 * FINAL CHECK A1-125 (25 Nov 2026): one failed reviews or services read used to take the whole shop page down
 * (the readers throw and the page's `Promise.all` had no catch). Each section read now settles to null and its own
 * section says it couldn't load; the rest of the page draws.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../lib/strip-comments';

const src = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));

test('🔒 the throwing section readers are caught, each on its own', () => {
  for (const call of ['fetchReviewStats(admin', 'fetchReviewsForVendorWithCouple(admin', 'fetchVendorServices(admin']) {
    const at = src.indexOf(call);
    assert.ok(at > 0, `${call} is gone`);
    assert.match(src.slice(Math.max(0, at - 20), at), /sectionRead\($/, `${call} is not wrapped in sectionRead`);
  }
  assert.match(src, /p\.catch\(/);
});

test('a failed read shows the section failure, never an empty list', () => {
  assert.match(src, /servicesReadFailed \? \(\s*<ShopSectionCouldNotLoad what="services" \/>/);
  assert.match(src, /if \(readFailed\) \{[\s\S]{0,300}<ShopSectionCouldNotLoad what="reviews" \/>/);
  assert.match(src, /readFailed=\{reviewsReadFailed\}/);
});

test('🔒 a refused shop read is not "no such shop" (A1-128)', () => {
  assert.match(src, /if \(error\) \{[\s\S]{0,160}return \{ vendor: null, failed: true \};/, 'a refused read folds into "not found" again');
  assert.match(src, /if \(vendorReadFailed\) \{[\s\S]{0,200}if \(cachedCopy\) throw[\s\S]{0,80}return <ShopCouldNotOpen \/>;/);
  assert.match(src, /if \(\(await fetchVendorRead\(slug\)\)\.failed\) return \{ title: \{ absolute: 'Setnayan' \}, robots: \{ index: false, follow: false \} \};/);
  const story = stripComments(readFileSync(join(process.cwd(), 'lib/ultra-story-pages.server.ts'), 'utf8'));
  assert.match(story, /if \(shopRead\.error\) \{[\s\S]{0,160}return \{ kind: 'failed' \};/);
});
