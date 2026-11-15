/**
 * 🏪 THE SUPPLIER DASHBOARD NEVER TELLS AN UNVERIFIED SHOP IT IS HIDDEN — DECISION_LOG 2026-11-15 "AN UNVERIFIED SHOP HAS
 * THE SAME WEBSITE AS A VERIFIED ONE": its page opens by its link and QR and couples can message it; Verified adds the
 * check and Discover + Suppliers › Find. W1, 15 Nov: Today said "send your documents to go live" and "Couples see your
 * shop once you are live".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { shopPillOf, shopStateWords } from './supplier-today';
import { UNVERIFIED_BUSINESS_LINE } from './supplier-today-view';

const SUPPLIER_COPY = [
  'lib/supplier-today.ts',
  'lib/supplier-today-view.ts',
  'lib/vendor-first-steps.ts',
  'lib/supplier-setup.ts',
  'lib/help/supplier-1.ts',
  'app/vendor-dashboard/_components/setup-paper-place.tsx',
];

test('1 · an unverified shop’s words say what Verified adds, not that it is hidden', () => {
  const pill = shopPillOf({ verified: false, findable: false });
  assert.equal(shopStateWords({ pill, docsWithSetnayan: false }), 'send your documents to get Verified');
  assert.equal(UNVERIFIED_BUSINESS_LINE, 'Couples can open your page by its link and message you');
});

test('2 · no supplier setup copy says the shop goes live (is shown) only once it is verified', () => {
  for (const rel of SUPPLIER_COPY) {
    const src = stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
    assert.doesNotMatch(
      src,
      /(?:to|before you|once you are|until you are|then you are|you) go live|(?:once|until|then) you are live|Nothing before this is visible/i,
      `${rel} tells an unverified shop it is hidden until verified`,
    );
  }
});
