/** 👗 gown/fabric/surface + weave — the cloth's surface patch finds its hooks on three 0.184; the weave tiles draw. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GOWN_STOCK_FABRICS } from '../../gown-config';
import { gownClothShader } from './shine';
import { gownSurfaceReady, gownSurfaceShader, gownSurfaceUniforms } from './surface';
import { GOWN_WEAVE_CM, drawGownWeave, gownWeaveGain, gownWeaveScale, type GownCanvas2D } from './weave';

test('the surface patch finds its hooks in this three.js and chains with the sheen patch, as v195 does', () => {
  assert.equal(gownSurfaceReady(), true, 'three moved begin_vertex or map_fragment: the surface patch must be updated');
  const u = gownSurfaceUniforms(), sh = { uniforms: {} as Record<string, unknown>, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  gownSurfaceShader(u)(sh);
  gownClothShader({ value: 0 })(sh);
  assert.match(sh.vertexShader, /attribute vec2 gmap;/);
  assert.match(sh.vertexShader, /vRest = rest; vRestN = normal; vG = gmap; vCz = gcz;/);
  assert.match(sh.fragmentShader, /float techH\(float kind/);
  for (const k of ['fabOn', 'weaveOn', 'laceOn', 'cutOn', 'techOn']) {
    assert.ok(sh.uniforms[k], k);
    assert.equal((u as Record<string, { value: unknown }>)[k]!.value, 0, `${k} starts off: a gown with no surface draws as before`);
  }
  assert.match(sh.fragmentShader, /float sheenEnergyComp = 1\.0;/, 'the sheen patch still applies after the surface patch');
  // Every uniform the surface GLSL declares has a value (the sheen patch's own sheerBack aside).
  const head = sh.fragmentShader.slice(0, sh.fragmentShader.indexOf("float tri1"));
  const declared = [...head.matchAll(/^uniform (?:float|vec2|vec3|sampler2D) ([^;]+);/gm)].flatMap((m) => m[1]!.split(',').map((x) => x.trim()));
  const ours = declared.filter((n) => n !== 'sheerBack');
  assert.ok(ours.length >= 30, `the surface declares its uniforms (${ours.length})`);
  for (const n of ours) assert.ok(n in u, `uniform ${n} has a value`);
});

test('the weave: every stock fabric has its tile and its real size; the gain keeps the colour', () => {
  const calls: string[] = [];
  const g = new Proxy({} as GownCanvas2D, { get: (_t, p) => (typeof p === 'string' && /^(fillStyle|strokeStyle|lineWidth)$/.test(p) ? '' : (...a: unknown[]) => { calls.push(String(p)); void a; }), set: () => true });
  for (const { id } of GOWN_STOCK_FABRICS) {
    calls.length = 0;
    drawGownWeave(g, id);
    assert.ok(calls.length > 1, `${id} draws threads`);
    assert.ok(GOWN_WEAVE_CM[id] > 0, `${id}: real size`);
  }
  assert.ok(Math.abs(gownWeaveScale('satin', 0.9) - 60) < 1e-9, '1.5 cm tiles on a body at S 0.9');
  const half = new Uint8Array(8 * 4).map((_, i) => (i % 4 === 0 ? (i < 16 ? 255 : 127) : 0));
  assert.ok(Math.abs(gownWeaveGain(half) - 255 * 8 / (255 * 4 + 127 * 4)) < 1e-9);
  assert.equal(gownWeaveGain(new Uint8Array(0)), 1);
});
