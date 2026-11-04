/**
 * /dev/shop-page-lab 404s in production — the production test is the FIRST statement — and it mounts the REAL shop
 * page pieces, not copies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the shop page lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function ShopPageLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab mounts the real since line and the real Check a date door', () => {
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/shop-since-line';/);
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/check-a-date-link';/);
});
