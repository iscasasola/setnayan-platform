/**
 * /dev/inquire-lab 404s in production — the production test is the FIRST statement — and it mounts the REAL Inquire
 * pop-up, never a copy; only the send is a stand-in, so the lab can never write an inquiry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const SHEET = stripComments(readFileSync(join(HERE, 'lab-sheet.tsx'), 'utf8'));

test('the inquire lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function InquireLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab mounts the real pop-up with a stand-in send, and never the real action', () => {
  assert.match(SHEET, /from '@\/app\/v\/\[slug\]\/_components\/inquire-sheet';/);
  assert.match(SHEET, /send=\{async \(input\) =>/);
  assert.doesNotMatch(SHEET, /inquiry-actions|startServiceInquiry/);
});
