/**
 * the-lab-never-ships.test.ts — /dev/card-maker-lab 404s in production. The same pattern `/dev/supplier-lab` holds:
 * the production check is the FIRST thing the page does, before it reads a search param or draws a fixture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the card maker lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function CardMakerLabPage('));
  assert.ok(page.length > 'export default'.length, 'the lab page function is gone');
  // The body starts after the parameter list's closing `}) {`.
  const open = page.indexOf('}) {');
  assert.ok(open > 0, 'the page signature could not be read');
  const body = page.slice(open + '}) {'.length).trimStart();
  assert.match(
    body,
    /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/,
    'the production 404 is not the first statement — the lab can render on the live site',
  );
});
