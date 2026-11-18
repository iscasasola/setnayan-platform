/**
 * 🔎 COUPLE SEARCH READS THE PLAN A SHOP IS ACTUALLY ON (plan-purchase audit, 2026-11-16).
 *
 * The lapse sweep runs only when a shop opens its own dashboard, so `tier_state` on another shop's row can name a plan
 * whose paid days ended. Search sized reach (Pro 100 km · Ultra nationwide) and the day-1 true name off that raw value
 * — a lapsed plan kept its reach until the shop signed in again. Every search read of `tier_state` must select
 * `tier_expires_at` beside it and go through `liveTierState`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';
import { liveTierState } from '@/lib/vendor-tier-lapse';

const NOW = Date.parse('2026-11-16T04:00:00Z');
const PAST = '2026-10-01T00:00:00Z';
const FUTURE = '2026-12-31T00:00:00Z';

test('a live paid plan reads as itself', () => {
  assert.equal(liveTierState({ tier_state: 'enterprise', tier_expires_at: FUTURE, verification_state: 'verified' }, NOW), 'enterprise');
});

test('an ended paid plan reads as the sweep will write it', () => {
  assert.equal(liveTierState({ tier_state: 'enterprise', tier_expires_at: PAST, verification_state: 'verified' }, NOW), 'verified');
  assert.equal(liveTierState({ tier_state: 'pro', tier_expires_at: PAST, verification_state: 'unverified' }, NOW), 'free');
  assert.equal(liveTierState({ tier_state: 'solo', tier_expires_at: PAST, verification_state: 'verified' }, NOW), 'verified');
});

test('a plan with no end day, and a missing row, are left alone', () => {
  assert.equal(liveTierState({ tier_state: 'pro', tier_expires_at: null, verification_state: 'verified' }, NOW), 'pro');
  assert.equal(liveTierState(null, NOW), null);
});

const SEARCH_FILES = ['lib/wizard-recommendations.ts', 'app/dashboard/[eventId]/vendors/_actions/category-search.ts'];

for (const file of SEARCH_FILES) {
  const code = stripComments(readFileSync(file, 'utf8'));
  test(`${file}: every tier_state it selects is paired with tier_expires_at`, () => {
    const selects = [...code.matchAll(/\.select\(\s*'([^']*\btier_state\b[^']*)'/g)].map((m) => m[1]!);
    assert.ok(selects.length > 0, 'no tier_state select found — update this guard if the read moved');
    for (const cols of selects) {
      assert.match(cols, /\btier_expires_at\b/, `"${cols}" reads tier_state without its end day`);
    }
  });
  test(`${file}: the plan is passed on through liveTierState, never raw`, () => {
    assert.match(code, /liveTierState\(row, Date\.now\(\)\)/);
    assert.doesNotMatch(code, /tier(?:_state)?: row\.tier_state\b/, 'a raw tier_state is handed to the reach / name gates again');
  });
}
