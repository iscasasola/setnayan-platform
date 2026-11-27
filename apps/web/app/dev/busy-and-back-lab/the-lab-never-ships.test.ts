/**
 * /dev/busy-and-back-lab 404s in production — the production test is the FIRST statement — and it draws the REAL
 * pinned row, upload slot and buttons, never a copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));
const FRAMES = stripComments(readFileSync(join(HERE, 'busy-frames.tsx'), 'utf8'));

test('the busy and back lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function BusyAndBackLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab draws the real parts', () => {
  assert.match(LAB, /from '@\/app\/vendor-dashboard\/_components\/tool-page';/);
  assert.match(FRAMES, /from '@\/app\/vendor-dashboard\/invite\/_components\/locked-qr-generator';/);
  assert.match(FRAMES, /from '@\/app\/_components\/submit-button';/);
});
