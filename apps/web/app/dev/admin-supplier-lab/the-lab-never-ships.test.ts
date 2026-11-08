/**
 * /dev/admin-supplier-lab 404s in production — the production test is the FIRST thing the page does (same rule as
 * every /dev lab), and it draws the slice's REAL pieces, not copies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the admin supplier lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function AdminSupplierLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the lab draws the REAL pieces', () => {
  for (const piece of ['<QueuesTriageFeed', '<SupplierInbox', '<HubToolsPane', '<HelpMessenger', '<LabSubmitCatcher']) {
    assert.ok(LAB.includes(piece), `the lab no longer draws ${piece}`);
  }
});
