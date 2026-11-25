/** FINAL CHECK A1-127: Share shares, copies, or says why it could not — never a silent press, never a false "Copied". */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../../lib/strip-comments';

const src = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/_components/share-button.tsx'), 'utf8'));

test('a failed copy tells the person, with the way to try again', () => {
  assert.doesNotMatch(src, /catch \{\s*\}/, 'a swallowed failure is back');
  assert.match(src, /toast\.error\(SHARE_FAILED_MESSAGE\)/);
  assert.match(src, /Press Share to try again/);
});

test('no clipboard is a failure, not a false "Copied"', () => {
  assert.match(src, /if \(!nav\?\.clipboard\?\.writeText \|\| !url\) throw/);
});

test('closing the share sheet is not reported as a failure', () => {
  assert.match(src, /e\.name === 'AbortError'\) return;/);
});

test('🔒 a refused rating read is said on the shop page, never "none yet" (A1-129)', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));
  assert.match(page, /fetchTrustedReviewStatsRead\(admin, vendor\.vendor_profile_id\)/);
  assert.match(page, /const starsNote = trustedFailed\s*\?\s*'Couldn’t load the rating just now\. Reload to try again\.'/);
  const reviews = stripComments(readFileSync(join(process.cwd(), 'lib/reviews.ts'), 'utf8'));
  assert.match(reviews, /if \(error\) \{[\s\S]{0,140}return null;/);
});
