/**
 * the-lab-never-ships.test.ts — /dev/card-checks-lab 404s in production (the production check is the FIRST thing the
 * page does), and it draws the REAL components — a lab with its own copy of the gold box or the Cards tab would be a
 * second screen the side-by-side then approves instead of the real one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the card-checks lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/);
  const page = LAB.slice(LAB.indexOf('export default async function CardChecksLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab draws the REAL gold box and the REAL Cards tab', () => {
  assert.match(LAB, /from '@\/app\/vendor-dashboard\/services\/_components\/held-card-box'/);
  assert.match(LAB, /from '@\/app\/admin\/integrity-watch\/_cards\/cards-tab'/);
  assert.match(LAB, /<HeldCardBox/);
  assert.match(LAB, /<CardsQueue/);
  assert.match(LAB, /<CardOpen/);
});
