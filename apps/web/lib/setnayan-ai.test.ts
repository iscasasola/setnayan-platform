/**
 * Setnayan AI gate invariants (node:test via tsx).
 *
 * Locks the PER-USER subscription foundation: the new gate is byte-identical to
 * the per-event gate while the per-user flag is OFF (inert), and only when ON
 * does the subscription window fan out to entitle the event. Also pins the
 * lazy-expiry window predicate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isSetnayanAiActive,
  isSetnayanAiActiveForUser,
  userAiSubscriptionActive,
} from './setnayan-ai';

const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000);
const PAST = new Date(Date.now() - 1000);

// ---- userAiSubscriptionActive (lazy expiry) --------------------------------

test('userAiSubscriptionActive: future window active, past/absent/invalid inactive', () => {
  assert.equal(userAiSubscriptionActive({ active_until: FUTURE }), true);
  assert.equal(userAiSubscriptionActive({ active_until: FUTURE.toISOString() }), true);
  assert.equal(userAiSubscriptionActive({ active_until: PAST }), false);
  assert.equal(userAiSubscriptionActive({ active_until: null }), false);
  assert.equal(userAiSubscriptionActive(null), false);
  assert.equal(userAiSubscriptionActive(undefined), false);
  assert.equal(userAiSubscriptionActive({ active_until: 'not-a-date' }), false);
});

// ---- per-user flag OFF → byte-identical to the per-event gate ---------------

test('per-user OFF: matches isSetnayanAiActive exactly (paywall off)', () => {
  const evNormal = { planning_mode: null, setnayan_ai_active: false };
  const evManual = { planning_mode: 'manual', setnayan_ai_active: false };
  for (const ev of [evNormal, evManual]) {
    assert.equal(
      isSetnayanAiActiveForUser(ev, { perUserEnabled: false, paywallEnabled: false }),
      isSetnayanAiActive(ev, false),
    );
  }
});

test('per-user OFF: matches isSetnayanAiActive exactly (paywall on)', () => {
  const evPaid = { planning_mode: null, setnayan_ai_active: true };
  const evUnpaid = { planning_mode: null, setnayan_ai_active: false };
  for (const ev of [evPaid, evUnpaid]) {
    assert.equal(
      isSetnayanAiActiveForUser(ev, { perUserEnabled: false, paywallEnabled: true }),
      isSetnayanAiActive(ev, true),
    );
  }
});

// ---- per-user flag ON → subscription fans out -------------------------------

test('per-user ON: per-event entitlement still activates', () => {
  const ev = { planning_mode: null, setnayan_ai_active: true };
  assert.equal(isSetnayanAiActiveForUser(ev, { perUserEnabled: true }), true);
});

test('per-user ON: active subscription activates even without the per-event flag', () => {
  const ev = { planning_mode: null, setnayan_ai_active: false };
  assert.equal(
    isSetnayanAiActiveForUser(ev, {
      perUserEnabled: true,
      subscription: { active_until: FUTURE },
    }),
    true,
  );
});

test('per-user ON: no entitlement + no active sub → inactive', () => {
  const ev = { planning_mode: null, setnayan_ai_active: false };
  assert.equal(
    isSetnayanAiActiveForUser(ev, {
      perUserEnabled: true,
      subscription: { active_until: PAST },
    }),
    false,
  );
});

test('per-user ON: Manual toggle still wins over an active subscription', () => {
  const ev = { planning_mode: 'manual', setnayan_ai_active: false };
  assert.equal(
    isSetnayanAiActiveForUser(ev, {
      perUserEnabled: true,
      subscription: { active_until: FUTURE },
    }),
    false,
  );
});
