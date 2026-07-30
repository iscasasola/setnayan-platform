/**
 * honoree-cardinality.test.ts — the second child must be able to have a party.
 *
 * THE DEFECT THIS SUITE EXISTS TO PREVENT (found 2026-07-31, live in prod):
 * the generic onboarding never collected `honoree_label`, but it still ran the
 * one-in-planning cap. `blocksLifeEventCreation` treats two UNLABELED events of
 * the same gated type as competing for a single slot, so the SECOND birthday /
 * debut / christening / graduation / gender reveal an account created was
 * refused — forever, with "Something went wrong saving your plan. Please try
 * again." Retrying is precisely what cannot work, and no archive control exists
 * anywhere in the app to clear the first event.
 *
 * These tests pin the two halves of the fix: the insert now CARRIES the name,
 * and the gate treats two different names as two different celebrations.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGenericEventInsert } from './event-insert';
import type { GenericOnboardingPayload } from './types';
import {
  blocksLifeEventCreation,
  isGatedLifeType,
  LIFE_GATE_EPOCH_ISO,
} from '@/lib/life-event-gate';

const TODAY = '2026-07-31';
/** Post-epoch: only these contend for the singleton slot. */
const CREATED = '2026-07-20T00:00:00.000Z';

function payload(over: Partial<GenericOnboardingPayload> = {}): GenericOnboardingPayload {
  return {
    eventType: 'birthday',
    displayName: 'Birthday',
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

const row = (honoree: string | null) => ({
  event_id: 'e1',
  event_type: 'birthday',
  display_name: 'Nina turns 7',
  event_date: null,
  archived: false,
  honoree_label: honoree,
  honoree_dependent_id: null,
  created_at: CREATED,
});

test('the insert now carries the honoree — this is what was missing', () => {
  const insert = buildGenericEventInsert(payload({ honoreeLabel: 'Bea' }), {
    slug: 's',
    isAnonymous: false,
  });
  assert.equal(insert.honoree_label, 'Bea');
});

test('whitespace-only and absent honoree both store NULL, never an empty string', () => {
  for (const v of ['   ', undefined, null]) {
    const insert = buildGenericEventInsert(
      payload({ honoreeLabel: v as string | null }),
      { slug: 's', isAnonymous: false },
    );
    assert.equal(insert.honoree_label, null, `for ${JSON.stringify(v)}`);
  }
});

test('THE BUG: two unlabeled birthdays collide — the second child is refused', () => {
  assert.equal(
    blocksLifeEventCreation(row(null), { eventType: 'birthday' }, TODAY),
    true,
    'an unlabeled pair must still contend for the singleton slot',
  );
});

test('THE FIX: naming a different celebrant opens a second slot', () => {
  assert.equal(
    blocksLifeEventCreation(
      row('Nina'),
      { eventType: 'birthday', honoreeLabel: 'Bea' },
      TODAY,
    ),
    false,
    'a second child must be able to have a birthday',
  );
});

test('the same celebrant is still capped — the rule is not weakened', () => {
  assert.equal(
    blocksLifeEventCreation(
      row('Nina'),
      { eventType: 'birthday', honoreeLabel: 'nina' },
      TODAY,
    ),
    true,
    'honoree keys normalize, so casing cannot buy a second slot',
  );
});

test('every gated type gets the question; lifestyle types do not', () => {
  for (const t of ['debut', 'christening', 'birthday', 'graduation', 'gender_reveal']) {
    assert.equal(isGatedLifeType(t), true, `${t} must be gated`);
  }
  for (const t of ['celebration', 'travel', 'date', 'hangout', 'reunion', 'anniversary']) {
    assert.equal(
      isGatedLifeType(t),
      false,
      `${t} must NOT be gated — a user has many of these`,
    );
  }
});

test('pre-epoch unlabeled rows still never block (the grandfather rule holds)', () => {
  assert.equal(
    blocksLifeEventCreation(
      { ...row(null), created_at: '2026-01-01T00:00:00.000Z' },
      { eventType: 'birthday' },
      TODAY,
    ),
    false,
    `rows created before ${LIFE_GATE_EPOCH_ISO} must not be retroactively frozen out`,
  );
});
