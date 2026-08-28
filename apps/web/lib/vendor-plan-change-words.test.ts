import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planLines,
  moveSentence,
  planWord,
  pesos,
  termIsTooShort,
  termTooShortMessage,
  daysRemaining,
} from './vendor-plan-change-words';

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

// ───────────────────────────────────────────────────────────────────────────
// A purchase may never be shorter than the time you already hold.
//
// Owner 2026-08-27: *"they cannot purchase a smaller timeline. if they paid for
// a year. their purchase must cover the same timeline."*
//
// ⚠ These pin the PICKER's copy of the rule. The database is the gate; this
// only decides whether a button is offered, so nobody meets the refusal after
// choosing. The db test file holds the server half.
// ───────────────────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-08-28T00:00:00.000Z');
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

test('holding a year, a 28-day plan is refused and the yearly one is not', () => {
  const yearLeft = inDays(300);
  assert.equal(termIsTooShort(28, yearLeft, NOW), true, '28 days cannot cover 300');
  assert.equal(termIsTooShort(365, yearLeft, NOW), false, 'a year covers 300 days');
});

test('holding ten days, a 28-day plan is fine — 28 covers 10', () => {
  assert.equal(termIsTooShort(28, inDays(10), NOW), false);
});

test('BOUNDARY: a term exactly equal to the time left is ALLOWED', () => {
  // 🔑 The rule is "shorter than", never "shorter than or equal". A same-length
  // renewal is the commonest purchase there is; refusing it would be absurd,
  // and `<=` is the easy way to get this wrong.
  assert.equal(termIsTooShort(28, inDays(28), NOW), false, 'equal must pass');
  assert.equal(
    termIsTooShort(28, new Date(NOW + 28 * 86_400_000 + 3_600_000).toISOString(), NOW),
    true,
    'a term shorter than the time left must be refused',
  );
});

test('a lapsed or never-subscribed shop can buy any term', () => {
  // Falls out of the rule rather than needing a case of its own.
  assert.equal(termIsTooShort(28, null, NOW), false, 'never subscribed');
  assert.equal(termIsTooShort(28, inDays(-5), NOW), false, 'lapsed five days ago');
  assert.equal(daysRemaining(inDays(-5), NOW), 0);
  assert.equal(daysRemaining(null, NOW), 0);
});

test('days remaining rounds UP — a plan still running is never "0 days left"', () => {
  assert.equal(daysRemaining(new Date(NOW + 3_600_000).toISOString(), NOW), 1);
  assert.equal(daysRemaining(inDays(28), NOW), 28);
});

test('the refusal names the day and gives a way out', () => {
  const msg = termTooShortMessage('2027-06-14T05:00:00.000Z');
  assert.match(msg, /June/, 'a refusal without the date leaves nowhere to go');
  assert.match(msg, /2027/);
  assert.match(msg, /yearly plan/, 'it must say what to do instead');
  assert.ok(!/TERM_TOO_SHORT/.test(msg), 'a person must never read the raw code');
});

test('the refusal still reads as a sentence when the date is missing', () => {
  // The date is parsed out of a database error; if that ever fails the shop
  // must still get English, not a blank or the word "null".
  const msg = termTooShortMessage(null);
  assert.match(msg, /shorter than the time you already have/);
  assert.ok(!/undefined|null|NaN|Invalid/.test(msg));
});
