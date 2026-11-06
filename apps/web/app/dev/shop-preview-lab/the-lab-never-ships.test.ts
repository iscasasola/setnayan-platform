/**
 * /dev/shop-preview-lab 404s in production — the production test is the FIRST statement — and it draws the REAL
 * banner and the REAL not-found, not copies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the shop preview lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function ShopPreviewLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab draws the real banner and the real not-found', () => {
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/team-preview-banner';/);
  assert.match(LAB, /from '@\/app\/\[slug\]\/not-found';/);
});
