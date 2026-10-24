/**
 * GUARD — the Home Papic card's coverage line says the window in the prototype's words, on the venue's clock; a
 * window it cannot read says nothing (never a guessed date).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { papicCardPhase, papicCoverageWords } from './papic-home-card';

const start = '2026-12-10T16:00:00.000Z'; // Fri 11 Dec, Manila midnight
const end = '2026-12-13T04:00:00.000Z'; // Sun 13 Dec, 12 noon Manila

test('the words, exactly', () => {
  const before = papicCoverageWords({ startIso: start, endIso: end, now: Date.parse('2026-11-01T00:00:00Z') })!;
  assert.equal(before, 'Fri, Dec 11 → Sun, Dec 13, 12 noon');
  assert.match(papicCoverageWords({ startIso: start, endIso: end, now: Date.parse('2026-12-12T03:00:00Z') })!, /^Open now → Sun, Dec 13, 12 noon$/);
  assert.match(papicCoverageWords({ startIso: start, endIso: end, now: Date.parse('2026-12-14T00:00:00Z') })!, /^Closed Sun, Dec 13, 12 noon$/);
  assert.equal(papicCoverageWords({ startIso: start, endIso: end, now: 0, on: false }), 'Papic is off');
  assert.equal(papicCoverageWords({ startIso: null, endIso: end, now: 0 }), null);
  assert.equal(papicCardPhase('nope', end, 0), null);
});
