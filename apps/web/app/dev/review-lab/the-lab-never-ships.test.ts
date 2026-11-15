/** /dev/review-lab 404s in production — the production test is the FIRST statement — and mounts the REAL pieces. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the review lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function ReviewLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab mounts the real review pieces, not copies', () => {
  assert.match(LAB, /from '@\/app\/dashboard\/\[eventId\]\/vendors\/\[vendorId\]\/review\/_components\/review-request-card';/);
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/guest-review\/_components\/guest-review-form';/);
  assert.match(LAB, /from '@\/app\/v\/\[slug\]\/_components\/review-groups';/);
  assert.match(LAB, /from '@\/app\/admin\/reviews\/_components\/guest-reviews-queue';/);
});
