/**
 * /dev/supplier-set-two-lab 404s in production — the production test is the FIRST statement — and it draws the
 * SHIPPED page bodies (never a copy of their markup), so a shot of the lab is a shot of the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the set-two lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function SupplierSetTwoLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab draws the shipped bodies from app/vendor-dashboard, never its own copy', () => {
  assert.match(LAB, /from '@\/app\/vendor-dashboard\/contracts\/\[contractId\]\/contract-body';/);
  assert.match(LAB, /from '@\/app\/vendor-dashboard\/contracts\/new\/upload-body';/);
  assert.doesNotMatch(LAB, /<form\b/, 'the lab drew a form of its own');
});
