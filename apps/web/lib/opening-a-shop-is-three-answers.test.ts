/**
 * OPENING A SHOP IS THREE ANSWERS, on every public page that says how (25 Nov 2026).
 *
 * The sign-up (`/open-shop`) heads itself with `OPEN_YOUR_SHOP_HEAD` ("Three answers. Free.") and /for-suppliers
 * says "Open your shop: three answers". /features, the front door and the AI answer still said "two steps"
 * (checked live with curl on 25 Nov). One sign-up, one count: every page that describes it says three answers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { OPEN_YOUR_SHOP_HEAD } from './supplier-onboarding';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

const PAGES = [
  'lib/features-page.ts',
  'app/features/_story-sample-moments.tsx',
  'app/_components/frontdoor/front-door-landing-data.ts',
  'lib/seo/ai-answers.ts',
  'app/for-suppliers/_components/supplier-front-data.ts',
];

test('the sign-up itself says three answers', () => {
  assert.match(OPEN_YOUR_SHOP_HEAD[1], /three answers/i);
});

test('no public page says a shop opens in two steps', () => {
  for (const rel of PAGES) {
    assert.doesNotMatch(read(rel), /two[\s-]steps?/i, `${rel} still says "two steps"; /open-shop says three answers`);
  }
});

test('every page that says how a shop opens says three answers', () => {
  for (const rel of PAGES) {
    assert.match(read(rel), /three answers/i, `${rel} does not say three answers`);
  }
});
