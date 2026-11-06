/**
 * the-lab-never-ships.test.ts — /dev/spotlight-lab 404s in production: the production check is the
 * FIRST thing its layout and its page do (the pattern `/dev/supplier-lab` holds).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

for (const [file, fn] of [
  ['layout.tsx', 'export default function SpotlightLabLayout('],
  ['[[...page]]/page.tsx', 'export default async function SpotlightLabPage('],
] as const) {
  test(`${file} calls notFound() in production, before anything else`, () => {
    const src = stripComments(readFileSync(join(HERE, file), 'utf8'));
    assert.match(src, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
    const at = src.indexOf(fn);
    assert.ok(at >= 0, 'the lab function is gone');
    const body = src.slice(src.indexOf(') {\n', at) + 4).trimStart();
    assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/, 'the production 404 is not the first statement');
  });
}
