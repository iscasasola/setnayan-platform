/**
 * the-lab-never-ships.test.ts — /dev/for-suppliers-lab 404s in production (the pattern every lab holds): the
 * production check is the FIRST thing the page does, before it draws a code or names a fixture price.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the for-suppliers lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function ForSuppliersLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/, 'the production 404 is not the first statement');
});

test('no shipped page reads the lab fixture prices', () => {
  const real = readFileSync(join(HERE, '..', '..', '(shell)', 'for-suppliers', 'page.tsx'), 'utf8');
  assert.doesNotMatch(real, /for-suppliers-lab|LAB_PRICES/);
});
