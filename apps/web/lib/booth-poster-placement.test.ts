/**
 * BOOTH POSTER PLACEMENT — geometry + avoidance guard.
 *
 * The per-event poster stand (PR #3437) shipped with its offset measured off
 * the SHARED booth footprint (`BOOTH_FOOTPRINT_M.w` = 2.0 m) and a 0.42 m gap:
 *
 *     rotateLocalRad({ x: w / 2 + 0.42, z: -0.2 }, facingY)   // x = 1.42, always
 *
 * Two independent defects, both fixed by `boothPosterLocalOffset`:
 *
 * 1. WRONG BODY. Once a template resolves, the booth's body is its CHASSIS, and
 *    chassis widths run 1.8 m (DESK) to 3.4 m (BUFFET) — the shared 2.0 m
 *    footprint describes none of them reliably. The sibling `BoothSign` already
 *    reads per-chassis geometry (`signAnchor`); the poster did not.
 *
 * 2. THE STAND'S OWN WIDTH WAS NEVER COUNTED. `BoothPoster` draws a top rail at
 *    `maxW + 0.12` = 0.90 m, so the stand reaches 0.45 m either side of its
 *    origin — MORE than the 0.42 m gap the offset allowed. The stand therefore
 *    reached back inside the booth body on NINE of the ten chassis, including
 *    the 2.0 m ones the number was tuned for. Only DESK (1.8 m) cleared, by
 *    7 cm.
 *
 * These are pure-geometry facts, so they are cheap to pin and would otherwise
 * only ever be caught by someone looking at the right booth from the right
 * angle in a 3D scene — which is how this shipped in the first place.
 *
 * The obstacle half is covered too: the crowd-avoidance disc must sit where the
 * artwork actually is. Renderer and obstacle both call the SAME helper, and the
 * test below asserts the disc lands on the helper's offset — because a
 * renderer/obstacle drift puts the disc somewhere the poster isn't, which reads
 * as "guests walk through the banner" and is invisible to any test that checks
 * only one side.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOOTH_POSTER_FRAME,
  BOOTH_POSTER_HALF_W,
  boothPosterLocalOffset,
  templateBoothObstacles,
  boothChassisSpec,
} from '@/app/_components/plan3d/kit/booth-templates';
import { CHASSIS_SPECS } from '@/app/_components/plan3d/kit/booth-chassis';
import { BOOTH_FOOTPRINT_M, pctToWorld } from '@/lib/seating-3d';

const ROOM = { w: 20, d: 14 };

/** Minimum walking gap we require between the booth body and the stand. */
const MIN_GAP = 0.2;

