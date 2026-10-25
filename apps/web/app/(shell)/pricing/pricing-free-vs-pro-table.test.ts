/**
 * pricing-free-vs-pro-table.test.ts — /pricing's "Two ways to plan" is ONE plain
 * Free vs Pro table, and Pro is Event Hub Pro read from the catalogue.
 *
 * Owner 2026-10-25 ("If you have recommendation that follow our design go for
 * it") on the approved prototype `prototypes/ceremo_deltas_2026-10-25/02_pricing.html`,
 * frame "Pro = Event Hub Pro". Three things this pins, each by the ACT on the
 * comment-stripped page, never by a docblock mentioning it:
 *   1. Pro's figure comes from the COUPLE_WEBSITE_PRO row through the shared
 *      two-price resolver — never a typed peso.
 *   2. The launch-offer line renders the row's sign-up price beside the regular one.
 *   3. The public footnote "Provisional pending the holistic pricing review" is gone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const PAGE = join(dirname(fileURLToPath(import.meta.url)), 'page.tsx');
const code = stripComments(readFileSync(PAGE, 'utf8'));

test('Pro is Event Hub Pro, priced from its catalogue row through the shared resolver', () => {
  assert.match(
    code,
    /const\s+proRow\s*=\s*customerSkus\.find\(\s*\(s\)\s*=>\s*s\.service_code\s*===\s*'COUPLE_WEBSITE_PRO'\s*\)/,
    'the Pro column no longer reads the COUPLE_WEBSITE_PRO row',
  );
  assert.match(code, /resolveAiPrices\(\s*proRow\s*\)/, 'Pro stopped using the shared two-price resolver');
  assert.match(code, /\{proRegularLabel\}<\/span>/, 'the Pro header no longer renders the catalogue figure');
});

test('the launch-offer line shows the sign-up price beside the regular one', () => {
  assert.match(
    code,
    /\{proSignupLabel\}\s*while you set up your event/,
    'the launch-offer line ("while you set up your event") is gone or no longer reads the sign-up price',
  );
});

test('the two old cards are gone and the table replaced them', () => {
  assert.doesNotMatch(code, />\s*Free · Explore\s*<\/p>/, 'the old "Free · Explore" card came back');
  assert.match(code, /<table\b/, '"Two ways to plan" is no longer a table');
});

test('no public "provisional" footnote', () => {
  assert.doesNotMatch(code, /Provisional pending/i);
});
