/**
 * anchor-write.test.ts — the generic onboarding must write the anchor, and must
 * NEVER write a birthdate.
 *
 * TWO DEFECTS THIS SUITE PINS:
 *
 * 1. Until 2026-07-31 the generic wizard wrote no `anchor_date`, `anchor_origin`
 *    or `recurs` at all. An anniversary created through it — the live path for
 *    every non-wedding type — landed with no commemorated date and no yearly
 *    flag, so `couples_with_anniversary_today()` never matched it and it never
 *    appeared on the Year view. There is no screen anywhere to fix that after
 *    creation, so the event was permanently invisible to the surface built for it.
 *
 * 2. ⚠ THE COUNSEL GATE, which the fix must not breach while closing (1): an
 *    anchor kind of `person_birthdate` (birthday · debut · christening) must
 *    never carry a date, because that date IS a person's birthdate and events do
 *    not store those. The wizard does not ask — but "the UI does not ask" is not
 *    a guarantee, so the insert enforces it and this file proves the insert does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGenericEventInsert, type GenericInsertOpts } from './event-insert';
import type { GenericOnboardingPayload } from './types';
import { ANCHOR_ORIGINS, anchorForType, canToggleRecur } from '@/lib/event-anchor';

const OPTS: GenericInsertOpts = {
  slug: 's',
  now: '2026-07-31T00:00:00.000Z',
  userId: 'u1',
  isAnonymous: false,
  experienceEnabled: false,
  homeSignalsEnabled: true,
};

function payload(over: Partial<GenericOnboardingPayload> = {}): GenericOnboardingPayload {
  return {
    eventType: 'anniversary',
    displayName: 'Ours',
    region: null,
    venueLatitude: null,
    venueLongitude: null,
    pax: null,
    budgetBand: null,
    budgetAmountCentavos: null,
    dateMode: 'specific',
    dateCandidates: [],
    windowStart: null,
    windowEnd: null,
    moodFeelKey: null,
    experiencePersona: null,
    experienceForWhom: null,
    experienceAxes: {},
    picks: [],
    interestedServices: [],
    refinements: {},
    basicMoodboard: null,
    places: [],
    guidanceOptIn: true,
    ...over,
  } as GenericOnboardingPayload;
}

const insert = (over: Partial<GenericOnboardingPayload>) =>
  buildGenericEventInsert(payload(over), OPTS);

test('an anniversary now carries its commemorated date, origin and yearly flag', () => {
  const row = insert({
    anchorDate: '2025-03-03',
    anchorOrigin: 'wedding',
    recurs: true,
  });
  assert.equal(row.anchor_date, '2025-03-03');
  assert.equal(row.anchor_origin, 'wedding');
  assert.equal(row.recurs, true);
});

test('the anchor is NOT the event date — event_date stays null', () => {
  const row = insert({ anchorDate: '2025-03-03', recurs: true });
  assert.equal(row.event_date, null, 'the day it is HELD is chosen separately');
});

test('⚠ COUNSEL GATE: person_birthdate types never store a date, even if one is passed', () => {
  for (const t of ['birthday', 'debut', 'christening']) {
    assert.equal(
      anchorForType(t).kind,
      'person_birthdate',
      `${t} must still be a person_birthdate anchor for this test to mean anything`,
    );
    const row = insert({ eventType: t, anchorDate: '2019-06-09', recurs: true });
    assert.equal(
      row.anchor_date,
      null,
      `${t} leaked a birthdate onto the event row`,
    );
  }
});

test('a non-positive origin is dropped, never passed through to fail the DB CHECK', () => {
  for (const bad of ['memorial', 'death', 'babang_luksa', '', 'wedding ']) {
    assert.equal(
      insert({ anchorOrigin: bad }).anchor_origin,
      null,
      `origin ${JSON.stringify(bad)} must not survive`,
    );
  }
  // …and every allowed origin does survive, so the filter is not just "always null"
  for (const ok of ANCHOR_ORIGINS) {
    assert.equal(insert({ anchorOrigin: ok }).anchor_origin, ok);
  }
});

test('recurs defaults to FALSE — a one-time event is never silently made yearly', () => {
  assert.equal(insert({ eventType: 'corporate' }).recurs, false);
  assert.equal(insert({ eventType: 'corporate', recurs: undefined }).recurs, false);
});

test('the toggle types are exactly the ones the wizard offers a choice to', () => {
  for (const t of ['travel', 'celebration', 'corporate', 'gala_night', 'reunion', 'tournament']) {
    assert.equal(canToggleRecur(t), true, `${t} should offer the yearly toggle`);
  }
  for (const t of ['anniversary', 'birthday', 'wedding', 'debut', 'christening']) {
    assert.equal(
      canToggleRecur(t),
      false,
      `${t} must NOT show a toggle — it recurs by nature or is one-time`,
    );
  }
});
