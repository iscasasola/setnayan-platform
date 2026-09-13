/**
 * THE FOUR KNOBS, AND THE TWO THAT DID NOTHING.
 *
 * The mood board's palette editor offers four room-dressing overrides —
 * **Linens, Chairs, Florals, Lighting warmth**. All four are saved. All four
 * survive `sanitizeRolePalette`. `resolveRoomDressing` resolves all four.
 *
 * And the 3D room read exactly two of them.
 *
 * A couple picked a chair colour and a floral colour, saw them persist, came
 * back to them, and the room never changed. Nothing errored, nothing was
 * missing, nothing looked broken — their work simply had no effect. That is the
 * defect this file exists to keep fixed.
 *
 * ─── THE HALF THAT IS EASY TO BREAK WHILE FIXING IT ──────────────────────
 * `resolveRoomDressing` does not only pass overrides through; it also DERIVES a
 * colour when the couple set none, and it derives different slots than the scene
 * renders — chairs from `reception[2]` where the room uses `wall`
 * (`reception[3]`), florals from raw `reception[0]` where the room uses a
 * lightened accent. Wiring that helper straight into the scene would have
 * restyled **every existing room** on the way past.
 *
 * So both directions are pinned here, and the second matters more:
 *
 *   1. an override the couple SET must reach the room
 *   2. an event with NO override must render byte-identically to before
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { resolvePalette, resolvePaletteFromRoles } from './seating-3d';
import type { RolePalette } from './mood-board';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

const RECEPTION = ['#8e3b5b', '#f3e7ec', '#2a2030', '#3a2c40'];

/* ── 2 · THE SAFETY HALF. No override → nothing moves. ─────────────────── */

test('an event with NO room-dressing renders exactly as before', () => {
  const before = resolvePaletteFromRoles({ reception: RECEPTION } as RolePalette);
  assert.equal(before.chairs, undefined, 'chairs must be ABSENT, not derived');
  assert.equal(before.florals, undefined, 'florals must be ABSENT, not derived');
  // And the five original slots are untouched by the widening.
  assert.deepEqual(
    { ambient: before.ambient, floor: before.floor, table: before.table, accent: before.accent, wall: before.wall },
    { ambient: '#8e3b5b', floor: '#2a2030', table: '#f3e7ec', accent: '#8e3b5b', wall: '#3a2c40' },
  );
});

test('an empty palette is still the warm default, with no dressing invented', () => {
  const p = resolvePalette([]);
  assert.equal(p.chairs, undefined);
  assert.equal(p.florals, undefined);
});

test('a room_dressing that omits chairs/florals must NOT derive them', () => {
  /*
    THE CASE THE FIRST VERSION OF THIS FILE MISSED, found by sabotage.

    Test 1 covers "no room_dressing at all" — but `resolvePaletteFromRoles`
    returns early on that, so it passes even when the code derives. The real
    trap is a couple who set ONE knob (say linens) and not the others: the
    object exists, the branch runs, and `chairs: rd.chairs ?? <anything>` would
    quietly hand every such room a chair colour nobody chose.

    That is the exact shape that restyles existing weddings, so it is asserted
    directly rather than implied.
  */
  const p = resolvePaletteFromRoles({
    reception: RECEPTION,
    room_dressing: { linens: '#111111' },
  } as RolePalette);
  assert.equal(p.table, '#111111', 'the knob they DID set applies');
  assert.equal(p.chairs, undefined, 'chairs must stay absent — the room falls back to `wall`');
  assert.equal(p.florals, undefined, 'florals must stay absent — blooms keep the accent mix');
});

test('setting only ONE knob leaves the other three alone', () => {
  const only = resolvePaletteFromRoles({
    reception: RECEPTION,
    room_dressing: { chairs: '#123456' },
  } as RolePalette);
  assert.equal(only.chairs, '#123456');
  assert.equal(only.florals, undefined, 'a chair override must not conjure a floral one');
  assert.equal(only.table, '#f3e7ec', 'linens untouched');
  assert.equal(only.ambient, '#8e3b5b', 'lighting untouched');
});

/* ── 1 · THE POINT. An override reaches the room. ──────────────────────── */

test('all four overrides reach the palette the scene renders', () => {
  const p = resolvePaletteFromRoles({
    reception: RECEPTION,
    room_dressing: {
      linens: '#111111',
      chairs: '#222222',
      florals: '#333333',
      lighting_warmth: '#444444',
    },
  } as RolePalette);
  assert.equal(p.table, '#111111', 'linens → table');
  assert.equal(p.chairs, '#222222', 'chairs → chairs');
  assert.equal(p.florals, '#333333', 'florals → florals');
  assert.equal(p.ambient, '#444444', 'lighting_warmth → ambient');
});

/* ── The render sites. The resolver is only half the path. ─────────────── */

test('every InstancedChairs mount uses the chair override, falling back to wall', () => {
  const mounts = [
    'dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx',
    '_components/plan3d/plan3d-scene.tsx',
    '[slug]/venue/_components/guest-venue-3d.tsx',
  ];
  for (const rel of mounts) {
    const src = stripComments(readFileSync(join(APP, rel), 'utf8'));
    const at = src.indexOf('<InstancedChairs');
    assert.ok(at > 0, `${rel}: no <InstancedChairs> — has it moved?`);
    const mount = src.slice(at, src.indexOf('/>', at));
    assert.match(
      mount,
      /color=\{palette\.chairs \?\? palette\.wall\}/,
      `${rel}: chairs still render a fixed slot. The couple's chair colour is ` +
        'saved, preserved and read by nothing — which is the bug.',
    );
  }
});

test('blooms use the floral override, falling back to the accent mix', () => {
  const src = stripComments(readFileSync(join(APP, '_components/plan3d/venue-decor.tsx'), 'utf8'));
  const fn = src.slice(src.indexOf('function bloomColor'), src.indexOf('function leafColor'));
  assert.match(fn, /palette\.florals \?\?/, 'bloomColor ignores the floral override');
  assert.match(
    fn,
    /mix\(palette\.accent, '#ffffff', 0\.35\)/,
    'the no-override fallback must stay the lightened accent — swapping it for ' +
      "resolveRoomDressing's raw reception[0] would deepen every existing room's blooms",
  );
});

/* ── The disagreement, recorded so it is a decision and not a surprise. ── */

test('resolveRoomDressing and the scene still derive different slots', () => {
  // NOT a bug being asserted as correct — a known divergence being pinned so it
  // cannot drift further unnoticed. The editor's own preview derives chairs from
  // reception[2]; the room renders reception[3]. Reconciling them CHANGES how
  // every existing room looks, so it is an owner call, not a tidy-up. If someone
  // reconciles them deliberately, this test is the one to delete.
  const scene = resolvePaletteFromRoles({ reception: RECEPTION } as RolePalette);
  assert.equal(scene.wall, RECEPTION[3], 'the room dresses chairs from reception[3]');
  // resolveRoomDressing (lib/mood-board) uses reception[2] for the same surface.
  assert.notEqual(RECEPTION[2], RECEPTION[3], 'fixture must make the two distinguishable');
});
