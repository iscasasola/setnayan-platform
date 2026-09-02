/**
 * The public guest walk's two movement contracts.
 *
 * Both defects this pins were on the PUBLIC surface only — the demo, the lab
 * and the kit already behaved correctly, which is exactly why neither showed
 * up as a failing test: the shared code was fine and the one surface guests
 * actually use was the exception.
 *
 *   1. REDUCED MOTION — every other surface keeps a "complete without
 *      animating" contract (demo teleports, lab skips the walk, kit holds
 *      STAND_BASE, SitController snaps but still fires onSeated). The guest
 *      walk's hook only stopped the beacon pulse, so a viewer who asked for
 *      reduced motion still got a FROZEN mannequin gliding 2.2 m/s across the
 *      room on load — motion stripped of the gait that explains it.
 *
 *   2. THE SNAP TURN — `rotation.y = Math.atan2(dx, dz)` rotated the body in a
 *      single frame, so a tap behind the figure flipped it 180° instantly.
 *
 * `lerpAngle` is pure and directly testable; the reduced-motion short-circuit
 * lives inside a `useFrame` and is pinned by a source guard instead.
 *
 * Run via `test:unit` (tsx --test "lib/**\/*.test.ts") from `apps/web`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerpAngle, damp } from './figure-rig';

const WALK = join(
  import.meta.dirname,
  '..',
  'app',
  '[slug]',
  'venue',
  '_components',
  'guest-venue-3d.tsx',
);

// ── 2 · THE TURN. The property that matters is SHORTEST ARC: a heading must
// never spin the long way round, which is what makes a 180° tap look like a
// glitch rather than a turn.
test('lerpAngle always takes the shortest arc, never the long way round', () => {
  const TAU = Math.PI * 2;
  // 10° → 350° is -20° the short way, +340° the long way.
  const short = lerpAngle((10 * Math.PI) / 180, (350 * Math.PI) / 180, 1);
  assert.ok(
    Math.abs(short - (-10 * Math.PI) / 180) < 1e-9,
    `expected -10°, got ${((short * 180) / Math.PI).toFixed(3)}° — it spun the long way`,
  );
  // Exhaustive: for any pair, one full step must land on the target (mod 2π)
  // and the arc travelled must never exceed π.
  for (let a = 0; a < 360; a += 7) {
    for (let b = 0; b < 360; b += 11) {
      const from = (a * Math.PI) / 180;
      const to = (b * Math.PI) / 180;
      const end = lerpAngle(from, to, 1);
      const landed = ((end - to) % TAU + TAU) % TAU;
      assert.ok(
        landed < 1e-9 || Math.abs(landed - TAU) < 1e-9,
        `k=1 must land on the target: ${a}° → ${b}°`,
      );
      assert.ok(Math.abs(end - from) <= Math.PI + 1e-9, `${a}° → ${b}° travelled the long way`);
    }
  }
});

test('a partial turn moves toward the target and never overshoots', () => {
  const from = 0;
  const to = Math.PI / 2;
  let h = from;
  for (let i = 0; i < 200; i++) h = lerpAngle(h, to, damp(0.015, 1 / 60));
  assert.ok(h > from && h <= to + 1e-9, `settled at ${h}, outside (${from}, ${to}]`);
  // Frame-rate independence: the same wall-clock second must land in the same
  // place at 30fps and 120fps (this is what damp() buys, and why the turn
  // cannot be a fixed per-frame fraction).
  const settle = (fps: number) => {
    let x = 0;
    for (let i = 0; i < fps; i++) x = lerpAngle(x, to, damp(0.015, 1 / fps));
    return x;
  };
  assert.ok(
    Math.abs(settle(30) - settle(120)) < 1e-3,
    `30fps and 120fps disagree after one second: ${settle(30)} vs ${settle(120)}`,
  );
});

// ── SOURCE GUARDS. Both fixes live inside a useFrame that cannot be imported.
test('the walking avatar smooths its heading instead of snapping', () => {
  const src = readFileSync(WALK, 'utf8');
  assert.ok(
    !/rotation\.y\s*=\s*Math\.atan2\(/.test(src),
    'the walker sets rotation.y straight from atan2 — that is a one-frame 180° snap',
  );
  assert.match(
    src,
    /rotation\.y\s*=\s*lerpAngle\(/,
    'the walker must ease its heading with lerpAngle + damp',
  );
});

test('reduced motion completes the walk instead of gliding a frozen figure', () => {
  const src = readFileSync(WALK, 'utf8');
  // The walk must be short-circuited by the reduced-motion flag, and it must
  // still COMPLETE — jumping to the final waypoint, not simply freezing in
  // place, or the arrival callbacks never fire and the beacon never retires.
  assert.match(src, /const reduced = usePrefersReducedMotion\(\)/, 'the walker must read the flag');
  const frame = src.slice(src.indexOf('useFrame((_, delta)'), src.indexOf('pos.current = {'));
  assert.ok(frame.length > 0, 'could not locate the walker useFrame body');
  assert.match(
    frame,
    /if \(reduced\)/,
    'the reduced-motion branch must be INSIDE the movement frame, not only on the beacon',
  );
  assert.match(
    frame,
    /idx\.current = p\.length - 1/,
    'reduced motion must jump to the END of the path so arrival still fires',
  );
});
