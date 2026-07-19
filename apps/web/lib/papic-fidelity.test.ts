import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asPapicFidelityTier,
  fidelityIngestParams,
  DEFAULT_PAPIC_FIDELITY,
  PAPIC_FIDELITY_TIERS,
  PAPIC_FIDELITY_VALUES,
  OPTIMAL_LONG_EDGE_PX,
  HIGH_EFFICIENCY_LONG_EDGE_PX,
  type PapicFidelityTier,
} from './papic-fidelity';

// Brief PR-4 guard: `events.papic_quality_tier` is ONE column with TWO seams
// (setup UI writes, ingest reads). These tests pin the shared vocabulary + the
// tier→ingest-parameter mapping both seams rely on, and — critically — that
// every absent/legacy/unknown value resolves to the DEFAULT tier whose params
// mean "no processing", i.e. exactly the pre-PR-4 shipped behavior. That is
// what makes the migration inert on apply.

test('default tier is full_res and its params mean NO ingest processing', () => {
  assert.equal(DEFAULT_PAPIC_FIDELITY, 'full_res');
  const params = fidelityIngestParams(DEFAULT_PAPIC_FIDELITY);
  // null long-edge cap = store the uploaded bytes verbatim (legacy behavior).
  assert.equal(params.maxLongEdgePx, null);
});

test('absent / null / undefined / legacy values fall back to the default tier', () => {
  assert.equal(asPapicFidelityTier(null), DEFAULT_PAPIC_FIDELITY);
  assert.equal(asPapicFidelityTier(undefined), DEFAULT_PAPIC_FIDELITY);
  assert.equal(asPapicFidelityTier(''), DEFAULT_PAPIC_FIDELITY);
  // Unknown / future / mangled values must NEVER enable processing.
  assert.equal(asPapicFidelityTier('ultra'), DEFAULT_PAPIC_FIDELITY);
  assert.equal(asPapicFidelityTier('OPTIMAL'), DEFAULT_PAPIC_FIDELITY);
  assert.equal(asPapicFidelityTier('12mp'), DEFAULT_PAPIC_FIDELITY);
});

test('valid tier ids pass through unchanged', () => {
  assert.equal(asPapicFidelityTier('full_res'), 'full_res');
  assert.equal(asPapicFidelityTier('optimal'), 'optimal');
  assert.equal(asPapicFidelityTier('high_efficiency'), 'high_efficiency');
});

test('tier→parameter mapping matches the GBB § 5 ladder', () => {
  // Optimal — ~4256px long edge ≈ 12 MP, the wedding-recommended tier.
  const optimal = fidelityIngestParams('optimal');
  assert.equal(optimal.maxLongEdgePx, OPTIMAL_LONG_EDGE_PX);
  assert.equal(optimal.maxLongEdgePx, 4256);

  // High efficiency — ~2560px long edge ≈ 4 MP, the Papic Lite tier.
  const he = fidelityIngestParams('high_efficiency');
  assert.equal(he.maxLongEdgePx, HIGH_EFFICIENCY_LONG_EDGE_PX);
  assert.equal(he.maxLongEdgePx, 2560);

  // Ladder is strictly ordered: full_res (no cap) > optimal > high_efficiency.
  assert.ok(OPTIMAL_LONG_EDGE_PX > HIGH_EFFICIENCY_LONG_EDGE_PX);

  // Full res — no processing, ever.
  assert.equal(fidelityIngestParams('full_res').maxLongEdgePx, null);
});

test('downscaling tiers carry a sane JPEG re-encode quality', () => {
  for (const tier of ['optimal', 'high_efficiency'] as const) {
    const q = fidelityIngestParams(tier).jpegQuality;
    assert.ok(q >= 70 && q <= 95, `${tier} quality ${q} out of sane range`);
  }
  // Optimal (the keeper copy that downloads / Drive-syncs) must never encode
  // below the crowd tier.
  assert.ok(
    fidelityIngestParams('optimal').jpegQuality >=
      fidelityIngestParams('high_efficiency').jpegQuality,
  );
});

test('picker metadata and the CHECK-constraint vocabulary agree', () => {
  // The DB CHECK is (full_res|optimal|high_efficiency) — the TS vocabulary must
  // be exactly that set, or a picker write would violate the constraint.
  const expected: readonly PapicFidelityTier[] = [
    'full_res',
    'optimal',
    'high_efficiency',
  ];
  assert.deepEqual([...PAPIC_FIDELITY_VALUES].sort(), [...expected].sort());
  // Every picker card is a valid tier and each tier appears exactly once.
  assert.equal(PAPIC_FIDELITY_TIERS.length, expected.length);
  for (const meta of PAPIC_FIDELITY_TIERS) {
    assert.ok(expected.includes(meta.id));
    assert.ok(meta.label.length > 0);
    assert.ok(meta.blurb.length > 0);
  }
});
