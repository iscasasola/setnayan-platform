/**
 * Per-EVENT window-aware Setnayan AI gate (node:test via tsx).
 *
 * Two jobs:
 *   1. Lock `eventOwnsSetnayanAi` — the ₱499/₱799 28-day window enforcement.
 *   2. PROVE the gate restructure is byte-identical when per-event pricing is OFF
 *      (the flag defaults OFF, so live behaviour must not move), and that the
 *      window only bites when the flag is ON.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  eventOwnsSetnayanAi,
  isSetnayanAiActiveForUser,
  shouldOfferSetnayanAiPurchaseForUser,
} from './setnayan-ai';

const NOW = new Date('2026-06-01T00:00:00.000Z');
const PAST = '2026-05-01T00:00:00.000Z'; // lapsed window
const FUTURE = '2026-07-01T00:00:00.000Z'; // live window

test('eventOwnsSetnayanAi: flag OFF → exactly `setnayan_ai_active === true`', () => {
  assert.equal(eventOwnsSetnayanAi({ setnayan_ai_active: true }), true);
  assert.equal(eventOwnsSetnayanAi({ setnayan_ai_active: false }), false);
  assert.equal(eventOwnsSetnayanAi(null), false);
  // A lapsed window is IGNORED while the flag is off (byte-identical to today).
  assert.equal(
    eventOwnsSetnayanAi({ setnayan_ai_active: true, setnayan_ai_active_until: PAST }),
    true,
  );
});

test('eventOwnsSetnayanAi: flag ON → window enforced, NULL window grandfathered', () => {
  const on = { perEventPricingEnabled: true, now: NOW };
  // Not purchased → never owns.
  assert.equal(eventOwnsSetnayanAi({ setnayan_ai_active: false }, on), false);
  // Purchased, no window → grandfathered permanent unlock.
  assert.equal(eventOwnsSetnayanAi({ setnayan_ai_active: true }, on), true);
  assert.equal(
    eventOwnsSetnayanAi({ setnayan_ai_active: true, setnayan_ai_active_until: null }, on),
    true,
  );
  // Purchased, live window → owns.
  assert.equal(
    eventOwnsSetnayanAi({ setnayan_ai_active: true, setnayan_ai_active_until: FUTURE }, on),
    true,
  );
  // Purchased, lapsed window → no longer owns (needs a ₱799 renewal).
  assert.equal(
    eventOwnsSetnayanAi({ setnayan_ai_active: true, setnayan_ai_active_until: PAST }, on),
    false,
  );
  // Unparseable window → don't lock the couple out.
  assert.equal(
    eventOwnsSetnayanAi({ setnayan_ai_active: true, setnayan_ai_active_until: 'not-a-date' }, on),
    true,
  );
});

test('isSetnayanAiActiveForUser: BYTE-IDENTICAL when per-event pricing is off', () => {
  // Paywall off → active unless manual, regardless of purchase (unchanged).
  assert.equal(isSetnayanAiActiveForUser({ planning_mode: null }, { paywallEnabled: false }), true);
  assert.equal(
    isSetnayanAiActiveForUser({ planning_mode: 'manual' }, { paywallEnabled: false }),
    false,
  );
  // Paywall on, per-user off → requires the per-event boolean (unchanged).
  assert.equal(
    isSetnayanAiActiveForUser({ setnayan_ai_active: true }, { paywallEnabled: true }),
    true,
  );
  assert.equal(
    isSetnayanAiActiveForUser({ setnayan_ai_active: false }, { paywallEnabled: true }),
    false,
  );
  // Per-user on → boolean OR the subscription window (unchanged); paywall not required.
  assert.equal(
    isSetnayanAiActiveForUser(
      { setnayan_ai_active: false },
      { perUserEnabled: true, subscription: { active_until: FUTURE }, now: NOW },
    ),
    true,
  );
  // A lapsed per-event window is IGNORED while the flag is off.
  assert.equal(
    isSetnayanAiActiveForUser(
      { setnayan_ai_active: true, setnayan_ai_active_until: PAST },
      { paywallEnabled: true },
    ),
    true,
  );
});

test('isSetnayanAiActiveForUser: per-event ON → the window lapses AI', () => {
  const base = { paywallEnabled: true, perEventPricingEnabled: true, now: NOW };
  assert.equal(
    isSetnayanAiActiveForUser({ setnayan_ai_active: true, setnayan_ai_active_until: FUTURE }, base),
    true,
  );
  assert.equal(
    isSetnayanAiActiveForUser({ setnayan_ai_active: true, setnayan_ai_active_until: PAST }, base),
    false, // lapsed → off until renewed
  );
  assert.equal(
    isSetnayanAiActiveForUser({ setnayan_ai_active: true, setnayan_ai_active_until: null }, base),
    true, // grandfathered
  );
  // Manual override still wins.
  assert.equal(
    isSetnayanAiActiveForUser(
      { planning_mode: 'manual', setnayan_ai_active: true, setnayan_ai_active_until: FUTURE },
      base,
    ),
    false,
  );
});

test('shouldOfferSetnayanAiPurchaseForUser: re-offers once the window lapses', () => {
  const on = { paywallEnabled: true, perEventPricingEnabled: true, now: NOW };
  // Live window → owns → do NOT re-offer (double-charge guard).
  assert.equal(
    shouldOfferSetnayanAiPurchaseForUser(
      { setnayan_ai_active: true, setnayan_ai_active_until: FUTURE },
      on,
    ),
    false,
  );
  // Lapsed window → offer the ₱799 renewal.
  assert.equal(
    shouldOfferSetnayanAiPurchaseForUser(
      { setnayan_ai_active: true, setnayan_ai_active_until: PAST },
      on,
    ),
    true,
  );
  // Flag off → byte-identical to the old boolean check (owns → no offer).
  assert.equal(
    shouldOfferSetnayanAiPurchaseForUser(
      { setnayan_ai_active: true, setnayan_ai_active_until: PAST },
      { paywallEnabled: true },
    ),
    false,
  );
});
