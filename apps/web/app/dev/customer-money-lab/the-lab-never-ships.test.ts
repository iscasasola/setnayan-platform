/**
 * /dev/customer-money-lab 404s in production — the same rule, and the same check,
 * as `/dev/suppliers-lab`: the production test is the FIRST thing the page
 * does, before it reads a search param or draws a fixture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the customer-money lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function CustomerMoneyLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(
    body,
    /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/,
    'the production 404 is not the first statement — the lab can render on the live site',
  );
});

test('the lab draws the customer card’s REAL money fold, over the pair fixture the couple’s lab reads', () => {
  assert.match(LAB, /from '@\/app\/vendor-dashboard\/clients\/\[eventId\]\/_components\/customer-money-fold';/);
  assert.match(LAB, /from '..\/suppliers-lab\/money-pair';/, 'the two labs must draw ONE booking');
  assert.match(LAB, /\.filter\(awaitsTheSupplier\)/, 'the card’s own filter — a refused payment is not waiting on the supplier');
});
