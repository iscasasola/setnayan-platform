import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  asPapicFidelityTier,
  fidelityIngestParams,
  NEW_EVENT_PAPIC_FIDELITY,
  FIDELITY_READ_FAILSAFE,
  PAPIC_FIDELITY_TIERS,
  PAPIC_FIDELITY_VALUES,
  OPTIMAL_LONG_EDGE_PX,
  HIGH_EFFICIENCY_LONG_EDGE_PX,
  type PapicFidelityTier,
} from './papic-fidelity';

// Brief PR-4 guard: `events.papic_quality_tier` is ONE column with TWO seams
// (setup UI writes, ingest reads). These tests pin the shared vocabulary + the
// tier→ingest-parameter mapping both seams rely on.
//
// ── THE PREMISE THAT CHANGED (owner ruling, 2026-08-10) ────────────────────
// This file used to assert a single `DEFAULT_PAPIC_FIDELITY === 'full_res'`.
// The owner then moved the NEW-EVENT default to Optimal ("photo quality starts
// at optimal and not full resolution"), and that one constant turned out to be
// answering two unrelated questions at once:
//
//   • what a brand-new event STARTS on          → a product decision → optimal
//   • what we assume when the READ FAILED       → a safety decision  → full_res
//
// Flipping the merged constant would have satisfied the ruling AND made a
// failed database read silently downscale someone's wedding originals, because
// the ingest's error path returned that same constant. So the constant was
// SPLIT, and these tests exist to keep it split: they assert the two values are
// each right AND that they are different. Re-merging them cannot go green.

test('the READ FAIL-SAFE is full_res, and its params mean NO ingest processing', () => {
  // 🔒 An error must never destroy data. Ingest only ever DOWNSCALES, so the
  // one safe answer to "we could not read the tier" is the tier that processes
  // nothing. If this ever reads 'optimal', a transient database failure starts
  // permanently shrinking originals — silently, with nothing thrown.
  assert.equal(FIDELITY_READ_FAILSAFE, 'full_res');
  const params = fidelityIngestParams(FIDELITY_READ_FAILSAFE);
  // null long-edge cap = store the uploaded bytes verbatim.
  assert.equal(params.maxLongEdgePx, null);
});

test('the NEW-EVENT default is optimal — and is NOT the same value as the fail-safe', () => {
  // Owner, 2026-08-10, verbatim: "photo quality starts at optimal and not full
  // resolution." All three tiers stay selectable; only the starting point moved.
  assert.equal(NEW_EVENT_PAPIC_FIDELITY, 'optimal');
  // The whole point of the split. One constant serving both jobs is the defect.
  assert.notEqual(
    NEW_EVENT_PAPIC_FIDELITY,
    FIDELITY_READ_FAILSAFE,
    'the new-event default and the read fail-safe must stay two separate decisions',
  );
  // The new-event default DOES process (it is a downscaling tier) — which is
  // exactly why it must never be reachable from an error path.
  assert.notEqual(
    fidelityIngestParams(NEW_EVENT_PAPIC_FIDELITY).maxLongEdgePx,
    null,
  );
});

/* ── The database is where the new-event default actually lives ─────────────
 *
 * A TypeScript constant cannot make an inserted row start on Optimal — only the
 * column DEFAULT does that. These assertions read the migration corpus and
 * derive the expected value FROM the constant, so the two cannot drift: flip
 * the constant without the migration (or the migration without the constant)
 * and this goes red. The behaviour itself is proven against a real replayed
 * Postgres in tests/db/papic-quality-tier-default.db.test.ts.
 */
const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../supabase/migrations',
);

/** Every statement in the corpus that sets this column's DEFAULT, in apply order. */
function papicQualityTierDefaults(): { file: string; value: string }[] {
  const out: { file: string; value: string }[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      // Strip SQL line comments so a comment QUOTING an old default can never
      // be mistaken for a statement setting one.
      .replace(/^\s*--.*$/gm, ' ');
    // Both shapes that can set it: the original ADD COLUMN … DEFAULT 'x', and
    // any later ALTER COLUMN … SET DEFAULT 'x'.
    const add = /papic_quality_tier\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'([a-z_]+)'/gi;
    const set = /ALTER\s+COLUMN\s+papic_quality_tier\s+SET\s+DEFAULT\s+'([a-z_]+)'/gi;
    for (const re of [add, set]) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(sql)) !== null) out.push({ file, value: m[1]! });
    }
  }
  return out;
}

