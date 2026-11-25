/**
 * supplier-batch4-holds.test.ts — final check 25 Nov 2026, area 5 batch 4.
 * B5-27 Today says "done for today" once · A5-G6-04 the Bundle Maker's ✕ returns to the place that opened it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));

test('Today says "You’re done for today" once — the cover heading, not again in the block (B5-27)', () => {
  const today = src('app/vendor-dashboard/_components/today-v2.tsx');
  assert.equal((today.match(/You’re done for today/g) ?? []).length, 1);
  assert.match(today, /'✓ You’re done for today'/);
});

test('the Bundle Maker ✕ returns to its opener, from a closed list only (A5-G6-04)', () => {
  const page = src('app/vendor-dashboard/packages/[packageId]/page.tsx');
  assert.match(page, /const CLOSE_TO: Record<string, string> = \{ packages: '\/vendor-dashboard\/packages' \};/);
  assert.match(page, /Object\.hasOwn\(CLOSE_TO, sp\.from\)/, 'never a free-form return address');
  assert.doesNotMatch(page, /closeHref=\{SHOP_SERVICES\}/);
  const list = src('app/vendor-dashboard/packages/page.tsx');
  assert.equal((list.match(/\?from=packages/g) ?? []).length, 2, 'both openers on Your packages name themselves');
  assert.match(src('app/vendor-dashboard/packages/_components/package-editor.tsx'), /\$\{window\.location\.search\}/);
});
