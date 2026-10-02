/**
 * First-timer fix 12 (corpus FIRST_TIMER_TEST_2026-10-02.md, S1): a new shop
 * lands on TODAY (`/vendor-dashboard`), where the ordered First steps live — not
 * on My Shop, which is fifteen tool rows with no next step.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../lib/strip-comments';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const strip = (s: string) => stripComments(s);

test('opening a shop ends on Today', () => {
  const actions = strip(read('app/open-shop/actions.ts'));
  const redirects = [...actions.matchAll(/redirect\('([^']+)'\)/g)].map((m) => m[1]);
  assert.equal(redirects[redirects.length - 1], '/vendor-dashboard', 'the last redirect of the open-shop action must be Today');
  assert.ok(!redirects.includes('/vendor-dashboard/shop'), 'no open-shop success path lands on My Shop');
});

test('a person who already has a shop is sent to Today too', () => {
  const page = strip(read('app/open-shop/page.tsx'));
  assert.match(page, /if \(row\?\.business_name\?\.trim\(\)\) redirect\('\/vendor-dashboard'\);/);
});
