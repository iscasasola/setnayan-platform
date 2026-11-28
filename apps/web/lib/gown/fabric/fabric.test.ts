/** 👗 gown/fabric — the shine table, the cloth's shader patch on this three.js, and the cloth's feel per fabric. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GOWN_STOCK_FABRICS } from '../../gown-config';
import { GOWN_CLOTH_COLOURS, GOWN_SHINE, GOWN_SHINE_TYPE, applyGownSheer, applyGownShine, gownClothShader, gownSeeLayers, gownShaderReady } from './shine';
import { GOWN_FEEL, gownFoldPattern } from './feel';
import { GOWN_FABRIC_PROPS, gownClothFeel, gownFabricNote, gownFabricType } from './types';

test('every stock fabric has its behaviour and its shine', () => {
  for (const { id } of GOWN_STOCK_FABRICS) {
    assert.ok(GOWN_FABRIC_PROPS[id], `${id}: behaviour`);
    assert.ok(GOWN_SHINE[id], `${id}: shine`);
  }
});

test('the cloth shader patch finds its hooks in this three.js (0.184): the sheen no longer darkens the colour; sheer glows from behind', () => {
  assert.equal(gownShaderReady(), true, 'three moved the sheen energy term or the light chunks: the patch must be updated');
  const sh = { uniforms: {} as Record<string, unknown>, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  gownClothShader({ value: 0.4 })(sh);
  assert.match(sh.fragmentShader, /float sheenEnergyComp = 1\.0;/);
  assert.ok(!/float sheenEnergyComp = 1\.0 - /.test(sh.fragmentShader), 'every energy term is neutralised');
  assert.match(sh.fragmentShader, /sheerBack \* directionalLights/);
  assert.ok(sh.uniforms.sheerBack);
});

test('shine reads true (v207): satin glossy with no clearcoat (it read as plastic), crepe matte; a sheer is clear face-on, denser lined', () => {
  const m = new THREE.MeshPhysicalMaterial({ color: GOWN_CLOTH_COLOURS.ivory[0] });
  applyGownShine(m, 'satin');
  assert.ok(Math.abs(m.roughness - 0.34) < 1e-9, 'satin: 0.5 - 0.2 × gloss 0.8');
  assert.equal(m.clearcoat, 0);
  applyGownShine(m, 'crepe');
  assert.equal(m.roughness, 0.9);
  // The sheen keeps the cloth's own colour (a quarter of the way to white).
  const c = new THREE.Color(GOWN_CLOTH_COLOURS.ivory[0]).lerp(new THREE.Color(0xffffff), 0.25);
  assert.ok(m.sheenColor.equals(c));
  applyGownSheer(m, GOWN_FEEL.chiffon, false, 2);
  assert.equal(m.transparent, true);
  assert.ok(Math.abs(m.opacity - (1 - 0.95 * 0.55 + 0.04 * 2)) < 1e-9, 'unlined');
  applyGownSheer(m, GOWN_FEEL.chiffon, true, 2);
  assert.ok(Math.abs(m.opacity - (1 - 0.85 * 0.55 + 0.05 * 2)) < 1e-9, 'lined');
  applyGownSheer(m, GOWN_FEEL.satin, false, 2);
  assert.equal(m.transparent, false);
  assert.equal(m.opacity, 1);
  assert.equal(gownSeeLayers({ petti: 'none', skirtLayers: 3 }), 0);
  assert.equal(gownSeeLayers({ petti: 'soft', skirtLayers: 2 }), 2);
});

test('the feel cards (v207): every stock fabric has one; folds are uneven, taffeta crisper and finer than duchess; bias takes 1.35×', () => {
  for (const { id } of GOWN_STOCK_FABRICS) assert.ok(GOWN_FEEL[id], `${id}: feel card`);
  const f = gownFoldPattern('satin', 64);
  assert.ok(Math.abs(Math.min(...f)) < 1e-6 && Math.abs(Math.max(...f) - 1) < 1e-6, 'normalised 0 … 1');
  const gaps = new Set(Array.from({ length: 63 }, (_, q) => Math.round((f[q + 1]! - f[q]!) * 1e3)));
  assert.ok(gaps.size > 20, 'no two folds alike (the even ribs are gone)');
  assert.ok(GOWN_FEEL.taffeta.sharp > GOWN_FEEL.duchess.sharp && GOWN_FEEL.taffeta.foldCm < GOWN_FEEL.duchess.foldCm);
  assert.equal(GOWN_FEEL.bias_satin.m, 1.35);
  assert.equal(GOWN_SHINE.bias_satin.r, GOWN_SHINE_TYPE.satin(0.85).r, 'bias satin shines as satin, at its own gloss');
});

test('the cloth feel: soft chiffon swings wide and settles slowly; mikado holds its shape (v207 applyFabric, from the cards)', () => {
  const chiffon = gownClothFeel(gownFabricType('chiffon'), 2), mikado = gownClothFeel(gownFabricType('mikado'), 2);
  assert.ok(chiffon.gain > mikado.gain && chiffon.kc < mikado.kc && mikado.hold > chiffon.hold);
  assert.ok(Math.abs(gownClothFeel(gownFabricType('satin'), 2).hold - 0.9375) < 1e-9, 'v189 satin hold');
  // The folds' depth comes from the card (v207, the capture's own `foldK`): satin keeps v189's, chiffon's are shallower.
  assert.ok(Math.abs(gownClothFeel(gownFabricType('satin'), 2).foldK - 1.156) < 1e-9, 'satin folds');
  assert.ok(Math.abs(chiffon.foldK - 0.5076923076923076) < 1e-9, 'chiffon folds');
  assert.ok(Math.abs(gownClothFeel(gownFabricType('taffeta'), 2).foldK - 1.1146153846153846) < 1e-9, 'taffeta folds');
  assert.equal(gownFabricNote(GOWN_FABRIC_PROPS.tulle, false), 'Tulle: about 30 gsm, light: drapes softly and swings freely, two-way stretch. Sheer and unlined: shown see-through.');
});
