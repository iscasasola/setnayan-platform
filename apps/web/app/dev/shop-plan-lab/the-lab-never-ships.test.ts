/**
 * /dev/shop-plan-lab 404s in production — the production test is the FIRST statement — and it mounts the REAL shop
 * page pieces and decides them with the page's own rules, not copies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the shop plan lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function ShopPlanLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab mounts the real plan pieces and the real rules', () => {
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/shop-reach';/);
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/shop-addresses';/);
  assert.match(LAB, /from '@\/lib\/shop-page-plan';/);
});
