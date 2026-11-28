/**
 * 👗 gown/fabric/feel-shader — the fabric's feel drawn into the light (prototype v207 `feelU`, `feelSync`,
 * `feelShader`): folds drawn into the normal (no extra mesh), uneven, starting where the cloth gathers and deepening to
 * the hem; long and soft for satin, sharp and broken for taffeta and mikado, fine for chiffon, almost none for crepe.
 * Sheer cloth is clearer face-on and denser at its edges and where a train pools; strong colours lose some gloss;
 * satin carries a long highlight down each fold; sequins glint (no time term, so a resting stage stays still).
 * Pleats read as pressed edges. The stage owns the material; this module sets numbers and patches its shader.
 *
 * Ported on three 0.184: the specular colour the BRDF reads is `specularColorBlended`, so the gloss damping scales it too.
 */
import type { GownConfig } from '../../gown-config';
import { GOWN_SHINE_IX, type GownFeelCard } from './feel';

export const GOWN_FEEL_UNIFORMS = [
  'flOn', 'flN', 'flD', 'flSharp', 'flYS', 'flYH', 'flCm', 'flType', 'flSee', 'flEdge', 'flLined', 'flSeq', 'flSatK', 'linV', 'laceMatch', 'hemV', 'vCmK', 'flGl', 'plK', 'plN', 'plD', 'linTop', 'flYT',
] as const;
export type GownFeelUniforms = Record<(typeof GOWN_FEEL_UNIFORMS)[number], { value: number }>;

export function gownFeelUniforms(): GownFeelUniforms {
  const u = Object.fromEntries(GOWN_FEEL_UNIFORMS.map((k) => [k, { value: 0 }])) as GownFeelUniforms;
  u.flSatK.value = 0.5;
  return u;
}

/** What the sync reads from the build (all in model units, before the body's scale). */
export type GownFeelBuild = {
  /** The body's scale (model units × S × 100 = cm). */
  S: number;
  /** Where the skirt starts, where the hem sits, each direction's hem (null before a build). */
  yS: number | null; yHem: number | null; hemQ: Float32Array | null;
  /** The floor, the waist, the hem's radius. */
  floorY: number; yWaist: number; hemR: number;
  /** The fabric print's vertical range (the dress's gmap y). */
  y0: number; y1: number;
  /** The cloth material's opacity (for a sheer's edge). */
  opacity: number;
  /** The Inside view hides the see-through (the layers show instead). */
  inside: boolean;
};

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const PLEAT_K: Partial<Record<GownConfig['pleat'], number>> = { knife: 1, box: 2, accordion: 3 };

