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

import { buildGenericEventInsert, type GenericInsertOpts } from './event-insert';
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

const OPTS: GenericInsertOpts = {
  slug: 's',
  now: `${TODAY}T00:00:00.000Z`,
  userId: 'u1',
  isAnonymous: false,
  experienceEnabled: false,
  homeSignalsEnabled: true,
};

const row = (honoree: string | null, dependentId: string | null = null) => ({
  event_id: 'e1',
  event_type: 'birthday',
  display_name: 'Nina turns 7',
  event_date: null,
  archived: false,
  honoree_label: honoree,
  honoree_dependent_id: dependentId,
  created_at: CREATED,
});

test('the insert now carries the honoree — this is what was missing', () => {
  const insert = buildGenericEventInsert(payload({ honoreeLabel: 'Bea' }), OPTS);
  assert.equal(insert.honoree_label, 'Bea');
});

test('whitespace-only and absent honoree both store NULL, never an empty string', () => {
  for (const v of ['   ', undefined, null]) {
    const insert = buildGenericEventInsert(
      payload({ honoreeLabel: v as string | null }),
      OPTS,
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

// ── the dependent LINK (2026-08-01) ─────────────────────────────────────────
// THE SECOND DEFECT: `events.honoree_dependent_id` was never written by any
// create path — only copied forward by event-recurrence — so the gate's
// strongest branch was unreachable and the cap always keyed on the label
// STRING. These pin that the insert now originates it, and what that buys.

const DEP_NINA = '11111111-2222-4333-8444-555555555555';
const DEP_BEA = '99999999-2222-4333-8444-555555555555';

test('the insert now carries the LINK too — this is the half that was dead', () => {
  const insert = buildGenericEventInsert(
    payload({ honoreeLabel: 'Nina', honoreeDependentId: DEP_NINA }),
    OPTS,
  );
  assert.equal(insert.honoree_dependent_id, DEP_NINA);
});

test('an absent or blank link stores NULL — every existing row behaves as today', () => {
  for (const v of ['   ', undefined, null]) {
    const insert = buildGenericEventInsert(
      payload({ honoreeLabel: 'Nina', honoreeDependentId: v as string | null }),
      OPTS,
    );
    assert.equal(insert.honoree_dependent_id, null, `for ${JSON.stringify(v)}`);
  }
});

test('the link WINS over the label when both sides have one', () => {
  // Same spelling, two different children — the label alone said "collide".
  assert.equal(
    blocksLifeEventCreation(
      row('Maria', DEP_NINA),
      { eventType: 'birthday', honoreeLabel: 'Maria', honoreeDependentId: DEP_BEA },
      TODAY,
    ),
    false,
    'two different alaga must not share one slot just because they share a name',
  );
  assert.equal(
    blocksLifeEventCreation(
      row('Maria', DEP_NINA),
      { eventType: 'birthday', honoreeLabel: 'Totally Different', honoreeDependentId: DEP_NINA },
      TODAY,
    ),
    true,
    'the same record must still collide however the label is spelled',
  );
});

test('RENAMING the alaga no longer moves it to a different slot', () => {
  // The whole point: event 1 was created while she was "Nina"; she is now
  // "Nina Santos". A label-keyed cap would call that a different celebrant.
  const existing = row('Nina', DEP_NINA);
  assert.equal(
    blocksLifeEventCreation(
      existing,
      { eventType: 'birthday', honoreeLabel: 'Nina Santos', honoreeDependentId: DEP_NINA },
      TODAY,
    ),
    true,
    'the cap keys on the record, not on the spelling',
  );
  // …and without the link (the pre-fix world) the rename buys a second slot.
  assert.equal(
    blocksLifeEventCreation(existing, { eventType: 'birthday', honoreeLabel: 'Nina Santos' }, TODAY),
    false,
    'this is the behaviour the link exists to replace',
  );
});

test('a one-sided link falls back to the label — unlinked rows are unchanged', () => {
  // Legacy row (NULL link) vs a linked candidate: the label still decides.
  assert.equal(
    blocksLifeEventCreation(
      row('Nina'),
      { eventType: 'birthday', honoreeLabel: 'Nina', honoreeDependentId: DEP_NINA },
      TODAY,
    ),
    true,
  );
  assert.equal(
    blocksLifeEventCreation(
      row('Nina'),
      { eventType: 'birthday', honoreeLabel: 'Bea', honoreeDependentId: DEP_BEA },
      TODAY,
    ),
    false,
  );
  // Two unlabeled, unlinked events still contend for the singleton slot.
  assert.equal(blocksLifeEventCreation(row(null), { eventType: 'birthday' }, TODAY), true);
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
