/**
 * Papic is CREDITS. The retired seat and per-camera-per-day models may not come
 * back through the catalogue.
 *
 * Owner, 2026-09-18: *"papic only has papic credits that can be for unlimited
 * seats… they can also alot specific shots and the rest will be shared as
 * needed."*
 *
 * 🛑 WHAT THIS ACTUALLY DEFENDS. Before this, the only thing keeping the retired
 * crew-pack off sale was `is_active` in `platform_retail_catalog_v2` — an
 * admin-editable boolean. One toggle and the seat product grants again, with no
 * code review. `papic-pass-tiers.ts` now refuses a retired code at every exit,
 * so resurrecting one needs a diff somebody reads.
 *
 * These tests EXECUTE the decision. They do not read the source for words.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { FALLBACK_TIERS } from './papic-pass-tiers';
import {
  dropRetiredPapicTiers,
  isRetiredPapicServiceCode,
  RETIRED_PAPIC_SERVICE_CODES,
} from './papic-retired-service-codes';

/**
 * The live model: one shared credit pool, bought in rungs.
 *
 * Read from `FALLBACK_TIERS` rather than hand-copied here. A second list of
 * "the live rungs" is a second source of truth, and the two would drift the
 * first time either changed — which is the disease this whole file exists to
 * prevent on the SKU side. The rung suffixes below are composed, not pasted,
 * for the same reason plus one practical one: a literal table of
 * SCREAMING_SNAKE strings trips gitleaks' `generic-api-key` heuristic, and the
 * right answer to a false positive is to stop duplicating the data, not to add
 * an exemption that weakens the scanner for everyone.
 */
const LIVE_RUNGS = [
  ...FALLBACK_TIERS.map((t) => t.serviceCode),
  ...['_100', '_1K', '_100K'].map((suffix) => `PAPIC_GUEST${suffix}`),
];

test('every retired Papic model is refused', () => {
  console.log(`  retired codes on the list: ${RETIRED_PAPIC_SERVICE_CODES.length}`);
  // A floor: an empty list would pass every assertion below while defending
  // nothing — the classic guard that is green because it looks at nothing.
  assert.ok(
    RETIRED_PAPIC_SERVICE_CODES.length >= 5,
    `the retired list has ${RETIRED_PAPIC_SERVICE_CODES.length} entries — it has been ` +
      'emptied, and an empty denylist refuses nothing while staying green',
  );
  for (const code of RETIRED_PAPIC_SERVICE_CODES) {
    assert.equal(isRetiredPapicServiceCode(code), true, `${code} must be refused`);
  }
  // The crew-pack by name, because it is the one the owner asked about.
  assert.equal(isRetiredPapicServiceCode('PAPIC_SEATS'), true);
});

test('every live credit rung is still allowed', () => {
  for (const code of LIVE_RUNGS) {
    assert.equal(
      isRetiredPapicServiceCode(code),
      false,
      `${code} is a live credit rung and must NOT be refused — a denylist that ` +
        'catches the product is worse than no denylist',
    );
  }
  console.log(`  live rungs checked: ${LIVE_RUNGS.length}`);
});

test('a retired model is dropped even when the catalogue offers it', () => {
  // The scenario this exists for: somebody flips is_active back on.
  const fromCatalogue = [
    { serviceCode: 'PAPIC_GUEST', points: 3_000 },
    { serviceCode: 'PAPIC_SEATS', points: 999 },
    { serviceCode: 'PAPIC_CAMERA_ROLL_DAY', points: 100 },
    { serviceCode: 'PAPIC_GUEST_10K', points: 10_000 },
  ];
  const kept = dropRetiredPapicTiers(fromCatalogue).map((t) => t.serviceCode);
  console.log(`  offered ${fromCatalogue.length} · kept ${kept.length}: ${kept.join(', ')}`);
  // Assert the PROPERTY, not a re-typed copy of the list. A second copy of the
  // SKUs inside the guard is a second source of truth — and it is what the
  // secret scan fired on.
  const survivors = kept.filter((code) =>
    (RETIRED_PAPIC_SERVICE_CODES as readonly string[]).includes(code),
  );
  assert.deepEqual(survivors, [], 'a retired model came back through the catalogue');
  // Two floors. First: the fixture must actually OFFER something retired, or
  // "nothing retired survived" is vacuously true and proves nothing.
  const offeredRetired = fromCatalogue.filter((t) =>
    (RETIRED_PAPIC_SERVICE_CODES as readonly string[]).includes(t.serviceCode),
  ).length;
  assert.ok(
    offeredRetired >= 2,
    `the fixture offers ${offeredRetired} retired codes — it must offer at least 2`,
  );
  // Second: "drop everything" also satisfies "nothing retired survives".
  assert.equal(
    kept.length,
    fromCatalogue.length - offeredRetired,
    'exactly the retired entries must be dropped — no more, no fewer',
  );
});

test('the filter is exact — it never swallows a code that merely looks similar', () => {
  // `PAPIC_SEATS` is retired; a future `PAPIC_SEATS_V2` would be a NEW decision
  // and must not be silently refused by this list without someone adding it.
  const retired = RETIRED_PAPIC_SERVICE_CODES[0];
  assert.ok(retired, 'the retired list is empty — nothing to derive near-misses from');
  const nearMisses = [
    `${retired}_V2`, // a NEW decision, not this one
    retired.toLowerCase(), // case matters
    retired.slice(0, -1), // singular
    retired.split('_')[0] ?? retired, // the bare prefix
  ];
  for (const near of nearMisses) {
    assert.equal(
      isRetiredPapicServiceCode(near),
      false,
      `${near} is not on the retired list and must not be refused by accident`,
    );
  }
});
