/** 👗 gown-config — the contract both gown builders share: append-only catalogs, each refusal, and a v186 order round-trip. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as G from './gown-config';
import {
  GOWN_CUP_MAX_CM,
  GOWN_FINE_TUNE_STEPS,
  GOWN_LOOK_KEYS,
  GOWN_MEASUREMENT_STEPS,
  GOWN_REFUSAL_WORDS,
  GOWN_STEP_LABELS,
  emptyGownQuantities,
  gownFromPrototypeOrder,
  gownLookOf,
  gownMeasuresNeeded,
  sanitizeGownBody,
  sanitizeGownConfig,
  sanitizeGownMeasures,
  sanitizeGownQuantities,
  startingGownBody,
  startingGownConfig,
  stockGownOffer,
  type GownOffer,
  type GownPrototypeOrder,
  type GownRefusal,
} from './gown-config';

const SHOP_FABRIC = '11111111-2222-4333-8444-555555555555';
const SHOP_LACE = '22222222-3333-4444-8555-666666666666';
const SHOP_LOOK = '33333333-4444-4555-8666-777777777777';
const offer = (over: Partial<GownOffer> = {}): GownOffer => ({ ...stockGownOffer(), fabricRefs: [SHOP_FABRIC], laceRefs: [SHOP_LACE], lookRefs: [SHOP_LOOK], ...over });
const design = (over: Record<string, unknown> = {}) => ({ ...startingGownConfig(), ...over });
const refused = (got: { ok: boolean; reason?: GownRefusal }, reason: GownRefusal, why: string) => assert.deepEqual(got, { ok: false, reason }, why);

/**
 * Every catalog as it shipped. Append-only: a stored design must never dangle, so a shipped id never moves or goes.
 * Adding an id at the END of a list is allowed (and this pin grows with it); anything else turns this red.
 */
