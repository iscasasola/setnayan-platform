/**
 * THE BOARD IS FIVE SHELVES (owner 2026-08-21).
 *
 *   Now happening · Planning · Worth planning · Untold · Told
 *
 * What is locked here, and why each one is worth a test:
 *
 *   • A celebration is on EXACTLY ONE shelf. The happening/planning/finished
 *     boundary is derived from two values (`event_date`, `event_end_date`) by
 *     two functions, and the failure mode when they disagree is a wedding that
 *     appears twice or vanishes — neither of which throws.
 *   • PUT AWAY MEANS HIDDEN FROM THE WHOLE BOARD. `isFinishedEvent` treats
 *     `archived` as finished, so before this work putting an event away moved
 *     it onto the finished shelf — visible, which is the opposite of what the
 *     person pressed the button for. The lift-out is what fixes that, and it
 *     must hold on every shelf, not just the one it was written for.
 *   • A clash names a real day. Warning about a day nobody has chosen, or about
 *     a celebration that has already happened, is worse than silence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  boardFinished,
  findDateClashes,
  isHappeningNow,
  splitEventBoard,
  splitPlanningShelves,
} from './event-board';
import type { EventWithRole } from './events';

function ev(
  over: Partial<EventWithRole> & { event_id: string },
): EventWithRole {
  return {
    public_id: `S89E-${over.event_id}`,
    event_type: 'wedding',
    display_name: over.display_name ?? over.event_id,
    event_date: over.event_date ?? null,
    is_primary: false,
    archived: over.archived ?? false,
    venue_name: null,
    venue_address: null,
    monogram_text: null,
    monogram_color: null,
    member_type: over.member_type ?? 'couple',
    ...over,
  } as EventWithRole;
}

/** The board split as the page does it, so the tests exercise the real seam. */
function board(events: EventWithRole[], todayISO: string) {
  const { comingUp, finished } = splitEventBoard(events, todayISO);
  return {
    ...splitPlanningShelves(comingUp, finished, todayISO),
    finishedShelf: boardFinished(finished),
  };
}

// ─── NOW HAPPENING ──────────────────────────────────────────────────────────

test('the day itself is happening now, and the day after it is not', () => {
  const e = ev({ event_id: 'a', event_date: '2026-08-21' });
  assert.equal(isHappeningNow(e, '2026-08-21'), true, 'the day itself');
  assert.equal(isHappeningNow(e, '2026-08-20'), false, 'the day before');
  assert.equal(isHappeningNow(e, '2026-08-22'), false, 'the day after');
});

test('a celebration that spans days is happening on every one of them', () => {
  // The reason `isHappeningNow` reads event_end_date rather than only the start:
  // a three-day reunion that showed as "now" on day one and disappeared on day
  // two would be at its least useful exactly when it is being lived.
  const e = ev({
    event_id: 'a',
    event_date: '2026-08-20',
    event_end_date: '2026-08-23',
  } as never);
  for (const day of ['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23']) {
    assert.equal(isHappeningNow(e, day), true, day);
  }
  assert.equal(isHappeningNow(e, '2026-08-24'), false, 'the morning after');
});

test('an undated celebration is never happening today', () => {
  // "Date to be set" is a real state. Reading it as today would put a
  // celebration nobody has scheduled in the loudest row on the board.
  assert.equal(
    isHappeningNow(ev({ event_id: 'a', event_date: null }), '2026-08-21'),
    false,
  );
});

test('a put-away celebration is never in the Now happening row', () => {
  const e = ev({ event_id: 'a', event_date: '2026-08-21', archived: true });
  assert.equal(isHappeningNow(e, '2026-08-21'), false);
});

// ─── ONE SHELF EACH ─────────────────────────────────────────────────────────

test('every celebration lands on exactly one shelf', () => {
  const events = [
    ev({ event_id: 'today', event_date: '2026-08-21' }),
    ev({ event_id: 'ahead', event_date: '2026-12-12' }),
    ev({ event_id: 'undated', event_date: null }),
    ev({ event_id: 'past', event_date: '2026-05-11' }),
  ];
  const b = board(events, '2026-08-21');
  const shelves = [
    ...b.happeningNow.map((e) => `now:${e.event_id}`),
    ...b.planning.map((e) => `planning:${e.event_id}`),
    ...b.finishedShelf.map((e) => `finished:${e.event_id}`),
  ];
  assert.deepEqual(shelves.sort(), [
    'finished:past',
    'now:today',
    'planning:ahead',
    'planning:undated',
  ]);
  assert.equal(shelves.length, events.length, 'none duplicated, none dropped');
});

// ─── PUT AWAY MEANS HIDDEN ──────────────────────────────────────────────────

