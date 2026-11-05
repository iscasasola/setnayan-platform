/**
 * the-lab-never-ships.test.ts — /dev/suppliers-lab 404s in production (review of
 * #6352). The pattern `the-day-is-a-rail.test.ts` holds for the schedule lab:
 * the production check is the FIRST thing the page does, before it reads a
 * single search param or renders a fixture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the suppliers lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function SuppliersLabPage('));
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.ok(page.length > 0, 'the lab page function is gone');
  assert.match(
    body,
    /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/,
    'the production 404 is not the first statement — the lab can render on the live site',
  );
});
