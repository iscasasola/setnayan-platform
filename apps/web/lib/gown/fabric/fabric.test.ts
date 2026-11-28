/** 👗 gown/fabric — the shine table, the cloth's shader patch on this three.js, and the cloth's feel per fabric. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GOWN_STOCK_FABRICS } from '../../gown-config';
import { GOWN_CLOTH_COLOURS, GOWN_SHINE, applyGownSheer, applyGownShine, gownClothShader, gownShaderReady } from './shine';
import { GOWN_FABRIC_PROPS, gownClothFeel, gownFabricNote } from './types';

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

test('shine reads true: satin is glossy with clearcoat, crepe matte; a sheer shows her only when unlined', () => {
  const m = new THREE.MeshPhysicalMaterial({ color: GOWN_CLOTH_COLOURS.ivory[0] });
  applyGownShine(m, 'satin');
  assert.equal(m.roughness, 0.3);
  assert.equal(m.clearcoat, 0.35);
  applyGownShine(m, 'crepe');
  assert.equal(m.roughness, 0.9);
  assert.equal(m.clearcoat, 0);
  // The sheen keeps the cloth's own colour (a quarter of the way to white).
  const c = new THREE.Color(GOWN_CLOTH_COLOURS.ivory[0]).lerp(new THREE.Color(0xffffff), 0.25);
  assert.ok(m.sheenColor.equals(c));
  applyGownSheer(m, GOWN_FABRIC_PROPS.chiffon, false);
  assert.equal(m.transparent, true);
  assert.ok(Math.abs(m.opacity - (1 - 0.38 * 0.55)) < 1e-9);
  applyGownSheer(m, GOWN_FABRIC_PROPS.chiffon, true);
  assert.ok(Math.abs(m.opacity - (1 - 0.15 * 0.55)) < 1e-9);
  applyGownSheer(m, GOWN_FABRIC_PROPS.satin, false);
  assert.equal(m.transparent, false);
  assert.equal(m.opacity, 1);
});

test('the cloth feel: soft chiffon swings wide and settles slowly; mikado holds its shape (v189 applyFabric)', () => {
  const chiffon = gownClothFeel(GOWN_FABRIC_PROPS.chiffon, 2), mikado = gownClothFeel(GOWN_FABRIC_PROPS.mikado, 2);
  assert.ok(chiffon.gain > mikado.gain && chiffon.kc < mikado.kc && mikado.hold > chiffon.hold);
  assert.ok(Math.abs(gownClothFeel(GOWN_FABRIC_PROPS.satin, 2).hold - 0.9375) < 1e-9, 'v189 satin hold');
  assert.ok(Math.abs(gownClothFeel(GOWN_FABRIC_PROPS.satin, 2).foldK - 1.156) < 1e-9, 'v189 satin folds');
  assert.equal(gownFabricNote(GOWN_FABRIC_PROPS.tulle, false), 'Tulle: about 30 gsm, light: drapes softly and swings freely, two-way stretch. Sheer and unlined: shown see-through.');
});
