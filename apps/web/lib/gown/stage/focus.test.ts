/**
 * 👗 gown/stage/focus — each close-up is measured on her live body (v204), held to prototype v210's own aims
 * (`v210-focus.fixture.json`, captured from the prototype): her whole figure, bust, underbust, waist, hips, shoulders,
 * arm, legs and feet, on two bodies, in flat shoes and in heels.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { startingGownConfig, type GownBodyKey, type GownBodyVals } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { solveGownBody } from '../body/solve';
import { GOWN_STANDING_POSES, emptyGownPose, gownClearArms, gownPoseBody } from '../motion/poses';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildDress, emptyDress } from '../dress/build';
import { GOWN_AIM_OF, GOWN_FOCUS, gownAimDist, gownAimOf, gownBodyMarks, type GownFocusKey } from './focus';

type Aim = { c: number[]; pts: number[][]; pitch: number | null };
type Row = { name: string; heel: number; vals: GownBodyVals; floorY: number; hemR: number; aims: Record<string, Aim | null> };
const REF = JSON.parse(readFileSync(join(__dirname, 'v210-focus.fixture.json'), 'utf8')) as { rows: Row[] };
const GLB = join(__dirname, '../../../public/gown/female.glb');
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(GLB); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};

async function standing(row: Row) {
  const B = await body();
  Object.assign(B.vals, row.vals);
  B.fine = { athletic: false, bustT: 0, given: row.name === 'default' ? [] : (['height', 'bust', 'waist', 'underbust', 'hips'] as GownBodyKey[]) };
  solveGownBody(B);
  const g = { ...startingGownConfig(), heel: row.heel }, S = emptyGownPose(B), T = emptyEnvelope(), D = emptyDress();
  S.pose = 'a'; S.t = 1; S.lastQ = new Array(B.nb).fill(null);
  gownPoseBody(B, S, row.heel);
  buildEnvelope(B, T);
  buildDress(B, T, D, g, S.floorY, S.floorStand ?? S.floorY, { standing: GOWN_STANDING_POSES.includes(S.pose) });
  gownClearArms(B, S, T, row.heel);
  return { B, S, D };
}

test('the measurement close-ups land where the prototype lands, on her live body', async () => {
  for (const row of REF.rows) {
    const { B, S } = await standing(row);
    assert.ok(Math.abs(S.floorY - row.floorY) < 1e-4, `${row.name} heel ${row.heel}: where she stands ${S.floorY} vs ${row.floorY}`);
    // The gown's own hem radius as the prototype drew it (its skirt is v207's; the aims are what is held here).
    const m = gownBodyMarks(B, S.floorY, { hemR: row.hemR });
    for (const [key, want] of Object.entries(row.aims)) {
      if (!want) continue;
      const got = gownAimOf(m, key as GownFocusKey), cm = B.P.S * 100;
      const off = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!) * cm;
      assert.ok(off(got.c, want.c) < 0.2, `${row.name} heel ${row.heel} ${key}: the centre is ${off(got.c, want.c).toFixed(2)} cm off`);
      assert.equal(got.pts.length, want.pts.length, `${key}: the points to keep in view`);
      const worst = Math.max(...got.pts.map((p, i) => off(p, want.pts[i]!)));
      assert.ok(worst < 0.2, `${row.name} heel ${row.heel} ${key}: a point to keep in view is ${worst.toFixed(2)} cm off`);
      assert.equal(got.pitch ?? null, want.pitch, `${key}: the view from above`);
    }
  }
});

test('in heels the feet close-up drops with the floor she stands on', async () => {
  const flat = REF.rows.find((r) => r.name === 'default' && r.heel === 0)!, heels = REF.rows.find((r) => r.name === 'default' && r.heel === 7)!;
  assert.notDeepEqual(flat.aims.heels!.c, heels.aims.heels!.c, 'the prototype moves it');
  const a = await standing(flat), fa = gownAimOf(gownBodyMarks(a.B, a.S.floorY, null), 'heels').c[1];
  const b = await standing(heels), fb = gownAimOf(gownBodyMarks(b.B, b.S.floorY, null), 'heels').c[1];
  assert.ok(fb < fa - 0.01, 'the feet sit lower in heels');
});

test('every focus key has an aim, and the fit keeps every point inside the view', () => {
  for (const k of Object.keys(GOWN_FOCUS) as GownFocusKey[]) assert.ok(GOWN_AIM_OF[k], `${k} has an aim`);
  const c = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(0, 0, 1), pts = [new THREE.Vector3(0.5, 1, 0), new THREE.Vector3(0, 1.4, 0)];
  const view = { fov: 28, aspect: 0.5, up: new THREE.Vector3(0, 1, 0), z: 0.1, fitDist: 5, min: 1.2, max: 9 };
  const d = gownAimDist(c, pts, dir, view), th = Math.tan(THREE.MathUtils.degToRad(14)) * 0.5;
  assert.ok(0.5 / d <= 0.84 * th + 1e-9, 'a narrow phone still fits her width');
  assert.ok(gownAimDist(c, [], dir, { ...view, z: 0.1 }) >= 1.2, 'never closer than the stage allows');
});