const SHIPPED: Record<string, string[]> = {
  GOWN_SILHOUETTES: ['aline', 'ball', 'mermaid', 'sheath', 'terno', 'fitflare'],
  GOWN_PIECES: ['one', 'two', 'crop'],
  GOWN_WAISTLINES: ['natural', 'empire', 'dropped', 'basque', 'basqueU'],
  GOWN_NECKLINES: ['sweetheart', 'v', 'off', 'high', 'bateau', 'straight'],
  GOWN_SLEEVES: ['none', 'cap', 'long', 'butterfly', 'flutter'],
  GOWN_SLEEVE_FABRICS: ['fabric', 'lace', 'chiffon'],
  GOWN_BACKS: ['scoop', 'closed', 'v'],
  GOWN_CLOSURES: ['zipper', 'lace', 'buttons'],
  GOWN_TRAINS: ['none', 'sweep', 'chapel', 'cathedral'],
  GOWN_VEILS: ['none', 'fingertip', 'chapel', 'cathedral', 'elbow', 'floor'],
  GOWN_BLUSHERS: ['back', 'over'],
  GOWN_BOWS: ['none', 'back', 'shoulder'],
  GOWN_VEIL_STYLES: ['classic', 'mantilla', 'drop', 'juliet', 'birdcage'],
  GOWN_CAPES: ['none', 'side', 'back', 'capelet', 'neck', 'pair', 'drape'],
  GOWN_CAPE_FABRICS: ['gown', 'tulle', 'chiffon', 'organza', 'lace'],
  GOWN_CAPE_LENGTHS: ['shoulder', 'elbow', 'fingertip', 'floor', 'train'],
  GOWN_CAPE_EDGES: ['plain', 'lace', 'beaded', 'applique'],
  GOWN_CAPE_FASTENINGS: ['neck', 'shoulders'],
  GOWN_CAPE_COLOURS: ['match', 'accent'],
  GOWN_OVERLAYS: ['none', 'asym', 'tiered', 'cascade'],
  GOWN_OVERLAY_FABRICS: ['chiffon', 'georgette', 'tulle', 'organza', 'gown'],
  GOWN_HEMS: ['knee', 'midi', 'floor'],
  GOWN_STOCK_FABRICS: ['satin', 'mikado', 'crepe', 'chiffon', 'georgette', 'tulle', 'organza', 'lace', 'sequin', 'pina', 'jusi', 'wool_suiting', 'linen', 'velvet', 'stretch_crepe_jersey'],
  GOWN_COLOURS: ['white', 'ivory', 'champagne', 'blush', 'navy', 'custom'],
  GOWN_COLOUR_FAMILIES: ['whites', 'nude', 'blush', 'red', 'purple', 'blue', 'green', 'gold', 'brown', 'grey'],
  GOWN_LACES: ['none', 'floral', 'alencon', 'chantilly', 'guipure', 'leaf', 'scallop'],
  GOWN_LACE_PLACES: ['cascade', 'bodice', 'neck', 'hem', 'scatter', 'all'],
  GOWN_LACE_BEADS: ['none', 'light', 'rich'],
  GOWN_LACE_COLOURS: ['white', 'ivory', 'champagne', 'blush'],
  GOWN_BEADS: ['none', 'crystal', 'pearl', 'seed', 'sequin'],
  GOWN_BEAD_PLACES: ['cascade', 'bodice', 'neck', 'waist', 'hem', 'all'],
  GOWN_BEAD_DENSITIES: ['light', 'medium', 'heavy'],
  GOWN_BEAD_COLOURS: ['clear', 'ivory', 'champagne', 'silver', 'gold', 'custom'],
  GOWN_PLEATS: ['none', 'knife', 'box', 'accordion'],
  GOWN_TEXTURES: ['none', 'pintuck', 'ruche', 'smock'],
  GOWN_TEXTURE_PLACES: ['bodice', 'waist', 'back', 'skirt', 'all'],
  GOWN_TEXTURE_DIRECTIONS: ['v', 'h', 'd', 'vv'],
  GOWN_DARTS: ['none', 'bust', 'waist', 'princess', 'corset'],
  GOWN_DRAPES: ['none', 'grecian', 'cowl', 'swag'],
  GOWN_BUSTLES: ['none', 'french', 'american', 'ballroom'],
  GOWN_PETTICOATS: ['none', 'soft', 'full', 'hoop'],
  GOWN_SHAPEWEAR: ['none', 'light', 'firm', 'corset'],
  GOWN_BONING: ['soft', 'complement', 'corset'],
  GOWN_LININGS: ['satin', 'cotton', 'silk', 'none'],
  GOWN_LAYER_TYPES: ['soft', 'full', 'organza', 'chiffon', 'hoop'],
  GOWN_LAYER_COLOURS: ['match', 'ivory', 'white', 'blush', 'champagne', 'nude'],
  GOWN_SLITS: ['left', 'right', 'lside', 'rside', 'back'],
  GOWN_CUTOUTS: ['waist', 'keyhole', 'under', 'diamond', 'window', 'hip', 'slash'],
  GOWN_CUT_EDGES: ['clean', 'bound', 'frayed', 'scalloped', 'beaded'],
  GOWN_CUT_FILLS: ['open', 'illusion'],
  GOWN_TRIMS: ['pipeNeck', 'pipeHem', 'ruffleHem', 'ruffleNeck', 'fringe', 'feather'],
  GOWN_TRIM_COLOURS: ['match', 'custom'],
  GOWN_BODY_SHAPES: ['hourglass', 'pear', 'apple', 'rectangle', 'inverted'],
  GOWN_BUST_POSITIONS: ['high', 'avg', 'low', 'custom'],
  GOWN_MATTERS: ['arms', 'back', 'support', 'move'],
  GOWN_MEASURES: [
    'napeWaist', 'frontLen', 'waistHip', 'apexApex', 'acrossBack', 'acrossChest', 'shoulderLen', 'sideLen', 'shoulderApex', 'neck', 'upperArm',
    'armhole', 'elbow', 'wrist', 'armBent', 'thigh', 'knee', 'waistFloor', 'hollowHem', 'waistHem',
  ],
};

