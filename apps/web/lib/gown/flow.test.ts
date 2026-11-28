/** 👗 gown/flow — the owner's step order exactly (v210 `MS`), Skip restores what she arrived with, undo, units, design steps. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startingGownBody, startingGownConfig, type GownConfig } from '../gown-config';
import { gownSetNumber } from './body-rules';
import { gownChoose } from './compat';
import { GOWN_FOCUS } from './stage/focus';
import {
  GOWN_DESIGN_STEPS, GOWN_UNDO_MAX, gownDesignSteps, gownMeasSteps, gownPickOptions, gownRemember, gownSayHeight, gownSayLength, gownSayWeight, gownSkipStep, gownSnapStep,
} from './flow';

test('the measurement steps keep the owner\'s order exactly (v210 MS), the fine-tune steps only after Yes', () => {
  assert.deepEqual(gownMeasSteps(false).map((s) => s.label), ['Height', 'Weight', 'Body shape', 'Bust', 'Waist', 'Hips', 'Fine-tune']);
  assert.deepEqual(gownMeasSteps(true).map((s) => s.label), [
    'Height', 'Weight', 'Body shape', 'Bust', 'Waist', 'Hips', 'Fine-tune', 'Bust position', 'Underbust', 'Shoulders', 'Arm length', 'Leg length', 'Elevation', 'What matters to her',
  ]);
  // v204: each step opens on its own close-up of her body.
  assert.deepEqual(gownMeasSteps(true).map((s) => s.focus), ['m_full', 'm_full', 'm_full', 'm_bust', 'm_waist', 'm_hips', 'm_full', 'm_bust', 'm_ub', 'm_sh', 'm_arm', 'm_leg', 'heels', 'm_full']);
});

test('Skip puts back what she changed on the step and the number is hers no longer (v202, v210 fine-skip)', () => {
  const b0 = startingGownBody(), snap = gownSnapStep(b0, 0);
  const moved = gownSetNumber(b0.vals, b0.given, 'underbust', 66);
  const now = { ...b0, vals: moved.vals, given: moved.given, matters: ['arms' as const], bustT: 0.5 };
  assert.ok(now.given.includes('underbust') && now.vals.underbust === 66);
  const back = gownSkipStep(now, snap, 'underbust');
  assert.deepEqual(back.body.vals, b0.vals, 'her numbers as she arrived');
  assert.equal(back.body.given.includes('underbust'), false, 'the underbust is the estimate again');
  assert.deepEqual([back.body.matters, back.body.bustT, back.heel], [[], 0, 0]);
  // Skip keeps what she gave before this step.
  const earlier = { ...b0, given: ['bust' as const] }, s2 = gownSnapStep(earlier, 7);
  assert.deepEqual(gownSkipStep({ ...earlier, given: ['bust', 'shoulders'] }, s2, 'shoulders').body.given, ['bust']);
  assert.equal(gownSkipStep(earlier, s2, 'heel').heel, 7, 'her shoes back as they were');
});

test('undo keeps the last designs, newest last, and never two the same in a row', () => {
  const m = (sil: GownConfig['sil']) => ({ config: { ...startingGownConfig(), sil }, body: startingGownBody(), heel: 0 });
  let st = gownRemember([], m('aline'));
  st = gownRemember(st, m('aline'));
  assert.equal(st.length, 1);
  for (let i = 0; i < GOWN_UNDO_MAX + 5; i++) st = gownRemember(st, m(i % 2 ? 'ball' : 'sheath'));
  assert.equal(st.length, GOWN_UNDO_MAX);
  const one = m('mermaid'), kept = gownRemember([], one);
  one.config.sil = 'ball';
  assert.equal(kept[0]!.config.sil, 'mermaid', 'a moment is a copy, not a reference');
});

test('her units: cm or inches, feet and inches for height, kg or lb', () => {
  const cm = { len: 'cm', mass: 'kg' } as const, inch = { len: 'in', mass: 'lb' } as const;
  assert.equal(gownSayLength(84, cm), '84 cm');
  assert.equal(gownSayLength(84, inch), '33 in');
  assert.equal(gownSayLength(85, inch), '33.5 in');
  assert.equal(gownSayHeight(155, cm), '155 cm');
  assert.equal(gownSayHeight(155, inch), '5′ 1″');
  assert.equal(gownSayWeight(52, cm), '52 kg');
  assert.equal(gownSayWeight(52, inch), '115 lb');
});

test('the design steps: real keys and lists, a close-up each, and the lists hide what the design rules out', () => {
  const s0 = startingGownConfig();
  for (const st of GOWN_DESIGN_STEPS) {
    assert.ok(st.focus in GOWN_FOCUS, `${st.id}: a close-up`);
    for (const p of st.picks) {
      assert.ok(p.key in s0, `${st.id}: ${String(p.key)} is a design key`);
      assert.ok(p.options.some((o) => o.id === s0[p.key]) || s0[p.key] === null, `${st.id}: the starting value is in its list`);
    }
  }
  assert.deepEqual(gownDesignSteps(s0).slice(0, 4).map((s) => s.label), ['Your colours', 'Silhouette', 'Fabric', 'Colour']);
  const hasStep = (g: GownConfig, id: string) => gownDesignSteps(g).some((s) => s.id === id);
  assert.equal(hasStep(s0, 'capeDet'), false, 'no cape, no cape details');
  const caped = gownChoose(s0, { key: 'cape', value: 'back' }).config;
  assert.equal(hasStep(caped, 'capeDet'), true);
  assert.equal(hasStep(s0, 'bustle'), false, 'no train, no bustle');
  const sleeves = GOWN_DESIGN_STEPS.find((s) => s.id === 'sleeve')!.picks[0]!;
  const ruffle = (g: GownConfig) => gownPickOptions(sleeves, g).some((o) => o.id === 'ruffle');
  assert.equal(ruffle({ ...s0, neck: 'v' }), false, 'the ruffle band only on an off-shoulder or sweetheart neckline');
  assert.equal(ruffle({ ...s0, neck: 'sweetheart' }), true);
});

test('a body type at the same weight (v210 est-go): a pear at 155 cm and 52 kg', async () => {
  const { gownShapeAtWeight } = await import('./body-rules');
  const v = startingGownBody().vals;
  // Worked by hand from the prototype's formula: an average figure of her height and weight, the pear's offsets, the
  // underbust 12 cm under the bust, then scaled so the weight stays 52 kg (here the scale comes out at 1).
  assert.deepEqual(gownShapeAtWeight(v, 'pear', 52), { bust: 82, waist: 67, hips: 104, underbust: 70 });
  const hg = gownShapeAtWeight(v, 'hourglass', 52);
  assert.equal(hg.bust - hg.underbust, 14, 'an hourglass keeps two more cm between bust and underbust');
  assert.ok(gownShapeAtWeight(v, 'apple', 52).waist > hg.waist, 'an apple carries it at the waist');
});

test('the design steps on a fresh gown: only what this gown has (each "hidden" rule read the right way round)', () => {
  const s0 = startingGownConfig(), ids = (g: GownConfig) => gownDesignSteps(g).map((s) => s.id);
  assert.deepEqual(ids(s0), [
    'palette', 'sil', 'fabric', 'colour', 'sleeve', 'cape', 'pieces', 'waist', 'neck', 'straps', 'topEdge', 'illu', 'boneShow', 'back', 'illuBack', 'closure', 'hem', 'train',
    'veilStyle', 'veil', 'overlay', 'bow', 'lace', 'flowers', 'bead', 'pearls', 'shape', 'lining', 'boning',
  ]);
  const plunge = gownChoose(s0, { key: 'neck', value: 'plungewaist' }).config;
  assert.ok(ids(plunge).includes('plungeFill'), 'a plunge to the waist asks what fills it');
  const veiled = gownChoose(s0, { key: 'veil', value: 'chapel' }).config;
  assert.ok(ids(veiled).includes('blusher') && ids(veiled).includes('veilFab'), 'a classic veil asks for its blusher and its tulle');
  const off = gownChoose(gownChoose(s0, { key: 'neck', value: 'off' }).config, { key: 'sleeve', value: 'long' }).config;
  assert.ok(ids(off).includes('sleeveDet'), 'off the shoulder: sewn or detachable sleeves');
});
