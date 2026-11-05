/** /dev/thumb-row-lab 404s in production — the check is the page's first statement (the guests lab's pattern). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the thumb-row lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/);
  const page = LAB.slice(LAB.indexOf('export default async function ThumbRowLabPage('));
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.ok(page.length > 0);
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});
