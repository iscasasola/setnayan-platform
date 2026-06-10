/**
 * Taxonomy constant invariants (Node built-in test runner, run via tsx).
 *
 * Guards the load-bearing shape of TAXONOMY_MAP + the tile/folder tree so a
 * careless edit can't silently break the marketplace. The centerpiece is the
 * de-faith regression guard (2026-06-11): a dietary canonical must never carry a
 * `faith` tag, because `passesReligionFilter` is INCLUDE-only and would silently
 * subtract it from every non-matching couple — the never-subtract-lock violation
 * fixed by the de-faith PR.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TAXONOMY_MAP,
  TILE_PARENT,
  WEDDING_FAITH_KEYS,
  WEDDING_FOLDER_ORDER,
  WEDDING_TILE_ORDER,
  WEDDING_TILES_BY_PARENT,
} from './taxonomy';

const FOLDERS = new Set<string>(WEDDING_FOLDER_ORDER as readonly string[]);
const TILES = new Set<string>(WEDDING_TILE_ORDER as readonly string[]);
// The canonical faith vocabulary (client mirror of the DB faith_vocab table;
// consumed by passesReligionFilter / mapCeremonyTypeToFaith). Title-case —
// the marketplace compares with strict ===.
const ALLOWED_FAITHS = new Set<string>(WEDDING_FAITH_KEYS);

const entries = Object.entries(TAXONOMY_MAP);

test('every canonical entry maps to a known folder', () => {
  for (const [k, e] of entries) {
    assert.ok(FOLDERS.has(e.folder), `${k}: folder "${e.folder}" not in WEDDING_FOLDER_ORDER`);
  }
});

test('every entry tile (when present) is a known tile under the declared folder', () => {
  for (const [k, e] of entries) {
    if (!e.tile) continue;
    assert.ok(TILES.has(e.tile), `${k}: tile "${e.tile}" not in WEDDING_TILE_ORDER`);
    assert.equal(
      TILE_PARENT[e.tile],
      e.folder,
      `${k}: tile "${e.tile}" belongs to folder "${TILE_PARENT[e.tile]}", not "${e.folder}"`,
    );
  }
});

test('faith values are from the allowed FaithKey set', () => {
  for (const [k, e] of entries) {
    if (e.faith == null) continue;
    assert.ok(ALLOWED_FAITHS.has(e.faith), `${k}: faith "${e.faith}" not an allowed FaithKey`);
  }
});

test('no dietary-tagged canonical is faith-gated (de-faith regression guard, 2026-06-11)', () => {
  const offenders = entries
    .filter(([, e]) => e.dietary != null && e.faith != null)
    .map(([k, e]) => `${k} (faith=${e.faith}, dietary=${e.dietary})`);
  assert.deepEqual(
    offenders,
    [],
    `dietary canonicals must not carry faith (passesReligionFilter would hide them): ${offenders.join('; ')}`,
  );
});

test('faith keys are title-case (lowercasing breaks the === marketplace filter)', () => {
  for (const key of WEDDING_FAITH_KEYS) {
    assert.notEqual(key, key.toLowerCase(), `faith key "${key}" must not be all-lowercase`);
    assert.equal(key.charAt(0), key.charAt(0).toUpperCase(), `faith key "${key}" must start upper-case`);
  }
  assert.equal(new Set(WEDDING_FAITH_KEYS).size, WEDDING_FAITH_KEYS.length, 'faith keys must be unique');
});

test('TILE_PARENT and WEDDING_TILES_BY_PARENT are mutually consistent', () => {
  for (const tile of WEDDING_TILE_ORDER) {
    const parent = TILE_PARENT[tile];
    assert.ok(parent, `tile "${tile}" has no parent in TILE_PARENT`);
    assert.ok(
      (WEDDING_TILES_BY_PARENT[parent] ?? []).includes(tile),
      `tile "${tile}" not listed under parent "${parent}" in WEDDING_TILES_BY_PARENT`,
    );
  }
  for (const [parent, tiles] of Object.entries(WEDDING_TILES_BY_PARENT)) {
    for (const tile of tiles) {
      assert.equal(
        TILE_PARENT[tile],
        parent,
        `WEDDING_TILES_BY_PARENT lists "${tile}" under "${parent}" but TILE_PARENT says "${TILE_PARENT[tile]}"`,
      );
    }
  }
});
