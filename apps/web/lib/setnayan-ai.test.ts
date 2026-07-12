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
  isMatchPreviewFree,
  isSetnayanAiActive,
  isSetnayanAiActiveForUser,
  shouldOfferSetnayanAiPurchase,
  shouldOfferSetnayanAiPurchaseForUser,
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

// ---- isMatchPreviewFree (Gap 2 free floor) ---------------------------------

test('isMatchPreviewFree: keyed on the Manual toggle ALONE, ignores entitlement', () => {
  // Not Manual → free, regardless of whether the event owns the AI entitlement.
  assert.equal(isMatchPreviewFree({ planning_mode: null }), true);
  assert.equal(isMatchPreviewFree({ planning_mode: 'guided' }), true);
  assert.equal(
    isMatchPreviewFree({ planning_mode: null, setnayan_ai_active: false } as {
      planning_mode?: string | null;
    }),
    true,
  );
  assert.equal(isMatchPreviewFree({}), true);
  assert.equal(isMatchPreviewFree(null), true);
  assert.equal(isMatchPreviewFree(undefined), true);
  // Manual → the couple chose "I'm driving" → the pill hides.
  assert.equal(isMatchPreviewFree({ planning_mode: 'manual' }), false);
});

test('isMatchPreviewFree: paywall ON + unpaid → floor SURVIVES while the full gate closes', () => {
  const ev = { planning_mode: null, setnayan_ai_active: false };
  // Full AI gate is OFF (paywall enforced, event hasn't purchased)…
  assert.equal(isSetnayanAiActiveForUser(ev, { paywallEnabled: true }), false);
  // …but the match-preview floor stays ON — this is the Gap 2 fix.
  assert.equal(isMatchPreviewFree(ev), true);
});

test('isMatchPreviewFree: paywall OFF → byte-identical to the full gate (no behavior change today)', () => {
  for (const planning_mode of [null, 'guided', 'manual']) {
    const ev = { planning_mode, setnayan_ai_active: false };
    assert.equal(
      isMatchPreviewFree(ev),
      isSetnayanAiActiveForUser(ev, { paywallEnabled: false }),
    );
  }
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

// ---- shouldOfferSetnayanAiPurchaseForUser (buy CTA) -------------------------

test('buy CTA per-user OFF: byte-identical to the per-event offer', () => {
  const evUnpaid = { setnayan_ai_active: false };
  const evPaid = { setnayan_ai_active: true };
  for (const paywallEnabled of [false, true]) {
    for (const ev of [evUnpaid, evPaid]) {
      assert.equal(
        shouldOfferSetnayanAiPurchaseForUser(ev, {
          perUserEnabled: false,
          paywallEnabled,
        }),
        shouldOfferSetnayanAiPurchase(ev, paywallEnabled),
      );
    }
  }
});

test('buy CTA per-user ON: offered when paywall on, unpaid, no active sub', () => {
  const ev = { setnayan_ai_active: false };
  assert.equal(
    shouldOfferSetnayanAiPurchaseForUser(ev, {
      paywallEnabled: true,
      perUserEnabled: true,
      subscription: { active_until: PAST },
    }),
    true,
  );
});

test('buy CTA per-user ON: SUPPRESSED for an active subscriber', () => {
  const ev = { setnayan_ai_active: false };
  assert.equal(
    shouldOfferSetnayanAiPurchaseForUser(ev, {
      paywallEnabled: true,
      perUserEnabled: true,
      subscription: { active_until: FUTURE },
    }),
    false,
  );
});

test('buy CTA per-user ON: SUPPRESSED for a per-event owner (never double-charge)', () => {
  const ev = { setnayan_ai_active: true };
  assert.equal(
    shouldOfferSetnayanAiPurchaseForUser(ev, {
      paywallEnabled: true,
      perUserEnabled: true,
      subscription: null,
    }),
    false,
  );
});

test('buy CTA per-user ON: never offered while the paywall is off', () => {
  const ev = { setnayan_ai_active: false };
  assert.equal(
    shouldOfferSetnayanAiPurchaseForUser(ev, {
      paywallEnabled: false,
      perUserEnabled: true,
      subscription: { active_until: PAST },
    }),
    false,
  );
});
