/**
 * Two owner rulings from 2026-08-20, pinned.
 *
 *   "yes keep it simple keeps it simple"
 *   "i think i already discussed this from another session" — on the milestone
 *   ladder, which is owner-locked at 1 · 7 · 18 (F) / 21 (M) · 60.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { effortLimit } from './onboarding/generic-plan';
import { birthdayWhoFromAge, GOLDEN_MIN_AGE } from './onboarding/birthday-who-from-age';
import { milestoneAges } from './event-anchor';

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const stripComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const WIZARD = 'app/onboarding/[type]/_components/generic-onboarding.tsx';

// ── "keep it simple keeps it simple" ───────────────────────────────────────
test('the finished plan is capped by the effort answer, not just the persona plan', () => {
  const src = stripComments(read(WIZARD));
  const block = /const finalPlan = useMemo\(\(\) => \{[\s\S]*?return \{ picks, labels \};/.exec(src)?.[0] ?? '';
  assert.ok(block.length > 0, 'the plan builder must exist');
  assert.match(block, /const limit = effortLimit\(axes\.effort\);/, 'the cap must come from the effort answer');
  assert.match(block, /picks\.length >= limit/, 'and it must actually stop the list');
});

test('a stated answer is never cut to honour a preference', () => {
  const src = stripComments(read(WIZARD));
  const block = /const finalPlan = useMemo\(\(\) => \{[\s\S]*?return \{ picks, labels \};/.exec(src)?.[0] ?? '';
  // Explicit answers take the slots first…
  assert.match(block, /\[\.\.\.extraPicks, \.\.\.plan\.picks\]/, 'stated choices must be considered first');
  // …and are exempt from the cap, so five stated choices all survive.
  assert.match(block, /!extraPicks\.includes\(id\)/, 'the cap must apply only to derived picks');
});

test('the three effort answers still mean three different sizes', () => {
  assert.equal(effortLimit('simple'), 4);
  assert.equal(effortLimit('balanced'), 6);
  assert.equal(effortLimit('allout'), 9);
  assert.ok(
    effortLimit('simple') < effortLimit('balanced') && effortLimit('balanced') < effortLimit('allout'),
    'simple must be smaller than balanced must be smaller than all out',
  );
});

// ── the milestone ladder is the settled one ────────────────────────────────
test('the golden option starts where the owner-locked ladder says: 60', () => {
  assert.equal(GOLDEN_MIN_AGE, 60);
  // Derived, not re-typed: 60 is the top rung of the ladder itself.
  for (const sex of ['female', 'male', null] as const) {
    assert.ok(
      milestoneAges(sex).includes(GOLDEN_MIN_AGE),
      `the golden floor must be a rung on the ${String(sex)} ladder`,
    );
  }
  assert.ok(!milestoneAges(null).includes(50), 'there is no 50 on the ladder');
});

test('the words on screen agree with the number in the code', () => {
  const src = read('lib/onboarding/type-questions.ts');
  assert.match(src, /A golden one \(60\+\)/, 'the option must say 60+');
  assert.doesNotMatch(src, /A golden one \(50\+\)/, 'the 50+ wording contradicted the ladder');
});

test('a 50-year-old is now an adult birthday, and 60 is the golden one', () => {
  assert.equal(birthdayWhoFromAge(50), 'adult');
  assert.equal(birthdayWhoFromAge(59), 'adult');
  assert.equal(birthdayWhoFromAge(60), 'golden');
  assert.equal(birthdayWhoFromAge(75), 'golden');
  // And the owner's own case is untouched by the move.
  assert.equal(birthdayWhoFromAge(40), 'adult');
});
