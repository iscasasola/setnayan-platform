/**
 * Unit suite for the figure kit's PURE rig math (`lib/figure-rig.ts`).
 * Load-bearing invariants:
 *   • resolveFigureLook is DETERMINISTIC — same id → same look, forever (a
 *     guest must never re-roll their face between visits), and explicit spec
 *     overrides always win over hash-derived defaults.
 *   • The walk cycle is symmetric — legs in antiphase, arms counter-swinging
 *     their legs — so the gait can't drift into a limp as tuning changes.
 *   • sitPose folds the thighs to ≈ horizontal with vertical shins (the
 *     renderer's chair-height constants assume it).
 *   • idleSway stays inside its advertised envelopes (±1.5° torso, bounded
 *     head turns) for all t, and de-syncs per id (no metronome crowds).
 *
 * Run via the repo's `test:unit` script (tsx --test "lib/**\/*.test.ts").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveFigureLook,
  standPose,
  walkCyclePose,
  sitPose,
  idleSway,
  staffIdle,
  overlayPose,
  damp,
  JOINTS,
  SKIN_TONES,
  HAIR_COLORS,
  HAIR_STYLE_COUNT,
  FACE_VARIANT_COUNT,
  STAFF_IDLE_KINDS,
} from './figure-rig';

const close = (a: number, b: number, tol: number, msg: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} (got ${a}, want ≈${b} ±${tol})`);

// ── resolveFigureLook ────────────────────────────────────────────────────────

test('same id resolves the same look every call (determinism)', () => {
  const a = resolveFigureLook({ id: 'S89G-ABC123DEF0' });
  const b = resolveFigureLook({ id: 'S89G-ABC123DEF0' });
  assert.deepEqual(a, b);
});

test('looks come from the published ramps and stay in range', () => {
  for (let i = 0; i < 60; i++) {
    const look = resolveFigureLook({ id: `guest-${i}` });
    assert.ok(SKIN_TONES.includes(look.skinTone), 'skin tone from the ramp');
    assert.ok(HAIR_COLORS.includes(look.hairColor), 'hair colour from the ramp');
    assert.ok(
      look.hairStyle >= 0 && look.hairStyle < HAIR_STYLE_COUNT,
      'hair style in range',
    );
    assert.ok(
      look.faceVariant >= 0 && look.faceVariant < FACE_VARIANT_COUNT,
      'face variant in range',
    );
  }
});

test('a crowd of ids actually varies (the hash spreads)', () => {
  const skins = new Set<string>();
  const styles = new Set<number>();
  for (let i = 0; i < 60; i++) {
    const look = resolveFigureLook({ id: `guest-${i}` });
    skins.add(look.skinTone);
    styles.add(look.hairStyle);
  }
  assert.ok(skins.size >= 3, `expected ≥3 distinct skin tones, got ${skins.size}`);
  assert.ok(styles.size >= 3, `expected ≥3 distinct hair styles, got ${styles.size}`);
});

test('explicit spec overrides win over hash-derived defaults', () => {
  const look = resolveFigureLook({
    id: 'guest-override',
    skinTone: '#123456',
    hairStyle: 2,
    hairColor: '#654321',
  });
  assert.equal(look.skinTone, '#123456');
  assert.equal(look.hairStyle, 2);
  assert.equal(look.hairColor, '#654321');
});

test('an out-of-range stored hairStyle wraps instead of crashing', () => {
  const look = resolveFigureLook({ id: 'x', hairStyle: 47 });
  assert.ok(look.hairStyle >= 0 && look.hairStyle < HAIR_STYLE_COUNT);
});

// ── walk cycle ───────────────────────────────────────────────────────────────

test('walk cycle: legs swing in antiphase (left(φ) === right(φ+π))', () => {
  for (let i = 0; i < 24; i++) {
    const phase = (i / 24) * Math.PI * 2;
    const now = walkCyclePose(phase);
    const half = walkCyclePose(phase + Math.PI);
    close(now.leftHip, half.rightHip, 1e-9, `hips antiphase at φ=${phase.toFixed(2)}`);
    close(now.leftKnee, half.rightKnee, 1e-9, `knees antiphase at φ=${phase.toFixed(2)}`);
    close(now.leftShoulder, half.rightShoulder, 1e-9, `arms antiphase at φ=${phase.toFixed(2)}`);
  }
});

test('walk cycle: arms counter-swing their legs (left arm with right leg)', () => {
  for (const phase of [0.4, 1.3, 2.6, 4.1, 5.5]) {
    const p = walkCyclePose(phase);
    if (Math.abs(Math.sin(phase)) > 0.05) {
      assert.ok(
        Math.sign(p.leftShoulder) === -Math.sign(p.leftHip),
        `left arm opposes left leg at φ=${phase}`,
      );
    }
  }
});

test('walk cycle: knees only ever flex (≤ 0) and the bob stays subtle', () => {
  for (let i = 0; i < 48; i++) {
    const p = walkCyclePose((i / 48) * Math.PI * 2);
    assert.ok(p.leftKnee <= 0 && p.rightKnee <= 0, 'knees never hyper-extend');
    assert.ok(Math.abs(p.pelvisY) <= 0.06, 'bob stays a subtle few cm');
  }
});

// ── sit / stand ──────────────────────────────────────────────────────────────

test('sit pose: thighs ≈ horizontal, shins ≈ vertical, hips back + down', () => {
  const p = sitPose();
  close(p.leftHip, Math.PI / 2, 0.2, 'left thigh folds to ≈ horizontal');
  close(p.rightHip, Math.PI / 2, 0.2, 'right thigh folds to ≈ horizontal');
  // Shin vertical ⇔ the knee flexes back the thigh's full fold.
  close(p.leftKnee, -p.leftHip, 0.05, 'left shin hangs ≈ vertical');
  close(p.rightKnee, -p.rightHip, 0.05, 'right shin hangs ≈ vertical');
  assert.ok(p.pelvisY < 0, 'hips drop');
  assert.ok(p.pelvisZ < 0, 'hips slide back');
  assert.ok(p.torsoLean > 0 && p.torsoLean < 0.3, 'slight forward lean');
});

test('stand pose: limbs hang neutral (near-zero hips/shoulders)', () => {
  const p = standPose();
  for (const j of ['leftHip', 'rightHip', 'leftShoulder', 'rightShoulder'] as const) {
    close(p[j], 0, 1e-9, `${j} hangs neutral`);
  }
});

// ── idle sway ────────────────────────────────────────────────────────────────

test('idle sway stays inside its envelopes for all sampled t', () => {
  const swayCap = (1.5 * Math.PI) / 180 + 1e-9;
  for (let i = 0; i < 400; i++) {
    const t = i * 0.37;
    const s = idleSway('guest-envelope', t);
    assert.ok(Math.abs(s.torsoSway ?? 0) <= swayCap, `torso sway ≤ 1.5° at t=${t}`);
    assert.ok(Math.abs(s.headYaw ?? 0) <= 0.45, `head turn bounded at t=${t}`);
  }
});

test('idle sway de-syncs per id (no metronome crowd)', () => {
  // Two ids must NOT trace the same curve — compare a few samples.
  let differs = false;
  for (let i = 0; i < 8; i++) {
    const t = i * 1.1;
    const a = idleSway('guest-a', t).torsoSway ?? 0;
    const b = idleSway('guest-b', t).torsoSway ?? 0;
    if (Math.abs(a - b) > 1e-4) differs = true;
  }
  assert.ok(differs, 'per-id phase offsets produce different sway curves');
});

// ── staff idle clips (booth-template kit) ────────────────────────────────────

test('staff idles: every clip stays bounded + finite for all sampled t', () => {
  // Envelope contract the renderer trusts: shoulders never wind past a raised
  // wave (≤ 3.0 rad), every other rotation channel stays ≤ 1.6 rad, and the
  // translation channels stay millimetric — a clip can never fold a mascot
  // through the counter.
  for (const kind of STAFF_IDLE_KINDS) {
    for (let i = 0; i < 300; i++) {
      const t = i * 0.41;
      const s = staffIdle(kind, `staff-${kind}`, t);
      for (const j of JOINTS) {
        const v = s[j] ?? 0;
        assert.ok(Number.isFinite(v), `${kind}.${j} finite at t=${t}`);
      }
      assert.ok(Math.abs(s.leftShoulder ?? 0) <= 3.0, `${kind} left shoulder bounded`);
      assert.ok(Math.abs(s.rightShoulder ?? 0) <= 3.0, `${kind} right shoulder bounded`);
      for (const j of ['leftElbow', 'rightElbow', 'headYaw', 'headPitch', 'torsoLean', 'torsoSway'] as const) {
        assert.ok(Math.abs(s[j] ?? 0) <= 1.6, `${kind}.${j} ≤ 1.6 rad at t=${t}`);
      }
      assert.ok(Math.abs(s.pelvisY ?? 0) <= 0.05, `${kind} pelvis bob stays subtle`);
      assert.ok(Math.abs(s.leftKnee ?? 0) < 1e-9 && Math.abs(s.rightKnee ?? 0) < 1e-9, `${kind} never bends knees (a standing loop)`);
    }
  }
});

test('staff idles are deterministic in (kind, id, t) and de-sync per id', () => {
  const a1 = staffIdle('shake', 'booth-a', 2.5);
  const a2 = staffIdle('shake', 'booth-a', 2.5);
  assert.deepEqual({ ...a1 }, { ...a2 }, 'same inputs → same overlay');
  // Two ids must not trace identical curves (per-id phase offsets).
  let differs = false;
  for (let i = 0; i < 8; i++) {
    const t = i * 0.9;
    const a = staffIdle('headBob', 'booth-a', t).headPitch ?? 0;
    const b = staffIdle('headBob', 'booth-b', t).headPitch ?? 0;
    if (Math.abs(a - b) > 1e-4) differs = true;
  }
  assert.ok(differs, 'per-id phase offsets de-sync neighbouring booths');
});

test('staff idles actually MOVE over time (a loop, not a freeze frame)', () => {
  for (const kind of STAFF_IDLE_KINDS) {
    let moved = false;
    const first = staffIdle(kind, 'staff-x', 0);
    const firstSnap = { ...first };
    for (let i = 1; i < 40 && !moved; i++) {
      const s = staffIdle(kind, 'staff-x', i * 0.23);
      for (const j of JOINTS) {
        if (Math.abs((s[j] ?? 0) - (firstSnap[j] ?? 0)) > 0.01) {
          moved = true;
          break;
        }
      }
    }
    assert.ok(moved, `${kind} animates over time`);
  }
});

test('staff idle buffer reuse never leaks channels between clip kinds', () => {
  // `wave` writes a big rightShoulder; a reused buffer sampled for `headBob`
  // must come back with headBob's own (small) value, not wave's leftover.
  const buf: Partial<Record<(typeof JOINTS)[number], number>> = {};
  staffIdle('wave', 'staff-x', 1.0, buf);
  const wavedShoulder = buf.rightShoulder ?? 0;
  assert.ok(wavedShoulder > 2, 'wave raises the arm');
  staffIdle('headBob', 'staff-x', 1.0, buf);
  assert.ok((buf.rightShoulder ?? 0) < 1, 'reused buffer re-written, not leaked');
  const fresh = staffIdle('headBob', 'staff-x', 1.0);
  assert.deepEqual({ ...buf }, { ...fresh }, 'buffered ≡ fresh');
});

test('staff idles compose over standPose without breaking the record', () => {
  const base = standPose();
  for (const kind of STAFF_IDLE_KINDS) {
    const out = overlayPose(base, staffIdle(kind, 'staff-y', 3.7));
    for (const j of JOINTS) assert.ok(Number.isFinite(out[j]), `${kind}.${j} finite composed`);
  }
});

// ── composition + damping helpers ────────────────────────────────────────────

test('overlayPose adds channels without touching the base record', () => {
  const base = sitPose();
  const before = { ...base };
  const out = overlayPose(base, { torsoSway: 0.02, headYaw: -0.1 });
  assert.deepEqual(base, before, 'base pose not mutated');
  close(out.torsoSway, base.torsoSway + 0.02, 1e-12, 'sway added');
  close(out.headYaw, base.headYaw - 0.1, 1e-12, 'yaw added');
  close(out.leftHip, base.leftHip, 1e-12, 'untouched channels pass through');
  for (const j of JOINTS) assert.ok(Number.isFinite(out[j]), `${j} finite`);
});

test('damp is frame-rate independent (two half-steps ≡ one full step)', () => {
  // Moving toward a target with damp(base, dt) twice at dt/2 must land exactly
  // where one dt step does — the property that makes easing fps-proof.
  const base = 0.01;
  const dt = 1 / 30;
  let a = 1;
  a += (0 - a) * damp(base, dt);
  let b = 1;
  b += (0 - b) * damp(base, dt / 2);
  b += (0 - b) * damp(base, dt / 2);
  close(a, b, 1e-12, 'half-steps compose to the full step');
});