test('every catalog is append-only: the shipped ids keep their place, and no catalog repeats an id', () => {
  const exported = G as unknown as Record<string, unknown>;
  for (const [name, shipped] of Object.entries(SHIPPED)) {
    const list = exported[name] as { id: string; label: string }[] | undefined;
    assert.ok(Array.isArray(list), `${name} is exported`);
    const now = list.map((x) => x.id);
    assert.deepEqual(now.slice(0, shipped.length), shipped, `${name}: a shipped id moved or went`);
    assert.equal(new Set(now).size, now.length, `${name}: an id repeats`);
    for (const x of list) assert.ok(x.label.trim().length > 0, `${name}.${x.id} has words`);
  }
  // Every exported catalog is pinned here, so a new catalog cannot dodge this test.
  const catalogs = Object.entries(exported).filter(([, v]) => Array.isArray(v) && (v as unknown[]).every((x) => x && typeof x === 'object' && 'id' in (x as object) && 'label' in (x as object)));
  assert.deepEqual(catalogs.map(([k]) => k).sort(), Object.keys(SHIPPED).sort(), 'every catalog is pinned');
});

test('women only, no sash: the men\'s catalogs and the removed sash are not part of the contract', () => {
  const src = readFileSync(join(__dirname, 'gown-config.ts'), 'utf8');
  for (const word of ['barong', 'trouser', 'camisa', 'male.json', "'sash'"]) assert.ok(!src.toLowerCase().includes(word.toLowerCase()), `no ${word}`);
  assert.ok(!G.GOWN_TRIMS.some((t) => (t.id as string) === 'sash'));
});

test('the measurement steps keep the owner\'s order exactly (27 Nov)', () => {
  assert.deepEqual(
    [...GOWN_MEASUREMENT_STEPS].map((s) => GOWN_STEP_LABELS[s]),
    ['Height', 'Weight', 'Body shape', 'Bust', 'Waist', 'Hips'],
  );
  assert.deepEqual(
    [...GOWN_FINE_TUNE_STEPS].map((s) => GOWN_STEP_LABELS[s]),
    ['Bust position', 'Underbust', 'Shoulders', 'Arm length', 'Leg length', 'Elevation', 'What matters to her'],
  );
});

test('a fresh design and a fresh body pass the server\'s own checks unchanged', () => {
  const c = sanitizeGownConfig(startingGownConfig(), stockGownOffer());
  assert.ok(c.ok);
  assert.deepEqual(c.config, startingGownConfig());
  const b = sanitizeGownBody(startingGownBody());
  assert.ok(b.ok);
  assert.deepEqual(b.body, startingGownBody());
  // The 155 cm default figure (v182: 84/72/68/90).
  assert.deepEqual([b.body.vals.height, b.body.vals.bust, b.body.vals.underbust, b.body.vals.waist, b.body.vals.hips], [155, 84, 72, 68, 90]);
  const q = sanitizeGownQuantities(emptyGownQuantities());
  assert.ok(q.ok);
  assert.deepEqual(q.quantities, emptyGownQuantities());
});

