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
  assert.deepEqual(gownHiddenChoices(b.config).veil, ['chapel', 'cathedral']);
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
