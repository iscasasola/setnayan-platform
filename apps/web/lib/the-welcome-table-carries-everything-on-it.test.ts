/**
 * A WELCOME TABLE CARRIES SEVERAL THINGS AT ONCE.
 *
 * `welcome_signage` is multi-select — an easel sign AND the seating chart AND
 * the guestbook is the normal case, not an edge one. The room drew `sel(...)`,
 * the primary, and silently dropped the rest: the couple ticked three things,
 * saw three on the mood board and in the printed concept, and walked into a 3D
 * room holding one.
 *
 * ⚠ WHAT MAKES THIS SAFE IS ARITHMETIC, NOT INTENTION. Couples have shown these
 * rooms to suppliers and booked against them, so a board that chose ONE piece
 * must render that piece in the same spot as before, unchanged. Two facts carry
 * that:
 *
 *   1. `selAll(...)[0] === sel(...)` by construction, so the first element is
 *      exactly what was being drawn.
 *   2. the position offset is `i * SPACING`, which is 0 at i === 0.
 *
 * Both are asserted below. If either stops holding, a single-choice room moves,
 * and "additive by construction" becomes a promise somebody has to keep.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { sel, selAll, type ReceptionDesign } from './reception-scene';

const DECOR = join(import.meta.dirname, '..', 'app', '_components', 'plan3d', 'venue-decor.tsx');
const src = () => stripComments(readFileSync(DECOR, 'utf8'));

/* ── 1 · the first piece cannot move ──────────────────────────────────────── */

test('the primary stays the primary — selAll[0] is what sel drew', () => {
  const three = {
    welcome_signage: { style: ['easel_sign', 'framed_seating_chart', 'floral_guestbook'] },
  } as ReceptionDesign;
  assert.equal(selAll(three, 'welcome_signage', 'style')[0], sel(three, 'welcome_signage', 'style'));

  const one = { welcome_signage: { style: 'framed_seating_chart' } } as ReceptionDesign;
  assert.deepEqual(selAll(one, 'welcome_signage', 'style'), ['framed_seating_chart']);
  assert.equal(sel(one, 'welcome_signage', 'style'), 'framed_seating_chart');
});

test('the offset is zero for the first piece', () => {
  // Pinned as arithmetic in the source: `i * SPACING`. An off-by-one here —
  // `(i + 1) * SPACING` — would shunt every existing single-choice welcome
  // table sideways by a metre, in every room already built.
  // BOTH axes, counted. A sabotage that shifted only x slipped past an earlier
  // version of this assertion: one axis still read `i * SPACING`, the loose
  // regex found it, and the guard reported health while every welcome table had
  // been shunted sideways along z. Count the occurrences; do not just find one.
  const steps = src().match(/i \* WELCOME_ITEM_SPACING_M/g) ?? [];
  assert.equal(
    steps.length,
    2,
    'both the x and z offsets must step by i * SPACING — index 0 then contributes ' +
      'nothing on either axis, which is what leaves an existing single-choice ' +
      'welcome table exactly where it was.',
  );
});

/* ── 2 · the whole table reaches the room ─────────────────────────────────── */

test('the room reads EVERY chosen piece, not just the primary', () => {
  const s = src();
  assert.match(
    s,
    /selAll\(design, 'welcome_signage', 'style'\)/,
    "the welcome table must be read with selAll — sel drops everything after the first",
  );
  assert.doesNotMatch(
    s,
    /sel\(design, 'welcome_signage', 'style'\)/,
    'a leftover sel() call for this zone means the primary-only bug is still live',
  );
});

test('"minimal" is an empty table, never an object', () => {
  const s = src();
  assert.match(
    s,
    /filter\(\(v\) => v !== 'minimal'\)/,
    "'minimal' is the couple saying there is nothing here; rendering it as a piece " +
      'would put furniture in a room they asked to leave bare.',
  );
  // And it must still be possible to have no table at all.
  assert.match(s, /welcomeStyles\.length > 0/, 'an empty list must render nothing');
});

test('each piece is keyed and named by its own style', () => {
  // Two pieces sharing a React key collapse to one — which would look exactly
  // like the bug this fixes, while the data was right all along.
  const s = src();
  assert.match(s, /key=\{style\}/, 'each piece needs its own key');
  assert.match(s, /decor-welcome-\$\{style\}/, 'and its own scene-graph name');
});
