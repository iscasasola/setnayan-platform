/**
 * Guard — a story cannot be told before the day happens.
 *
 * Owner 2026-08-21: the story unlocks only after the celebration, and it lives
 * on the **Untold** shelf — the one a card lands on when it leaves *Coming up*.
 * So the gate must agree with the board, always.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { storyGate } from './story-opens-when-untold';
import { isFinishedEvent, manilaTodayISO } from './event-board';

/** A fixed instant so the suite cannot drift with the calendar. */
const NOW = new Date('2026-12-20T02:00:00Z'); // 10:00 in Manila, 20 Dec

test('a celebration still to come is closed', () => {
  const g = storyGate({ event_date: '2026-12-25' }, NOW);
  assert.equal(g.open, false);
  if (!g.open) assert.equal(g.opensAfter, '2026-12-25');
});

test('a celebration that has passed is open', () => {
  assert.equal(storyGate({ event_date: '2026-12-18' }, NOW).open, true);
});

test('a multi-day celebration is not open on its first morning', () => {
  // Started the 19th, runs to the 22nd. Today is the 20th — still happening.
  assert.equal(
    storyGate({ event_date: '2026-12-19', event_end_date: '2026-12-22' }, NOW).open,
    false,
    'a celebration still running had its story opened — the day is not over',
  );
});

test('a dateless celebration is open, never a wait with no end', () => {
  // Prod carries these. Refusing would be a door that never opens.
  assert.equal(storyGate({ event_date: null }, NOW).open, true);
});

test('a put-away celebration is open', () => {
  assert.equal(
    storyGate({ event_date: '2026-12-25', archived: true }, NOW).open,
    true,
    'somebody who put a celebration away has finished with it either way',
  );
});

test('THE GATE AND THE BOARD NEVER DISAGREE', () => {
  /*
    🔑 The load-bearing one. The story is reached from the Untold shelf, so if
    this gate and `isFinishedEvent` ever diverge, a card sits on Untold while the
    story says "not yet" — or worse, the other way round. Both must answer the
    same question the same way, on the same PH-local day.
  */
  const today = manilaTodayISO(NOW);
  const cases = [
    { event_date: '2026-12-18', archived: false },
    { event_date: '2026-12-25', archived: false },
    { event_date: '2026-12-19', event_end_date: '2026-12-22', archived: false },
    { event_date: '2026-12-25', archived: true },
  ];
  for (const c of cases) {
    assert.equal(
      storyGate(c, NOW).open,
      isFinishedEvent(c as Parameters<typeof isFinishedEvent>[0], today),
      `the gate disagrees with the board for ${JSON.stringify(c)} — a card ` +
        'would sit on Untold with its story refused',
    );
  }
});

test('the PH-local day decides, not the server clock', () => {
  /*
    ⚠ 16:30 UTC on 18 Dec is already 00:30 on the 19th in Manila. A wedding on
    the 18th IS over for the couple, and a UTC comparison would refuse them their
    story for another seven and a half hours — the morning they are most likely
    to look.
  */
  const manilaJustPastMidnight = new Date('2026-12-18T16:30:00Z');
  assert.equal(
    storyGate({ event_date: '2026-12-18' }, manilaJustPastMidnight).open,
    true,
    'the story was refused on the morning after, because the server clock is UTC',
  );
});
