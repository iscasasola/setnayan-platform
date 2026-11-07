/**
 * the-lab-never-ships.test.ts — /dev/open-shop-lab 404s in production: the production check is the FIRST thing its
 * page does (the pattern `/dev/supplier-lab` and `/dev/spotlight-lab` hold). It mounts the real "Open your shop"
 * wizard on fixtures for the 2026-11-06 gate-walk proof; it must never be a page anyone outside a dev machine reaches.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

test('page.tsx calls notFound() in production, before anything else', () => {
  const src = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  assert.match(src, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const at = src.indexOf('export default async function OpenShopLabPage(');
  assert.ok(at >= 0, 'the lab function is gone');
  const body = src.slice(src.indexOf(') {\n', at) + 4).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/, 'the production 404 is not the first statement');
});
