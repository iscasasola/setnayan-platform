/**
 * THE CHIBI DANCES — owner 2026-09-06 ("yes do it"). On the dance floor a rig
 * figure runs `dancePose`; the chibi only hopped in place. The rig is jointless
 * below the neck, so its dance is the four things it CAN do — bounce, lean,
 * turn, head bob — on the same beat clock as the rig, eased in and out.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  chibiDance, CHIBI_DANCE_LIFT, CHIBI_DANCE_SWAY_RAD, CHIBI_DANCE_TURN_RAD,
  CHIBI_DANCE_HEAD_TILT_RAD, CHIBI_DANCE_HEAD_NOD_RAD,
} from './figure-rig';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('amp 0 is the identity — a chibi that is not dancing is not moved at all', () => {
  const d = chibiDance('a', 3.7, 0);
  assert.deepEqual(d, { lift: 0, scaleY: 1, scaleXZ: 1, sway: 0, turn: 0, headTilt: 0, headNod: 0 });
});

test('every channel stays inside its envelope for all t, and the figure never sinks', () => {
  for (let t = 0; t < 30; t += 0.037) {
    const d = chibiDance('guest-self', t, 1);
    assert.ok(d.lift >= 0 && d.lift <= CHIBI_DANCE_LIFT + 1e-9, `lift ${d.lift} @${t}`);
    assert.ok(Math.abs(d.sway) <= CHIBI_DANCE_SWAY_RAD + 1e-9);
    assert.ok(Math.abs(d.turn) <= CHIBI_DANCE_TURN_RAD + 1e-9);
    assert.ok(Math.abs(d.headTilt) <= CHIBI_DANCE_HEAD_TILT_RAD + 1e-9);
    assert.ok(Math.abs(d.headNod) <= CHIBI_DANCE_HEAD_NOD_RAD / 2 + 1e-9);
    assert.ok(d.scaleY > 0.85 && d.scaleY <= 1 && d.scaleXZ >= 1, 'squash, never stretch past 1 or collapse');
  }
});

test('it actually moves: the bounce lands (lift reaches 0) and reaches its apex', () => {
  let min = Infinity, max = -Infinity;
  for (let t = 0; t < 10; t += 0.01) { const d = chibiDance('x', t, 1); min = Math.min(min, d.lift); max = Math.max(max, d.lift); }
  assert.ok(min < 0.002, 'contact with the floor each beat');
  assert.ok(max > CHIBI_DANCE_LIFT * 0.98, 'a real bounce');
});

test('deterministic in (id, t); two ids do not dance in unison', () => {
  assert.deepEqual(chibiDance('a', 1.234, 1), chibiDance('a', 1.234, 1));
  const a = chibiDance('guest-a', 2, 1), b = chibiDance('guest-b', 2, 1);
  assert.notEqual(a.sway, b.sway);
});

test('amp scales every channel and the out-buffer is reused', () => {
  const full = chibiDance('a', 5, 1);
  const half = chibiDance('a', 5, 0.5);
  assert.ok(Math.abs(half.sway - full.sway / 2) < 1e-9);
  assert.ok(Math.abs(half.lift - full.lift / 2) < 1e-9);
  const buf = { lift: 9, scaleY: 9, scaleXZ: 9, sway: 9, turn: 9, headTilt: 9, headNod: 9 };
  assert.equal(chibiDance('a', 5, 1, buf), buf, 'same object back');
  assert.notEqual(buf.sway, 9, 'every channel rewritten');
});

test('the walk dances the chibi under the SAME condition the rig figure dances, and still mounts one bounce', () => {
  const w = read('app/[slug]/venue/_components/guest-venue-3d.tsx');
  assert.match(w, /pose=\{waving \? 'stand' : atRest \? \(dance \? 'dance' : 'stand'\) : 'run'\}/, 'the rig condition, unchanged');
  assert.match(w, /<ChibiBounce phaseRef=\{phaseRef\} moving=\{!atRest\} dancing=\{atRest && dance && !waving\} id=\{selfSpec\.id\}>/);
  assert.equal((w.match(/<ChibiBounce/g) ?? []).length, 1);
  assert.match(w, /const d = chibiDance\(id, state\.clock\.elapsedTime, danceAmp\.current, dance\.current\);/, 'wall-clock beat, not the gait phase');
  assert.match(w, /if \(head\) head\.rotation\.set\(d\.headNod, 0, d\.headTilt\);/, 'the head group is what bobs');
  assert.match(w, /const danceTarget = dancing && !moving \? 1 : 0;/, 'walking off the floor stops the dance');
  assert.match(w, /grp\.rotation\.set\(0, 0, 0\);\s*return;/, 'reduced motion: no lean, no turn');
});
