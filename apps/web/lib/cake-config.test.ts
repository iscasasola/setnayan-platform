/** 🎂 cake-config (v6) — the one catalog, the server's refusals, the tier resize, and the one figure model both views draw. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAKE_MAX_TIERS,
  cakeFigureSpec,
  fullCakeOffer,
  resizeCakeTiers,
  sanitizeCakeConfig,
  startingCakeConfig,
  type CakeConfig,
  type CakeOffer,
  type CakeTierConfig,
} from './cake-config';

const offer = (over: Partial<CakeOffer> = {}): CakeOffer => ({ ...fullCakeOffer(), flavourRefs: ['f1', 'f2'], ...over });
const tier = (kind: 'real' | 'display', over: Partial<CakeTierConfig> = {}): CakeTierConfig => ({ kind, flavourRef: kind === 'real' ? 'f1' : null, accent: 'none', shape: 'round', tall: false, ...over });
/** Tiers TOP FIRST; the bottom tier is cut unless said otherwise. */
const cake = (tiers: CakeTierConfig[], over: Partial<CakeConfig> = {}): CakeConfig => ({
  ...startingCakeConfig(offer()),
  tiers,
  cuttingTier: tiers.length - 1,
  flowingFrom: 0,
  flowingTo: Math.max(0, tiers.length - 1),
  monogramTier: Math.max(0, tiers.length - 1),
  ...over,
});
const reals = (n: number) => Array.from({ length: n }, () => tier('real'));

test('N tiers draw a complete N-tier cake for every N from 1 to 10: widest at the bottom, the topper on the top tier', () => {
  for (let n = 1; n <= CAKE_MAX_TIERS; n++) {
    const got = sanitizeCakeConfig(cake(reals(n), { topper: 'names' }), offer());
    assert.ok(got.ok, `n=${n}`);
    const spec = cakeFigureSpec(got.config);
    assert.equal(spec.tiers.length, n, `exactly ${n} tiers`);
    for (let k = 1; k < n; k++) {
      assert.ok(spec.tiers[k]!.radius < spec.tiers[k - 1]!.radius, `n=${n}: tier ${k} narrower than the one below`);
      assert.ok(spec.tiers[k]!.y >= spec.tiers[k - 1]!.y + spec.tiers[k - 1]!.height - 1e-9, `n=${n}: tier ${k} sits on the one below`);
    }
    // The spec draws bottom first; config index 0 is the TOP tier.
    assert.equal(spec.tiers[n - 1]!.index, 0, `n=${n}: the last drawn tier is the top (config index 0)`);
    assert.ok(spec.topper, `n=${n}: a topper`);
  }
});

test('the server refuses zero real tiers and a display cutting tier — and display tiers from a shop without them', () => {
  assert.deepEqual(sanitizeCakeConfig(cake([tier('display'), tier('display')]), offer()), { ok: false, reason: 'no_real_tier' });
  assert.deepEqual(sanitizeCakeConfig(cake([tier('real'), tier('display')]), offer()), { ok: false, reason: 'cutting_tier_display' });
  assert.deepEqual(sanitizeCakeConfig(cake([tier('display'), tier('real')]), offer({ display: false })), { ok: false, reason: 'display_not_offered' });
  assert.deepEqual(sanitizeCakeConfig(cake([]), offer()), { ok: false, reason: 'tiers' });
  assert.deepEqual(sanitizeCakeConfig(cake(reals(11)), offer()), { ok: false, reason: 'tiers' });
  assert.deepEqual(sanitizeCakeConfig(cake(reals(4)), offer({ sizes: [1, 2, 3] })), { ok: false, reason: 'tiers' }, 'a size the shop does not make');
  assert.ok(sanitizeCakeConfig(cake([tier('display'), tier('real'), tier('display')], { cuttingTier: 1 }), offer()).ok);
});

test('flavour applies to real tiers only, and only the shop’s own flavours', () => {
  const got = sanitizeCakeConfig(cake([tier('display', { flavourRef: 'f2' }), tier('real', { flavourRef: 'f2' })]), offer());
  assert.ok(got.ok);
  assert.equal(got.config.tiers[0]!.flavourRef, null, 'a display tier carries no flavour');
  assert.deepEqual(sanitizeCakeConfig(cake([tier('real', { flavourRef: 'f9' })]), offer()), { ok: false, reason: 'not_offered' });
});

test('v6 per tier: shape and height — only what the shop makes', () => {
  assert.ok(sanitizeCakeConfig(cake([tier('real', { shape: 'heart' }), tier('real', { shape: 'hexagon', tall: true })]), offer()).ok);
  assert.deepEqual(sanitizeCakeConfig(cake([tier('real', { shape: 'heart' })]), offer({ shapes: ['round', 'square'] })), { ok: false, reason: 'not_offered' });
  assert.deepEqual(sanitizeCakeConfig(cake([tier('real', { tall: true })]), offer({ tall: false })), { ok: false, reason: 'not_offered' });
  const spec = cakeFigureSpec(cake([tier('real'), tier('real', { tall: true, shape: 'square' })]));
  const bottom = spec.tiers[0]!;
  const top = spec.tiers[1]!;
  assert.equal(bottom.shape, 'square');
  assert.ok(bottom.tall && bottom.height > top.height * 1.5, 'a tall tier is about twice the height (double barrel)');
});

