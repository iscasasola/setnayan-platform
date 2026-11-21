/** 🎂 cake-config — the one catalog, the server's refusals, and the one figure model both views draw. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAKE_MAX_TIERS,
  cakeFigureSpec,
  fullCakeOffer,
  sanitizeCakeConfig,
  startingCakeConfig,
  type CakeConfig,
  type CakeOffer,
} from './cake-config';

const offer = (over: Partial<CakeOffer> = {}): CakeOffer => ({ ...fullCakeOffer(), flavourRefs: ['f-ube', 'f-choc'], ...over });
const cake = (kinds: ('real' | 'display')[], over: Partial<CakeConfig> = {}) => ({
  ...startingCakeConfig(offer()),
  tiers: kinds.map((kind) => ({ kind, flavourRef: kind === 'real' ? 'f-ube' : null, accent: 'none' as const })),
  ...over,
});

test('N tiers draw a complete N-tier cake for every N from 1 to 10: widest at the bottom, the topper on the top tier', () => {
  for (let n = 1; n <= CAKE_MAX_TIERS; n++) {
    const got = sanitizeCakeConfig(cake(Array(n).fill('real'), { topper: 'names' }), offer());
    assert.ok(got.ok, `n=${n}`);
    const spec = cakeFigureSpec(got.config);
    assert.equal(spec.tiers.length, n, `exactly ${n} tiers`);
    for (let k = 1; k < n; k++) {
      assert.ok(spec.tiers[k]!.radius < spec.tiers[k - 1]!.radius, `n=${n}: tier ${k} narrower than the one below`);
      assert.ok(spec.tiers[k]!.y >= spec.tiers[k - 1]!.y + spec.tiers[k - 1]!.height - 1e-9, `n=${n}: tier ${k} sits on the one below`);
    }
    assert.equal(spec.topper?.onTier, n - 1, `n=${n}: the topper sits on the top tier`);
    assert.ok(spec.height <= 4.2, `n=${n}: scaled to fit the frame (${spec.height})`);
  }
});

test('the server refuses zero real tiers and a display cutting tier — and display tiers from a shop without them', () => {
  assert.deepEqual(sanitizeCakeConfig(cake(['display', 'display']), offer()), { ok: false, reason: 'no_real_tier' });
  assert.deepEqual(sanitizeCakeConfig(cake(['display', 'real'], { cuttingTier: 0 }), offer()), { ok: false, reason: 'cutting_tier_display' });
  assert.deepEqual(sanitizeCakeConfig(cake(['real', 'display']), offer({ maxDisplayTiers: 0 })), { ok: false, reason: 'display_not_offered' });
  assert.deepEqual(sanitizeCakeConfig(cake([]), offer()), { ok: false, reason: 'tiers' });
  assert.deepEqual(sanitizeCakeConfig(cake(Array(11).fill('real')), offer()), { ok: false, reason: 'tiers' });
  assert.ok(sanitizeCakeConfig(cake(['display', 'real', 'display'], { cuttingTier: 1 }), offer()).ok);
});

test('flavour applies to real tiers only, and only the shop’s own flavours', () => {
  const got = sanitizeCakeConfig(
    { ...cake(['real', 'display']), tiers: [{ kind: 'real', flavourRef: 'f-choc', accent: 'none' }, { kind: 'display', flavourRef: 'f-ube', accent: 'none' }] },
    offer(),
  );
  assert.ok(got.ok);
  assert.equal(got.config.tiers[1]!.flavourRef, null, 'a display tier carries no flavour');
  assert.deepEqual(
    sanitizeCakeConfig({ ...cake(['real']), tiers: [{ kind: 'real', flavourRef: 'f-other', accent: 'none' }] }, offer()),
    { ok: false, reason: 'not_offered' },
  );
});

test('a look this shop does not offer is refused, never quietly swapped', () => {
  assert.deepEqual(sanitizeCakeConfig(cake(['real'], { arrangement: 'pillars' }), offer({ arrangements: ['stacked'] })), { ok: false, reason: 'not_offered' });
  assert.deepEqual(
    sanitizeCakeConfig({ ...cake(['real']), tiers: [{ kind: 'real', flavourRef: null, accent: 'drip' }] }, offer({ accents: ['none', 'ribbon'] })),
    { ok: false, reason: 'not_offered' },
  );
  assert.deepEqual(sanitizeCakeConfig(cake(['real'], { monogram: 'front' }), offer({ monogram: false })), { ok: false, reason: 'not_offered' });
  assert.deepEqual(
    sanitizeCakeConfig(cake(['real'], { cupcakes: { packRef: 'p-24', flavourRef: null, match: true, placement: 'base' } }), offer()),
    { ok: false, reason: 'not_offered' },
  );
});

test('colours cap at 3, text caps at the shop’s letters, and junk is refused before anything is parsed', () => {
  const c = { hex: '#C98B8B', name: 'Dusty rose' };
  assert.deepEqual(sanitizeCakeConfig(cake(['real'], { colours: [c, c, c, c] }), offer()), { ok: false, reason: 'colours' });
  assert.deepEqual(sanitizeCakeConfig(cake(['real'], { message: 'x'.repeat(41) }), offer({ messageMax: 40 })), { ok: false, reason: 'text' });
  assert.deepEqual(sanitizeCakeConfig({ ...cake(['real']), pad: 'x'.repeat(5000) }, offer()), { ok: false, reason: 'too_big' });
  assert.deepEqual(sanitizeCakeConfig('a cake', offer()), { ok: false, reason: 'not_a_design' });
});

test('cupcakes: the shop’s packs and flavours, around the base or a tower when offered', () => {
  const o = offer({ cupcakes: { packRefs: ['p-24'], flavourRefs: ['c-van'], tower: false } });
  const ok = sanitizeCakeConfig(cake(['real'], { cupcakes: { packRef: 'p-24', flavourRef: 'c-van', match: false, placement: 'base' } }), o);
  assert.ok(ok.ok);
  assert.equal(cakeFigureSpec(ok.config, () => null, 24).cupcakes?.count, 24);
  assert.deepEqual(
    sanitizeCakeConfig(cake(['real'], { cupcakes: { packRef: 'p-24', flavourRef: null, match: true, placement: 'tower' } }), o),
    { ok: false, reason: 'not_offered' },
  );
});

test('both views draw the ONE shared model — the 2D picture and the 3D turntable each read cakeFigureSpec', () => {
  const kit = join(process.cwd(), 'app', '_components', 'plan3d', 'kit');
  for (const f of ['cake-figure.tsx', 'cake-figure-3d.tsx']) {
    const p = join(kit, f);
    assert.ok(existsSync(p), `${f} exists`);
    const src = readFileSync(p, 'utf8');
    assert.match(src, /CakeFigureSpec/, `${f} draws a CakeFigureSpec`);
    assert.doesNotMatch(src, /config\.tiers/, `${f} never reads the raw config — only the shared model`);
  }
});