/** The card and the build into the shader's numbers (v207 `feelSync`; call on a change only). */
export function gownFeelSync(u: GownFeelUniforms, c: GownFeelCard, g: Pick<GownConfig, 'sil' | 'lining' | 'pleat' | 'pleatN' | 'pleatCm' | 'laceCol'>, b: GownFeelBuild): { sheer: boolean; lined: boolean } {
  u.flType.value = GOWN_SHINE_IX[c.shine] ?? 4;
  u.flGl.value = c.gloss;
  u.flCm.value = b.S * 100;
  const pleated = g.pleat !== 'none';
  const on = b.yS != null && b.yHem != null;
  u.flOn.value = on ? 1 : 0;
  if (on) {
    // A mermaid's folds start at its flare, not at the waist.
    const yFl = g.sil === 'mermaid' ? Math.max(b.yHem! + 0.12, b.yWaist - 0.55 * (b.yWaist - b.floorY)) : -1;
    u.flYS.value = yFl > 0 ? yFl + 0.04 : b.yS!;
    u.flYH.value = b.yHem!;
    const hemCm = TAU * Math.max(0.05, b.hemR || 0.3) * b.S * 100;
    u.flN.value = clamp(Math.round(hemCm / c.foldCm), 6, 120);
    u.flD.value = c.foldD * 0.01 * (pleated ? 0.3 : 1) * (g.sil === 'sheath' ? 0.6 : 1);
    u.flSharp.value = c.sharp;
  }
  // Pleats: a folded, pressed edge on each one (crisper in crisp cloth).
  u.plK.value = on && pleated ? (PLEAT_K[g.pleat] ?? 0) : 0;
  u.plN.value = g.pleatN || 24;
  u.plD.value = (g.pleatCm || 3) * 0.01 * (0.45 + 0.4 * c.sharp);
  u.flSeq.value = 1 / (0.0045 / b.S); // a sequin about 4.5 mm across
  const sheer = c.see > 0.3 && !b.inside, lined = sheer && g.lining !== 'none';
  u.flSee.value = sheer ? 1 : 0;
  u.flLined.value = lined ? 1 : 0;
  u.flEdge.value = sheer ? Math.min(3.5, 0.97 / Math.max(0.2, b.opacity)) : 1;
  if (b.y1 > b.y0 && b.yHem != null) {
    u.hemV.value = (b.yHem - b.y0) / (b.y1 - b.y0);
    u.vCmK.value = (b.y1 - b.y0) * b.S * 100;
    u.linTop.value = b.yS != null ? (b.yS + 0.035 - b.y0) / (b.y1 - b.y0) : 2;
    u.flYT.value = b.yS ?? 0;
  }
  if (b.hemQ && b.y1 > b.y0) {
    let mn = 1e9;
    for (const h of b.hemQ) mn = Math.min(mn, h);
    u.linV.value = (mn + 0.006 - b.y0) / (b.y1 - b.y0);
  }
  u.laceMatch.value = g.laceCol === 'match' ? 1 : 0;
  return { sheer, lined };
}

const HEAD =
  'uniform float flOn, flN, flD, flSharp, flYS, flYH, flCm, flType, flSee, flEdge, flLined, flSeq, flSatK, laceMatch, hemV, vCmK, flGl, plK, plN, plD, flYT;\n' +
  'float flH2(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }\n' +
  'float flNz(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f); return mix(mix(flH2(i), flH2(i + vec2(1.0, 0.0)), f.x), mix(flH2(i + vec2(0.0, 1.0)), flH2(i + vec2(1.0, 1.0)), f.x), f.y); }\n' +
  'float flF(float ph, float y) { float K = max(3.0, flN), d = 0.8 * sin(y * 0.021 + 2.0 * ph) + 0.5 * sin(y * 0.047 + 3.0 * ph + 1.3);\n' +
  '  d += flSharp * 2.4 * (flNz(vec2(cos(ph), sin(ph)) * 4.0 + vec2(y * 0.08, 0.0)) - 0.5);\n' + // crisp cloth kinks and jumps along its length (broken folds)
  '  float a = cos(floor(K) * ph + d), b = cos(floor(K * 1.53) * ph + 1.7 * d + 2.1), c = cos(floor(K * 0.57) * ph - 0.6 * d + 4.0);\n' +
  '  float s = (0.55 * a + 0.3 * b + 0.25 * c) * (0.72 + 0.28 * cos(2.0 * ph + 0.5 + y * 0.013)); return mix(s, 0.9 - 1.8 * abs(s), flSharp * 0.75); }\n' + // soft: a rounded wave; sharp: creases
  'vec3 flLace(vec3 c) { float l = dot(c, vec3(0.299, 0.587, 0.114)); return mix(c, vec3(1.0), 0.1 * (1.0 - smoothstep(0.05, 0.35, l))); }\n' +
  'float plH(float ph) { float f = fract(ph / 6.2831853 * plN); return plK < 1.5 ? (f < 0.85 ? f / 0.85 : (1.0 - f) / 0.15) - 0.5 : plK < 2.5 ? (smoothstep(0.2, 0.235, f) - smoothstep(0.765, 0.8, f)) - 0.5 : abs(f - 0.5) * 2.0 - 0.5; }\n' +
  'float flG(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\n';