test('the poster stand clears every chassis body — the shipped constant did not', () => {
  const offenders: string[] = [];

  for (const [kind, spec] of Object.entries(CHASSIS_SPECS)) {
    const { x } = boothPosterLocalOffset(spec);
    // The stand's INNER edge, i.e. the closest its geometry comes to centre.
    const innerEdge = x - BOOTH_POSTER_HALF_W;
    const bodyHalf = spec.w / 2;
    if (innerEdge < bodyHalf + MIN_GAP - 1e-9) {
      offenders.push(
        `${kind}: body half ${bodyHalf}, stand inner edge ${innerEdge.toFixed(3)}`,
      );
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Poster stand intersects (or crowds) these chassis:\n  ${offenders.join('\n  ')}`,
  );
});

test('the OLD hardcoded offset really did clip 9 of 10 chassis (regression is real, not theoretical)', () => {
  // Documents the defect this file exists to prevent. If someone "simplifies"
  // the helper back to a constant, the test above fires — and this one explains
  // why the constant was never right.
  const OLD_X = BOOTH_FOOTPRINT_M.w / 2 + 0.42; // 1.42
  const oldInnerEdge = OLD_X - BOOTH_POSTER_HALF_W; // 0.97

  const clipped = Object.entries(CHASSIS_SPECS).filter(
    ([, spec]) => oldInnerEdge < spec.w / 2,
  );

  assert.equal(
    clipped.length,
    9,
    `expected 9 clipping chassis under the old constant, got ${clipped.length}: ${clipped.map(([k]) => k).join(',')}`,
  );
  // BUFFET was the worst: 3.4 m body, stand 0.73 m inside it.
  assert.ok(oldInnerEdge < CHASSIS_SPECS.BUFFET.w / 2);
  // DESK was the ONLY chassis that cleared.
  assert.ok(oldInnerEdge > CHASSIS_SPECS.DESK.w / 2);
});

test('the offset scales with the chassis, not with a constant', () => {
  // BUFFET (3.4) must push the stand strictly further out than DESK (1.8).
  const buffet = boothPosterLocalOffset(CHASSIS_SPECS.BUFFET).x;
  const desk = boothPosterLocalOffset(CHASSIS_SPECS.DESK).x;
  assert.ok(
    buffet > desk,
    `BUFFET stand (${buffet}) must sit further out than DESK (${desk})`,
  );
  assert.ok(
    Math.abs(buffet - desk - (CHASSIS_SPECS.BUFFET.w - CHASSIS_SPECS.DESK.w) / 2) < 1e-9,
    'the delta must be exactly half the width difference',
  );
});

test('a generic (template-less) booth falls back to the shared footprint', () => {
  const generic = boothPosterLocalOffset(null);
  assert.equal(
    generic.x,
    BOOTH_FOOTPRINT_M.w / 2 + 0.25 + BOOTH_POSTER_HALF_W,
    'null spec must fall back to BOOTH_FOOTPRINT_M, never NaN',
  );
  assert.ok(Number.isFinite(generic.x) && Number.isFinite(generic.z));
});

// ── The obstacle half ────────────────────────────────────────────────────────

/** A booth whose template resolves to the widest chassis (catering → BUFFET). */
function boothWithPoster(posterUrl: string | null) {
  return {
    kind: 'catering',
    xPct: 50,
    yPct: 50,
    // `boothTemplateFor` resolves off vendor.category (catering -> BUFFET,
    // the widest chassis), NOT off `kind` — which is a booth_type.
    // boothAddonActive:true = the paid 3D Booth add-on is live, so the branded
    // poster (and its avoidance disc) render — boothIsBranded's second factor.
    vendor: { tier: 'enterprise', category: 'catering', posterUrl, logoUrl: null, boothAddonActive: true },
  } as unknown as Parameters<typeof templateBoothObstacles>[0][number];
}

test('a poster adds exactly one avoidance disc; no poster adds none', () => {
  const withPoster = templateBoothObstacles([boothWithPoster('r2://b/p.jpg')], ROOM);
  const without = templateBoothObstacles([boothWithPoster(null)], ROOM);

  assert.equal(
    withPoster.length - without.length,
    1,
    'the poster must contribute exactly one disc — no more, no fewer',
  );
});

// ⚠ SCOPE — what this next test can and CANNOT prove.
//
// It verifies that the disc `templateBoothObstacles` emits is exactly |offset|
// from the booth centre, i.e. that the obstacle path applies the helper's
// offset correctly through `rotateLocalRad` under any yaw. That is real.
//
// It does NOT prove the RENDERER uses the helper. `templateBoothObstacles`
// calls `boothPosterLocalOffset` internally, so computing the expectation from
// the same helper compares the module to itself — this test passes unchanged if
// venue-objects.tsx goes back to a hardcoded literal. The renderer is JSX in a
// `'use client'` module and there is no React render harness in this suite, so
// no test here can reach it.
//
// That cross-file invariant is enforced instead by
// `apps/web/scripts/lint-booth-poster-placement.mjs` (its own CI job), which
// scans the renderer's source for the banned literal and for the helper call.
// An earlier title on this test claimed "renderer/obstacle cannot drift",
// which overstated it; the guard is what makes that claim true.
test('the emitted disc is exactly |offset| from the booth centre, under any yaw', () => {
  const booth = boothWithPoster('r2://b/p.jpg');
  const withPoster = templateBoothObstacles([booth], ROOM);
  const without = templateBoothObstacles([boothWithPoster(null)], ROOM);

  // The one disc present only in the poster case.
  const extra = withPoster.find(
    (d) => !without.some((o) => o.c.x === d.c.x && o.c.z === d.c.z && o.r === d.r),
  );
  assert.ok(extra, 'could not isolate the poster disc');

  const centre = pctToWorld(50, 50, ROOM);
  const off = boothPosterLocalOffset(boothChassisSpec(booth));
  // Booth is dead-centre in the room, so boothFacingY yields a known heading;
  // rather than re-deriving it, assert the disc is exactly |off| away from the
  // booth centre — true under ANY yaw, since rotation preserves length.
  const dist = Math.hypot(extra.c.x - centre.x, extra.c.z - centre.z);
  const expected = Math.hypot(off.x, off.z);
  assert.ok(
    Math.abs(dist - expected) < 1e-6,
    `disc is ${dist.toFixed(4)} m from booth centre, artwork is ${expected.toFixed(4)} m — they have drifted`,
  );
});

test('the disc is at least as wide as the stand it protects', () => {
  const booth = boothWithPoster('r2://b/p.jpg');
  const withPoster = templateBoothObstacles([booth], ROOM);
  const without = templateBoothObstacles([boothWithPoster(null)], ROOM);
  const extra = withPoster.find(
    (d) => !without.some((o) => o.c.x === d.c.x && o.c.z === d.c.z && o.r === d.r),
  );
  assert.ok(extra);
  assert.ok(
    extra.r >= BOOTH_POSTER_HALF_W,
    `disc radius ${extra.r} is smaller than the stand's half-width ${BOOTH_POSTER_HALF_W} — walkers would clip the banner`,
  );
});

// ── The GENERIC (untemplated) branch ─────────────────────────────────────────
//
// venue-objects.tsx renders the poster in BOTH branches. The first pass of this
// fix only closed the templated one, leaving every untemplated booth on the old
// hardcoded 1.42 with no avoidance disc at all — and making the "single source
// of truth" comment false. These booths are reachable: `registration_desk`,
// `custom` and `unassigned` kinds all resolve no template, as do vendor
// categories like `accommodation`.

/** A booth that resolves NO template → the generic silhouette branch. */
function genericBoothWithPoster(posterUrl: string | null) {
  return {
    kind: 'registration_desk',
    xPct: 50,
    yPct: 50,
    // boothAddonActive:true = the paid 3D Booth add-on is live (boothIsBranded's
    // second factor), so the branded poster + its avoidance disc render.
    vendor: { tier: 'enterprise', posterUrl, logoUrl: null, boothAddonActive: true },
  } as unknown as Parameters<typeof templateBoothObstacles>[0][number];
}

test('the generic branch really is reachable (guard the premise, not just the fix)', () => {
  assert.equal(
    boothChassisSpec(genericBoothWithPoster('r2://b/p.jpg')),
    null,
    'if this ever resolves a template, these generic-branch tests stop testing anything',
  );
});

test('an untemplated booth with a poster gets an avoidance disc too', () => {
  const withPoster = templateBoothObstacles(
    [genericBoothWithPoster('r2://b/p.jpg')],
    ROOM,
  );
  const without = templateBoothObstacles([genericBoothWithPoster(null)], ROOM);
  assert.equal(
    withPoster.length - without.length,
    1,
    'the generic branch early-returns before the template path — the poster disc must sit above it',
  );
});

test('the untemplated booth keeps its historical disc, unchanged and first', () => {
  // Untemplated booths must steer EXACTLY as before; the poster disc is
  // strictly additive and must not displace or resize the original.
  const before = templateBoothObstacles([genericBoothWithPoster(null)], ROOM);
  const after = templateBoothObstacles(
    [genericBoothWithPoster('r2://b/p.jpg')],
    ROOM,
  );
  assert.equal(before.length, 1, 'a generic booth has exactly one historical disc');
  assert.deepEqual(
    after[0],
    before[0],
    'the historical generic disc must be untouched and still come first',
  );
});

test('the generic poster clears the shared footprint it stands beside', () => {
  const off = boothPosterLocalOffset(null);
  assert.ok(
    off.x - BOOTH_POSTER_HALF_W >= BOOTH_FOOTPRINT_M.w / 2,
    'the generic stand must not clip the generic silhouette either',
  );
});

// ── Disc ORDER is load-bearing ───────────────────────────────────────────────

test('the poster disc is emitted LAST for its booth, in both branches', () => {
  // NOT cosmetic. `pushOutOfDiscs` (lib/seating-3d.ts) walks discs sequentially
  // and each expulsion MOVES the point, so a walker inside two overlapping
  // discs ends up on the edge of whichever disc was visited LAST. The poster
  // stand overlaps its own booth's chassis/staff discs by construction, so if
  // the poster disc is emitted BEFORE them, a later chassis expulsion can shove
  // the walker straight back through the banner — silently undoing the fix
  // while every "is there a disc?" test still passes.
  //
  // An earlier draft of this fix hoisted the poster push above the generic
  // early-return, which would have made it FIRST for every templated booth.
  for (const make of [boothWithPoster, genericBoothWithPoster]) {
    const discs = templateBoothObstacles([make('r2://b/p.jpg')], ROOM);
    const baseline = templateBoothObstacles([make(null)], ROOM);
    const last = discs[discs.length - 1];
    assert.ok(last, 'expected at least one disc');
    assert.equal(
      discs.length,
      baseline.length + 1,
      'exactly one disc should be added by the poster',
    );
    assert.equal(
      last.r,
      BOOTH_POSTER_HALF_W + 0.4,
      'the LAST disc for a poster booth must be the poster disc',
    );
  }
});

// ── The constant that started all this ───────────────────────────────────────

test('the stand half-width is DERIVED from the frame, not hand-copied', () => {
  // The original defect was a hand-copied 0.42 for a stand that is 0.45 wide.
  // Deriving it means editing BoothPoster's frame can never silently invalidate
  // the placement maths again.
  assert.equal(
    BOOTH_POSTER_HALF_W,
    (BOOTH_POSTER_FRAME.maxW + BOOTH_POSTER_FRAME.railOverhang) / 2,
  );
  assert.equal(BOOTH_POSTER_HALF_W, 0.45, 'the rendered stand is 0.90 m wide');
});

test('an unbrandable vendor gets no poster disc (disc obeys the same gate as the art)', () => {
  // boothCanBrand is false for solo/verified tiers — the renderer draws no
  // poster for them, so the obstacle must not invent one.
  const solo = {
    kind: 'catering',
    xPct: 50,
    yPct: 50,
    vendor: { tier: 'solo', category: 'catering', posterUrl: 'r2://b/p.jpg', logoUrl: null },
  } as unknown as Parameters<typeof templateBoothObstacles>[0][number];

  assert.equal(
    templateBoothObstacles([solo], ROOM).length,
    templateBoothObstacles([boothWithPoster(null)], ROOM).length,
    'a non-brandable vendor must not get a poster disc',
  );
});
