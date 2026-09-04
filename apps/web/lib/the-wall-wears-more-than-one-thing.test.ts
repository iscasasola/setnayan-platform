/**
 * A WALL CARRIES MORE THAN ONE THING.
 *
 * `walls` is multi-select — greenery behind a drape, a garland along the top of
 * it — and the room drew the primary and dropped the rest. Unlike the welcome
 * table, whose pieces are separate objects standing side by side, wall
 * treatments occupy the SAME plane: rendering two without separating them
 * z-fights instead of layering.
 *
 * So each extra treatment hangs `WALL_LAYER_STEP_M` further into the room.
 *
 * ⚠ LAYER 0 IS AT DEPTH 0, AND THAT IS THE WHOLE SAFETY ARGUMENT. Couples have
 * shown these rooms to suppliers. `selAll(...)[0] === sel(...)` by construction,
 * and `li * STEP` is 0 at `li === 0`, so a wall that chose one treatment renders
 * it in exactly the plane it always did. Both halves are asserted — an
 * off-by-one (`(li + 1) * STEP`) would push every existing dressed wall 9 cm off
 * its own surface, in every room already built.
 *
 * ⚠ THE STACK FOLLOWS PICK ORDER, NOT PHYSICS, AND THAT IS DELIBERATE. Choose a
 * garland first and a greenery wall second and the greenery hangs in front of
 * the garland. Sorting by physical depth instead would move whichever treatment
 * is currently drawn, which is the one thing that must not happen. Their first
 * choice is the one they are already looking at.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { sel, selAll, type ReceptionDesign } from './reception-scene';
import { ROOM_DRAWN_ATTRIBUTES } from '@/app/_components/plan3d/venue-decor';

const DECOR = join(import.meta.dirname, '..', 'app', '_components', 'plan3d', 'venue-decor.tsx');
const src = () => stripComments(readFileSync(DECOR, 'utf8'));

/* ── the plane the primary sits in cannot move ────────────────────────────── */

test('the primary treatment is still the primary', () => {
  const two = { walls: { treatment: ['fabric_drape', 'floral_garland'] } } as ReceptionDesign;
  assert.equal(selAll(two, 'walls', 'treatment')[0], sel(two, 'walls', 'treatment'));
});

test('layer 0 renders at depth 0', () => {
  // The arithmetic IS the rule-03 guarantee, so it is pinned as arithmetic.
  assert.match(
    src(),
    /li \* WALL_LAYER_STEP_M/,
    'the step must be li * STEP — an off-by-one lifts every existing dressed wall ' +
      'off its own surface in every room already built.',
  );
});

/* ── the whole wall reaches the room ──────────────────────────────────────── */

test('the room reads every chosen treatment', () => {
  const s = src();
  assert.match(s, /selAll\(design, 'walls', 'treatment'\)/, 'walls must be read with selAll');
  assert.doesNotMatch(
    s,
    /sel\(design, 'walls', 'treatment'\)/,
    'a leftover sel() for this zone means the primary-only bug is still live',
  );
});

test('"bare" is an undressed wall, never a layer', () => {
  assert.match(
    src(),
    /filter\(\(v\) => v !== 'bare'\)/,
    "'bare' is the couple saying leave the walls alone; drawing it as a layer would " +
      'dress a wall they asked to leave plain.',
  );
});

test('each layer is keyed and named by its own treatment', () => {
  const s = src();
  assert.match(s, /key=\{treatment\}/, 'two layers sharing a key collapse to one');
  assert.match(s, /decor-walls-\$\{treatment\}/, 'and each needs its own scene-graph name');
});

/* ── and the legend stops calling it primary-only ─────────────────────────── */

test('walls has left the primary-only disclosure list', () => {
  // Drawn in full now, so the notice must not claim the room is hiding a choice
  // it is actually showing. The sibling guard asserts the same rule generally;
  // this pins the specific zone this change moved.
  const declared = ROOM_DRAWN_ATTRIBUTES.map(([p]) => p);
  assert.ok(
    !declared.includes('walls'),
    'the walls zone draws every treatment — listing it as primary-only would make ' +
      'the legend describe a limitation that no longer exists.',
  );
});
