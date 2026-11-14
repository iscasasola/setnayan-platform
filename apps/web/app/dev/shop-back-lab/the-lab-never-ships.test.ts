/**
 * /dev/shop-back-lab 404s in production — the production test is the FIRST statement — and it decides every door with
 * the REAL rule (`lib/shop-back.ts`), never a copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the shop back lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function ShopBackLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab asks the real rule for the back door and the real Check a date door', () => {
  assert.match(LAB, /from '@\/lib\/shop-back';/);
  assert.match(LAB, /shopBackDoor\(arrival\)/);
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/check-a-date-link';/);
});
