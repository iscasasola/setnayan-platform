/**
 * 🏷 A SUPPLIER PLAN IS NAMED THE SAME EVERYWHERE — `planWord` (plan-purchase audit, 2026-11-16).
 *
 * The plan notices (admin "subscription awaiting payment", shop "your plan is active" / "couldn't be confirmed") and
 * the admin Subscriptions fallback each carried a local `{ pro: 'Pro', enterprise: 'Ultra' }` map with no `solo`. A
 * Supplier Plus purchase fell through to the raw enum, so the shop was emailed "Your solo plan is active". Every
 * plan name on these surfaces now comes from `planWord`, the Plan screen's own words.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';
import { planWord } from '@/lib/vendor-plan-change-words';

const FILES = ['lib/subscription-purchase-notify.ts', 'app/admin/subscriptions/page.tsx'];

test('the three bought plans have their supplier names', () => {
  assert.equal(planWord('solo'), 'Plus');
  assert.equal(planWord('pro'), 'Pro');
  assert.equal(planWord('enterprise'), 'Ultra');
});

for (const file of FILES) {
  const code = stripComments(readFileSync(file, 'utf8'));
  test(`${file}: names a plan with planWord, never a local tier map`, () => {
    assert.match(code, /from '@\/lib\/vendor-plan-change-words'/, 'planWord is no longer imported');
    assert.match(code, /planWord\(/, 'planWord is no longer called');
    assert.doesNotMatch(
      code,
      /Record<string,\s*string>\s*=\s*\{\s*pro:/,
      'a local { pro, enterprise } plan-name map is back — it has no Plus, so a Plus purchase reads "solo"',
    );
  });
}

test('the shop is never told a raw tier code in a plan notice', () => {
  const code = stripComments(readFileSync('lib/subscription-purchase-notify.ts', 'utf8'));
  assert.doesNotMatch(code, /\?\?\s*\(p\.tier as string\)/, 'a plan name falls back to the raw enum again');
  const uses = code.match(/const tier = tierName\(p\.tier\);/g) ?? [];
  assert.equal(uses.length, 3, `expected the three notices to name the plan through tierName, found ${uses.length}`);
});
