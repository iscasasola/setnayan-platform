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
import { GOWN_FEEL, gownSeeAlpha, type GownFeelCard, type GownShineType } from './feel';

/** r roughness · sh sheen · sr sheen softness · cc clearcoat · sp specular · mt metal · ir iridescence · env room light. */
export type GownShine = { r: number; sh: number; sr: number; cc?: number; sp: number; mt?: number; ir?: number; env: number; edge?: number };

/**
 * How each kind of cloth takes the light (v207 `SHINE_TYPE`); the card's gloss sets how strong. No clearcoat on cloth:
 * it read as moulded plastic. Sequins glint in the shader instead of a metal finish.
 */
export const GOWN_SHINE_TYPE: Record<GownShineType, (g: number) => GownShine> = {
  satin: (g) => ({ r: 0.5 - 0.2 * g, sh: 0.45, sr: 0.32, sp: 0.55 + 0.45 * g, env: 0.85 + 0.15 * g }),
  mikado: (g) => ({ r: 0.56, sh: 0.4, sr: 0.5, sp: 0.55 + 0.3 * g, env: 0.85 }),
  taffeta: (g) => ({ r: 0.46, sh: 0.6, sr: 0.36, sp: 0.5 + 0.35 * g, env: 0.85 }),
  matte: (g) => ({ r: 0.9, sh: 0.3 + 0.6 * g, sr: 0.75, sp: 0.3, env: 0.75 }),
  sheer: (g) => ({ r: 0.8, sh: 0.3 + 0.5 * g, sr: 0.65, sp: 0.35, env: 0.75 }),
  crisp: (g) => ({ r: 0.46, sh: 0.5 + 0.2 * g, sr: 0.38, sp: 0.55 + 0.3 * g, env: 0.85 }),
  sequin: () => ({ r: 0.55, sh: 0.25, sr: 0.4, sp: 0.5, env: 0.8 }),
  velvet: () => ({ r: 0.95, sh: 1, sr: 0.9, sp: 0.08, env: 0.7, edge: 1 }),
};

/** Each stock fabric's light, from its feel card (v207 `SHINE`). */
export const GOWN_SHINE = Object.fromEntries(Object.entries(GOWN_FEEL).map(([k, c]) => [k, GOWN_SHINE_TYPE[c.shine](c.gloss)])) as Record<GownStockFabric, GownShine>;

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

/**
 * A sheer fabric (v207 `seeAlpha`): clear enough face-on to see what is under it; a lining and more petticoat layers
 * make it denser. Its edges and a pooled train read denser still in the shader (`gownFeelShader`).
 */
export function applyGownSheer(m: THREE.MeshPhysicalMaterial, c: Pick<GownFeelCard, 'see'>, lined: boolean, layers: number): void {
  const sheer = c.see > 0.3;
  m.transparent = sheer;
  m.opacity = sheer ? gownSeeAlpha(c, lined, layers) : 1;
  m.depthWrite = true;
  m.needsUpdate = true;
}

/** How many petticoat layers sit under the skirt, as the see-through counts them (v207 `seeAlpha` `nL`). */
export const gownSeeLayers = (g: { petti: string; skirtLayers: number }) => (g.petti === 'none' ? 0 : Math.max(1, Math.round(g.skirtLayers || 1)));

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

/**
 * Sheer cloth with no lining and no print (v195 `sheerMat`: flutter sleeves in chiffon, an overlay): how much it hides
 * her. An overlay reads a little denser: it hangs free, folded, over the skirt.
 */
export const gownSheerOpacity = (f: GownFabricProps, overlay = false) => Math.min(0.8, Math.max(0.35, 1 - 0.9 * Math.max(0.35, f.sheer) + (overlay ? 0.12 : 0)));
