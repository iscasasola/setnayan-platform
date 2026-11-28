/**
 * 👗 gown/motion — her poses, the walks and the jump, held to prototype v206's own numbers (`v206-motion.fixture.json`,
 * captured from the prototype itself): every joint turn, the arm lifts that keep a hand out of the skirt, the hand-on-hip
 * reach, where she stands, her body and the skirt on it, a blend half way, and each walk at seven moments.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startingGownConfig, type GownConfig, type GownLook } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { solveGownBody } from '../body/solve';
import { estimateGownMeasures } from '../body/estimate';
import { gownRefitTo } from '../body/refit';
import { gownApplyLook } from '../compat';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress } from '../dress/build';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { GOWN_POSES, GOWN_POSE_TOUR, GOWN_STANDING_POSES, emptyGownPose, gownBlendPose, gownClearArms, gownPoseBody, gownTargetPose, type GownPoseName } from './poses';
import { GOWN_MOTION_HZ, GOWN_WALKS, gownMotionPose, gownStepMotion, stillGownMotion, type GownMotionKind } from './walks';

type Pt = [number, number, number, number];
type Q = [number, number, number, number] | null;
type Row = { pose: string; heel?: number; poseQ: Q[]; target?: Q[]; extra?: { L: number; R: number }; ik?: number[] | null; heelT?: number; floorY?: number; floorStand?: number; body?: Pt[]; dress?: Pt[] | null };
type Move = { t: number; p: Record<string, [number, number, number]>; y: number; x: number };
const REF = JSON.parse(readFileSync(join(__dirname, 'v206-motion.fixture.json'), 'utf8')) as { rows: Row[]; moves: Record<string, Move[]>; tour: string[]; walks: Record<string, unknown> };
const GLB = join(__dirname, '../../../public/gown/female.glb');
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(GLB); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
const design = (heel: number): GownConfig => ({ ...gownApplyLook(startingGownConfig(), { slits: [], cuts: [], veil: 'none', sleeve: 'none', cape: 'none', sil: 'aline' } as Partial<GownLook>), hem: 'floor', hemCm: 0, heel } as GownConfig);

/** The stage's order (v206 `present`): pose her, her envelope, the gown, clear her arms, and wrap the bodice again if an arm moved. */
function present(B: GownRig, pose: GownPoseName, heel: number) {
  const g = design(heel), S = emptyGownPose(B), T = emptyEnvelope(), D = emptyDress(), C = restingCloth(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  solveGownBody(B);
  const dress = () => { buildEnvelope(B, T); buildDress(B, T, D, g, S.floorY, S.floorStand ?? S.floorY, { standing: GOWN_STANDING_POSES.includes(S.pose) }); writeDress(D, T, C, { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S }); };
  // As captured: standing first (where she stood), then the pose.
  for (const p of ['a', pose] as const) {
    S.pose = p; S.t = 1; S.lastQ = new Array(B.nb).fill(null);
    gownPoseBody(B, S, heel);
    dress();
    if (gownClearArms(B, S, T, heel)) dress();
  }
  return { S, D };
}
const qd = (a: { x: number; y: number; z: number; w: number } | null, b: Q) => {
  if (!a || !b) return a || b ? 9 : 0;
  // q and −q are the same turn.
  return Math.min(Math.hypot(a.x - b[0], a.y - b[1], a.z - b[2], a.w - b[3]), Math.hypot(a.x + b[0], a.y + b[1], a.z + b[2], a.w + b[3]));
};
const worstCm = (B: GownRig, P: ArrayLike<number>, sample: Pt[]) => {
  let w = 0;
  for (const [i, x, y, z] of sample) w = Math.max(w, Math.hypot(P[i * 3]! - x, P[i * 3 + 1]! - y, P[i * 3 + 2]! - z));
  return w * B.P.S * 100;
};

test('every pose as v206 poses her: joint turns, the arm lifts that keep her hands out of the skirt, the hand on her hip, where she stands, her body and the skirt', async () => {
  const B = await body();
  for (const r of REF.rows.filter((x) => x.body)) {
    const name = `${r.pose} on ${r.heel} cm`, { S, D } = present(B, r.pose as GownPoseName, r.heel!);
    assert.deepEqual(S.extra, r.extra, `${name}: arm lifts`);
    assert.deepEqual(S.ik ? Object.keys(S.ik).map(Number) : null, r.ik, `${name}: the hand-on-hip reach`);
    assert.ok(Math.abs(S.heelT - r.heelT!) < 1e-5, `${name}: on her toes`);
    let worstQ = 0;
    for (let i = 0; i < B.nb; i++) worstQ = Math.max(worstQ, qd(S.poseQ[i] ?? null, r.poseQ[i] ?? null));
    assert.ok(worstQ < 1e-4, `${name}: every joint turn (worst ${worstQ})`);
    assert.ok(Math.abs(S.floorY - r.floorY!) < 1e-5 && Math.abs(S.floorStand! - r.floorStand!) < 1e-5, `${name}: where she stands ${S.floorY} / ${S.floorStand} vs ${r.floorY} / ${r.floorStand}`);
    assert.ok(worstCm(B, B.V, r.body!) < 0.05, `${name}: her body within 0.5 mm (worst ${worstCm(B, B.V, r.body!).toFixed(3)} cm)`);
    const P = D.geo!.attributes.position!.array as Float32Array;
    assert.ok(worstCm(B, P, r.dress!) < 0.1, `${name}: the skirt within 1 mm (worst ${worstCm(B, P, r.dress!).toFixed(3)} cm)`);
  }
});

test('a change of pose blends: half way from standing to a step is v206\'s half way', async () => {
  const B = await body(), r = REF.rows.find((x) => x.pose === 'blend-a-step-0.5')!, S = emptyGownPose(B);
  const { S: stood } = present(B, 'a', 7);
  S.lastQ = stood.poseQ.map((q) => q && q.clone());
  S.pose = 'step';
  const Tq = gownTargetPose(B, S, 7);
  for (let i = 0; i < B.nb; i++) assert.ok(qd(Tq[i] ?? null, r.target![i] ?? null) < 1e-5, `target joint ${i}`);
  gownBlendPose(B, S, Tq, 0.5);
  for (let i = 0; i < B.nb; i++) assert.ok(qd(S.poseQ[i] ?? null, r.poseQ[i] ?? null) < 1e-5, `half way joint ${i}`);
});

test('the aisle walk, the everyday walk, the runway and the jump: every joint, her rise and her sway at seven moments, as v206', () => {
  for (const [kind, moves] of Object.entries(REF.moves)) for (const m of moves) {
    const got = gownMotionPose(kind as GownMotionKind, m.t);
    assert.deepEqual(Object.keys(got.p).sort(), Object.keys(m.p).sort(), `${kind} at ${m.t}s: the joints`);
    for (const [k, v] of Object.entries(m.p)) for (let c = 0; c < 3; c++) assert.ok(Math.abs(got.p[k]![c]! - v[c]!) < 1e-5, `${kind} at ${m.t}s: ${k}`);
    assert.ok(Math.abs(got.y - m.y) < 1e-5 && Math.abs(got.x - m.x) < 1e-5, `${kind} at ${m.t}s: rise and sway`);
  }
  assert.deepEqual([...GOWN_POSE_TOUR], REF.tour, 'the tour, in order');
  assert.deepEqual(JSON.parse(JSON.stringify(GOWN_WALKS)), REF.walks, 'the walks, number for number');
  assert.deepEqual(Object.keys(GOWN_POSES).sort(), ['a', 'bent', 'cross', 'down', 'dyn', 'hip', 'kneel', 'pop', 'step', 'sit', 'walk'].sort());
});

test('while she moves, the body and gown are rebuilt about 24 times a second, never more; she eases in; a stall does not replay', () => {
  const M = stillGownMotion();
  assert.equal(gownStepMotion(M, 1 / 60).rebuild, null, 'standing still: nothing to rebuild');
  M.kind = 'walk';
  let rebuilds = 0, first: number | null = null;
  for (let f = 0; f < 120; f++) { const s = gownStepMotion(M, 1 / 60); if (s.rebuild) { rebuilds++; first ??= s.rebuild.ease; } }
  assert.ok(rebuilds >= GOWN_MOTION_HZ * 2 - 2 && rebuilds <= GOWN_MOTION_HZ * 2, `two seconds at 60 fps: ${rebuilds} rebuilds (at most one a frame, about ${GOWN_MOTION_HZ} a second)`);
  assert.ok(first! < 0.1, 'she eases into the walk');
  const big = gownStepMotion(M, 0.5);
  assert.ok(big.rebuild, 'after a stall, one rebuild');
  assert.equal(M.acc, 0, 'and the missed ones are not replayed');
});

test('the designer\'s tape re-fits the mannequin (v175 example, as v206): waist to floor 108 re-fits her legs; nape to waist and shoulder to bust point are checked', async () => {
  const B = await body(), ref = (REF as unknown as { refit: { before: { leg: number; est: Record<string, number> }; msg: string; leg: number; bustT: number; vals: Record<string, number>; est: Record<string, number> } }).refit;
  // 158 cm, 92 / 76 / 72 / 98, a mermaid, 7 cm heels; those five numbers are hers.
  Object.assign(B.vals, { height: 158, bust: 92, waist: 76, underbust: 72, hips: 98, leg: ref.before.leg });
  B.fine = { athletic: false, bustT: 0, given: ['height', 'bust', 'waist', 'underbust', 'hips'] };
  const g = { ...design(7), sil: 'mermaid' } as GownConfig;
  const look = () => {
    const S = emptyGownPose(B), T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
    D.hold = feel.hold; D.foldK = feel.foldK;
    solveGownBody(B);
    gownPoseBody(B, S, 7);
    buildEnvelope(B, T);
    buildDress(B, T, D, g, S.floorY, S.floorStand ?? S.floorY);
    if (gownClearArms(B, S, T, 7)) { buildEnvelope(B, T); buildDress(B, T, D, g, S.floorY, S.floorStand ?? S.floorY); }
    return estimateGownMeasures(B, T);
  };
  const e0 = look();
  for (const k of ['waistFloor', 'napeWaist', 'shoulderApex'] as const) assert.equal(e0[k], ref.before.est[k], `before: ${k} on the mannequin`);
  const r = gownRefitTo(B, { waistFloor: 108, napeWaist: 39, shoulderApex: 23 }, look);
  assert.equal(r.lines.join(' '), ref.msg, 'the lines the designer reads');
  assert.ok(Math.abs(r.leg! - ref.leg) < 1e-6 && Math.abs(B.vals.leg - ref.leg) < 1e-6, `legs ${B.vals.leg} vs ${ref.leg}`);
  assert.equal(r.bustT, ref.bustT, 'the bust position goes as high as the mannequin allows');
  const e1 = estimateGownMeasures(B, emptyEnvelope());
  assert.equal(e1.waistFloor, ref.est.waistFloor, 'waist to floor now reads the tape');
  assert.equal(B.vals.weight, ref.vals.weight, 'her weight follows (it was not hers)');
  assert.deepEqual(gownRefitTo(B, { neck: 34 }, look).lines, ['Kept for the pattern (the mannequin\'s shape doesn\'t change for them): Neck.', 'Add waist to floor, nape to waist or shoulder to bust point to re-fit her proportions.']);
});