const NORMAL = `#include <normal_fragment_maps>
  if (flOn > 0.5 && vCz > -50.0) { vec2 dd = vec2(vRest.x, vRest.z - vCz); float ph = atan(dd.x, dd.y), yc = vRest.y * flCm, tF = clamp((flYS - vRest.y) / max(1e-4, flYS - flYH), 0.0, 1.0);
    vec2 P0 = vec2(ph, yc), dx = dFdx(P0), dy = dFdy(P0); dx.x -= 6.2831853 * floor(dx.x / 6.2831853 + 0.5); dy.x -= 6.2831853 * floor(dy.x / 6.2831853 + 0.5);
    float dTr = (hemV - vG.y) * vCmK, onTr = smoothstep(0.0, 25.0, dTr), alias = (abs(dx.x) + abs(dy.x)) * flN, keep = 1.0 - smoothstep(0.9, 2.2, alias), amp = flD * pow(tF, 0.8) * keep * (1.0 + 1.5 * onTr);
    float pa = plK > 0.5 ? plD * smoothstep(0.0, 0.12, tF) * (1.0 - onTr) * (1.0 - smoothstep(0.5, 1.4, (abs(dx.x) + abs(dy.x)) * plN)) : 0.0;
    if (amp > 1e-5 || pa > 1e-5) { float h0 = flF(P0.x, P0.y), hx = flF(P0.x + dx.x, P0.y + dx.y), hy = flF(P0.x + dy.x, P0.y + dy.y); vec2 dH = amp * vec2(hx - h0, hy - h0);
      if (pa > 1e-5) { float p0 = plH(P0.x); dH += pa * vec2(plH(P0.x + dx.x) - p0, plH(P0.x + dy.x) - p0); diffuseColor.rgb *= 1.0 - 0.09 * pa / max(1e-4, plD) * (0.5 - p0); }
      vec3 vSx = dFdx(-vViewPosition), vSy = dFdy(-vViewPosition), R1 = cross(vSy, normal), R2 = cross(normal, vSx); float fDet = dot(vSx, R1) * faceDirection;
      normal = normalize(abs(fDet) * normal - sign(fDet) * (dH.x * R1 + dH.y * R2));
      diffuseColor.rgb *= 1.0 - (0.1 + 0.12 * onTr) * pow(tF, 0.8) * keep * clamp(flD * 70.0, 0.0, 1.0) * (0.5 - 0.5 * h0); }
    diffuseColor.rgb *= 1.0 - 0.05 * onTr - 0.1 * exp(-abs(dTr) / 12.0) * step(0.0, flD); }`;

const LIGHT = `#include <lights_physical_fragment>
  { vec3 dc = diffuseColor.rgb; float mx = max(max(dc.r, dc.g), dc.b), mn = min(min(dc.r, dc.g), dc.b), sat = mx > 1e-3 ? (mx - mn) / mx : 0.0, gk = 1.0 - flSatK * sat * smoothstep(0.03, 0.3, mx);
    material.specularColor *= gk; material.specularColorBlended *= gk; material.specularF90 *= gk; material.roughness = mix(material.roughness, max(material.roughness, 0.62), sat * smoothstep(0.03, 0.3, mx)); }`;

