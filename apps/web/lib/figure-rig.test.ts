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
  dancePose,
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

// ── catalog-completion idles (the 11 added with the remaining-37 PR) ─────────

const COMPLETION_IDLE_KINDS = [
  'typing',
  'pourArc',
  'stretch',
  'ribbonSwirl',
  'countBeat',
  'swaySing',
  'strokeWork',
  'polishWipe',
  'measure',
  'boxPass',
  'thumbsUp',
] as const;

test('catalog completion ships all 21 idle kinds', () => {
  assert.equal(STAFF_IDLE_KINDS.length, 21);
  for (const kind of COMPLETION_IDLE_KINDS) {
    assert.ok(STAFF_IDLE_KINDS.includes(kind), `${kind} registered`);
  }
});

test('completion idles are wall-clock deterministic at a fixed t', () => {
  // Same (kind, id, t) → the identical overlay, call after call — the
  // wall-clock contract (never frame-count-bound) the renderer trusts.
  for (const kind of COMPLETION_IDLE_KINDS) {
    for (const t of [0, 1.7, 42.3, 3600.5]) {
      const a = staffIdle(kind, 'booth-fixed', t);
      const b = staffIdle(kind, 'booth-fixed', t);
      assert.deepEqual({ ...a }, { ...b }, `${kind} deterministic at t=${t}`);
    }
  }
});

test('completion idles hold their signature poses', () => {
  // The one readable claim per clip — the silhouette that names the job.
  const t = 5.3;
  const stretch = staffIdle('stretch', 'sig', t);
  assert.ok((stretch.leftShoulder ?? 0) >= 1.9 && (stretch.rightShoulder ?? 0) >= 1.9, 'stretch reaches overhead');
  const sing = staffIdle('swaySing', 'sig', t);
  assert.ok((sing.leftElbow ?? 0) >= 1.2 && (sing.rightElbow ?? 0) >= 1.2, 'swaySing keeps hands folded at the chest');
  const stroke = staffIdle('strokeWork', 'sig', t);
  assert.ok((stroke.headPitch ?? 0) >= 0.25, 'strokeWork keeps eyes on the work');
  assert.ok((stroke.torsoLean ?? 0) > 0.1, 'strokeWork leans over the work');
  const thumbs = staffIdle('thumbsUp', 'sig', t);
  assert.ok((thumbs.rightShoulder ?? 0) >= 1.4, 'thumbsUp parks the arm high');
  assert.ok((thumbs.leftShoulder ?? 0) < 0.5, 'thumbsUp keeps the off arm low');
  const swirl = staffIdle('ribbonSwirl', 'sig', t);
  assert.ok((swirl.rightShoulder ?? 0) >= 1.8, 'ribbonSwirl raises the ribbon arm');
  const type = staffIdle('typing', 'sig', t);
  close(type.leftShoulder ?? 0, type.rightShoulder ?? 0, 1e-9, 'typing holds both forearms level');
});

test('measure pulls both elbows in phase (the tape, apart and together)', () => {
  for (let i = 0; i < 40; i++) {
    const s = staffIdle('measure', 'fitter', i * 0.31);
    close(s.leftElbow ?? 0, s.rightElbow ?? 0, 1e-9, `elbows in phase at i=${i}`);
    assert.ok((s.leftElbow ?? 0) >= 0.3, 'elbows never hyper-extend past the gather');
  }
});

test('staff idles compose over standPose without breaking the record', () => {
  const base = standPose();
  for (const kind of STAFF_IDLE_KINDS) {
    const out = overlayPose(base, staffIdle(kind, 'staff-y', 3.7));
    for (const j of JOINTS) assert.ok(Number.isFinite(out[j]), `${kind}.${j} finite composed`);
  }
});

// ── dance clip (tap-the-dance-floor) ─────────────────────────────────────────

