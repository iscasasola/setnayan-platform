import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lifeFlashSummaryLine } from './life-story-summary-line';

/**
 * The guard for the sentence the owner actually read on switch-on day:
 * "14 moments · 0 people who made them".
 *
 * It asserts the PROPERTY (no count reaches the copy as a zero) over the whole
 * small grid, not one hand-picked pair — a single example passes for the wrong
 * reason as soon as somebody re-orders the template.
 */
test('no count ever reaches the copy as a zero', () => {
  const printedZero: string[] = [];
  for (let moments = 0; moments <= 4; moments++) {
    for (let people = 0; people <= 4; people++) {
      const line = lifeFlashSummaryLine(moments, people);
      if (/\b0\s+(person|people|moment|moments)\b/.test(line)) {
        printedZero.push(`m=${moments} p=${people} → "${line}"`);
      }
    }
  }
  assert.deepEqual(printedZero, [], `a zero reached the copy:\n${printedZero.join('\n')}`);
});

test('the people clause appears exactly when somebody is there', () => {
  assert.equal(
    lifeFlashSummaryLine(14, 0),
    '14 moments — gathered while you’re living them',
    'with nobody tagged the people clause must be absent, not zeroed',
  );
  assert.equal(
    lifeFlashSummaryLine(14, 3),
    '14 moments · 3 people who made them — gathered while you’re living them',
  );
});

test('singulars read as singulars', () => {
  assert.equal(
    lifeFlashSummaryLine(1, 1),
    '1 moment · 1 person who made them — gathered while you’re living them',
  );
});

test('no moments yet gets the invitation, never a count', () => {
  const line = lifeFlashSummaryLine(0, 0);
  assert.equal(line, 'Moments gather here live, from every celebration you’re part of.');
  assert.ok(!/\d/.test(line), 'the empty state must carry no number at all');
});
