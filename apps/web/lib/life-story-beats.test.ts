/**
 * Life Story · beat compiler tests — the emotional arc as assertions.
 *
 * The load-bearing ones: the arc always ends on the present pointing forward
 * (owner-locked alive-framing), the ✦ hold only ever comes from an opt-in
 * flag, and the whole arc stays bounded (≤ MAX_BEATS). Run: pnpm test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Moment, MomentGraph, MomentPerson } from './life-story-types';
import { scoreMoments } from './life-story-significance';
import { compileBeats, MAX_BEATS, DWELL_MS } from './life-story-beats';

function person(id: string, over: Partial<MomentPerson> = {}): MomentPerson {
  return { personId: id, displayName: id.toUpperCase(), inMemoriam: false, recurrence: 1, ...over };
}

function moment(id: string, over: Partial<Moment> = {}): Moment {
  const peoplePresent = over.peoplePresent ?? [person('a')];
  return {
    id,
    eventId: 'e1',
    eventName: 'The wedding',
    eventType: 'wedding',
    eventDate: '2024-06-01',
    media: { sourceTable: 'papic_photos', sourceId: id, type: 'photo', r2Key: `k/${id}.jpg` },
    capturedAt: '2024-06-01T10:00:00Z',
    capturedBy: { kind: 'self', personId: 'viewer', displayName: 'Me' },
    peoplePresent,
    // Default: test people are high-trust (mirror peoplePresent) unless a case
    // overrides it to exercise the low-trust memoriam exclusion.
    peoplePresentHighTrust: over.peoplePresentHighTrust ?? peoplePresent,
    coverage: 1,
    clusterId: null,
    ...over,
  };
}

function graph(
  moments: Moment[],
  people: MomentPerson[],
  viewer: MomentGraph['viewer'] = { personId: 'viewer', birthDate: null },
): MomentGraph {
  const eventIds = [...new Set(moments.map((m) => m.eventId))];
  return {
    moments: scoreMoments(moments, { viewerBirthDate: viewer.birthDate }),
    people,
    events: eventIds.map((eventId) => ({
      eventId,
      eventName: 'Event',
      eventType: 'wedding',
      eventDate: '2024-06-01',
      heroImageUrl: null,
    })),
    viewer,
  };
}

test('opens on the most-recurring face', () => {
  const g = graph(
    [moment('m1')],
    [person('bea', { recurrence: 5 }), person('kiko', { recurrence: 2 })],
  );
  const beats = compileBeats(g);
  assert.equal(beats[0]!.kind, 'face_open');
  assert.equal((beats[0] as { person: MomentPerson }).person.personId, 'bea');
});

test('ALWAYS ends on present_forward — even for an empty graph', () => {
  const full = compileBeats(graph([moment('m1'), moment('m2')], [person('a')]));
  assert.equal(full.at(-1)!.kind, 'present_forward');

  const empty = compileBeats(graph([], []));
  assert.equal(empty.length, 1);
  assert.equal(empty[0]!.kind, 'present_forward');
  assert.equal((empty[0] as { moment: unknown }).moment, null);
});

test('present_forward anchors on the NEWEST moment, not the most significant', () => {
  const significant = moment('big', {
    capturedAt: '2020-01-01T10:00:00Z',
    peoplePresent: [person('a', { recurrence: 6 }), person('b'), person('c')],
    coverage: 5,
  });
  const newest = moment('recent', { capturedAt: '2026-05-01T10:00:00Z' });
  const beats = compileBeats(graph([significant, newest], [person('a')]));
  const ending = beats.at(-1)!;
  assert.equal(ending.kind, 'present_forward');
  assert.equal((ending as { moment: { id: string } }).moment.id, 'recent');
});

test('stays bounded at MAX_BEATS regardless of graph size', () => {
  const many = Array.from({ length: 40 }, (_, i) =>
    moment(`m${String(i).padStart(2, '0')}`, {
      capturedAt: `2024-06-01T10:${String(i % 60).padStart(2, '0')}:00Z`,
    }),
  );
  const beats = compileBeats(graph(many, [person('a')]));
  assert.ok(beats.length <= MAX_BEATS, `expected ≤${MAX_BEATS}, got ${beats.length}`);
  assert.equal(beats.at(-1)!.kind, 'present_forward');
});

test('perspective beat appears when a NAMED other capturer exists — and only then', () => {
  const throughBea = moment('m1', {
    capturedBy: { kind: 'papic_seat', personId: 'bea', displayName: 'Bea' },
  });
  const withPerspective = compileBeats(graph([throughBea, moment('m2')], [person('bea')]));
  const beat = withPerspective.find((b) => b.kind === 'perspective');
  assert.ok(beat, 'expected a perspective beat');
  assert.equal((beat as { moment: { id: string } }).moment.id, 'm1');

  // All self-shot → no perspective beat.
  const selfOnly = compileBeats(graph([moment('m3'), moment('m4')], [person('a')]));
  assert.ok(!selfOnly.some((b) => b.kind === 'perspective'));

  // Unclaimed seat (personId null) → degrades gracefully, no perspective beat.
  const unclaimed = moment('m5', {
    capturedBy: { kind: 'papic_seat', personId: null, displayName: null },
  });
  const anonymous = compileBeats(graph([unclaimed], [person('a')]));
  assert.ok(!anonymous.some((b) => b.kind === 'perspective'));

  // The viewer's own claimed person behind a seat is still 'self' in spirit.
  const viewerSeat = moment('m6', {
    capturedBy: { kind: 'papic_seat', personId: 'viewer', displayName: 'Me' },
  });
  const own = compileBeats(graph([viewerSeat], [person('a')]));
  assert.ok(!own.some((b) => b.kind === 'perspective'));
});

test('✦ memoriam_hold: only from an opt-in flag, gets the longest dwell, never synthesized', () => {
  const lola = person('lola', { inMemoriam: true, recurrence: 3 });
  const withLola = moment('m1', { peoplePresent: [lola] });
  const beats = compileBeats(graph([withLola, moment('m2')], [lola, person('a')]));
  const hold = beats.find((b) => b.kind === 'memoriam_hold');
  assert.ok(hold, 'expected a memoriam hold');
  assert.deepEqual((hold as { people: MomentPerson[] }).people.map((p) => p.personId), ['lola']);
  assert.equal((hold as { dwellMs: number }).dwellMs, DWELL_MS.memoriam);
  const maxOther = Math.max(
    ...beats.filter((b) => b.kind !== 'memoriam_hold' && b.dwellMs !== null).map((b) => b.dwellMs!),
  );
  assert.ok(DWELL_MS.memoriam >= maxOther, 'memoriam must hold longest');

  // No flagged person anywhere → no memoriam beat, full stop.
  const unflagged = compileBeats(graph([moment('m3'), moment('m4')], [person('a')]));
  assert.ok(!unflagged.some((b) => b.kind === 'memoriam_hold'));
});

test('✦ memoriam: a person present ONLY via a low-trust tag is NEVER memorialized', () => {
  const lolo = person('lolo', { inMemoriam: true, recurrence: 3 });
  // In the frame (table-QR fan-out / auto-face), but NOT high-trust → must not
  // be captioned "here". This is the dignity gate: no one is memorialized onto
  // a photo they aren't actually in.
  const m = moment('m1', { peoplePresent: [lolo], peoplePresentHighTrust: [] });
  const beats = compileBeats(graph([m, moment('m2')], [lolo, person('a')]));
  assert.ok(!beats.some((b) => b.kind === 'memoriam_hold'), 'no hold off a low-trust tag');
});

test('✦ memoriam: every remembered person is honored across frames (multiple deceased)', () => {
  const lola = person('lola', { inMemoriam: true, recurrence: 3 });
  const lolo = person('lolo', { inMemoriam: true, recurrence: 2 });
  const beats = compileBeats(
    graph(
      [moment('m1', { peoplePresent: [lola] }), moment('m2', { peoplePresent: [lolo] }), moment('m3')],
      [lola, lolo, person('a')],
    ),
  );
  const named = beats
    .filter((b) => b.kind === 'memoriam_hold')
    .flatMap((b) => (b as { people: MomentPerson[] }).people.map((p) => p.personId));
  assert.deepEqual(named.sort(), ['lola', 'lolo'], 'both remembered — nobody silently dropped');
});

test('✦ memoriam: two remembered people in one frame are honored together in one hold', () => {
  const lola = person('lola', { inMemoriam: true, recurrence: 3 });
  const lolo = person('lolo', { inMemoriam: true, recurrence: 3 });
  const beats = compileBeats(
    graph([moment('m1', { peoplePresent: [lola, lolo] }), moment('m2')], [lola, lolo, person('a')]),
  );
  const holds = beats.filter((b) => b.kind === 'memoriam_hold');
  assert.equal(holds.length, 1, 'one hold for the shared frame');
  assert.deepEqual(
    (holds[0] as { people: MomentPerson[] }).people.map((p) => p.personId).sort(),
    ['lola', 'lolo'],
  );
});

test('burst dedup: one middle beat per cluster', () => {
  const burst = ['b1', 'b2', 'b3'].map((id) => moment(id, { clusterId: 'burst-x' }));
  const solo = moment('solo');
  const beats = compileBeats(graph([...burst, solo], [person('a')]));
  const middleIds = beats.filter((b) => b.kind === 'moment').map((b) => b.moment.id);
  const fromBurst = middleIds.filter((id) => id.startsWith('b'));
  assert.equal(fromBurst.length, 1, `expected 1 from the burst, got ${fromBurst.length}`);
});

test('event breadth: a multi-event life does not collapse onto one event', () => {
  // e1 packed with high scorers, e2 with one modest moment.
  const e1Big = Array.from({ length: 6 }, (_, i) =>
    moment(`e1-${i}`, {
      peoplePresent: [person('a', { recurrence: 6 }), person('b'), person('c')],
      coverage: 4,
    }),
  );
  const e2Quiet = moment('e2-0', { eventId: 'e2', eventType: 'birthday' });
  const beats = compileBeats(graph([...e1Big, e2Quiet], [person('a')]));
  const middleEventIds = new Set(
    beats.filter((b) => b.kind === 'moment').map((b) => b.moment.eventId),
  );
  assert.ok(middleEventIds.size >= 2, 'middle beats should span ≥2 events when available');
});

test('reserved specials are not duplicated as plain middle beats', () => {
  const lola = person('lola', { inMemoriam: true });
  const special = moment('special', {
    peoplePresent: [lola],
    capturedBy: { kind: 'guest', personId: 'bea', displayName: 'Bea' },
  });
  const beats = compileBeats(graph([special, moment('m2'), moment('m3')], [lola]));
  const asMiddle = beats.filter((b) => b.kind === 'moment' && b.moment.id === 'special');
  assert.equal(asMiddle.length, 0);
});