test('dancePose stays inside its (knee/bounce-aware) envelope for all sampled t', () => {
  // Its OWN envelope — unlike staff, a dance bends knees and bounces the
  // pelvis, but every channel is still bounded and tasteful: raised arms
  // (≤ 3.0 rad), everything else ≤ 1.6 rad, a few-cm bounce (≤ 0.06 m), and
  // knees that only flex (≤ 0) and never hyperflex (≥ −0.3).
  for (const id of ['dancer-a', 'dancer-b', 'dancer-c', 'S89G-ZZZ9', 'x']) {
    for (let i = 0; i < 400; i++) {
      const t = i * 0.29;
      const s = dancePose(id, t);
      for (const j of JOINTS) {
        assert.ok(Number.isFinite(s[j] ?? 0), `${id}.${j} finite at t=${t}`);
      }
      assert.ok(Math.abs(s.leftShoulder ?? 0) <= 3.0, `${id} left shoulder bounded at t=${t}`);
      assert.ok(Math.abs(s.rightShoulder ?? 0) <= 3.0, `${id} right shoulder bounded at t=${t}`);
      for (const j of ['leftElbow', 'rightElbow', 'headYaw', 'headPitch', 'torsoLean', 'torsoSway'] as const) {
        assert.ok(Math.abs(s[j] ?? 0) <= 1.6, `${id}.${j} ≤ 1.6 rad at t=${t}`);
      }
      assert.ok(Math.abs(s.pelvisY ?? 0) <= 0.06, `${id} bounce stays a few cm at t=${t}`);
      assert.ok((s.leftKnee ?? 0) <= 0 && (s.rightKnee ?? 0) <= 0, `${id} knees only flex at t=${t}`);
      assert.ok((s.leftKnee ?? 0) >= -0.3 && (s.rightKnee ?? 0) >= -0.3, `${id} knees never hyperflex at t=${t}`);
    }
  }
});

test('dancePose is deterministic in (id, t)', () => {
  for (const t of [0, 0.8, 12.5, 999.25]) {
    const a = dancePose('dancer-fixed', t);
    const b = dancePose('dancer-fixed', t);
    assert.deepEqual({ ...a }, { ...b }, `same (id,t) → same overlay at t=${t}`);
  }
});

test('dancePose actually moves over time (a loop, not a freeze frame)', () => {
  let moved = false;
  const first = { ...dancePose('dancer-move', 0) };
  for (let i = 1; i < 40 && !moved; i++) {
    const s = dancePose('dancer-move', i * 0.19);
    for (const j of JOINTS) {
      if (Math.abs((s[j] ?? 0) - (first[j] ?? 0)) > 0.02) {
        moved = true;
        break;
      }
    }
  }
  assert.ok(moved, 'the dance animates over time');
});

test('dancePose de-syncs across ids (distinct but bounded)', () => {
  // Two ids must not trace an identical curve. With hash-derived phase AND
  // style variants, at least one channel differs across a short sweep.
  let differs = false;
  for (let i = 0; i < 12; i++) {
    const t = i * 0.53;
    const a = dancePose('dancer-1', t);
    const b = dancePose('dancer-2', t);
    for (const j of JOINTS) {
      if (Math.abs((a[j] ?? 0) - (b[j] ?? 0)) > 1e-3) {
        differs = true;
        break;
      }
    }
  }
  assert.ok(differs, 'per-id phase + variant produce different dance curves');
});

test('dancePose raises the arms (it reads as dancing, not standing)', () => {
  // Across ids/time the shoulders lift well past a resting arm — the silhouette
  // that names the pose. Sample several ids so every variant is exercised.
  for (const id of ['dancer-a', 'dancer-b', 'dancer-c', 'dancer-d']) {
    let maxShoulder = 0;
    for (let i = 0; i < 60; i++) {
      const s = dancePose(id, i * 0.21);
      maxShoulder = Math.max(maxShoulder, s.leftShoulder ?? 0, s.rightShoulder ?? 0);
    }
    assert.ok(maxShoulder > 1.0, `${id} raises an arm well above rest (got ${maxShoulder})`);
  }
});

test('dancePose held pose at t=0 is stable and composes legally over standPose', () => {
  const base = standPose();
  for (const id of ['dancer-a', 'dancer-b', 'dancer-c']) {
    const held = dancePose(id, 0);
    // Deterministic hold — the reduced-motion / quality-'low' bake.
    assert.deepEqual({ ...held }, { ...dancePose(id, 0) }, `${id} t=0 hold stable`);
    const out = overlayPose(base, held);
    for (const j of JOINTS) assert.ok(Number.isFinite(out[j]), `${id}.${j} finite composed at t=0`);
    // The composed hold keeps the same tasteful envelope (arms raised, subtle bounce).
    assert.ok(Math.abs(out.leftShoulder) <= 3.0 && Math.abs(out.rightShoulder) <= 3.0, `${id} held shoulders bounded`);
    assert.ok(out.leftKnee <= 1e-9 && out.rightKnee <= 1e-9, `${id} held knees only flex`);
  }
});

test('dancePose is NOT registered as a staff idle kind (own envelope)', () => {
  // A dance bends knees + bounces; the staff envelope forbids both. Guard that
  // it never leaks into STAFF_IDLE_KINDS (where the staff suite would fail it).
  assert.ok(!(STAFF_IDLE_KINDS as readonly string[]).includes('dance'), 'dance is not a staff kind');
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
