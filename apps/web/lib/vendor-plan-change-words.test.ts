import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLines, moveSentence, planWord, pesos } from './vendor-plan-change-words';

/**
 * The words a supplier reads about a plan change.
 *
 * A scheduled change is a promise about the future. These tests hold the three
 * things that promise has to contain — what you are on, what it becomes, and
 * WHEN — plus the rule that it is never made without a date, and that none of it
 * speaks in jargon.
 */

const OCT = '2026-10-19T05:00:00.000Z';

test('the plan sentence names the plan a supplier is on', () => {
  assert.equal(
    planLines({ currentTier: 'pro', pendingTier: null, tierExpiresAt: OCT, creditPhp: 0 }).now,
    'You are on Pro.',
  );
});

test('a scheduled change says what it becomes AND on what date', () => {
  const l = planLines({
    currentTier: 'pro',
    pendingTier: 'solo',
    tierExpiresAt: OCT,
    creditPhp: 0,
  });
  assert.ok(l.change, 'a scheduled change must be stated');
  assert.match(l.change!, /Solo/, 'it must name the plan it becomes');
  assert.match(l.change!, /2026/, 'it must name the date it lands');
  assert.match(l.change!, /Nothing changes before then/, 'it must say today is unaffected');
});

test('a change with no date is NOT promised at all', () => {
  // A promise with no due date is worse than silence — the reader cannot tell
  // whether it means today.
  const l = planLines({
    currentTier: 'pro',
    pendingTier: 'solo',
    tierExpiresAt: null,
    creditPhp: 0,
  });
  assert.equal(l.change, null);
});

test('held money is stated in pesos, as automatic, and as not expiring', () => {
  const l = planLines({
    currentTier: 'solo',
    pendingTier: null,
    tierExpiresAt: OCT,
    creditPhp: 1400,
  });
  assert.ok(l.credit);
  assert.match(l.credit!, /₱1,400/);
  assert.match(l.credit!, /automatically/);
  assert.match(l.credit!, /does not run out/);
});

test('no money, no sentence about money', () => {
  const l = planLines({
    currentTier: 'solo',
    pendingTier: null,
    tierExpiresAt: OCT,
    creditPhp: 0,
  });
  assert.equal(l.credit, null);
});

test('centavos show only when there are centavos', () => {
  // ₱1,857.14 is a real prorated figure; ₱1,000 should not read "₱1,000.00".
  assert.equal(pesos(1000), '₱1,000');
  assert.equal(pesos(1857.14), '₱1,857.14');
});

test('an upgrade promises TODAY and says the unused part comes off the price', () => {
  const s = moveSentence('upgrade', { toTier: 'pro', tierExpiresAt: OCT });
  assert.match(s, /as soon as we confirm your payment/);
  assert.match(s, /comes off the price/);
});

test('a downgrade promises the DATE and that nothing is lost before it', () => {
  const s = moveSentence('downgrade', { toTier: 'solo', tierExpiresAt: OCT });
  assert.match(s, /2026/, 'a deferred change is meaningless without its date');
  assert.match(s, /keep everything you are paying for until then/);
});

test('none of it speaks in jargon', () => {
  // ⚖ The owner steers this product and does not read the code. Words like
  // "proration", "tier" and "billing cycle" are the plumbing, not the point.
  const all = [
    planLines({ currentTier: 'pro', pendingTier: 'solo', tierExpiresAt: OCT, creditPhp: 1400 }),
  ]
    .flatMap((l) => [l.now, l.change, l.credit])
    .concat([
      moveSentence('upgrade', { toTier: 'pro', tierExpiresAt: OCT }),
      moveSentence('downgrade', { toTier: 'solo', tierExpiresAt: OCT }),
      moveSentence('renewal', { toTier: 'pro', tierExpiresAt: OCT }),
    ])
    .filter((s): s is string => typeof s === 'string')
    .join(' ')
    .toLowerCase();

  for (const banned of [
    'prorat',
    'tier',
    'billing cycle',
    'credit balance',
    'entitlement',
    'sku',
    'subscription_',
  ]) {
    assert.ok(!all.includes(banned), `the screen says "${banned}" — that is plumbing, not the point`);
  }
});

test('every plan has a name a person would recognise', () => {
  assert.equal(planWord('solo'), 'Solo');
  assert.equal(planWord('enterprise'), 'Enterprise');
  assert.equal(planWord('verified'), 'Free · Verified');
  // An unknown value must never render as a raw database word.
  assert.equal(planWord('some_future_tier'), 'Free');
  assert.equal(planWord(null), 'Free');
});
