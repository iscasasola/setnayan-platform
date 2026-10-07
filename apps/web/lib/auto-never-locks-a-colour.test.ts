/**
 * ✨ AUTO NEVER LOCKS A COLOUR (owner 2026-10-06, DECISION_LOG "AUTO PALETTE
 * BESIDE SAVED": *"we can add a button beside save where we auto generate the
 * palettes? but we can always change them manually"* — "Manual always wins:
 * Auto never locks anything").
 *
 * Held on the pure writers Studio calls (`withAutoPalette`, `withMainColour`):
 *   · a pick by hand after Auto wins — the very next write is the couple's;
 *   · Auto fills the five and NOTHING else: a part or role the couple set by
 *     hand keeps its colour, and Auto adds no marker of its own;
 *   · Auto twice in a row is just the second suggestion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { withAutoPalette, withMainColour, withPartColour, withRoleColours } from './mood-board-studio';
import type { RolePalette } from './mood-board';

const MINE = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];
const GARDEN = ['#3F5A3C', '#DCE5D6', '#C9A86A', '#F7F2EC', '#E9C9D3'];
const MODERN = ['#2C2A29', '#E6E1D8', '#B5543A', '#FFFFFF', '#A9834B'];

test('a manual pick after Auto wins', () => {
  const auto = withAutoPalette({ reception: MINE }, GARDEN);
  assert.deepEqual(auto.reception, GARDEN);
  const mine = withMainColour(auto, auto.reception!, 0, '#112233');
  assert.equal(mine.reception![0], '#112233');
  assert.deepEqual(mine.reception!.slice(1), GARDEN.slice(1));
});

test('Auto fills the five and touches nothing the couple set by hand', () => {
  let p: RolePalette = { reception: MINE };
  p = withPartColour(p, 'chairs', '#ABCDEF');
  p = withRoleColours(p, 'bridesmaids', ['#F3DDE3']);
  const auto = withAutoPalette(p, GARDEN);
  assert.equal(auto.room_dressing?.chairs, '#ABCDEF', 'Auto repainted a part set by hand');
  assert.deepEqual(auto.bridesmaids, ['#F3DDE3'], 'Auto repainted a role set by hand');
  assert.deepEqual(auto.touched_roles, p.touched_roles);
  const { reception: _a, ...restAfter } = auto;
  const { reception: _b, ...restBefore } = p;
  assert.deepEqual(restAfter, restBefore, 'Auto wrote something besides the five');
});

test('Auto adds no lock of its own — a second Auto is simply the second suggestion', () => {
  const once = withAutoPalette({ reception: MINE }, GARDEN);
  const twice = withAutoPalette(once, MODERN);
  assert.deepEqual(twice.reception, MODERN);
  assert.deepEqual(Object.keys(twice).sort(), ['reception']);
});
