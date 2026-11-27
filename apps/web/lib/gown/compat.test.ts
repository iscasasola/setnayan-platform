/** 👗 gown/compat — the pairings follow v193, as data; the server refuses what they would have changed. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOWN_LAYER_TYPES, sanitizeGownConfig, startingGownConfig, type GownConfig, type GownOffer } from '../gown-config';
import { GOWN_RULES, gownChoose, gownChooseLayers, gownHiddenChoices } from './compat';

const OFFER: GownOffer = { fabricTypes: ['satin', 'crepe', 'chiffon'], fabricRefs: [], laceRefs: [], lookRefs: [] };
const start = (over: Partial<GownConfig> = {}): GownConfig => ({ ...startingGownConfig(), ...over });

test('a cape and butterfly sleeves fight over the shoulder: either choice takes the other off, said in the Undo line', () => {
  const a = gownChoose(start({ sleeve: 'butterfly', neck: 'bateau' }), { key: 'cape', value: 'side' });
  assert.equal(a.config.sleeve, 'none');
  assert.equal(a.tell, true);
  assert.deepEqual(a.notes, ['Sleeves are now none: butterfly sleeves stand where the cape lies.']);
  assert.deepEqual(a.changed, ['sleeve']);
  const b = gownChoose(start({ cape: 'capelet', neck: 'bateau' }), { key: 'sleeve', value: 'butterfly' });
  assert.equal(b.config.cape, 'none');
  // A Filipiniana brings butterfly sleeves, so it takes the cape off too.
  const c = gownChoose(start({ cape: 'back' }), { key: 'sil', value: 'terno' });
  assert.equal(c.config.sleeve, 'butterfly');
  assert.equal(c.config.neck, 'bateau');
  assert.equal(c.config.cape, 'none');
});

test('a back cape keeps the veil fingertip or shorter, both ways round', () => {
  const a = gownChoose(start({ veil: 'cathedral' }), { key: 'cape', value: 'back' });
  assert.equal(a.config.veil, 'fingertip');
  assert.equal(a.tell, true);
  const b = gownChoose(start({ cape: 'back' }), { key: 'veil', value: 'chapel' });
  assert.equal(b.config.veil, 'fingertip');
  assert.deepEqual(gownHiddenChoices(b.config).veil, ['floor', 'chapel', 'cathedral']);
  const c = gownChoose(start({ veil: 'cathedral' }), { key: 'cape', value: 'side' });
  assert.equal(c.config.veil, 'cathedral', 'a side cape leaves the veil alone');
});

test('the made-garment pairings from v193 setGown', () => {
  assert.equal(gownChoose(start(), { key: 'sil', value: 'ball' }).config.petti, 'full');
  const strap = gownChoose(start({ neck: 'high' }), { key: 'neck', value: 'sweetheart' }).config;
  assert.equal(strap.boning, 'complement');
  assert.equal(strap.waistStay, true);
  assert.deepEqual(gownChoose(start({ sil: 'aline', slits: ['left'] }), { key: 'sil', value: 'ball' }).config.slits, []);
  assert.equal(gownChoose(start({ waist: 'empire' }), { key: 'pieces', value: 'crop' }).config.waist, 'natural');
  const ruche = gownChoose(start(), { key: 'tex', value: 'ruche' }).config;
  assert.equal(ruche.texDir, 'd');
  assert.equal(ruche.texSp, 2.2);
  assert.equal(gownChoose(start(), { key: 'veilStyle', value: 'birdcage' }).config.veil, 'fingertip');
  assert.equal(gownChoose(start({ shape: 'corset', boning: 'corset' }), { key: 'shape', value: 'none' }).config.boning, 'complement');
  // The design passed in is never changed.
  const g = start();
  gownChoose(g, { key: 'sil', value: 'ball' });
  assert.equal(g.petti, 'soft');
});

test('the layers and the petticoat always agree (v192): a hoop is layer 1 only; full tulle makes a full petticoat', () => {
  const full = gownChooseLayers(start({ skirtLayers: 3 }), 3, ['soft', 'full', 'chiffon']).config;
  assert.equal(full.petti, 'full');
  assert.deepEqual(full.layerTypes.slice(0, 3), ['soft', 'full', 'chiffon']);
  const hoop = gownChooseLayers(start(), 2, ['hoop', 'organza']).config;
  assert.equal(hoop.petti, 'hoop');
  const soft = gownChoose(full, { key: 'petti', value: 'soft' }).config;
  assert.ok(!soft.layerTypes.some((t) => t === 'full' || t === 'hoop'));
  const none = gownChooseLayers(start(), 0, []).config;
  assert.equal(none.petti, 'none');
  // Every design the rules make, the server accepts; and the server refuses what they would have changed.
  for (const g of [full, hoop, soft, none]) assert.equal(sanitizeGownConfig(g, OFFER).ok, true);
  assert.deepEqual(sanitizeGownConfig({ ...full, petti: 'soft' }, OFFER), { ok: false, reason: 'not_a_design' });
  assert.deepEqual(sanitizeGownConfig({ ...start(), layerTypes: ['soft', 'hoop', 'soft', 'soft', 'soft', 'soft'] }, OFFER), { ok: false, reason: 'not_a_design' });
  assert.deepEqual(sanitizeGownConfig({ ...start(), cape: 'side', sleeve: 'butterfly', neck: 'bateau' }, OFFER), { ok: false, reason: 'not_a_design' });
  assert.deepEqual(sanitizeGownConfig({ ...start(), cape: 'back', veil: 'chapel' }, OFFER), { ok: false, reason: 'not_a_design' });
  assert.equal(GOWN_LAYER_TYPES.length, 5);
});

test('every rule names real keys and has a reason to exist (a change or a line)', () => {
  const keys = new Set(Object.keys(startingGownConfig()));
  for (const r of GOWN_RULES) {
    assert.ok(r.on.length > 0 && r.on.every((k) => keys.has(k)), r.id);
    assert.ok(r.apply || r.note, r.id);
  }
  assert.equal(new Set(GOWN_RULES.map((r) => r.id)).size, GOWN_RULES.length, 'rule ids are unique');
});

// v197 accuracy review: the lines are the prototype's own (`setGown`).
test('a strapless bodice: its back stops at the bra line, no cap sleeve or cowl, long sleeves are detachable', () => {
  const a = gownChoose(start({ neck: 'bateau', back: 'v', backT: 0.9, sleeve: 'cap', drape: 'cowl' }), { key: 'neck', value: 'straight' }, { backCapT: 0.4 });
  assert.equal(a.config.backT, 0.4);
  assert.equal(a.config.sleeve, 'none');
  assert.equal(a.config.drape, 'none');
  assert.equal(a.tell, true);
  assert.deepEqual(a.notes, [
    'The back stops at the bra line: a strapless bodice is held up all the way round there.',
    'Cap sleeves need a shoulder to sit on, so sleeves are now none.',
    'The cowl drape is off: a cowl hangs from the shoulders.',
  ]);
  // Without her landmarks the back is left to the stage.
  assert.equal(gownChoose(start({ neck: 'bateau', back: 'v', backT: 0.9 }), { key: 'neck', value: 'sweetheart' }).config.backT, 0.9);
  // Off-shoulder keeps its band, so a cap sleeve stays.
  assert.equal(gownChoose(start({ neck: 'bateau', sleeve: 'cap' }), { key: 'neck', value: 'off' }).config.sleeve, 'cap');
  const b = gownChoose(start({ neck: 'bateau', sleeve: 'long', boning: 'complement' }), { key: 'neck', value: 'sweetheart' });
  assert.deepEqual(b.notes, ['On a strapless bodice the long sleeves are detachable: each one on its own band round the upper arm.']);
  const c = gownChoose(start({ neck: 'sweetheart', sleeve: 'none' }), { key: 'sleeve', value: 'cap' });
  assert.equal(c.config.sleeve, 'none', 'the cap sleeve is refused');
  assert.deepEqual(c.notes, ['Cap sleeves need a shoulder to sit on: pick a neckline with shoulders first.']);
  assert.deepEqual(gownChoose(start({ neck: 'sweetheart' }), { key: 'sleeve', value: 'long' }).notes, ['Detachable sleeves: each one on its own band round the upper arm, separate from the strapless bodice.']);
  const h = gownHiddenChoices(start({ neck: 'straight' }));
  assert.deepEqual([h.sleeve, h.drape, h.longSleeveLabel], [['cap'], ['cowl'], 'Detachable']);
});

test('leaving a ball gown: the petticoat goes back to soft tulle, at most 2 layers', () => {
  const ball = gownChoose(start(), { key: 'sil', value: 'ball' }).config;
  const a = gownChoose({ ...ball, skirtLayers: 4 }, { key: 'sil', value: 'aline' });
  assert.equal(a.config.petti, 'soft');
  assert.equal(a.config.skirtLayers, 2);
  assert.ok(!a.config.layerTypes.includes('full') && !a.config.layerTypes.includes('hoop'));
  assert.deepEqual(a.notes, ["The petticoat is back to soft tulle: an a-line doesn't need the ball gown's full layers."]);
  assert.equal(gownChoose(ball, { key: 'sil', value: 'fitflare' }).notes[0], "The petticoat is back to soft tulle: a fit and flare doesn't need the ball gown's full layers.");
});

test('a sheath or mermaid: a sweep train at most, soft tulle at most; a sheath takes no pleats', () => {
  const a = gownChoose(start({ train: 'cathedral', pleat: 'box' }), { key: 'sil', value: 'sheath' });
  assert.equal(a.config.train, 'sweep');
  assert.equal(a.config.pleat, 'none');
  assert.deepEqual(a.notes, ['The train is now a sweep: a sheath is too narrow at the hem to carry a longer train.', 'Pleats are off: a sheath falls too close to the body for pleats to open.']);
  assert.equal(gownChoose(start({ sil: 'mermaid' }), { key: 'train', value: 'chapel' }).config.train, 'sweep');
  const p = gownChoose(start({ sil: 'mermaid' }), { key: 'petti', value: 'hoop' });
  assert.equal(p.config.petti, 'soft');
  assert.deepEqual(p.notes, ['A mermaid is too close-fitting for a hoop: soft tulle at most.']);
  const h = gownHiddenChoices(start({ sil: 'sheath' }));
  assert.deepEqual([h.petti, h.train, h.pleat], [['full', 'hoop'], ['chapel', 'cathedral'], true]);
});

test('the server refuses the v197 pairings the maker would have changed', () => {
  for (const bad of [{ neck: 'sweetheart', sleeve: 'cap' }, { neck: 'straight', drape: 'cowl' }, { sil: 'mermaid', petti: 'hoop' }, { sil: 'sheath', pleat: 'box' }, { cape: 'back', veil: 'floor' }] as Partial<GownConfig>[]) {
    assert.equal(sanitizeGownConfig(start(bad), OFFER).ok, false, JSON.stringify(bad));
  }
  assert.equal(sanitizeGownConfig(start({ neck: 'off', sleeve: 'cap' }), OFFER).ok, true, 'off-shoulder keeps its band');
});
