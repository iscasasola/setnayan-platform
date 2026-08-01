/**
 * Setnayan AI gate invariants (node:test via tsx).
 *
 * 🔒 SETNAYAN AI IS PER EVENT (owner 2026-08-01: "it is per event").
 *
 * This suite used to lock the PER-USER subscription foundation — that the gate
 * was byte-identical while the per-user flag was OFF, and that flipping it ON
 * fanned a user's subscription window out across all their events. That model is
 * retired: the table, the flag, the resolver and the helpers are deleted.
 *
 * What is locked now is the opposite property: an event's entitlement is a
 * function of THAT EVENT'S OWN ROW and nothing else. No argument, no option and
 * no ambient state may make one event's purchase light up another.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isSetnayanAiActive,
  isSetnayanAiActiveForEvent,
  shouldOfferSetnayanAiPurchase,
  shouldOfferSetnayanAiPurchaseForEvent,
} from './setnayan-ai';

const HERE = dirname(fileURLToPath(import.meta.url));
const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000);
const PAST = new Date(Date.now() - 1000);

// ---- the per-EVENT gate agrees with the plain gate -------------------------

test('isSetnayanAiActiveForEvent matches isSetnayanAiActive for windowless rows', () => {
  const rows = [
    { planning_mode: null, setnayan_ai_active: false },
    { planning_mode: 'manual', setnayan_ai_active: false },
    { planning_mode: null, setnayan_ai_active: true },
    { planning_mode: 'manual', setnayan_ai_active: true },
  ];
  for (const paywallEnabled of [false, true]) {
    for (const ev of rows) {
      assert.equal(
        isSetnayanAiActiveForEvent(ev, { paywallEnabled }),
        isSetnayanAiActive(ev, paywallEnabled),
        `${JSON.stringify(ev)} @ paywall=${paywallEnabled}`,
      );
    }
  }
});

test('shouldOfferSetnayanAiPurchaseForEvent matches its plain sibling', () => {
  const rows = [{ setnayan_ai_active: false }, { setnayan_ai_active: true }];
  for (const paywallEnabled of [false, true]) {
    for (const ev of rows) {
      assert.equal(
        shouldOfferSetnayanAiPurchaseForEvent(ev, { paywallEnabled }),
        shouldOfferSetnayanAiPurchase(ev, paywallEnabled),
        `${JSON.stringify(ev)} @ paywall=${paywallEnabled}`,
      );
    }
  }
});

// ---- the window still governs (2026-07-09 fix, unchanged by this PR) -------

test('a lapsed per-EVENT window turns AI off; a future one keeps it on', () => {
  const opts = { paywallEnabled: true };
  assert.equal(
    isSetnayanAiActiveForEvent({ setnayan_ai_active: true, setnayan_ai_active_until: FUTURE }, opts),
    true,
  );
  assert.equal(
    isSetnayanAiActiveForEvent({ setnayan_ai_active: true, setnayan_ai_active_until: PAST }, opts),
    false,
  );
  // No window at all = grandfathered permanent unlock.
  assert.equal(
    isSetnayanAiActiveForEvent({ setnayan_ai_active: true, setnayan_ai_active_until: null }, opts),
    true,
  );
});

// ---- 🔒 NO CROSS-EVENT ENTITLEMENT ------------------------------------------

test('no option can entitle an event that does not own Setnayan AI', () => {
  // The per-USER path used to work exactly like this: pass a `subscription` with
  // a future `active_until` and an unowned event went ACTIVE. Anyone re-adding a
  // cross-event entitlement would have to make this test fail first.
  const unowned = { planning_mode: null, setnayan_ai_active: false };
  const smuggled = {
    paywallEnabled: true,
    // Deliberately shaped like the retired inputs. Extra keys must be inert.
    subscription: { active_until: FUTURE },
    perUserEnabled: true,
  } as unknown as { paywallEnabled: boolean };

  assert.equal(
    isSetnayanAiActiveForEvent(unowned, smuggled),
    false,
    'an unowned event must stay OFF no matter what else is passed',
  );
  assert.equal(
    shouldOfferSetnayanAiPurchaseForEvent(unowned, smuggled),
    true,
    'and it must still be OFFERED the purchase — a "subscription" cannot suppress the CTA',
  );
});

test('the AI gate module holds no user-scoped entitlement concept', () => {
  // Source-level guard. The runtime assertions above cannot see a NEW per-user
  // path added beside them; this can.
  const src = readFileSync(join(HERE, 'setnayan-ai.ts'), 'utf8');
  for (const banned of ['user_ai_subscription', 'userAiSubscriptionActive', 'perUserEnabled']) {
    assert.ok(
      !new RegExp(`^(?!\\s*(//|\\*)).*${banned}`, 'm').test(src),
      `lib/setnayan-ai.ts references ${banned} in CODE. Setnayan AI is per event ` +
        '(owner 2026-08-01) — a user-scoped window is not a thing this module may express.',
    );
  }
});
