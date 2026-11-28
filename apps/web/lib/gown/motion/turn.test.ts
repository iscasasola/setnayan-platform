/**
 * 👗 gown/motion/turn — v206's twirl, sway and auto-turn: a twirl turns her exactly once round (a double, twice), slow
 * at the start and the end; the sway comes back to where she faced; the showroom turn rests at each quarter; reduced
 * motion turns her round at once; the cloth ignores a jump and stays still with motion reduced.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gownClothDrive, gownStartTwirl, gownStepTurn, gownTurning, stillGownClothDrive, stillGownTurn } from './turn';

const run = (style: 'classic' | 'slow' | 'double', dt = 1 / 60) => {
  const S = stillGownTurn();
  let rot = gownStartTwirl(S, style, 0.3, 0, false), t = 0;
  const steps: number[] = [];
  while (gownTurning(S) && t < 30) { const r = gownStepTurn(S, rot, dt, t * 1000); steps.push(r - rot); rot = r; t += dt; }
  return { rot, t, steps };
};

test('a twirl turns her exactly once round (a double, twice): slow to start, fast in the middle, slow to stop', () => {
  for (const [style, turns] of [['classic', 1], ['slow', 1], ['double', 2]] as const) {
    const r = run(style);
    assert.ok(Math.abs(r.rot - 0.3 - turns * 2 * Math.PI) < 1e-9, `${style}: ${turns} turn(s)`);
    const mid = r.steps[r.steps.length >> 1]!, first = r.steps[0]!, last = r.steps[r.steps.length - 2]!;
    assert.ok(mid > 2 * first && mid > 2 * last, `${style}: builds speed then stops smoothly`);
  }
  assert.ok(run('slow').t > 2 * run('classic').t, 'the slow reveal takes much longer');
});

test('the sway goes each way and comes back to where she faced; reduced motion just turns her round', () => {
  const S = stillGownTurn();
  let rot = gownStartTwirl(S, 'sway', 1, 0, false), lo = 1, hi = 1;
  for (let ms = 0; ms <= 5000; ms += 16) { rot = gownStepTurn(S, rot, 0.016, ms); lo = Math.min(lo, rot); hi = Math.max(hi, rot); }
  assert.equal(rot, 1, 'back where she faced');
  assert.ok(hi - 1 > 0.4 && 1 - lo > 0.4, 'both ways');
  assert.equal(gownTurning(S), false);
  const R = stillGownTurn();
  assert.equal(gownStartTwirl(R, 'classic', 0, 0, true), Math.PI, 'reduced motion: half a turn at once');
  assert.equal(gownTurning(R), false, 'and nothing keeps moving');
});

test('the auto-turn: round and round at its speed, a showroom turn resting at each quarter, a twirl stops it', () => {
  const S = stillGownTurn();
  S.auto = 30;
  assert.ok(Math.abs(gownStepTurn(S, 0, 1, 0) - Math.PI / 6) < 1e-12, '30° a second');
  S.style = 'show';
  let rot = 0, ms = 0, rests = 0;
  for (let i = 0; i < 1000; i++) { const r = gownStepTurn(S, rot, 0.05, ms); if (r === rot) rests++; rot = r; ms += 50; }
  assert.ok(rests > 20, 'pauses at the quarters');
  gownStartTwirl(S, 'classic', rot, ms, false);
  assert.equal(S.auto, 0, 'a twirl ends the auto-turn');
});

test('the cloth feels her turn smoothed; a jump (a reset) is ignored; reduced motion keeps it still', () => {
  const C = stillGownClothDrive();
  assert.equal(gownClothDrive(C, 0, 1 / 60, false).w, 0, 'first frame: nothing to compare');
  const a = gownClothDrive(C, 0.05, 1 / 60, false);
  assert.ok(a.w > 0 && a.w < 3, 'a turn, smoothed');
  assert.equal(gownClothDrive(stillGownClothDrive(), 0, 1 / 60, true).w, 0);
  const J = stillGownClothDrive();
  gownClothDrive(J, 0, 1 / 60, false);
  assert.equal(gownClothDrive(J, 3, 1 / 60, false).w, 0, 'a jump of 3 radians in one frame is a reset, not a spin');
});
