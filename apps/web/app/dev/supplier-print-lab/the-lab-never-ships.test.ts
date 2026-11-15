/**
 * /dev/supplier-print-lab 404s in production — the production test is the FIRST statement — and it draws the shop's
 * QR with the SAME call the supplier's QR codes page makes, so the code on a tarp opens the page the app says it does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.lab.tsx'), 'utf8'));

test('the supplier print lab calls notFound() in production, before anything else', () => {
  const page = LAB.slice(LAB.indexOf('export default async function SupplierPrintLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(') {') + 1) + 1).trimStart();
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('the QR is the My page code the QR codes page makes, and every piece names all three ways in', () => {
  assert.match(LAB, /from '@\/lib\/qr';/);
  assert.match(LAB, /from '@\/lib\/supplier-qr-codes';/);
  assert.match(LAB, /renderUrlQrSvg\(myPageUrl\(siteOrigin\(\), shop\.business_slug\)|renderUrlQrSvg\(url,/);
  assert.match(LAB, /const url = myPageUrl\(siteOrigin\(\), shop\.business_slug\);/);
  assert.match(LAB, /\(NFC\)/);
  assert.match(LAB, /\{link\}/);
});
