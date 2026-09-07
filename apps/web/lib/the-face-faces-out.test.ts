/**
 * THE FACE FACES OUT — owner 2026-09-06, looking at production: "heritage and
 * blocky's face seem wrong" · "chibi looks like a female and heritage and
 * block looks like a male". Three defects, measured on geometry, not eyes:
 *   1 · the face sat INSIDE the head (scaled but never pushed proud);
 *   2 · the long hair caps wrapped the face (round) or hid inside the box
 *       head (blocky);
 *   3 · the rig styles had no body type.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { stripComments } from './strip-comments';
import { rigFaceGeometry, rigHeadFrontZ, RIG_FACE_PROUD_M } from '@/app/_components/plan3d/kit/rig-face';
import { hairCapGeometry, HAIR_CROWN_THETA, HAIR_FACE_OPENING_HALF } from '@/app/_components/plan3d/kit/hair-cap';
import { defaultHeritageConfig, validateHeritageConfig, resolveHeritageConfig, heritageFigureSpec, HERITAGE_BODY_TYPES } from './heritage-config';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('the face sits PROUD of the head front, on both kits, for every variant', () => {
  for (const kit of ['round', 'blocky'] as const) {
    for (let v = 0; v < 3; v++) {
      const g = rigFaceGeometry(v, kit)!;
      g.computeBoundingBox();
      const maxZ = g.boundingBox!.max.z;
      assert.ok(Math.abs(maxZ - (rigHeadFrontZ(kit) + RIG_FACE_PROUD_M)) < 1e-6, `${kit}/${v}: furthest point ${maxZ} vs front ${rigHeadFrontZ(kit)}`);
      // and nothing of it is BEHIND the head centre (it is a face, not a mask around the skull)
      assert.ok(g.boundingBox!.min.z > 0, `${kit}/${v}: entirely in front`);
    }
  }
  assert.notEqual(rigFaceGeometry(0, 'round'), rigFaceGeometry(0, 'blocky'), 'one geometry per kit');
});

test('round hair: the crown covers the top; a long drape leaves the FACE open', () => {
  const long = hairCapGeometry(5, 'round');
  const pos = long.getAttribute('position');
  let frontLowVerts = 0, backLowVerts = 0, crownVerts = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, y, z);
    const theta = Math.acos(y / r); // from the top
    if (theta < HAIR_CROWN_THETA - 0.05) crownVerts++;
    else if (theta > HAIR_CROWN_THETA + 0.05) {
      // below the brow: is this vertex in the face opening?
      const phi = Math.atan2(z, -x); // three.js sphere param: +Z ⇒ φ = π/2
      const fromNose = Math.abs(((phi - Math.PI / 2 + Math.PI) % (2 * Math.PI)) - Math.PI);
      if (fromNose < HAIR_FACE_OPENING_HALF - 0.05) frontLowVerts++; else backLowVerts++;
    }
  }
  assert.ok(crownVerts > 0, 'a crown');
  assert.ok(backLowVerts > 0, 'a drape down the back and sides');
  assert.equal(frontLowVerts, 0, 'nothing below the brow in front of the face');
  // a crop has no drape at all
  const crop = hairCapGeometry(0, 'round');
  const cpos = crop.getAttribute('position');
  let below = 0;
  for (let i = 0; i < cpos.count; i++) { const r = Math.hypot(cpos.getX(i), cpos.getY(i), cpos.getZ(i)); if (Math.acos(cpos.getY(i) / r) > HAIR_CROWN_THETA + 0.05) below++; }
  assert.equal(below, 0);
});

test('blocky hair: a helmet ABOVE the box head, never hidden inside it', () => {
  for (let s = 0; s < 6; s++) {
    const g = hairCapGeometry(s, 'blocky');
    g.computeBoundingBox();
    const b = g.boundingBox!;
    assert.ok(b.max.y > 0.15 + 0.03, `style ${s}: rises above the head top (0.15)`);
    assert.ok(b.max.x > 0.16 && b.max.z > 0.15, `style ${s}: wider and deeper than the head, so it shows`);
  }
  const long = hairCapGeometry(5, 'blocky'); long.computeBoundingBox();
  const crop = hairCapGeometry(0, 'blocky'); crop.computeBoundingBox();
  assert.ok(long.boundingBox!.min.y < crop.boundingBox!.min.y - 0.1, 'a long style drops a back panel');
  assert.ok(long.boundingBox!.min.z < -0.15, 'the panel hangs behind the head');
  assert.ok(long.boundingBox!.max.z < 0.18, 'and never in front of the face');
});

test('rig styles have a body: two builds, hash-defaulted, outfit following the body, and the spec carries it', () => {
  assert.deepEqual([...HERITAGE_BODY_TYPES], ['female', 'male']);
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const d = defaultHeritageConfig(`guest-${i}`);
    seen.add(d.bodyType);
    assert.deepEqual(validateHeritageConfig(d), []);
    if (d.bodyType === 'female') assert.ok(['gown', 'filipiniana'].includes(d.outfit), 'female default reads female');
    else assert.ok(['suit', 'barong'].includes(d.outfit), 'male default reads male');
  }
  assert.equal(seen.size, 2, 'both builds appear across ids');
  const d = defaultHeritageConfig('x');
  assert.ok(validateHeritageConfig({ ...d, bodyType: 'other' }).some((e) => e.includes('bodyType')));
  const { bodyType: _drop, ...noBody } = d; void _drop;
  assert.ok(validateHeritageConfig(noBody).some((e) => e.includes('bodyType')), 'required');
  assert.equal(resolveHeritageConfig('x', { style: 'heritage', bodyType: 'nope' }).bodyType, d.bodyType, 'repairs');
  assert.equal(heritageFigureSpec('x', { ...d, bodyType: 'female' }, '').build, 'female');
  assert.equal(heritageFigureSpec('x', { ...d, bodyType: 'male' }, '').build, 'male');
});

test('the rig applies the build and passes its kit to face and hair', () => {
  const f = read('app/_components/plan3d/kit/figure.tsx');
  assert.match(f, /const female = look && spec\.build === 'female';/, 'build only ever applies to a dressed figure');
  assert.match(f, /scale=\{hipScale\}/); assert.match(f, /scale=\{torsoScale\}/);
  assert.match(f, /position=\{\[side \* shoulderX, SHOULDER_Y, 0\]\}/);
  assert.match(f, /rigFaceGeometry\(resolveFigureLook\(spec\)\.faceVariant, kit\)/);
  assert.match(f, /hairCapGeometry\(spec\.hairStyle, kit\)/);
  const m = read('app/[slug]/avatar/_components/avatar-maker.tsx');
  assert.match(m, /\{HERITAGE_BODY_TYPES\.map\(/, 'the maker offers the body');
});
