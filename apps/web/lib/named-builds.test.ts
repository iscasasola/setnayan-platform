/**
 * Unit suite for the named-saved-builds PURE helpers (`named-builds.ts`),
 * backing the free-form Save-As → Compare flow (BUILD_3STATE_ENABLED).
 * Load-bearing invariants:
 *   • normalizeBuildTitle trims/collapses, caps length, and maps blank → null
 *     (so a blank save falls back to an auto title, never stores "").
 *   • displayBuildTitle: legacy A/B/C rows show "Plan X"; untitled named rows
 *     show "Build {n}" (never a blank header).
 *   • sortSavedBuilds: A/B/C lead (alpha), then named oldest-first — deterministic.
 *   • planSaveAs: a valid overwrite target → overwrite; a stale target → fail-soft
 *     to create (a save is never silently dropped).
 *
 * Run via the repo's `test:unit` script (`tsx --test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeBuildTitle,
  autoBuildTitle,
  displayBuildTitle,
  sortSavedBuilds,
  planSaveAs,
  MAX_BUILD_TITLE_LEN,
  type NamedBuildRow,
} from './named-builds';

// ── normalizeBuildTitle ──────────────────────────────────────────────────────

test('normalizeBuildTitle trims, collapses whitespace, keeps content', () => {
  assert.equal(normalizeBuildTitle('  Beach   Plan  '), 'Beach Plan');
  assert.equal(normalizeBuildTitle('Tight Budget'), 'Tight Budget');
});

test('normalizeBuildTitle maps blank/whitespace-only/non-string to null', () => {
  assert.equal(normalizeBuildTitle(''), null);
  assert.equal(normalizeBuildTitle('   '), null);
  assert.equal(normalizeBuildTitle('\n\t  \n'), null);
  assert.equal(normalizeBuildTitle(undefined), null);
  assert.equal(normalizeBuildTitle(null), null);
  assert.equal(normalizeBuildTitle(42), null);
});

test('normalizeBuildTitle caps length at MAX_BUILD_TITLE_LEN', () => {
  const long = 'x'.repeat(MAX_BUILD_TITLE_LEN + 25);
  const out = normalizeBuildTitle(long);
  assert.equal(out?.length, MAX_BUILD_TITLE_LEN);
});

// ── displayBuildTitle / autoBuildTitle ───────────────────────────────────────

test('legacy A/B/C row shows "Plan X" when untitled', () => {
  const row: NamedBuildRow = { build_id: 'b1', label: 'B', title: null };
  assert.equal(autoBuildTitle(row, 0), 'Plan B');
  assert.equal(displayBuildTitle(row, 0), 'Plan B');
});

test('named (null-label) untitled row shows "Build {n}"', () => {
  const row: NamedBuildRow = { build_id: 'b1', label: null, title: null };
  assert.equal(autoBuildTitle(row, 0), 'Build 1');
  assert.equal(autoBuildTitle(row, 2), 'Build 3');
  assert.equal(displayBuildTitle(row, 2), 'Build 3');
});

test('a stored title always wins over the auto fallback', () => {
  const row: NamedBuildRow = { build_id: 'b1', label: null, title: '  Garden  Wedding ' };
  assert.equal(displayBuildTitle(row, 5), 'Garden Wedding');
});

// ── sortSavedBuilds ──────────────────────────────────────────────────────────

test('A/B/C rows lead (alpha), then named oldest-first', () => {
  const rows: NamedBuildRow[] = [
    { build_id: 'n2', label: null, title: 'Second', created_at: '2026-06-15T10:00:00Z' },
    { build_id: 'c', label: 'C', title: null },
    { build_id: 'n1', label: null, title: 'First', created_at: '2026-06-14T10:00:00Z' },
    { build_id: 'a', label: 'A', title: null },
  ];
  const sorted = sortSavedBuilds(rows).map((r) => r.build_id);
  assert.deepEqual(sorted, ['a', 'c', 'n1', 'n2']);
});

test('sortSavedBuilds does not mutate its input', () => {
  const rows: NamedBuildRow[] = [
    { build_id: 'c', label: 'C', title: null },
    { build_id: 'a', label: 'A', title: null },
  ];
  const before = rows.map((r) => r.build_id);
  sortSavedBuilds(rows);
  assert.deepEqual(
    rows.map((r) => r.build_id),
    before,
  );
});

test('named rows with equal/missing created_at fall back to build_id tie-break', () => {
  const rows: NamedBuildRow[] = [
    { build_id: 'zzz', label: null, title: null },
    { build_id: 'aaa', label: null, title: null },
  ];
  const sorted = sortSavedBuilds(rows).map((r) => r.build_id);
  assert.deepEqual(sorted, ['aaa', 'zzz']);
});

// ── planSaveAs ───────────────────────────────────────────────────────────────

const EXISTING: NamedBuildRow[] = [
  { build_id: 'b-keep', label: null, title: 'Keeper' },
  { build_id: 'b-a', label: 'A', title: null },
];

test('planSaveAs with a matching overwrite target → overwrite', () => {
  const plan = planSaveAs({
    rawName: '  New Name ',
    overwriteBuildId: 'b-keep',
    existing: EXISTING,
  });
  assert.deepEqual(plan, { mode: 'overwrite', buildId: 'b-keep', title: 'New Name' });
});

test('planSaveAs with no target → create-new', () => {
  const plan = planSaveAs({ rawName: 'Fresh Build', overwriteBuildId: null, existing: EXISTING });
  assert.deepEqual(plan, { mode: 'create', title: 'Fresh Build' });
});

test('planSaveAs with a STALE overwrite target fails soft to create (never drops the save)', () => {
  const plan = planSaveAs({
    rawName: 'Recovered',
    overwriteBuildId: 'b-gone',
    existing: EXISTING,
  });
  assert.deepEqual(plan, { mode: 'create', title: 'Recovered' });
});

test('planSaveAs blank name → create with null title (caller uses auto title)', () => {
  const plan = planSaveAs({ rawName: '   ', overwriteBuildId: null, existing: EXISTING });
  assert.deepEqual(plan, { mode: 'create', title: null });
});