test('a put-away celebration is on no shelf until it is asked for', () => {
  const events = [
    ev({ event_id: 'kept', event_date: '2026-12-12' }),
    ev({ event_id: 'hidden-ahead', event_date: '2026-12-24', archived: true }),
    ev({ event_id: 'hidden-past', event_date: '2026-05-11', archived: true }),
  ];
  const b = board(events, '2026-08-21');
  assert.deepEqual(b.planning.map((e) => e.event_id), ['kept']);
  assert.deepEqual(b.happeningNow, []);
  assert.deepEqual(
    b.finishedShelf.map((e) => e.event_id),
    [],
    'THE REGRESSION THIS FIXES: a put-away event used to surface here',
  );
  assert.deepEqual(
    b.putAway.map((e) => e.event_id).sort(),
    ['hidden-ahead', 'hidden-past'],
    'both recovered, whatever their date',
  );
});

test('a put-away celebration happening today is still put away', () => {
  // The loudest row on the board is not where a person's "hide this" is
  // overruled, however topical the day is.
  const b = board(
    [ev({ event_id: 'a', event_date: '2026-08-21', archived: true })],
    '2026-08-21',
  );
  assert.deepEqual(b.happeningNow, []);
  assert.deepEqual(b.putAway.map((e) => e.event_id), ['a']);
});

test('splitPlanningShelves lifts put-away rows out of its OWN input', () => {
  // ⚠ THIS TEST EXISTS BECAUSE THE COMPOSED PATH CANNOT REACH THE BRANCH.
  // `splitEventBoard` files an archived row as finished (via `isFinishedEvent`),
  // so no archived row ever arrives in `comingUp` today — and a mutation that
  // deletes the `!archived` filter therefore stays GREEN through the board.
  // Measured: removing it, 1 occurrence → 0, left all other tests passing.
  //
  // 🔑 THAT FILTER IS DELIBERATELY KEPT, AND SO IS THIS TEST. The whole point
  // of `splitPlanningShelves` is to stop depending on `isFinishedEvent`'s
  // opinion about `archived` — the day somebody changes that resolver (and
  // there is a live reason to: a put-away event that has NOT happened is not
  // finished), the coupling that makes the filter redundant disappears and the
  // filter is the only thing standing between that change and put-away
  // celebrations reappearing on the board. A guard whose premise may expire is
  // tested at its own boundary, not through the caller that currently masks it.
  const hidden = ev({ event_id: 'hidden', event_date: '2026-12-24', archived: true });
  const kept = ev({ event_id: 'kept', event_date: '2026-12-12' });
  const out = splitPlanningShelves([hidden, kept], [], '2026-08-21');
  assert.deepEqual(out.planning.map((e) => e.event_id), ['kept']);
  assert.deepEqual(out.putAway.map((e) => e.event_id), ['hidden']);
});

// ─── CLASHES ────────────────────────────────────────────────────────────────

test('two celebrations on one day are reported once, naming both', () => {
  const clashes = findDateClashes([
    ev({ event_id: 'a', display_name: 'Lolo Ben’s 80th', event_date: '2027-02-14' }),
    ev({ event_id: 'b', display_name: 'Mia turns 1', event_date: '2027-02-14' }),
  ]);
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0]!.dayISO, '2027-02-14');
  assert.deepEqual(clashes[0]!.names, ['Lolo Ben’s 80th', 'Mia turns 1']);
});

test('a celebration that swallows another day catches it', () => {
  // The range walk is the point: a reunion running Thu–Sun collides with a
  // birthday on the Saturday, which a start-date-only compare never sees.
  const clashes = findDateClashes([
    ev({
      event_id: 'a',
      display_name: 'Casasola reunion',
      event_date: '2027-04-01',
      event_end_date: '2027-04-04',
    } as never),
    ev({ event_id: 'b', display_name: 'Mia turns 1', event_date: '2027-04-03' }),
  ]);
  assert.equal(clashes.length, 1, 'one day collides, not four');
  assert.equal(clashes[0]!.dayISO, '2027-04-03');
});

test('nothing collides with itself, and undated days never collide', () => {
  assert.deepEqual(
    findDateClashes([ev({ event_id: 'a', event_date: '2027-02-14' })]),
    [],
    'one celebration is not a clash',
  );
  assert.deepEqual(
    findDateClashes([
      ev({ event_id: 'a', event_date: null }),
      ev({ event_id: 'b', event_date: null }),
    ]),
    [],
    'two celebrations with no date chosen are not a conflict',
  );
});

test('clashes come back in date order', () => {
  const clashes = findDateClashes([
    ev({ event_id: 'a', display_name: 'Later A', event_date: '2027-06-01' }),
    ev({ event_id: 'b', display_name: 'Later B', event_date: '2027-06-01' }),
    ev({ event_id: 'c', display_name: 'Sooner A', event_date: '2027-03-01' }),
    ev({ event_id: 'd', display_name: 'Sooner B', event_date: '2027-03-01' }),
  ]);
  assert.deepEqual(clashes.map((c) => c.dayISO), ['2027-03-01', '2027-06-01']);
});
