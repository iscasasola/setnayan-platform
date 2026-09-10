/**
 * THE CHIBI BOUNCES — IT DOES NOT GLIDE.
 *
 * `guest-venue-3d.tsx` carried this warning: "NO GAIT ON THE CHIBI PATH. The
 * chibi rig is jointless below the neck… an avatar figure GLIDES where the blob
 * runs. That is a real regression in motion, and it is why
 * NEXT_PUBLIC_FIGURE_CHIBI must NOT be flipped on until the rig spec's § 11
 * pose PR lands."
 *
 * That flag has been "true" in production. So the regression the comment warns
 * about was live: any guest who made an avatar slid across the floor.
 *
 * 🔑 THE CONSTRAINT NEVER APPLIED TO A HOP. A leg cycle needs joints. A hop is
 * a whole-body translate and scale, so the merge that removed the walk left the
 * bounce entirely available. The fix is not the § 11 pose work — it is motion
 * that does not need legs at all.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { chibiHop, CHIBI_HOP_HEIGHT } from './figure-rig';

const WALK = join(
  import.meta.dirname, '..', 'app', '[slug]', 'venue', '_components', 'guest-venue-3d.tsx',
);
const src = () => stripComments(readFileSync(WALK, 'utf8'));

/* ── the motion ──────────────────────────────────────────────────────────── */

test('it actually leaves the floor', () => {
  let peak = 0;
  for (let p = 0; p < 40; p += 0.05) peak = Math.max(peak, chibiHop(p).lift);
  assert.ok(peak > CHIBI_HOP_HEIGHT * 0.9, `barely lifts (${peak}) — that is still a glide`);
});

test('it touches down — a hop has a ground contact, a hover does not', () => {
  let lowest = Infinity;
  for (let p = 0; p < 40; p += 0.05) lowest = Math.min(lowest, chibiHop(p).lift);
  assert.ok(lowest < 1e-6, `never reaches the floor (${lowest}) — that is hovering, not hopping`);
});

test('it never sinks below the floor', () => {
  for (let p = 0; p < 40; p += 0.05) {
    assert.ok(chibiHop(p).lift >= 0, `lift went negative at phase ${p} — the figure clips the floor`);
  }
});

test('squash is strongest on landing and gone at the apex', () => {
  // This is what separates a bounce from moving up and down.
  let atGround = { scaleY: 1 };
  let atApex = { scaleY: 1 };
  for (let p = 0; p < 40; p += 0.01) {
    const h = chibiHop(p);
    if (h.lift < 1e-4) atGround = h;
    if (h.lift > CHIBI_HOP_HEIGHT * 0.98) atApex = h;
  }
  assert.ok(atGround.scaleY < 0.95, `no squash on landing (${atGround.scaleY})`);
  assert.ok(atApex.scaleY > 0.99, `still squashed at the apex (${atApex.scaleY}) — reads as a wobble`);
});

test('volume reads as preserved — it squashes, it does not shrink', () => {
  for (let p = 0; p < 40; p += 0.05) {
    const { scaleY, scaleXZ } = chibiHop(p);
    if (scaleY < 1) assert.ok(scaleXZ > 1, 'flattening must widen, or the figure looks deflated');
  }
});

test('amp 0 is EXACT neutral — a standing chibi is untransformed', () => {
  // The settle relies on this: on arrival amp eases to 0 and the figure must
  // land at exactly y=0, scale 1. "Close to neutral" would leave it floating a
  // millimetre off the floor forever.
  assert.deepEqual(chibiHop(1.234, 0), { lift: 0, scaleY: 1, scaleXZ: 1 });
  assert.deepEqual(chibiHop(99, 0), { lift: 0, scaleY: 1, scaleXZ: 1 });
});

/* ── the wiring ──────────────────────────────────────────────────────────── */

test('only the CHIBI bounces — the blob keeps its own gait', () => {
  // venue-avatars.ts guarantees a guest without an avatar renders exactly as
  // before. Wrapping the shared branch would break that for everyone.
  // Scoped to the wrapper's own span. A whole-file indexOf answers about the
  // FIRST match in a 1400-line file — here that was a different figure mount
  // entirely (the SitController's seated branch), so the assertion was
  // reporting on code it was not about.
  const s = src();
  // COUNTED, not found. Checking only the first wrapper let a sabotage add a
  // SECOND one around the blob and stay green — the span this assertion reads
  // was still the chibi's. Exactly one figure bounces.
  const wrappers = (s.match(/<ChibiBounce/g) ?? []).length;
  assert.equal(wrappers, 1, `${wrappers} ChibiBounce mounts — exactly one figure may bounce`);
  const open = s.indexOf('<ChibiBounce');
  assert.ok(open !== -1, 'the chibi is not wrapped — it still glides');
  const close = s.indexOf('</ChibiBounce>', open);
  assert.ok(close !== -1, 'ChibiBounce is not closed');
  const inside = s.slice(open, close);
  assert.match(inside, /<ChibiFigure/, 'the wrapper must contain the chibi');
  assert.doesNotMatch(
    inside,
    /<Figure\b/,
    'the blob must NOT be inside the bounce — venue-avatars.ts guarantees a guest ' +
      'without an avatar renders exactly as before, and it has its own gait already.',
  );
});

test('the bounce settles instead of freezing mid-air', () => {
  assert.match(
    src(),
    /moving \? 1 : 0/,
    'amp must fall to 0 when the walk ends, or the gait clock freezes the figure ' +
      'at whatever height the last frame caught.',
  );
});

test('reduced motion gets no bounce', () => {
  const s = src();
  const at = s.indexOf('function ChibiBounce');
  assert.ok(at !== -1, 'ChibiBounce moved');
  assert.match(
    s.slice(at, at + 900),
    /reduced/,
    'a viewer who asked not to be moved at must not be bounced — this is decoration',
  );
});