test('the design check refuses, never repairs: each reason has its own words and its own trigger', () => {
  for (const [k, w] of Object.entries(GOWN_REFUSAL_WORDS)) assert.ok(w.length > 0 && !/vendor/i.test(w), `${k} words`);
  refused(sanitizeGownConfig({ ...design(), notes: 'x'.repeat(9000) }, offer()), 'too_big', 'an oversized design');
  refused(sanitizeGownConfig([], offer()), 'not_a_design', 'not an object');
  refused(sanitizeGownConfig(design({ v: 99 }), offer()), 'not_a_design', 'a version this code does not know');
  refused(sanitizeGownConfig(design({ sil: 'trumpet' }), offer()), 'not_a_design', 'a silhouette not in the catalog');
  refused(sanitizeGownConfig(design({ fabric: 'Satin!' }), offer()), 'not_a_design', 'a fabric id that is not a slug');
  refused(sanitizeGownConfig(design({ fabric: 'velvet' }), offer({ fabricTypes: ['satin'] })), 'not_offered', 'a fabric type the shop does not work in');
  refused(sanitizeGownConfig(design({ fabricRef: '44444444-4444-4444-8444-444444444444' }), offer()), 'not_offered', 'another shop\'s fabric');
  refused(sanitizeGownConfig(design({ laceRef: SHOP_FABRIC }), offer()), 'not_offered', 'a fabric row used as a lace');
  refused(sanitizeGownConfig(design({ lookRef: 'not-a-uuid' }), offer()), 'not_a_design', 'a look ref that is not an id');
  refused(sanitizeGownConfig(design({ heel: 16 }), offer()), 'out_of_range', 'a heel past 15 cm');
  refused(sanitizeGownConfig(design({ heel: 4.2 }), offer()), 'out_of_range', 'a heel off the half-cm steps');
  refused(sanitizeGownConfig(design({ hemCm: 5 }), offer()), 'out_of_range', 'a hem that lengthens');
  refused(sanitizeGownConfig(design({ neckT: 1.5 }), offer()), 'out_of_range', 'a front depth past 1');
  refused(sanitizeGownConfig(design({ beadMm: 7 }), offer()), 'out_of_range', 'a bead past 6 mm');
  refused(sanitizeGownConfig(design({ cuts: ['keyhole', 'under'] }), offer()), 'cut_forbidden', 'an under-bust opening');
  refused(sanitizeGownConfig(design({ cuts: ['diamond'] }), offer()), 'cut_forbidden', 'a back cut-out through the closure');
  refused(sanitizeGownConfig(design({ cuts: ['keyhole', 'keyhole'] }), offer()), 'not_a_design', 'a repeated cut-out');
  refused(sanitizeGownConfig(design({ colour: 'custom', colourHex: null }), offer()), 'colours', 'a custom colour with no colour');
  refused(sanitizeGownConfig(design({ accentHex: 'red' }), offer()), 'colours', 'a colour that is not a hex');
  refused(sanitizeGownConfig(design({ palette: ['whites', 'nude', 'blush', 'red'] }), offer()), 'colours', 'four colour families');
  refused(sanitizeGownConfig(design({ bead: 'pearl', beadCol: 'custom' }), offer()), 'colours', 'custom beads with no colour');
  refused(sanitizeGownConfig(design({ mix: [{ hex: '#C9A13B', pct: 20 }, { hex: '#E3CFA6', pct: 20 }, { hex: '#FFFFFF', pct: 20 }] }), offer()), 'colours', 'three mixed-in colours');
  refused(sanitizeGownConfig(design({ notes: 'x'.repeat(1501) }), offer()), 'text', 'long special requests');
  refused(sanitizeGownConfig(design({ waistStay: 'yes' }), offer()), 'not_a_design', 'a switch that is not a yes or no');
});

test('the design check keeps what is valid and normalises only case', () => {
  const got = sanitizeGownConfig(
    design({
      sil: 'mermaid',
      colour: 'custom',
      colourHex: '#7a2e3a',
      trimCol: 'custom',
      trimHex: '#c9a46a',
      trims: ['pipeNeck'],
      fabricRef: SHOP_FABRIC.toUpperCase(),
      laceRef: SHOP_LACE,
      lace: 'chantilly',
      bead: 'pearl',
      beadCol: 'custom',
      beadHex: '#e6b8c2',
      beadLayers: [{ bead: 'crystal', beadAt: 'neck', beadDen: 'light', beadCol: 'clear', beadMm: 4, beadHex: null, mix: [] }],
      cuts: ['keyhole', 'hip'],
      slits: ['left'],
      heel: 7,
      neckT: 0.45,
      notes: '  A fitting in March.  ',
    }),
    offer(),
  );
  assert.ok(got.ok);
  assert.equal(got.config.colourHex, '#7A2E3A');
  assert.equal(got.config.trimHex, '#C9A46A');
  assert.equal(got.config.beadHex, '#E6B8C2');
  assert.equal(got.config.fabricRef, SHOP_FABRIC);
  assert.equal(got.config.notes, 'A fitting in March.');
  assert.equal(got.config.beadLayers.length, 1);
  // A colour for a non-custom pick is dropped, not stored: the stock swatch is the colour.
  const plain = sanitizeGownConfig(design({ colour: 'ivory', colourHex: '#123456' }), offer());
  assert.ok(plain.ok);
  assert.equal(plain.config.colourHex, null);
});

