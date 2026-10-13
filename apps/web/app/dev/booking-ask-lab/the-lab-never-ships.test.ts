/**
 * /dev/booking-ask-lab 404s in production — the same rule, and the same check,
 * as `/dev/suppliers-lab`: the production test is the FIRST thing the page
 * does, before it reads a search param or draws a fixture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the booking-ask lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function BookingAskLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(
    body,
    /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/,
    'the production 404 is not the first statement — the lab can render on the live site',
  );
});

test('the lab draws the customer card\'s REAL panel, posting the real answers', () => {
  assert.match(LAB, /from '@\/app\/vendor-dashboard\/clients\/\[eventId\]\/_components\/booking-ask-panel';/);
  assert.match(LAB, /agreeLock=\{vendorAgreeToLock\}/);
  assert.match(LAB, /declineLock=\{vendorDeclineLock\}/);
  assert.match(LAB, /supplierAskOutcomeOf\(/, 'the closed-ask line must come from the rule the card uses');
});