const OPAQUE = `if (flType > 6.5 && flType < 7.5) { vec3 gp = vRest * flSeq, ci = floor(gp), fp = fract(gp) - 0.5;
    vec3 jit = vec3(flG(ci + 1.7), flG(ci + 4.3), flG(ci + 9.1)) * 2.0 - 1.0, fn = normalize(normal + jit * 0.7), V = normalize(vViewPosition); float fw = length(fwidth(gp)), far = 1.0 - 0.7 * smoothstep(0.7, 2.2, fw), dsk = 1.0 - smoothstep(0.3, 0.48, length(fp));
    float g = 0.0;
    #if NUM_DIR_LIGHTS > 0
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) { vec3 Hh = normalize(directionalLights[i].direction + V); g += pow(max(dot(fn, Hh), 0.0), 90.0) * length(directionalLights[i].color) * 0.6; }
    #endif
    g += 0.3 * pow(max(dot(fn, V), 0.0), 80.0); g *= step(0.3, flG(ci + 3.3)); outgoingLight += mix(vec3(1.0, 0.98, 0.95), diffuseColor.rgb, 0.35) * min(g, 2.5) * dsk * far * 0.9; outgoingLight *= 0.93 + 0.12 * flG(ci); }
  if ((flType > 0.5 && flType < 1.5) || (flType > 2.5 && flType < 3.5)) { vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), Ta = cross(upV, normal); float tl = length(Ta);
    if (tl > 0.2) { Ta /= tl; vec3 V = normalize(vViewPosition); float sp = 0.0;
      #if NUM_DIR_LIGHTS > 0
      for (int i = 0; i < NUM_DIR_LIGHTS; i++) { vec3 L = directionalLights[i].direction, Hh = normalize(L + V); float th = dot(Ta, Hh); sp += pow(max(0.0, 1.0 - th * th), 36.0) * smoothstep(0.0, 0.35, dot(normal, L)) * min(1.5, length(directionalLights[i].color)); }
      #endif
      vec3 dc = diffuseColor.rgb; float mx = max(max(dc.r, dc.g), dc.b), sat = mx > 1e-3 ? (mx - min(min(dc.r, dc.g), dc.b)) / mx : 0.0;
      outgoingLight += mix(vec3(1.0), dc, 0.4) * sp * flGl * (flType > 2.5 ? 0.1 : 0.2) * (1.0 - 0.6 * sat) * smoothstep(0.2, 0.5, tl); } }
  if (flSee > 0.5) { float nv = abs(dot(normalize(nonPerturbedNormal), normalize(vViewPosition))), a = min(1.0, diffuseColor.a * mix(flEdge, 1.0, pow(nv, 0.55)));
    if (flLined > 0.5) a = max(a, smoothstep(flYT - 0.03, flYT + 0.03, vRest.y));
    a = mix(a, max(a, 0.78), smoothstep(0.0, 20.0, (hemV - vG.y) * vCmK));
    if (laceOn > 0.5 && vG.y >= 0.0 && vG.y <= 1.0) a = max(a, 0.96 * texture2D(laceMap, vG).a);
    diffuseColor.a = a; }
  #include <opaque_fragment>`;

/** The hooks the patch needs exist in this three.js (a build check, held by a test). */
export function gownFeelShaderReady(fragment: string, chunks: Record<string, string>): boolean {
  return ['#include <normal_fragment_maps>', '#include <lights_physical_fragment>', '#include <opaque_fragment>'].every((h) => fragment.includes(h)) &&
    (chunks.normal_fragment_begin ?? '').includes('nonPerturbedNormal') && (chunks.lights_physical_fragment ?? '').includes('specularColorBlended');
}

/**
 * The patch (v207 `feelShader`), chained after the cloth's surface shader (it reads `vRest`, `vCz`, `vG` and the lace
 * uniforms the surface declares). A lace in the gown's own colour reads the cloth's colour, a touch lifted.
 */
export function gownFeelShader(u: GownFeelUniforms) {
  return (sh: { uniforms: Record<string, unknown>; fragmentShader: string }) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = HEAD + sh.fragmentShader.split('laceCol * ').join('flLace(laceMatch > 0.5 ? diffuse : laceCol) * ');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_maps>', NORMAL)
      .replace('#include <lights_physical_fragment>', LIGHT)
      .replace('#include <opaque_fragment>', OPAQUE);
  };
}

/** The lining under a sheer (v207 `feelX.linMat`): it stops at the hem, so a sheer train lies alone on the floor. */
export function gownLiningShader(u: Pick<GownFeelUniforms, 'linV' | 'vCmK' | 'linTop'>) {
  return (sh: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) => {
    sh.uniforms.linV = u.linV; sh.uniforms.vCmK = u.vCmK; sh.uniforms.linTop = u.linTop;
    sh.vertexShader = 'attribute vec2 gmap;\nvarying float vLinV;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLinV = gmap.y;');
    sh.fragmentShader = 'uniform float linV, vCmK, linTop;\nvarying float vLinV;\n' + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (vLinV < linV || vLinV > linTop) discard;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= smoothstep(0.0, 4.0, (vLinV - linV) * vCmK);\n  #include <opaque_fragment>');
  };
}
