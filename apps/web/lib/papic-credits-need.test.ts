/**
 * GUARD — "How many do I need?" (owner 2026-10-23): guests coming × the per-guest numbers that exist − credits left,
 * and the stepper lands on the smallest rung that covers it. A failed read is never a zero, and the helper ASKS for a
 * per-guest number rather than inventing one (owner rule on money: "don't guess").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditNeed, needWords, rungFor } from './papic-credits-need';

const rungs = [{ points: 100 }, { points: 500 }, { points: 1000 }, { points: 5000 }];

test('a failed head count or balance is "unread", never a zero', () => {
  assert.deepEqual(creditNeed({ guestsComing: null, named: [], everyoneElse: 10 }, 50, null), { kind: 'unread' });
  assert.deepEqual(creditNeed({ guestsComing: 40, named: [], everyoneElse: 10 }, null, null), { kind: 'unread' });
});

test('asks "How many photos each?" when the rest have no number — it never supplies one', () => {
  assert.deepEqual(creditNeed({ guestsComing: 40, named: [30, 30], everyoneElse: null }, 0, null), { kind: 'ask', rest: 38 });
});

test('named numbers + the couple’s number for everyone else − what is left', () => {
  // 2 named at 30 + 38 × 10 = 440; 100 left → 340 more.
  assert.deepEqual(creditNeed({ guestsComing: 40, named: [30, 30], everyoneElse: 10 }, 100, null), {
    kind: 'need',
    total: 440,
    more: 340,
    guests: 40,
  });
});

test('the typed per-guest number is used only when no stored one exists', () => {
  const typed = creditNeed({ guestsComing: 10, named: [], everyoneElse: null }, 0, 20);
  assert.equal(typed.kind === 'need' && typed.total, 200);
  const stored = creditNeed({ guestsComing: 10, named: [], everyoneElse: 5 }, 0, 20);
  assert.equal(stored.kind === 'need' && stored.total, 50);
});

test('everyone named needs no ask; enough left says it covers it', () => {
  const n = creditNeed({ guestsComing: 2, named: [10, 10], everyoneElse: null }, 50, null);
  assert.equal(n.kind, 'need');
  assert.equal(n.kind === 'need' && n.more, 0);
  assert.equal(n.kind === 'need' && needWords(n), 'What you have covers it');
});

test('the smallest rung that covers it; above the top lands on the top and says so', () => {
  assert.deepEqual(rungFor(rungs, 340), { index: 1, above: false });
  assert.deepEqual(rungFor(rungs, 500), { index: 1, above: false });
  assert.deepEqual(rungFor(rungs, 0), { index: 0, above: false });
  assert.deepEqual(rungFor(rungs, 9000), { index: 3, above: true });
});