test('the migration corpus lands the new-event default on the constant', () => {
  const found = papicQualityTierDefaults();
  assert.ok(
    found.length >= 2,
    `expected the original DEFAULT plus at least one SET DEFAULT, found ${found.length}`,
  );
  // Last one in filename (= apply) order wins — that is the effective default.
  const effective = found[found.length - 1]!;
  assert.equal(
    effective.value,
    NEW_EVENT_PAPIC_FIDELITY,
    `the last migration to set events.papic_quality_tier's DEFAULT (${effective.file}) ` +
      `sets it to '${effective.value}', but NEW_EVENT_PAPIC_FIDELITY is ` +
      `'${NEW_EVENT_PAPIC_FIDELITY}' — code and database disagree about what a new event gets`,
  );
});

test('no migration back-fills the column — existing events are never moved', () => {
  // Owner, 2026-08-10: existing events are NOT migrated; the five in production
  // stay on Full resolution. The column is NOT NULL, so every stored row already
  // carries its own value and a DEFAULT change cannot reach it — the only way to
  // break that promise is an explicit UPDATE, so that is what this forbids.
  const offenders: string[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8').replace(/^\s*--.*$/gm, ' ');
    if (/UPDATE\s+(?:public\.)?events\b[\s\S]{0,400}?\bSET\b[\s\S]{0,200}?papic_quality_tier\s*=/i.test(sql)) {
      offenders.push(file);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these migrations rewrite events.papic_quality_tier on existing rows: ${offenders.join(', ')}`,
  );
});

test('absent / null / undefined / legacy values fall back to the READ FAIL-SAFE', () => {
  assert.equal(asPapicFidelityTier(null), FIDELITY_READ_FAILSAFE);
  assert.equal(asPapicFidelityTier(undefined), FIDELITY_READ_FAILSAFE);
  assert.equal(asPapicFidelityTier(''), FIDELITY_READ_FAILSAFE);
  // Unknown / future / mangled values must NEVER enable processing.
  assert.equal(asPapicFidelityTier('ultra'), FIDELITY_READ_FAILSAFE);
  assert.equal(asPapicFidelityTier('OPTIMAL'), FIDELITY_READ_FAILSAFE);
  assert.equal(asPapicFidelityTier('12mp'), FIDELITY_READ_FAILSAFE);
  // And they must not quietly become the new-event default either: a coercion
  // failure is not a new event.
  assert.notEqual(asPapicFidelityTier('ultra'), NEW_EVENT_PAPIC_FIDELITY);
});

test('the ingest error paths return the fail-safe, not the new-event default', () => {
  // 🔑 A source-text pin, deliberately: the two `return` sites in
  // readEventFidelityTier are ERROR paths (PostgREST error, thrown exception)
  // that no unit test can reach without a database. What CAN be checked without
  // one is that neither of them names the new-event default. This is the exact
  // edit that would destroy resolution on an error, so it is worth pinning.
  const raw = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'papic-ingest-fidelity.ts'),
    'utf8',
  );
  // Strip comments first — the module header legitimately DISCUSSES 'optimal'.
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

  const returns = [...code.matchAll(/return\s+([A-Z][A-Z0-9_]+)\s*;/g)].map((m) => m[1]!);
  assert.ok(
    returns.length >= 2,
    'expected both error paths (the PostgREST error and the catch) to return a named ' +
      'fail-safe constant — if this shape changed, re-point this assertion deliberately',
  );
  for (const name of returns) {
    assert.equal(
      name,
      'FIDELITY_READ_FAILSAFE',
      `papic-ingest-fidelity.ts returns ${name} on a failure path — a failed read must ` +
        'never select a downscaling tier',
    );
  }
  // Belt and braces: neither a downscaling tier literal nor the new-event
  // default may appear in this module's executable code, in any position.
  assert.ok(
    !/'(optimal|high_efficiency)'/.test(code),
    'the ingest module must never name a downscaling tier directly',
  );
  assert.ok(
    !/NEW_EVENT_PAPIC_FIDELITY/.test(code),
    'the ingest module must not reference the new-event default at all',
  );
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
