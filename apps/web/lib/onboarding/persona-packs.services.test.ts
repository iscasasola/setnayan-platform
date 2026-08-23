/**
 * Unit suite for the per-type / per-persona IN-APP SERVICES dimension of the
 * persona packs (0053 Phase 3 follow-up · services restore).
 *
 * The generic `/onboarding/[type]` flow used to hardcode `interestedServices: []`,
 * dropping the per-persona service pre-surfacing the wedding wizard has. These
 * packs restore it, type- + persona-scoped. Invariants:
 *  - every enabled non-wedding type has services for ALL 6 personas;
 *  - `derivePackServices` dedupes + sizes by the effort axis (simple=2/balanced=3/allout=5);
 *  - no pack / unknown persona → [] (the safe PR2 fallback — no paywall, nothing extra);
 *  - ONLY-VALID-KEYS: every authored service id is in the canonical
 *    `VALID_SERVICE_KEYS` registry (= INAPP_TO_SERVICE_CODE); none can leak.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERSONA_PACKS,
  VALID_SERVICE_KEYS,
  derivePackServices,
  derivePackServicesFrom,
} from './persona-packs';

const PERSONA_KEYS = [
  'keepsake',
  'big_celebration',
  'best_of_both',
  'intimate_romance',
  'modern_statement',
  'rooted_tradition',
] as const;

const ENABLED_TYPES = [
  'birthday',
  'debut',
  'gender_reveal',
  'christening',
  'corporate',
  'tournament',
  'travel',
  'celebration',
  'anniversary',
  'graduation',
  'reunion',
] as const;

test('every enabled type has services for all 6 personas (non-empty)', () => {
  for (const type of ENABLED_TYPES) {
    const pack = PERSONA_PACKS[type];
    assert.ok(pack, `missing pack for ${type}`);
    for (const p of PERSONA_KEYS) {
      const list = pack!.servicesByPersona[p];
      assert.ok(Array.isArray(list), `${type} missing servicesByPersona.${p}`);
      assert.ok(list.length > 0, `${type}.${p} has no services`);
    }
  }
});

test('ONLY-VALID-KEYS: every authored service id is a real in-app service key', () => {
  for (const [type, pack] of Object.entries(PERSONA_PACKS)) {
    for (const p of PERSONA_KEYS) {
      for (const key of pack.servicesByPersona[p]) {
        assert.ok(
          VALID_SERVICE_KEYS.has(key),
          `${type}.${p}: "${key}" is not in VALID_SERVICE_KEYS (INAPP_TO_SERVICE_CODE)`,
        );
      }
    }
  }
});

test('the registry itself is non-trivial (guards against an empty import)', () => {
  assert.ok(VALID_SERVICE_KEYS.size >= 10);
  // Spot-check a few canonical keys exist.
  for (const k of ['papic_seats', 'animated_monogram', 'advanced_website', 'panood']) {
    assert.ok(VALID_SERVICE_KEYS.has(k), `expected canonical key ${k}`);
  }
});

/*
  ⚠ THE `allout` HALF OF THIS TEST NO LONGER HAS AN AUTHORED LIST LONG ENOUGH
  TO REACH ITS OWN LIMIT, AND THAT IS WHY IT IS BUILT A SECOND WAY.

  It used to read the cap off `debut/big_celebration`, which had exactly five
  services. Retiring Pabati on 2026-08-21 took one entry out of twenty-six
  authored lists, and the longest is four now. Left as it was, the assertion
  would have been rewritten to expect four — and the 5 in "simple=2/balanced=3/
  allout=5" would have stopped being tested by anything at all, while the test
  name went on claiming it.

  🔑 A CAP NO FIXTURE CAN REACH IS AN UNTESTED CAP. So the sizing rule is
  asserted against the authored data where the data can still prove it, and the
  limit itself against a pack built to exceed it.
*/
test('effort scales the service count: simple=2, balanced=3, allout=5', () => {
  // birthday/big_celebration has 3 services — enough to prove both short limits.
  assert.equal(derivePackServices('birthday', 'big_celebration', 'simple').length, 2);
  assert.equal(derivePackServices('birthday', 'big_celebration', 'balanced').length, 3);
  // debut/big_celebration has 4 — allout returns all 4, the limit not reached.
  assert.equal(derivePackServices('debut', 'big_celebration', 'allout').length, 4);

  // The limit itself, proved on a pack longer than it. Six valid keys in, five
  // out — and the six are taken from the real registry, so this cannot pass by
  // silently dropping ids the intersect refuses.
  const six = [...VALID_SERVICE_KEYS].slice(0, 6);
  assert.equal(six.length, 6, 'the registry must offer six valid keys, or this proves nothing');
  const long = {
    essentials: [],
    byPersona: { big_celebration: [] },
    servicesByPersona: { big_celebration: six },
  } as unknown as Parameters<typeof derivePackServicesFrom>[0];
  assert.equal(derivePackServicesFrom(long, 'big_celebration', 'allout').length, 5);
  assert.equal(derivePackServicesFrom(long, 'big_celebration', 'balanced').length, 3);
  assert.equal(derivePackServicesFrom(long, 'big_celebration', 'simple').length, 2);
});

test('default (no/unknown effort) sizes to 3', () => {
  assert.equal(derivePackServices('birthday', 'keepsake', null).length, 3);
  assert.equal(derivePackServices('birthday', 'keepsake', 'nonsense').length, 3);
});

test('the resolved persona differentiates services (same type, same effort)', () => {
  const keepsake = derivePackServices('birthday', 'keepsake', 'allout');
  const grand = derivePackServices('birthday', 'big_celebration', 'allout');
  assert.notDeepEqual(keepsake, grand);
});

test('output preserves priority order and is a prefix of the authored list', () => {
  const full = PERSONA_PACKS.birthday!.servicesByPersona.keepsake;
  assert.deepEqual(derivePackServices('birthday', 'keepsake', 'simple'), full.slice(0, 2));
  assert.deepEqual(derivePackServices('birthday', 'keepsake', 'balanced'), full.slice(0, 3));
});

test('result is deduped (no repeated key)', () => {
  for (const type of ENABLED_TYPES) {
    for (const p of PERSONA_KEYS) {
      const out = derivePackServices(type, p, 'allout');
      assert.equal(new Set(out).size, out.length, `${type}.${p} produced a duplicate`);
    }
  }
});

test('no pack for the key → [] (safe PR2 fallback)', () => {
  for (const key of ['generic', 'gala_night', '', undefined, null]) {
    assert.deepEqual(derivePackServices(key as string | null | undefined, 'keepsake', 'balanced'), []);
  }
});

test('an unknown / null persona → [] (no guessing)', () => {
  assert.deepEqual(derivePackServices('birthday', 'not_a_persona', 'balanced'), []);
  assert.deepEqual(derivePackServices('birthday', null, 'balanced'), []);
  assert.deepEqual(derivePackServices('birthday', undefined, 'balanced'), []);
});

test('corporate + tournament never pre-surface couple-only SKUs (pakanta)', () => {
  for (const type of ['corporate', 'tournament'] as const) {
    for (const p of PERSONA_KEYS) {
      assert.ok(
        !PERSONA_PACKS[type]!.servicesByPersona[p].includes('pakanta'),
        `${type}.${p} should not include pakanta (couple-only)`,
      );
    }
  }
});
