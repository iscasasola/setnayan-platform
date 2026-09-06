/**
 * A FACE, A HAND, AND A SECOND DOOR — owner 2026-09-06 ("any improvements you
 * can do for the 3 styles?" → "go"). Three cosmetic-but-visible fixes:
 *   1 · dressed rig figures (Heritage, Blocky) get a face — the chibi's ink,
 *       cloned and scaled to the rig head, by the look's faceVariant;
 *   2 · dressed rig figures get skin hands at the forearm ends;
 *   3 · the seat pass carries a second door into the avatar maker.
 * The blob is untouched: every addition sits behind the SAME `look` gate skin
 * and hair use, so a guest without an avatar renders byte-for-byte as before.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { rigFaceGeometry, RIG_FACE_SCALE, RIG_FACE_VARIANTS, RIG_HEAD_R } from '@/app/_components/plan3d/kit/rig-face';
import { chibiFaceInkGeo, CHIBI_HEAD_R } from './chibi-geometry';
import { FACE_VARIANT_COUNT } from './figure-rig';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

const cz0 = (() => { const g = chibiFaceInkGeo('dots', 'smile', 'none')!; g.computeBoundingBox(); return g.boundingBox!.max.z; })();

test('the rig face is the chibi ink, scaled head-to-head, on a CLONE', () => {
  assert.equal(RIG_FACE_VARIANTS.length, FACE_VARIANT_COUNT);
  assert.ok(Math.abs(RIG_FACE_SCALE - RIG_HEAD_R / CHIBI_HEAD_R) < 1e-9);
  const rig = rigFaceGeometry(0)!;
  const chibi = chibiFaceInkGeo('dots', 'smile', 'none')!;
  rig.computeBoundingBox(); chibi.computeBoundingBox();
  // Scaled head-to-head (the WIDTH proves the scale; the depth is then pushed
  // proud of the head — see the-face-faces-out.test.ts), and a clone.
  const rw = rig.boundingBox!.max.x - rig.boundingBox!.min.x, cw = chibi.boundingBox!.max.x - chibi.boundingBox!.min.x;
  assert.ok(Math.abs(rw - cw * RIG_FACE_SCALE) < 1e-6, 'scaled to the smaller head');
  assert.notEqual(rig, chibi, 'a clone — the chibi cache is shared with every mounted chibi');
  chibi.computeBoundingBox();
  assert.ok(Math.abs(chibi.boundingBox!.max.z - cz0) < 1e-9, 'the shared chibi ink was not moved');
  assert.equal(rigFaceGeometry(3), rigFaceGeometry(0), 'variants wrap');
  assert.equal(rigFaceGeometry(-1), rigFaceGeometry(2), 'negative wraps too');
});

test('face and hands mount ONLY under the look gate — the blob keeps no face and its stump', () => {
  const f = read('app/_components/plan3d/kit/figure.tsx');
  assert.match(f, /const faceGeo = look \? rigFaceGeometry\(resolveFigureLook\(spec\)\.faceVariant, kit\) : null;/);
  assert.match(f, /\{faceGeo \? \(\s*<mesh geometry=\{faceGeo\} material=\{plainMaterial\(CHIBI_FACE_INK\)\} castShadow=\{false\} \/>/);
  const hands = f.match(/\{look \? \(\s*<mesh\s+geometry=\{G\.joint\}\s+material=\{headMat\}\s+position=\{\[0, -FOREARM_LEN, 0\]\}/g) ?? [];
  assert.equal(hands.length, 1, 'one hand mount inside the mirrored arm chain (the chain renders both sides)');
  assert.match(f, /scale=\{\[HAND_R, HAND_R \* 0\.9, HAND_R\]\}/);
  // the gate is the same `look` skin and hair use — no second predicate
  assert.doesNotMatch(f, /spec\.kit === 'blocky' \?[^\n]*hand/i);
});

test('the seat pass carries the second door, gated on the same flag as the first', () => {
  const seat = read('app/[slug]/seat/page.tsx');
  assert.match(seat, /avatarHref=\{guestAvatarsEnabled\(\) \? `\/\$\{slug\}\/avatar` : null\}/);
  const shell = seat; // SeatPassShell is private to the seat page
  assert.match(shell, /avatarHref\?: string \| null;/);
  assert.match(shell, /Make your avatar for the 3D room/);
  assert.match(shell, /\{avatarHref \? \(/, 'no door when null');
});
