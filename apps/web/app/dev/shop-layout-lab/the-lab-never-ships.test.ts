/**
 * /dev/shop-layout-lab 404s in production — the production test is the FIRST statement — and it draws the page's OWN
 * column classes, not copies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the shop layout lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function ShopLayoutLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab draws the page\'s own column classes', () => {
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/shop-columns';/);
  for (const c of ['SHOP_ARTICLE_WIDTH', 'SHOP_COLUMNS_CLASS', 'SHOP_CARD_COLUMN_CLASS', 'SHOP_CARD_SECTION_CLASS']) {
    assert.match(LAB, new RegExp(`\\$?\\{${c}\\}`), `${c} is not used`);
  }
});
