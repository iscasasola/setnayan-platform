/**
 * home-two-loads-agree.test.ts — final check A2-P10 (25 Nov 2026, plan batch A-2).
 *
 * The staging walk saw Home say "4 things need you" on one load and "1 thing needs you · Nothing needs you" on another,
 * minutes apart, with nothing changed by the checker. Traced: the card's count and the "Needs you today" list are ONE
 * reader's (`buildEventToday` — `count = listCount + the strip`), and a part that could not load is a row that says so
 * ("Part of Today couldn’t load"), never "Nothing needs you". The two loads differed in the DATA (the copy's seed was
 * still writing that hour — its Event Hub figure moved too, 9 → 8 of 18), not in two readers.
 *
 * Held here so it stays that way: the same facts draw the same Home, byte for byte, and the card's figure is always
 * the list's own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureControl, fixtureControlUnread } from '@/lib/home-control-fixture';
import { eventTodayNeedWords } from '@/lib/event-today';
import { drawHome, loadHome } from './home-render.harness';

const NOW = Date.UTC(2026, 10, 25, 6, 55, 0);

test.before(loadHome);

test('one fixture, two loads: the same Home, byte for byte', () => {
  const a = drawHome({ control: fixtureControl('e1', {}, NOW) });
  const b = drawHome({ control: fixtureControl('e1', {}, NOW) });
  assert.equal(a, b);
  const u1 = drawHome({ control: fixtureControlUnread('e1') });
  const u2 = drawHome({ control: fixtureControlUnread('e1') });
  assert.equal(u1, u2);
});

test('a part that could not load is said, never "Nothing needs you"', () => {
  assert.deepEqual(eventTodayNeedWords({ count: 0, unread: true }), { figure: null, words: 'Part of Today couldn’t load' });
  assert.deepEqual(eventTodayNeedWords({ count: 0, unread: false }), { figure: null, words: 'Nothing needs you today' });
  assert.deepEqual(eventTodayNeedWords({ count: 4, unread: true }), { figure: '4 things', words: 'need you' });
  const unread = drawHome({ control: fixtureControlUnread('e1') });
  assert.doesNotMatch(unread, /Nothing needs you/, 'a refused read drew as calm');
});
