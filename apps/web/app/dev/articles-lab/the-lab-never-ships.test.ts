/**
 * the-lab-never-ships.test.ts — /dev/articles-lab 404s in production (the house rule every lab holds), and it
 * draws the screens' REAL view components, never a copy the side-by-side would then approve instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the articles lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/);
  const page = LAB.slice(LAB.indexOf('export default async function ArticlesLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab draws the REAL views', () => {
  assert.match(LAB, /from '@\/app\/\(shell\)\/articles\/_components\/feed-view'/);
  assert.match(LAB, /from '@\/app\/\(shell\)\/articles\/_components\/article-view'/);
  assert.match(LAB, /from '@\/app\/\(shell\)\/articles\/_components\/write-sheet'/);
});