test('the body check: the mannequin\'s range, BMI 10–62, and a bust at most 28 cm over the underbust', () => {
  const body = (vals: Partial<G.GownBodyVals>, over: Record<string, unknown> = {}) => ({ ...startingGownBody(), ...over, vals: { ...startingGownBody().vals, ...vals } });
  refused(sanitizeGownBody(body({ height: 139 })), 'body_range', 'shorter than the mannequin goes');
  refused(sanitizeGownBody(body({ hips: 171 })), 'body_range', 'hips past the range');
  refused(sanitizeGownBody(body({ weight: 23 })), 'weight_for_height', 'BMI under 10 at 155 cm');
  refused(sanitizeGownBody(body({ weight: 150 })), 'weight_for_height', 'BMI over 62 at 155 cm');
  refused(sanitizeGownBody(body({ underbust: 72, bust: 72 + GOWN_CUP_MAX_CM + 1 })), 'bust_over_underbust', 'bust 29 over the underbust');
  refused(sanitizeGownBody(body({ underbust: 90, bust: 88 })), 'body_range', 'a bust under the underbust');
  refused(sanitizeGownBody(body({}, { bustT: 2 })), 'body_range', 'a bust position past the bar');
  refused(sanitizeGownBody(body({}, { shape: 'spoon' })), 'not_a_design', 'a body shape not in the list');
  refused(sanitizeGownBody(body({}, { given: ['height', 'height'] })), 'not_a_design', 'a number given twice');
  refused(sanitizeGownBody(body({}, { bra: { eu: '75B', us: '34B', uk: '34B<script>', exact: true } })), 'not_a_design', 'a bra size that is not a size');
  refused(sanitizeGownBody({ vals: { height: 155 } }), 'not_a_design', 'a body missing numbers');
  // At the cup limit exactly: allowed.
  assert.ok(sanitizeGownBody(body({ underbust: 72, bust: 72 + GOWN_CUP_MAX_CM })).ok);
});

test('the measurement check: known keys only, each tagged typed or estimate', () => {
  assert.ok(sanitizeGownMeasures({ waistHip: { cm: 20, from: 'estimate' }, waistFloor: { cm: 108, from: 'typed' } }).ok);
  refused(sanitizeGownMeasures({ inseam: { cm: 80, from: 'typed' } }), 'measures', 'a men\'s measurement');
  refused(sanitizeGownMeasures({ knee: { cm: 0, from: 'typed' } }), 'measures', 'a zero');
  refused(sanitizeGownMeasures({ knee: { cm: 36, from: 'tape' } }), 'measures', 'the designer\'s tape is a fitting, not hers');
});

test('what this design needs: v186 GMEAS conditions', () => {
  const s = startingGownConfig();
  const base = gownMeasuresNeeded(s);
  // Sweetheart is strapless → the bust points are needed; a floor hem → the floor lengths, not waist to hem.
  assert.ok(base.includes('apexApex') && base.includes('shoulderApex') && base.includes('waistFloor') && !base.includes('waistHem'));
  assert.ok(!base.includes('knee') && !base.includes('elbow'));
  // v197 starts boned; an unboned bateau mermaid needs no bust points.
  const mermaid = gownMeasuresNeeded({ ...s, sil: 'mermaid', sleeve: 'long', neck: 'bateau', hem: 'knee', boning: 'soft' });
  assert.ok(mermaid.includes('knee') && mermaid.includes('thigh') && mermaid.includes('elbow') && mermaid.includes('wrist') && mermaid.includes('waistHem'));
  assert.ok(!mermaid.includes('apexApex') && !mermaid.includes('waistFloor'));
  // The list order is the catalog's.
  const order = G.GOWN_MEASURES.map((m) => m.id as string);
  assert.deepEqual([...mermaid].sort((a, b) => order.indexOf(a) - order.indexOf(b)), mermaid);
});