test('a look this shop does not offer is refused, never quietly swapped', () => {
  assert.deepEqual(sanitizeCakeConfig(cake(reals(1), { arrangement: 'pillars' }), offer({ arrangements: ['stacked'] })), { ok: false, reason: 'not_offered' });
  assert.deepEqual(sanitizeCakeConfig(cake([tier('real', { accent: 'drip' })]), offer({ accents: ['none', 'ribbon'] })), { ok: false, reason: 'not_offered' });
  assert.deepEqual(sanitizeCakeConfig(cake(reals(1), { monogram: 'front' }), offer({ monogram: false })), { ok: false, reason: 'not_offered' });
  assert.deepEqual(sanitizeCakeConfig(cake(reals(1), { cupcakes: { packRef: 'pack:24', flavourRef: null, match: true, placement: 'base' } }), offer()), { ok: false, reason: 'not_offered' });
});

test('colours cap at 3, text caps at the shop’s letters and 500 for the notes, and junk is refused', () => {
  const c = { hex: '#C98B8B', name: 'Dusty rose' };
  assert.deepEqual(sanitizeCakeConfig(cake(reals(1), { colours: [c, c, c, c] }), offer()), { ok: false, reason: 'colours' });
  assert.deepEqual(sanitizeCakeConfig(cake(reals(1), { message: 'x'.repeat(41) }), offer({ messageMax: 40 })), { ok: false, reason: 'text' });
  assert.deepEqual(sanitizeCakeConfig(cake(reals(1), { instructions: 'x'.repeat(501) }), offer()), { ok: false, reason: 'text' });
  assert.ok(sanitizeCakeConfig(cake(reals(1), { instructions: 'x'.repeat(500) }), offer()).ok);
  assert.deepEqual(sanitizeCakeConfig({ ...cake(reals(1)), pad: 'x'.repeat(5000) }, offer()), { ok: false, reason: 'too_big' });
  assert.deepEqual(sanitizeCakeConfig('a cake', offer()), { ok: false, reason: 'not_a_design' });
});

test('cupcakes: the shop’s packs and flavours, around the base or a tower when offered', () => {
  const o = offer({ cupcakes: { packRefs: ['pack:24'], flavourRefs: ['f1'], tower: false } });
  const ok = sanitizeCakeConfig(cake(reals(1), { cupcakes: { packRef: 'pack:24', flavourRef: 'f1', match: false, placement: 'base' } }), o);
  assert.ok(ok.ok);
  assert.equal(cakeFigureSpec(ok.config, () => null, 24).cupcakes?.count, 24);
  assert.deepEqual(sanitizeCakeConfig(cake(reals(1), { cupcakes: { packRef: 'pack:24', flavourRef: null, match: true, placement: 'tower' } }), o), { ok: false, reason: 'not_offered' });
});

test('staircase stands each tier on its own stand, stepping up', () => {
  const spec = cakeFigureSpec(cake(reals(3), { arrangement: 'staircase' }));
  assert.equal(spec.stands.length, 3, 'one stand per tier');
  const ys = spec.stands.map((s) => s.y);
  assert.ok(ys[0]! < ys[1]! && ys[1]! < ys[2]!, `the stands step up (${ys.join(', ')})`);
  assert.equal(cakeFigureSpec(cake(reals(3))).stands.length, 1, 'stacked stands on one board');
});

test('resizing keeps the bottom tiers the couple set; the cut tier stays real and in range', () => {
  const start = cake([tier('real', { accent: 'pearls' }), tier('display'), tier('real', { shape: 'square', flavourRef: 'f2' })], { cuttingTier: 2 });
  const up = resizeCakeTiers(start, 5);
  assert.equal(up.tiers.length, 5);
  assert.deepEqual(up.tiers[4], start.tiers[2], 'the bottom tier is kept');
  assert.equal(up.cuttingTier, 4, 'the cut tier moved with the bottom');
  assert.equal(up.tiers[0]!.accent, 'pearls', 'new top tiers copy the old top');
  const down = resizeCakeTiers(start, 1);
  assert.equal(down.tiers.length, 1);
  assert.equal(down.tiers[0]!.shape, 'square', 'one tier left: the bottom one');
  assert.equal(down.tiers[0]!.kind, 'real');
  assert.equal(down.cuttingTier, 0);
  assert.ok(down.flowingFrom <= down.flowingTo && down.flowingTo === 0);
  for (let n = 1; n <= CAKE_MAX_TIERS; n++) assert.ok(sanitizeCakeConfig(resizeCakeTiers(start, n), offer()).ok, `resize to ${n} stays a valid design`);
});

test('both views draw the ONE shared model — the 2D picture and the 3D cake each read cakeFigureSpec', () => {
  const kit = join(process.cwd(), 'app', '_components', 'plan3d', 'kit');
  for (const f of ['cake-figure.tsx', 'cake-figure-3d.tsx']) {
    const p = join(kit, f);
    assert.ok(existsSync(p), `${f} exists`);
    const src = readFileSync(p, 'utf8');
    assert.match(src, /CakeFigureSpec/, `${f} draws a CakeFigureSpec`);
    assert.doesNotMatch(src, /config\.tiers/, `${f} never reads the raw config — only the shared model`);
  }
});
