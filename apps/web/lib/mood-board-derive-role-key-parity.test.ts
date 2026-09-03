import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE_ORDER } from './mood-board';
import { VISIBILITY_RANK } from './palette-styles';

/**
 * `mood-board-derive.ts` indexes `VISIBILITY_RANK`/`Board` (both keyed by
 * `RoleKey`, palette-styles.ts) directly with a `PaletteKey` (mood-board.ts),
 * with no cast and no hand-written mapping table. That is only sound because
 * the two string unions hold the exact same 16 literals — this test is what
 * makes that claim checked rather than assumed, so a future addition to
 * either vocabulary that isn't mirrored in the other fails HERE, loudly,
 * instead of silently reading `undefined` off a Board or a rank table.
 */
test('🚨 every PaletteKey is a real RoleKey in VISIBILITY_RANK, and vice versa', () => {
  const paletteKeys = new Set<string>(PALETTE_ORDER);
  const roleKeys = new Set(Object.keys(VISIBILITY_RANK));
  const onlyInPalette = [...paletteKeys].filter((k) => !roleKeys.has(k));
  const onlyInRole = [...roleKeys].filter((k) => !paletteKeys.has(k));
  assert.deepEqual(onlyInPalette, [], 'PaletteKey has a key VISIBILITY_RANK does not know');
  assert.deepEqual(onlyInRole, [], 'VISIBILITY_RANK has a key PaletteKey does not know');
  assert.equal(paletteKeys.size, roleKeys.size);
});
