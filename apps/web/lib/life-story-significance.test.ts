/**
 * Life Story · significance engine tests.
 *
 * These pin ORDERING behavior (what outranks what) and the caps/bonus
 * mechanics — not exact float values — so the weights stay tunable without
 * rewriting the suite. Run: pnpm test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Moment, MomentPerson } from './life-story-types';
import {
  SIGNIFICANCE_WEIGHTS,
  REMINISCENCE_BUMP_BONUS,
  EVENT_TYPE_WEIGHTS,
  DEFAULT_EVENT_TYPE_WEIGHT,
  PEOPLE_PRESENT_CAP,
  ageAtEvent,
  scoreMoment,
  scoreMoments,
} from './life-story-significance';

const CTX = { viewerBirthDate: null };

function person(id: string, over: Partial<MomentPerson> = {}): MomentPerson {
  return { personId: id, displayName: id.toUpperCase(), inMemoriam: false, recurrence: 1, ...over };
}

function moment(id: string, over: Partial<Moment> = {}): Moment {
  return {
    id,
    eventId: 'e1',
    eventName: 'The wedding',
    eventType: 'wedding',
    eventDate: '2024-06-01',
    media: { sourceTable: 'papic_photos', sourceId: id, type: 'photo', r2Key: `k/${id}.jpg` },
    capturedAt: '2024-06-01T10:00:00Z',
    capturedBy: { kind: 'self', personId: 'me', displayName: 'Me' },
    peoplePresent: over.peoplePresent ?? [person('a')],
    peoplePresentHighTrust: over.peoplePresentHighTrust ?? over.peoplePresent ?? [person('a')],
    coverage: 1,
    clusterId: null,
    ...over,
  };
}

test('weights sum to 1.0 (bump rides on top as a bounded bonus)', () => {
  const sum = Object.values(SIGNIFICANCE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights sum to ${sum}, expected 1.0`);
});

test('a moment with an in-memoriam person outranks the identical moment without', () => {
  const plain = moment('m1');
  const remembered = moment('m2', { peoplePresent: [person('a', { inMemoriam: true })] });
  assert.ok(scoreMoment(remembered, CTX) > scoreMoment(plain, CTX));
});

test('higher cross-event recurrence of the people present outranks lower', () => {
  const regulars = moment('m1', { peoplePresent: [person('a', { recurrence: 6 })] });
  const stranger = moment('m2', { peoplePresent: [person('b', { recurrence: 1 })] });
  assert.ok(scoreMoment(regulars, CTX) > scoreMoment(stranger, CTX));
});

test('people-present signal caps: a mob scores the same as a full room', () => {
  const atCap = moment('m1', {
    peoplePresent: Array.from({ length: PEOPLE_PRESENT_CAP }, (_, i) => person(`p${i}`)),
  });
  const overCap = moment('m2', {
    peoplePresent: Array.from({ length: PEOPLE_PRESENT_CAP + 12 }, (_, i) => person(`p${i}`)),
  });
  assert.equal(scoreMoment(atCap, CTX), scoreMoment(overCap, CTX));
});

test('event-type prior: wedding outranks birthday; unknown types take the default weight', () => {
  const kasal = moment('m1', { eventType: 'wedding' });
  const birthday = moment('m2', { eventType: 'birthday' });
  assert.ok(scoreMoment(kasal, CTX) > scoreMoment(birthday, CTX));

  // 'reunion' is tuned exactly at the default weight — an unknown type must land there too.
  assert.equal(EVENT_TYPE_WEIGHTS['reunion'], DEFAULT_EVENT_TYPE_WEIGHT);
  const unknown = moment('m3', { eventType: 'zombie_prom' });
  const reunion = moment('m4', { eventType: 'reunion' });
  assert.equal(scoreMoment(unknown, CTX), scoreMoment(reunion, CTX));
});

test('reminiscence bump: applies only in the 10–30 age window, only with a birth date', () => {
  const m = moment('m1', { eventDate: '2024-06-01' });
  const base = scoreMoment(m, { viewerBirthDate: null });

  // age 24 at event — in window
  const inWindow = scoreMoment(m, { viewerBirthDate: '2000-01-01' });
  assert.ok(Math.abs(inWindow - (base + REMINISCENCE_BUMP_BONUS)) < 1e-9);

  // age 44 at event — out of window
  const tooOld = scoreMoment(m, { viewerBirthDate: '1980-01-01' });
  assert.equal(tooOld, base);

  // age 8 at event — out of window
  const tooYoung = scoreMoment(m, { viewerBirthDate: '2016-01-01' });
  assert.equal(tooYoung, base);

  // unparseable birth date degrades silently
  const garbage = scoreMoment(m, { viewerBirthDate: 'not-a-date' });
  assert.equal(garbage, base);
});

test('ageAtEvent handles the not-yet-birthday boundary', () => {
  assert.equal(ageAtEvent('2024-06-01', '2000-06-02'), 23); // birthday tomorrow
  assert.equal(ageAtEvent('2024-06-01', '2000-06-01'), 24); // birthday today
  assert.equal(ageAtEvent('2024-06-01', '2000-05-31'), 24); // birthday yesterday
  assert.equal(ageAtEvent('nope', '2000-01-01'), null);
});

test('pin signal is reserved in v1: pinned moments score identically', () => {
  const pinned = moment('m1', { pinned: true });
  const unpinned = moment('m2', { pinned: false });
  assert.equal(scoreMoment(pinned, CTX), scoreMoment(unpinned, CTX));
});

test('scoreMoments orders deterministically: significance desc → newer first → id asc', () => {
  const big = moment('zz-big', {
    peoplePresent: [person('a', { recurrence: 6 }), person('b'), person('c')],
    coverage: 4,
  });
  const twinOld = moment('twin-b', { capturedAt: '2024-06-01T09:00:00Z' });
  const twinNew = moment('twin-a', { capturedAt: '2024-06-01T11:00:00Z' });
  const twinNewIdTie = moment('twin-c', { capturedAt: '2024-06-01T11:00:00Z' });

  const ordered = scoreMoments([twinOld, twinNewIdTie, big, twinNew], CTX);
  assert.deepEqual(
    ordered.map((m) => m.id),
    ['zz-big', 'twin-a', 'twin-c', 'twin-b'],
  );

  // Stable across recomputes regardless of input order.
  const reordered = scoreMoments([twinNew, big, twinOld, twinNewIdTie], CTX);
  assert.deepEqual(reordered.map((m) => m.id), ordered.map((m) => m.id));
});

test('scoreMoments does not mutate its input', () => {
  const input = [moment('m1'), moment('m2')];
  const snapshot = JSON.stringify(input);
  scoreMoments(input, CTX);
  assert.equal(JSON.stringify(input), snapshot);
});
