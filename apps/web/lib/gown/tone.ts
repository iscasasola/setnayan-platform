/**
 * 👗 gown/tone — colour accuracy on the stage (prototype v186): colours pass through unchanged up to 90 % brightness;
 * only the brightest highlights ease into white, keeping their hue. Installed once by the stage, on three's
 * `CustomToneMapping` slot, which nothing else in the app uses (the other 3D rooms keep their own tone mapping).
 */
import * as THREE from 'three';

const STOCK = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
const GOWN = `vec3 CustomToneMapping( vec3 color ) { color *= toneMappingExposure; float peak = max( color.r, max( color.g, color.b ) ); if ( peak < 0.9 ) return color;
  float np = 1.0 - 0.01 / ( peak - 0.8 ); color *= np / peak; float g = 1.0 - 1.0 / ( 0.15 * ( peak - np ) + 1.0 ); return mix( color, vec3( np ), g ); }`;

/** Idempotent. Returns false when three's chunk has changed shape (the stage then keeps three's own pass-through). */
export function installGownToneMapping(): boolean {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (chunk.includes('float np = 1.0 - 0.01')) return true;
  if (!chunk.includes(STOCK)) return false;
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(STOCK, GOWN);
  return true;
}
