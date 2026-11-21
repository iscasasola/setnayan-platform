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
  // W1-B21 (16 Nov 2026): the last redirect is Today unless the supplier came for a plan — then that plan's offer.
  // 🚪 Supplier onboarding (owner 19 Nov): Today is reached through `firstCardLanding` — Today's WELCOME
  // (`/vendor-dashboard?opened=1`), or the shipped Card Maker when the first card's way was Edit.
  const redirects = [...actions.matchAll(/redirect\((?:planOfferPath\(plan\) \?\? )?'([^']+)'\)/g)].map((m) => m[1]);
  assert.match(
    actions,
    /redirect\(planOfferPath\(plan\) \?\? firstCardLanding\(\{ choice: cardChoice, cardId, category: cardCategory \}\)\);\s*\}/,
    'the last redirect of the open-shop action must be Today (its welcome)',
  );
  const onboarding = strip(read('lib/supplier-onboarding.ts'));
  assert.match(onboarding, /WELCOME_OPENED_PATH = '\/vendor-dashboard\?opened=1'/);
  assert.ok(!redirects.includes('/vendor-dashboard/shop'), 'no open-shop success path lands on My Shop');
});

test('a person who already has a shop is sent to Today too (or to the console page `?next=` names)', () => {
  const page = strip(read('app/open-shop/page.tsx'));
  assert.match(page, /const landing = shopConsolePath\(next\);/);
  // W1-B21: a supplier who came for a plan is offered it; anyone else goes to `landing`.
  assert.match(page, /if \(row\?\.business_name\?\.trim\(\)\) redirect\(planOfferPath\(plan\) \?\? landing\);/);
  // The default — no `next`, or one that is not a console page — is still Today.
  const lib = strip(read('lib/shop-console-path.ts'));
  assert.match(lib, /SHOP_CONSOLE_HOME = '\/vendor-dashboard'/);
});
