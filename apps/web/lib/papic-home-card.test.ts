/**
 * GUARD — the Papic card's window words say the window in the controller's words, on the venue's clock; a window they
 * cannot read says nothing (never a guessed date), and the phase is told before / live / after exactly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { papicCardPhase, papicDayWords, papicSpanWords } from './papic-home-card';

const start = '2026-12-10T16:00:00.000Z'; // Fri 11 Dec, Manila midnight
const end = '2026-12-13T04:00:00.000Z'; // Sun 13 Dec, 12 noon Manila

test('the words, exactly', () => {
  assert.equal(papicSpanWords(start, end), 'Fri, Dec 11 → Sun, Dec 13, 12 noon');
  assert.equal(papicDayWords(start), 'Fri, Dec 11');
  assert.equal(papicSpanWords(null, end), null);
  assert.equal(papicDayWords('nope'), null);
});

test('the phase', () => {
  assert.equal(papicCardPhase(start, end, Date.parse('2026-11-01T00:00:00Z')), 'before');
  assert.equal(papicCardPhase(start, end, Date.parse('2026-12-12T03:00:00Z')), 'live');
  assert.equal(papicCardPhase(start, end, Date.parse('2026-12-14T00:00:00Z')), 'after');
  assert.equal(papicCardPhase('nope', end, 0), null);
});
