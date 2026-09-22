/**
 * The digest second-line predicate. Every "drop" case below is a REAL string this
 * panel renders today (traced to its assignment in event-dashboard.tsx), so the
 * test is an inventory of what actually disappears, not a set of invented inputs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { digestSubWorthShowing } from './digest-sub';
import { notBookedLabel } from './two-counts-two-names';

test('keeps a line carrying a reference the couple must quote', () => {
  assert.equal(digestSubWorthShowing('Order placed · ref A7K2QX'), true);
  assert.equal(digestSubWorthShowing('Ref: 8H2K9Q'), true);
  assert.equal(digestSubWorthShowing('reference ABCD1234'), true);
});

test('keeps a line carrying a date, in either register', () => {
  assert.equal(digestSubWorthShowing('Due 12 Dec'), true, 'day-first short');
  assert.equal(digestSubWorthShowing('Due 12 December 2026'), true, 'day-first long');
  assert.equal(digestSubWorthShowing('Due Dec 12'), true, 'month-first short');
  assert.equal(digestSubWorthShowing('Due December 12, 2026'), true, 'month-first long');
  assert.equal(digestSubWorthShowing('Locked 2026-12-12'), true, 'ISO');
});

test('drops the lines that only restate the row — every one of these ships today', () => {
  for (const sub of [
    'Order placed · payment pending',
    /*
      ⚠ GENERATED, NOT TYPED. The book group's sub used to be the literals
      '3 categories still open' / '1 category still open'. On 2026-09-22 it moved
      into `notBookedLabel` (two counts were sharing the word "open"), and a
      hand-typed fixture here would have kept asserting about a sentence the app
      can no longer produce — under a test title that says these ship TODAY.
      Reading it from the module is what makes the title true, and what makes a
      future rewording arrive here on its own instead of silently bypassing this
      drop and printing the count twice on the panel.
    */
    notBookedLabel(3, 25),
    notBookedLabel(1, 25),
    notBookedLabel(1, 1),
    notBookedLabel(4, 0),
    notBookedLabel(0, 25),
    notBookedLabel(0, 0),
    'Saved options waiting on a lock',
    '1 waiting',
    '4 waiting',
    'Key people your ceremony needs',
  ]) {
    assert.equal(digestSubWorthShowing(sub), false, `should drop: ${sub}`);
  }
});

test('the lines this panel USED to render are still dropped — history, not fixture rot', () => {
  /*
    Kept deliberately, and labelled as history so nobody reads them as current
    copy: an old row cached in a rendered payload must not start reappearing.
  */
  for (const sub of ['3 categories still open', '1 category still open']) {
    assert.equal(digestSubWorthShowing(sub), false, `should still drop: ${sub}`);
  }
});

test('🪤 a bare month WORD is not a date — a number must sit beside it', () => {
  // "May" is a verb and "March" is a noun. A month-word match alone would keep
  // ordinary prose forever, and the drop would silently stop happening.
  assert.equal(digestSubWorthShowing('You may need to confirm this'), false);
  assert.equal(digestSubWorthShowing('The march of the season'), false);
  assert.equal(digestSubWorthShowing('Saved options waiting on a lock'), false);
  // …but the moment a number joins it, it is a date again.
  assert.equal(digestSubWorthShowing('Confirm by May 3'), true);
});

test('🪤 the WORD "reference" without a code is prose, not a reference', () => {
  assert.equal(digestSubWorthShowing('Please reference your order'), false);
  assert.equal(digestSubWorthShowing('ref'), false);
});

test('empty, blank and missing all drop', () => {
  assert.equal(digestSubWorthShowing(''), false);
  assert.equal(digestSubWorthShowing('   '), false);
  assert.equal(digestSubWorthShowing(null), false);
  assert.equal(digestSubWorthShowing(undefined), false);
});
