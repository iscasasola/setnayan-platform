/**
 * the-lab-never-ships.test.ts — /dev/favorites-lab 404s in production: the production check is the FIRST thing the
 * page does. And it draws the shipped components — a lab with its own copy would be a second Favorites screen that
 * the side-by-side then approves instead of the real one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the favorites lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function FavoritesLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(
    body,
    /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/,
    'the production 404 is not the first statement — the lab can render on the live site',
  );
});

test('the lab draws the REAL components, not a copy', () => {
  for (const real of [
    "from '@/app/[slug]/_components/hub-suppliers-made-this-day'",
    "from '@/app/_components/favorite-heart'",
    "from '@/app/dashboard/(account)/library/_components/favorite-rows'",
    "from '@/app/(shell)/explore/_components/save-vendor-button'",
  ]) {
    assert.ok(LAB.includes(real), `the lab no longer imports ${real}`);
  }
  assert.doesNotMatch(LAB, /<SwipeToDelete|<Heart\b/, 'the lab draws a row or a heart of its own');
});
