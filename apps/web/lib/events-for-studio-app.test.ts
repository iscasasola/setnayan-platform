/**
 * events-for-studio-app.test.ts — the picker offers only celebrations you
 * organise, that have not happened yet, and that can actually use the service.
 *
 * Owner, 2026-08-21: *"they get to pick which event (but only show events that
 * is compatible to this) and the event should be on the ongoing and upcoming
 * only."* Each of those two clauses is a test below, plus the third gate the
 * ruling assumes without saying — that it is your celebration to change.
 *
 * The interesting cases are the ones where the obvious implementation is wrong:
 * a celebration ON its own day, a multi-day one mid-run, one with no date yet,
 * and an event whose type we could not read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { eventsForStudioApp, emptyPickerReason, type PickableEvent } from './events-for-studio-app';
import type { EventTypeProfile } from './event-type-profile';

const TODAY = '2026-08-21';

const profile = (surfaces: string[]): EventTypeProfile =>
  ({ enabledSurfaces: surfaces } as unknown as EventTypeProfile);

const ev = (over: Partial<PickableEvent> = {}): PickableEvent => ({
  eventId: 'e1',
  title: 'A celebration',
  eventDate: '2026-12-12',
  memberType: 'couple',
  profile: profile(['monogram', 'gallery', 'website']),
  ...over,
});

const MONOGRAM = { surface: 'monogram' } as const;   // wedding-only, like Logo Maker
const UNIVERSAL = {} as const;                        // no surface — anything can use it

const ids = (r: { pickable: PickableEvent[] }) => r.pickable.map((e) => e.eventId);
const why = (r: { rejected: ReadonlyArray<{ eventId: string; reason: string }> }, id: string) =>
  r.rejected.find((x) => x.eventId === id)?.reason;

test('a compatible, upcoming celebration you organise is offered', () => {
  const r = eventsForStudioApp(MONOGRAM, [ev()], TODAY);
  assert.deepEqual(ids(r), ['e1']);
  assert.equal(r.unchecked, 0);
  assert.equal(emptyPickerReason(r), null);
});

test('“ongoing and upcoming only” — a finished celebration is not offered', () => {
  const r = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'past', eventDate: '2026-08-20' })],
    TODAY,
  );
  assert.deepEqual(ids(r), []);
  assert.equal(why(r, 'past'), 'finished');
});

test('ONGOING means today still counts — a celebration on its own day is offered', () => {
  const r = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'today', eventDate: TODAY })],
    TODAY,
  );
  assert.deepEqual(ids(r), ['today'], 'a wedding happening today has not finished');
});

test('a multi-day celebration is offered until its LAST day has passed', () => {
  const spans = { eventId: 'span', eventDate: '2026-08-19', eventEndDate: '2026-08-23' };
  assert.deepEqual(
    ids(eventsForStudioApp(MONOGRAM, [ev(spans)], TODAY)),
    ['span'],
    'still running on the 21st',
  );
  assert.deepEqual(
    ids(eventsForStudioApp(MONOGRAM, [ev(spans)], '2026-08-24')),
    [],
    'over on the 24th',
  );
});

test('a celebration with no date yet IS offered — you can plan before you pick a day', () => {
  const r = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'undated', eventDate: null })],
    TODAY,
  );
  assert.deepEqual(ids(r), ['undated']);
});

test('an archived celebration is never offered, whatever its date says', () => {
  const r = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'arch', eventDate: '2027-01-01', archived: true })],
    TODAY,
  );
  assert.equal(why(r, 'arch'), 'finished');
});

test('“only compatible” — a type without the surface is not offered', () => {
  const r = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'bday', profile: profile(['gallery', 'website']) })],
    TODAY,
  );
  assert.deepEqual(ids(r), [], 'a birthday cannot take a wedding-only service');
  assert.equal(why(r, 'bday'), 'incompatible');
});

test('a service with no surface is offered to every otherwise-eligible celebration', () => {
  const r = eventsForStudioApp(
    UNIVERSAL,
    [ev({ eventId: 'bday', profile: profile([]) })],
    TODAY,
  );
  assert.deepEqual(ids(r), ['bday']);
});

test('being INVITED to a celebration is not permission to add a service to it', () => {
  const r = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'theirs', memberType: 'guest' })],
    TODAY,
  );
  assert.deepEqual(ids(r), []);
  assert.equal(why(r, 'theirs'), 'not-organiser');
});

test('an unreadable event type FAILS CLOSED and is reported as unchecked', () => {
  const r = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'mystery', profile: null })],
    TODAY,
  );
  assert.deepEqual(ids(r), [], 'never offer a destination we cannot confirm');
  assert.equal(why(r, 'mystery'), 'unknown-type');
  assert.equal(r.unchecked, 1);
});

test('an empty list never tells a person the same thing for two different reasons', () => {
  const noEvents = eventsForStudioApp(MONOGRAM, [], TODAY);
  const allPast = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'p', eventDate: '2020-01-01' })],
    TODAY,
  );
  const allUnreadable = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'm', profile: null })],
    TODAY,
  );
  const incompatible = eventsForStudioApp(
    MONOGRAM,
    [ev({ eventId: 'b', profile: profile(['gallery']) })],
    TODAY,
  );

  const said = [noEvents, allPast, allUnreadable, incompatible].map(emptyPickerReason);
  assert.equal(new Set(said).size, 4, `four situations, four sentences — got ${JSON.stringify(said)}`);
  assert.match(
    String(emptyPickerReason(allUnreadable)),
    /couldn’t check/,
    'a failed read must never be reported as "you have no celebrations"',
  );
});

test('order is preserved and mixed lists split correctly', () => {
  const r = eventsForStudioApp(
    MONOGRAM,
    [
      ev({ eventId: 'a' }),
      ev({ eventId: 'past', eventDate: '2020-01-01' }),
      ev({ eventId: 'b' }),
      ev({ eventId: 'guest', memberType: 'guest' }),
      ev({ eventId: 'c', profile: profile(['gallery']) }),
    ],
    TODAY,
  );
  assert.deepEqual(ids(r), ['a', 'b']);
  assert.equal(r.rejected.length, 3);
  assert.equal(r.unchecked, 0);
});
