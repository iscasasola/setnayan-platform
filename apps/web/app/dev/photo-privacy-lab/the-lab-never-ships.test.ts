/**
 * the-lab-never-ships.test.ts — /dev/photo-privacy-lab 404s in production, as the FIRST thing the page does, and its
 * stand-in server doors live only in the lab (the real screens use the real actions).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the photo-privacy lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/);
  const page = LAB.slice(LAB.indexOf('export default async function PhotoPrivacyLabPage('));
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.ok(page.length > 0, 'the lab page function is gone');
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab reads no database and no R2', () => {
  const client = stripComments(readFileSync(join(HERE, 'lab-client.tsx'), 'utf8'));
  for (const src of [LAB, client]) {
    assert.doesNotMatch(src, /createClient|createAdminClient|@\/lib\/r2'/);
  }
});
