/**
 * /dev/papers-renewal-lab 404s in production — the production test is the FIRST statement — and it mounts the REAL
 * renewal pieces, not copies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the papers renewal lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function PapersRenewalLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab mounts the real Today line, state card, upload place, couple notice and admin views', () => {
  assert.match(LAB, /from '@\/app\/vendor-dashboard\/_components\/papers-renewal-line';/);
  assert.match(LAB, /from '@\/app\/vendor-dashboard\/shop\/_components\/renewal-state-card';/);
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/not-yet-verified-notice';/);
  assert.match(LAB, /from '@\/app\/admin\/accounts\/_surfaces\/renewals-list';/);
  assert.match(LAB, /from '@\/app\/admin\/vendors\/\[vendorProfileId\]\/_components\/renewal-record';/);
  const place = stripComments(readFileSync(join(HERE, 'lab-upload-place.tsx'), 'utf8'));
  assert.match(place, /from '@\/app\/vendor-dashboard\/shop\/_components\/paper-upload-place';/);
});
