/**
 * A GARMENT IS A SOLID, NOT A CUT-OUT.
 *
 * The owner, looking at a gown in the room: "all clothes are just half and not
 * wrapped around."
 *
 * They were not. The gown is a full 360° lathe — the geometry goes all the way
 * round. TWO rendering facts made it read as a flat panel:
 *
 *   1. the profile returned to the axis only at the HEM, so the collar end was
 *      an open tube and a camera above the shoulder looked down inside it;
 *   2. every outfit material was FrontSide, so the far half of the skirt was
 *      culled — leaving the front shell, hard straight silhouette cuts, and a
 *      chevron hem where the open bottom showed through.
 *
 * `chibi-figure.tsx` already names the cure — "closed lathes + DoubleSide" —
 * and `lib/chibi-geometry.ts` enforces the first half with `closedLatheProfile`.
 * Half of that law had shipped here; this pins both halves.
 *
 * ⚠ THE PAIRING IS THE POINT. Either alone still reads as cut open: caps
 * without DoubleSide still discards the far side; DoubleSide without caps
 * still shows a hollow neck. So both are asserted, and a sabotage removing
 * either must go red.
 *
 * Strictly additive: two-sided rendering can only REVEAL surfaces that were
 * culled and can never remove one, and a cap only closes a hole. No existing
 * room loses anything it was drawing — which is what makes this safe to apply
 * to rooms couples have already shown suppliers.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { latheProfile } from '@/app/_components/plan3d/kit/outfits';

const OUTFITS = join(
  import.meta.dirname, '..', 'app', '_components', 'plan3d', 'kit', 'outfits.ts',
);
const src = () => stripComments(readFileSync(OUTFITS, 'utf8'));

/* ── half one: the lathe is watertight ───────────────────────────────────── */

test('a garment profile returns to the axis at BOTH ends', () => {
  // A dress-form profile: collar → bust → waist → hips → hem. Neither end sits
  // on the axis, so latheProfile must add both caps itself.
  const geo = latheProfile([
    [0.045, 1.3], [0.15, 1.24], [0.165, 1.12], [0.105, 0.97], [0.21, 0.42], [0.25, 0.12],
  ]);
  const pos = geo.getAttribute('position');
  let minRadius = Infinity;
  let topOnAxis = false;
  let bottomOnAxis = false;
  for (let i = 0; i < pos.count; i += 1) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    minRadius = Math.min(minRadius, r);
    if (r < 0.01 && pos.getY(i) > 1.2) topOnAxis = true;
    if (r < 0.01 && pos.getY(i) < 0.2) bottomOnAxis = true;
  }
  assert.ok(minRadius < 0.01, 'no vertex reaches the axis — the lathe is an open tube');
  assert.ok(topOnAxis, 'the COLLAR end never closes: a camera above the shoulder sees inside');
  assert.ok(bottomOnAxis, 'the HEM never closes: a low camera sees up inside');
});

/* ── half two: both faces are drawn ──────────────────────────────────────── */

/** The body of one exported function, so the assertion can be scoped to
 *  GARMENTS. An earlier version counted every material in the file and went red
 *  against correct code: `mannequinMaterial` is skin — closed capsules, where
 *  two-sided rendering is pure cost and no benefit. The law applies to hollow
 *  lathes, not to everything that happens to live in this file. */
function fnBody(s: string, name: string): string {
  const start = s.indexOf(`export function ${name}(`);
  assert.ok(start !== -1, `${name} moved`);
  const next = s.indexOf('\nexport function ', start + 1);
  return s.slice(start, next === -1 ? undefined : next);
}

test('every GARMENT material renders both faces', () => {
  const s = src();
  for (const fn of ['outfitMaterial', 'trouserMaterial']) {
    const body = fnBody(s, fn);
    const materials = (body.match(/new THREE\.MeshStandardMaterial\(/g) ?? []).length;
    const sided = (body.match(/side: OUTFIT_SIDE/g) ?? []).length;
    assert.ok(materials > 0, `no materials in ${fn} — has it moved?`);
    assert.equal(
      sided,
      materials,
      `${fn}: ${materials - sided} garment material(s) still cull their back faces, ` +
        'so that garment still reads as half a shell.',
    );
  }
  assert.match(s, /const OUTFIT_SIDE = THREE\.DoubleSide/, 'the law must be DoubleSide');
});

test('the body is NOT made two-sided — the law is for hollow shells', () => {
  // Skin is closed capsules and spheres. Two-sided rendering there doubles the
  // fragment work for surfaces no camera can ever see, on a phone.
  assert.doesNotMatch(
    fnBody(src(), 'mannequinMaterial'),
    /side: OUTFIT_SIDE/,
    'the mannequin body is a solid; culling its back faces is correct',
  );
});

/* ── the pairing ─────────────────────────────────────────────────────────── */

test('the two halves stay together', () => {
  // Documented as one law in chibi-figure.tsx. Either half alone still reads as
  // cut open, so neither may be removed on the grounds that the other is there.
  const s = src();
  assert.match(s, /pts\.push\(new THREE\.Vector2\(0\.001, last\[1\]\)\)/, 'hem cap');
  assert.match(s, /new THREE\.Vector2\(0\.001, first\[1\]\)/, 'collar cap');
  assert.match(s, /side: OUTFIT_SIDE/, 'two-sided rendering');
});
