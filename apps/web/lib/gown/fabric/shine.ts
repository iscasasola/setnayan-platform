/**
 * 👗 gown/fabric/shine — how each fabric takes the light (prototype v189 `SHINE`, `shine`, `tintSheen`, `envOf`,
 * `caShader`, the sheer opacity in `applyFabric`). Owner: shine and matte must read true. The stage owns the material;
 * this module only sets its numbers and patches its shader, so it stays testable without a browser.
 *
 * Ported on three 0.184: the sheen's energy term moved into `lights_physical_pars_fragment` and changed shape since
 * 0.160, so the patch finds every `sheenEnergyComp` there (`gownShaderReady` proves the hooks still exist).
 */
import * as THREE from 'three';
import type { GownStockFabric } from '../../gown-config';
import type { GownFabricProps } from './types';

/** r roughness · sh sheen · sr sheen softness · cc clearcoat · sp specular · mt metal · ir iridescence · env room light. */
export type GownShine = { r: number; sh: number; sr: number; cc?: number; sp: number; mt?: number; ir?: number; env: number; edge?: number };

export const GOWN_SHINE: Record<GownStockFabric, GownShine> = {
  satin: { r: 0.3, sh: 0.55, sr: 0.28, cc: 0.35, sp: 1, env: 1 },
  mikado: { r: 0.48, sh: 0.5, sr: 0.42, cc: 0.15, sp: 0.8, env: 0.85 },
  crepe: { r: 0.9, sh: 0.22, sr: 0.8, sp: 0.3, env: 0.75 },
  chiffon: { r: 0.74, sh: 0.4, sr: 0.6, sp: 0.45, env: 0.8 },
  georgette: { r: 0.88, sh: 0.25, sr: 0.8, sp: 0.3, env: 0.75 },
  tulle: { r: 0.85, sh: 0.3, sr: 0.7, sp: 0.3, env: 0.75 },
  organza: { r: 0.42, sh: 0.6, sr: 0.35, cc: 0.12, sp: 0.8, env: 0.9 },
  lace: { r: 0.8, sh: 0.35, sr: 0.6, sp: 0.4, env: 0.75 },
  sequin: { r: 0.28, sh: 0.3, sr: 0.3, sp: 1, mt: 0.35, ir: 0.4, env: 1.4 },
  pina: { r: 0.58, sh: 0.55, sr: 0.4, sp: 0.6, env: 0.85 },
  jusi: { r: 0.52, sh: 0.6, sr: 0.4, sp: 0.65, env: 0.85 },
  wool_suiting: { r: 0.92, sh: 0.2, sr: 0.85, sp: 0.2, env: 0.7 },
  linen: { r: 0.96, sh: 0.12, sr: 0.9, sp: 0.18, env: 0.7 },
  velvet: { r: 0.95, sh: 1, sr: 0.9, sp: 0.08, env: 0.7, edge: 1 },
  stretch_crepe_jersey: { r: 0.8, sh: 0.3, sr: 0.7, sp: 0.35, env: 0.75 },
};

/** Room-light strength, and how far the sheen colour moves from the cloth colour toward white. */
export const GOWN_SHINE_ROOM = { envK: 0.12, sheenW: 0.25 } as const;

/** The stock gown colours as [cloth, sheen] (v189 `COLOURS`): product data, like the swatches the bride picks. */
export const GOWN_CLOTH_COLOURS = {
  white: [0xfbfaf6, 0xffffff],
  ivory: [0xf3ecdf, 0xffffff],
  champagne: [0xdcc49c, 0xfff1d6],
  blush: [0xe9c3bd, 0xffe9e4],
  navy: [0x1f2a44, 0x8fa3d6],
} as const;

/** Set a material's light response for a fabric, in a scene with this reflection strength (v189 `shine` + `envOf`). */
export function applyGownShine(m: THREE.MeshPhysicalMaterial, kind: GownStockFabric, sceneEnv = 1): void {
  const t = GOWN_SHINE[kind];
  m.roughness = t.r;
  m.sheen = t.sh;
  m.sheenRoughness = t.sr;
  m.clearcoat = t.cc ?? 0;
  m.clearcoatRoughness = 0.25;
  m.specularIntensity = t.sp;
  m.metalness = t.mt ?? 0;
  m.iridescence = t.ir ?? 0;
  // A grain-stretched highlight streaked black along the side seam (the cloth has no tangents): satin's shine comes
  // from low roughness and clearcoat instead.
  m.anisotropy = 0;
  m.envMapIntensity = Math.max(1, t.env) * GOWN_SHINE_ROOM.envK * sceneEnv;
  tintGownSheen(m);
  m.needsUpdate = true;
}

/** The sheen carries the cloth's own colour, so shine never greys or shifts it. */
export function tintGownSheen(m: THREE.MeshPhysicalMaterial): void {
  m.sheenColor.copy(m.color).lerp(new THREE.Color(0xffffff), GOWN_SHINE_ROOM.sheenW);
}

/** A sheer fabric over a lining shows its own colour; unlined, she shows through (v189 `applyFabric`). */
export function applyGownSheer(m: THREE.MeshPhysicalMaterial, f: GownFabricProps, lined: boolean): void {
  const sheer = f.sheer > 0.3;
  m.transparent = sheer;
  m.opacity = sheer ? 1 - (lined ? 0.15 : 0.38) * f.sheer : 1;
  m.depthWrite = true;
  m.needsUpdate = true;
}

const SHEEN_ENERGY = /float sheenEnergyComp = [^;]*;/g;

/** The shader hooks the cloth patch needs exist in this three.js (a build check, held by a test). */
export function gownShaderReady(): boolean {
  const physical = THREE.ShaderLib.physical.fragmentShader;
  return (THREE.ShaderChunk.lights_physical_pars_fragment.match(SHEEN_ENERGY)?.length ?? 0) > 0 && physical.includes('#include <lights_fragment_begin>') && physical.includes('#include <lights_physical_pars_fragment>');
}

/**
 * The cloth's shader patch (v189 `caShader`): the sheen no longer darkens the cloth colour under it, and a sheer cloth
 * glows when the light is behind it (`sheerBack`, 0 = off). Use as `material.onBeforeCompile`.
 */
export function gownClothShader(sheerBack: { value: number }) {
  return (sh: { uniforms: Record<string, unknown>; fragmentShader: string }) => {
    sh.uniforms.sheerBack = sheerBack;
    const pars = THREE.ShaderChunk.lights_physical_pars_fragment.replace(SHEEN_ENERGY, 'float sheenEnergyComp = 1.0;');
    sh.fragmentShader =
      'uniform float sheerBack;\n' +
      sh.fragmentShader.replace('#include <lights_physical_pars_fragment>', pars).replace(
        '#include <lights_fragment_begin>',
        `#include <lights_fragment_begin>
  #if NUM_DIR_LIGHTS > 0
  if ( sheerBack > 0.0 ) { for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) reflectedLight.directDiffuse += sheerBack * directionalLights[ i ].color * saturate( dot( - geometryNormal, directionalLights[ i ].direction ) ) * BRDF_Lambert( material.diffuseColor ); }
  #endif`,
      );
  };
}

/** The cloth colour for a design: a stock swatch, or her custom colour (a hex string, already checked by the contract). */
export function gownClothColour(colour: string, colourHex: string | null): number {
  if (colour === 'custom' && colourHex) return parseInt(colourHex.slice(1), 16);
  const c = GOWN_CLOTH_COLOURS[colour as keyof typeof GOWN_CLOTH_COLOURS];
  return c ? c[0] : GOWN_CLOTH_COLOURS.white[0];
}
