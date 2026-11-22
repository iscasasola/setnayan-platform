/**
 * today-wrap-up.test.ts — ✓ THE WRAP-UP RULES (Today v3 part 3, owner 19 Nov 2026, drawing V3 · 1).
 *   1 · the card only when the event has photos or reviews — else v2's quick row; an unread read is not "nothing";
 *   2 · silence = accepted only after the owner's days; not set → a photo waits; Hide is the couple's story only;
 *   3 · only this event's own photos go out, once each;
 *   4 · the count line names the Inspiration share only when there is one.
 * SABOTAGE (each seen red once, 2026-11-19): `||` → `&&` in wrapUpApplies → 1 red · silence null treated as 0 → 2 red ·
 * the `mine.has` filter dropped → 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { storyShareState, wrapUpApplies, wrapUpCountLine, wrapUpSelection } from './today-wrap-up';

test('1 · the wrap-up card only with photos or reviews', () => {
  const photo = { fileId: 'a', url: 'u', serviceTitle: null };
  const review = { reviewId: 'r', name: 'G.', rating: 5, line: null, replied: false };
  assert.equal(wrapUpApplies({ photos: [photo], reviews: [] }), true);
  assert.equal(wrapUpApplies({ photos: [], reviews: [review] }), true);
  assert.equal(wrapUpApplies({ photos: [], reviews: [] }), false, 'an event with nothing to check lost its quick row');
  assert.equal(wrapUpApplies(null), false, 'an unread read drew a wrap-up card');
});

test('2 · silence is accepted only after the owner’s days; Hide stays hidden', () => {
  const now = Date.parse('2026-11-19T00:00:00Z');
  const at = (days: number) => new Date(now - days * 86_400_000).toISOString();
  assert.equal(storyShareState({ couple_decision: 'waiting', shared_at: at(8) }, now, 7), 'accepted');
  assert.equal(storyShareState({ couple_decision: 'waiting', shared_at: at(6) }, now, 7), 'waiting');
  assert.equal(storyShareState({ couple_decision: 'waiting', shared_at: at(300) }, now, null), 'waiting', 'a photo was accepted on a guessed number');
  assert.equal(storyShareState({ couple_decision: 'hidden', shared_at: at(300) }, now, 7), 'hidden');
  assert.equal(storyShareState({ couple_decision: 'approved', shared_at: at(0) }, now, null), 'accepted');
});

test('3 · only this event’s own photos go out, once each', () => {
  assert.deepEqual(wrapUpSelection(['a', 'b'], ['b', 'b', 'z', 'a']), ['b', 'a']);
});

test('4 · the count line', () => {
  assert.equal(wrapUpCountLine(8, 2), '8 for this event · 2 also to Inspiration');
  assert.equal(wrapUpCountLine(9, 0), '9 for this event');
});
