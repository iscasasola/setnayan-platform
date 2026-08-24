/**
 * two-shelves-cannot-both-hold-it.test.ts — a guard that COMPARES TWO SURFACES
 * instead of checking one.
 *
 * ─── WHY THIS SHAPE ─────────────────────────────────────────────────────────
 * Owner, 2026-08-24, after finding three defects on the first screen: *"~70
 * changes shipped in two days, all tested, with these sitting on the first
 * screen. No test asks whether a screen contradicts the screen beside it. If you
 * can express any of these as a guard that compares two surfaces rather than
 * checking one, that is worth more than the fix."*
 *
 * The My Events board derives its shelves TWICE, from one set of events:
 *   · `splitEventBoard()`      → the cards under Planning / Ended
 *   · `buildYearMoments()` + `worthPlanningMoments()` → the "Worth planning" rows
 *
 * Each was correct about its own question and they contradicted each other on
 * screen: a wedding sat in Planning as a card AND re-listed itself under "Worth
 * planning" with an "Open plan" button — a shelf whose whole premise (owner
 * ruling, `DECISION_LOG.md` 2026-08-21 / PR #4678) is that it holds days that do
 * NOT exist as events.
 *
 * 🔑 THE INVARIANT IS BETWEEN THE TWO, WHICH IS WHY NEITHER SURFACE'S OWN TESTS
 * COULD HOLD IT: no celebration may be a CARD and have its OWN DAY on the shelf
 * at the same time.
 *
 * 🔑 AND THE COLLISION IS COMPUTED HERE INDEPENDENTLY — by comparing each
 * moment's date against the source event's own date — NOT by calling
 * `momentIsEventOwnDay`. A guard that asks the rule whether the rule is right
 * agrees with it by construction, including when the rule is wrong. This one
 * caught exactly that: the first predicate was a hand-written list of kinds
 * (`'wedding' || 'recurring'`), which both over-dropped and would have missed
 * any future kind.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { splitEventBoard } from '@/lib/event-board';
import type { EventWithRole } from '@/lib/events';
import { buildYearMoments, worthPlanningMoments, type MomentEvent } from '@/lib/year-moments';

const TODAY = '2026-08-24';

/**
 * One row that satisfies BOTH surfaces — the point is that they see the same
 * events. ⚠ The two surfaces type their input differently: `EventWithRole` has
 * no recurrence fields and `MomentEvent` has no `member_type`, so the fixture is
 * the INTERSECTION. Typing it as either one alone silently drops the fields the
 * other reads, and the test would then exercise a board and a shelf looking at
 * two different sets of facts — which is the very thing it exists to catch.
 */
type BoardAndYearRow = EventWithRole & MomentEvent;

function ev(over: Partial<BoardAndYearRow> & { event_id: string }): BoardAndYearRow {
  return {
    event_type: 'wedding',
    display_name: 'An event',
    event_date: null,
    anchor_date: null,
    anchor_origin: null,
    recurs: false,
    recur_cadence: null,
    archived: false,
    member_type: 'couple',
    ...over,
  } as BoardAndYearRow;
}

/** The owner's real board, 2026-08-24 (prod), plus a past wedding for the floor. */
const EVENTS: BoardAndYearRow[] = [
  ev({ event_id: 'wed-upcoming', display_name: 'Cale & Ice', event_date: '2026-12-18' }),
  ev({ event_id: 'wed-other', display_name: 'Maria & Jose', event_date: '2026-12-12' }),
  // A past evening that repeats: its NEXT occurrence is a day that does not exist.
  ev({
    event_id: 'movie-night',
    event_type: 'date',
    display_name: 'Movie Night',
    event_date: '2026-08-20',
    recurs: true,
    recur_cadence: 'annual',
  }),
  // A PAST anniversary row whose next occurrence is a different day.
  // ⚠ Its `event_date` must be in the PAST and NOT equal the next occurrence.
  // The first draft of this fixture dated it 2026-10-01 — the very day the
  // anniversary next falls on — which makes it the event's OWN day and is
  // correctly dropped. That fixture was wrong, not the code, and it is worth
  // saying so: when a recurring row's date IS the upcoming occurrence, the
  // event already has a card and the shelf must not re-list it.
  ev({
    event_id: 'anniv',
    event_type: 'anniversary',
    display_name: 'Nanay & Tatay',
    event_date: '2023-10-01',
    anchor_date: '1998-10-01',
    anchor_origin: 'wedding',
    recurs: true,
  }),
];

function surfaces() {
  const board = splitEventBoard(EVENTS, TODAY);
  const carded = new Set([...board.comingUp, ...board.finished].map((e) => e.event_id));
  const all = buildYearMoments(EVENTS, TODAY, { includeHolidays: false });
  return { board, carded, all, shelf: worthPlanningMoments(all) };
}

test('the fixture actually exercises the rule — both surfaces see the same events', () => {
  const { carded, all } = surfaces();
  assert.ok(carded.has('wed-upcoming'), 'the upcoming wedding must have a card');
  assert.ok(carded.has('movie-night'), 'the finished evening must have a card');
  assert.ok(
    all.some((m) => m.eventId === 'wed-upcoming'),
    'the year must produce a moment for the wedding, or this test proves nothing',
  );
  assert.ok(
    all.some((m) => m.eventId === 'movie-night'),
    'and one for the recurring evening',
  );
});

test('NO celebration is a card AND has its own day on the Worth-planning shelf', () => {
  const { carded, shelf } = surfaces();
  const ownDate = new Map(EVENTS.map((e) => [e.event_id, e.event_date]));

  // Computed independently of `momentIsEventOwnDay` — see the docblock.
  const contradictions = shelf
    .filter((m) => m.eventId != null && carded.has(m.eventId))
    .filter((m) => ownDate.get(m.eventId as string) === m.dateISO)
    .map((m) => `${m.label} (${m.dateISO})`);

  assert.deepEqual(
    contradictions,
    [],
    'a celebration is on two shelves at once: it has a card AND re-lists its own ' +
      'day under "Worth planning", which holds days that do not exist as events',
  );
});

test('FLOOR — derived days SURVIVE, so the invariant cannot be met by emptying the shelf', () => {
  const { shelf } = surfaces();
  // A past event that repeats: next year's occurrence is NOT its own day.
  const movie = shelf.find((m) => m.eventId === 'movie-night');
  assert.ok(
    movie,
    'the recurring evening\'s NEXT occurrence was swept off the shelf — that ' +
      'deletes the reminder the shelf exists for, not the duplication',
  );
  assert.notEqual(
    movie?.dateISO,
    '2026-08-20',
    'and it must be the NEXT occurrence, not the day that already happened',
  );
  assert.ok(
    shelf.some((m) => m.eventId === 'anniv'),
    'the anniversary of an existing marriage is a derived day and must stay',
  );
});

test('the guard would FAIL if either surface changed alone', () => {
  // The invariant is a relationship, so prove it is sensitive to the shelf side:
  // an unfiltered shelf must contradict the board.
  const { carded, all } = surfaces();
  const ownDate = new Map(EVENTS.map((e) => [e.event_id, e.event_date]));
  const unfiltered = all
    .filter((m) => m.eventId != null && carded.has(m.eventId))
    .filter((m) => ownDate.get(m.eventId as string) === m.dateISO);
  assert.ok(
    unfiltered.length > 0,
    'with the filter removed the two surfaces MUST collide — if they do not, this ' +
      'guard is decoration and would pass with the shelf unfiltered',
  );
});