test('quantities carry no money: unknown keys (a price, a cost) are refused, counts are whole, guards hold', () => {
  const q = emptyGownQuantities();
  // The veil's tulle is its own quantity, apart from the petticoat's (Builder B: a priced veil is never counted twice).
  assert.equal(q.materials.veilM, 0);
  assert.ok(sanitizeGownQuantities({ ...q, materials: { ...q.materials, netM: 6, veilM: 3.5 } }).ok);
  const keys = JSON.stringify(q);
  assert.ok(!/price|cost|centavo|peso|amount|rate|markup/i.test(keys), 'no money word in any quantity key');
  refused(sanitizeGownQuantities({ ...q, price: 1 }), 'quantities', 'a price beside the quantities');
  refused(sanitizeGownQuantities({ ...q, materials: { ...q.materials, cost: 1 } }), 'quantities', 'a cost line in the materials');
  refused(sanitizeGownQuantities({ ...q, labour: { ...q.labour, hours: 9 } }), 'quantities', 'hours are the shop\'s, not the bride\'s');
  refused(sanitizeGownQuantities({ ...q, materials: { ...q.materials, buttons: 2.5 } }), 'quantities', 'half a button');
  refused(sanitizeGownQuantities({ ...q, materials: { ...q.materials, outerM: -1 } }), 'quantities', 'negative metres');
  refused(sanitizeGownQuantities({ ...q, materials: { ...q.materials, outerM: 201 } }), 'quantities', 'past the metres guard');
  refused(sanitizeGownQuantities({ ...q, labour: { ...q.labour, slits: 6 } }), 'quantities', 'more slits than places');
  refused(sanitizeGownQuantities({ ...q, labour: { ...q.labour, sleeve: 'puff' } }), 'quantities', 'a sleeve not in the catalog');
  const ok = sanitizeGownQuantities({ ...q, materials: { ...q.materials, outerM: 7.4, buttons: 24, beads: { ...q.materials.beads, pearl: 600 } }, labour: { ...q.labour, beads: 600, train: 'chapel' } });
  assert.ok(ok.ok);
  assert.equal(ok.quantities.materials.beads.pearl, 600);
});

test('the contract file holds no price: no peso, no centavos, no money format', () => {
  const src = readFileSync(join(__dirname, 'gown-config.ts'), 'utf8');
  assert.ok(!/₱|centavos?\b|formatPhp|price_|_price|priceShown/i.test(src), 'no money in the contract');
});

/**
 * A v186 order, as `orderData()` builds it for the scenario in the prototype's `tests/ord.js`: 158 cm, bust 92 on an
 * underbust of 76, a mermaid with a V neck, 7 cm heels, two numbers typed and the rest estimated.
 */
const V186_ORDER: GownPrototypeOrder = {
  look: 'Lace mermaid',
  notes: 'Fitting before March, please.',
  design3d: {
    gown: {
      veilStyle: 'classic', waist: 'natural', pieces: 'one', sil: 'mermaid', neck: 'v', sleeve: 'none', sleeveFab: 'fabric', back: 'v', closure: 'zipper',
      fabric: 'crepe', lace: 'chantilly', laceAt: 'all', laceBeads: 'none', laceCol: 'ivory', bead: 'none', beadAt: 'cascade', beadDen: 'medium', beadCol: 'clear',
      train: 'chapel', veil: 'chapel', pleat: 'none', tex: 'none', darts: 'none', drape: 'none', bustle: 'none', petti: 'soft', shape: 'none', boning: 'soft',
    },
    col: 'ivory',
    colHex: null,
    hem: 'floor',
    heel: 7,
  },
  vals: { height: 158, weight: 58, bust: 92, waist: 72, hips: 98, underbust: 76, shoulders: 36, arm: 1, leg: 0.915 },
  fine: { bustT: 0, bustPos: 'avg', athletic: false, given: ['height', 'bust', 'waist', 'hips', 'underbust'] },
  matters: ['move'],
  body: { bra: { eu: '75C', us: '34C', uk: '34C', exact: true } },
  gownMeas: { waistFloor: 108, napeWaist: 39 },
  gownMeasEst: { waistHip: 20.5, apexApex: 18, shoulderApex: 24.5, thigh: 56, knee: 36.5, waistFloor: 106 },
};

test('a v186 order round-trips: the look keys, her numbers and her choices come back exactly', () => {
  const got = gownFromPrototypeOrder(V186_ORDER, offer());
  assert.ok(got.ok, got.ok ? '' : got.reason);
  // A v186 look has no bow, blusher or overlay (v197 adds them to the look): they come back as the starting values.
  // It opens as v197 opens an order: the mermaid's chapel train becomes a sweep (corpus a5ada15).
  const s0 = startingGownConfig();
  assert.deepEqual(gownLookOf(got.config), { bow: s0.bow, blusher: s0.blusher, overlay: s0.overlay, ovFab: s0.ovFab, ...V186_ORDER.design3d.gown, train: 'sweep' }, 'the look the designer opens on the mannequin');
  assert.deepEqual(Object.keys(gownLookOf(got.config)), [...GOWN_LOOK_KEYS]);
  assert.equal(got.config.hem, 'floor');
  assert.equal(got.config.heel, 7);
  assert.equal(got.config.colour, 'ivory');
  assert.equal(got.config.lookName, 'Lace mermaid');
  assert.equal(got.config.notes, 'Fitting before March, please.');
  assert.deepEqual(got.body.vals, V186_ORDER.vals);
  assert.deepEqual(got.body.given, V186_ORDER.fine.given);
  assert.deepEqual(got.body.matters, ['move']);
  assert.deepEqual(got.body.bra, { eu: '75C', us: '34C', uk: '34C', exact: true });
  // Her typed tape wins over the estimate for the same measurement; every other one stays an estimate.
  assert.deepEqual(got.measures.waistFloor, { cm: 108, from: 'typed' });
  assert.deepEqual(got.measures.napeWaist, { cm: 39, from: 'typed' });
  assert.deepEqual(got.measures.knee, { cm: 36.5, from: 'estimate' });
  // And the stored shapes pass the server's checks a second time unchanged (what is stored is what is read).
  const again = sanitizeGownConfig(got.config, offer());
  assert.ok(again.ok);
  assert.deepEqual(again.config, got.config);
  const body = sanitizeGownBody(got.body);
  assert.ok(body.ok);
  assert.deepEqual(body.body, got.body);
});

test('every v186 stock look reads as a valid design (the prototype\'s LOOKS)', () => {
  const LOOKS: [string, Record<string, string>, string][] = [
    ['Classic ball gown', { sil: 'ball', fabric: 'mikado', lace: 'alencon', laceAt: 'cascade', laceBeads: 'light', train: 'cathedral', veil: 'cathedral', closure: 'buttons' }, 'floor'],
    // Corpus a5ada15 (v198): the Lace mermaid carries a sweep train (a mermaid is too narrow at the hem for longer).
    ['Lace mermaid', { sil: 'mermaid', neck: 'v', back: 'v', sleeve: 'long', sleeveFab: 'lace', fabric: 'crepe', lace: 'chantilly', laceAt: 'all', train: 'sweep', veil: 'chapel' }, 'floor'],
    ['Modern minimal', { sil: 'sheath', neck: 'bateau', back: 'v', fabric: 'crepe', train: 'sweep' }, 'floor'],
    ['Filipiniana terno', { sil: 'terno', neck: 'bateau', sleeve: 'butterfly', fabric: 'pina', bead: 'pearl', beadAt: 'neck', beadCol: 'ivory' }, 'floor'],
    ['Boho garden', { neck: 'v', sleeve: 'cap', fabric: 'chiffon', lace: 'leaf', laceAt: 'scatter', train: 'sweep', veil: 'fingertip' }, 'floor'],
    ['Sparkle princess', { sil: 'ball', neck: 'off', fabric: 'tulle', bead: 'crystal', beadAt: 'all', beadDen: 'medium', train: 'chapel' }, 'floor'],
    ['High-low reception', { neck: 'sweetheart', fabric: 'satin', lace: 'guipure', laceAt: 'hem', train: 'chapel' }, 'knee'],
    ['Grecian goddess', { neck: 'v', fabric: 'chiffon', drape: 'grecian', train: 'sweep' }, 'floor'],
  ];
  for (const [name, look, hem] of LOOKS) {
    const got = sanitizeGownConfig(design({ ...look, hem, lookName: name }), stockGownOffer());
    assert.ok(got.ok, `${name}: ${got.ok ? '' : got.reason}`);
    for (const [k, v] of Object.entries(look)) assert.equal(got.config[k as keyof G.GownConfig], v, `${name}.${k}`);
  }
});

test('v2 (accuracy review, v197): an A-line saved at v1 opens as Fit and flare; a v2 A-line stays an A-line', () => {
  const o = stockGownOffer();
  const old = sanitizeGownConfig({ ...startingGownConfig(), v: 1, sil: 'aline' }, o);
  assert.ok(old.ok && old.config.sil === 'fitflare' && old.config.v === 2, 'v1 A-line → Fit and flare, stored as v2');
  const now = sanitizeGownConfig({ ...startingGownConfig(), sil: 'aline' }, o);
  assert.ok(now.ok && now.config.sil === 'aline');
  const ball = sanitizeGownConfig({ ...startingGownConfig(), v: 1, sil: 'ball' }, o);
  assert.ok(ball.ok && ball.config.sil === 'ball', 'only the A-line moves');
});
