/**
 * 👗 gown/parts/illusion — the sheer illusion bodice, the illusion back and the boning you can see (prototype v198
 * `illu`, `ILLU_GLSL`, `illuDressShader`, `illuMatNow`, `boneSet`, `illuLines`, `illuPaint`, `buildIllu`, `illuZoneAt`,
 * `illuMetres`, `illuSummary`).
 *
 * The sheer zone is a map round the body (u = direction, v = height): red where the bodice is sheer, green on the bound
 * edge of a sheer neckline. The gown's own cloth is cut away there (its lace stays, on the tulle) with a neat bound line
 * where the lined part ends; the tulle itself is a second mesh drawn on the gown's own geometry, shown only inside the
 * zone. The bones are one list (`gownBoneSet`) that feeds Inside, Boning, the quote's metres and the visible channels,
 * which are drawn in the shaders (no geometry): clear through tulle, faint on the gown fabric.
 *
 * The GLSL is v198's own, verbatim. The map is painted on any 2D context (the stage passes a canvas's).
 */
import type { GownConfig } from '../../gown-config';
import { RING_N, TAU } from '../body/constants';
import { clamp, type GownRig } from '../body/rig';
import type { GownDress } from '../dress/build';
import { gownIlluBackOn, gownIlluBaseY, gownIlluCupBot, neckTop, waistY, type GownNeckLandmarks } from '../dress/lines';
import type { GownEnvelope } from '../dress/table';

const N = RING_N, DTH = TAU / N;
/** The zone map's size (px): round the body × height. */
export const GOWN_ILLU_MAP = { w: 512, h: 256 } as const;
/** The tulle's own colours; 'match' is the gown's colour (v198 `ILLU_TULLE`). */
export const GOWN_ILLU_TULLE = { nude: 0xd9b79e, ivory: 0xf3ecdf } as const;
/** How the stage draws the tulle: its opacity (in the gown colour, or nude and ivory), its draw order, the bones' tint. */
export const GOWN_ILLU_DRAW = { opacityMatch: 0.4, opacity: 0.32, renderOrder: 3, polygonOffsetFactor: 1, polygonOffsetUnits: 2, boneTint: 0.25 } as const;

export type GownIlluDesignFull = Pick<GownConfig, 'illu' | 'illuBase' | 'illuCol' | 'illuBack' | 'boneShow' | 'boning' | 'back' | 'backT' | 'neck' | 'neckT' | 'waist'>;

/** The bones (v198 `boneSet`): centre front, princess lines, side seams, back princess lines; more for a fuller body or a corset. */
export function gownBoneSet(B: GownRig, L: GownNeckLandmarks | null, boning: GownConfig['boning']): { n: number; angs: number[]; kind: GownConfig['boning'] } {
  if (boning === 'soft') return { n: 0, angs: [], kind: 'soft' };
  const fr = L ? clamp(L.front, 0.25, 0.75) : 0.45, wc = B.got?.waist || B.vals?.waist || 70, SD = Math.PI / 2, BP = Math.PI - 0.62, A = [0, fr, -fr, SD, -SD, BP, -BP];
  if (wc >= 80 || boning === 'corset') A.push((fr + SD) / 2, -(fr + SD) / 2); // between the princess line and the side seam, in front
  if (wc >= 95) A.push((SD + BP) / 2, -(SD + BP) / 2); // and at the back
  if (boning === 'corset') A.push(Math.PI - 0.14, -(Math.PI - 0.14)); // each side of the back closure
  return { n: A.length, angs: A, kind: boning };
}

/** The uniforms both shaders share (v198 `illu.u`). The stage hands the map's texture to `ilMap`. */
export function gownIlluUniforms<T = unknown>() {
  return {
    ilMap: { value: null as T | null }, ilOn: { value: 0 }, ilY: { value: { x: 0, y: 1, set(a: number, b: number) { this.x = a; this.y = b; return this; } } }, ilDv: { value: 0.006 }, ilCmU: { value: 100 },
    ilBoneOn: { value: 0 }, ilBoneN: { value: 0 }, ilBoneA: { value: new Float32Array(16) }, ilBoneLo: { value: new Float32Array(16) }, ilBoneHi: { value: new Float32Array(16) },
    ilBoneW: { value: 0.45 }, ilBoneCol: { value: { r: 1, g: 1, b: 1 } as { r: number; g: number; b: number } }, ilEdgeCol: { value: { r: 1, g: 1, b: 1 } as { r: number; g: number; b: number } },
  };
}
export type GownIlluUniforms = ReturnType<typeof gownIlluUniforms>;

/** v198 `ILLU_GLSL`: the zone and the bone channels, read by both shaders. */
export const GOWN_ILLU_GLSL = "uniform sampler2D ilMap; uniform vec2 ilY; uniform float ilOn, ilDv, ilCmU, ilBoneOn, ilBoneN, ilBoneW; uniform float ilBoneA[16]; uniform float ilBoneLo[16]; uniform float ilBoneHi[16]; uniform vec3 ilBoneCol, ilEdgeCol;\nvec4 ilZone(vec3 r, float cz) { vec2 d = vec2(r.x, r.z - cz); return texture2D(ilMap, vec2(atan(d.x, d.y) / 6.2831853 + 0.5, (r.y - ilY.x) / (ilY.y - ilY.x))); }   // r: sheer zone \u00b7 g: bound top edge\nvec2 ilBone(vec3 r, float cz) { vec2 d = vec2(r.x, r.z - cz); float ph = atan(d.x, d.y), rr = length(d), m = 0.0, c = 0.0;   // x: the channel (soft sides), y: the bone in it\n  for (int i = 0; i < 16; i++) { if (float(i) >= ilBoneN) break; float da = abs(ph - ilBoneA[i]); da = min(da, 6.2831853 - da); float w = da * rr * ilCmU;   // cm across the channel\n    float al = smoothstep(ilBoneLo[i], ilBoneLo[i] + 0.006, r.y) * (1.0 - smoothstep(ilBoneHi[i] - 0.006, ilBoneHi[i], r.y));\n    m = max(m, al * (1.0 - smoothstep(ilBoneW * 0.7, ilBoneW, w))); c = max(c, al * (1.0 - smoothstep(ilBoneW * 0.25, ilBoneW * 0.45, w))); }\n  return vec2(m, c); }\n";
const DRESS_AT = 'if (cutOn > 0.5 && vCz > -50.0) {';
const DRESS_PATCH = "if (ilOn > 0.5 && vCz > -50.0) { vec4 iz = ilZone(vRest, vCz);\n    if (iz.r > 0.5) { vec4 il = (laceOn > 0.5 && vG.y >= 0.0 && vG.y <= 1.0) ? texture2D(laceMap, vG) : vec4(0.0); if (il.a < 0.42) discard; diffuseColor.rgb = laceCol * il.rgb; }   // the lace sits on the tulle\n    else if (max(ilZone(vRest + vec3(0.0, ilDv, 0.0), vCz).r, ilZone(vRest - vec3(0.0, ilDv, 0.0), vCz).r) > 0.5) diffuseColor.rgb *= 0.88; }   // the lined part's edge: a neat bound line\n  if (ilBoneOn > 0.5 && vCz > -50.0) { vec2 bo = ilBone(vRest, vCz); diffuseColor.rgb *= 1.0 - 0.07 * bo.x + 0.04 * bo.y; }   // through the gown fabric the bones show only faintly\n  ";
const TULLE_PATCH = "#include <map_fragment>\n  { if (vIlCz < -50.0) discard; vec4 iz = ilZone(vIlR, vIlCz); if (iz.r < 0.5) discard;\n    diffuseColor.rgb = mix(diffuseColor.rgb, ilEdgeCol, iz.g * 0.7); diffuseColor.a = mix(diffuseColor.a, 0.82, iz.g);   // the sheer neckline's bound edge\n    if (ilBoneOn > 0.5) { vec2 bo = ilBone(vIlR, vIlCz); diffuseColor.rgb = mix(diffuseColor.rgb, mix(ilBoneCol, ilBoneCol * 0.82, bo.y), bo.x); diffuseColor.a = mix(diffuseColor.a, 0.7 + 0.22 * bo.y, bo.x); } }   // a bone in its channel, clear through the tulle";
type Shader = { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string };

/**
 * The gown's own cloth: cut away in the sheer zone (its lace stays), a bound edge where the lined part ends, faint bone
 * channels (v198 `illuDressShader`). Chained after the surface shader (it patches the cut-out block's start).
 */
export function gownIlluDressShader(u: GownIlluUniforms) {
  return (sh: Shader) => {
    Object.assign(sh.uniforms, u);
    if (!sh.fragmentShader.includes(DRESS_AT)) return;
    sh.fragmentShader = GOWN_ILLU_GLSL + sh.fragmentShader.replace(DRESS_AT, DRESS_PATCH + DRESS_AT);
  };
}
/** The sheer tulle, drawn on the gown's own mesh, only inside the zone (v198 `illuMatNow`). Chain the sheen patch after it. */
export function gownIlluTulleShader(u: GownIlluUniforms) {
  return (sh: Shader) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec3 rest;\nattribute float gcz;\nvarying vec3 vIlR;\nvarying float vIlCz;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vIlR = rest; vIlCz = gcz;');
    sh.fragmentShader = 'varying vec3 vIlR;\nvarying float vIlCz;\n' + GOWN_ILLU_GLSL + sh.fragmentShader.replace('#include <map_fragment>', TULLE_PATCH);
  };
}

/** Per map column: where the sheer starts above, and (a sheer corset) the span below the cups (v198 `illuLines`). */
export type GownIlluLines = { lo: Float32Array; cupLo: Float32Array; cupHi: Float32Array; top: Float32Array; bind: Uint8Array };
export function gownIlluLines(B: GownRig, T: GownEnvelope, L: GownNeckLandmarks, d: GownIlluDesignFull): GownIlluLines {
  const W = GOWN_ILLU_MAP.w, out: GownIlluLines = { lo: new Float32Array(W), cupLo: new Float32Array(W), cupHi: new Float32Array(W), top: new Float32Array(W), bind: new Uint8Array(W) };
  for (let x = 0; x < W; x++) {
    const ph = ((x + 0.5) / W - 0.5) * TAU, aph = Math.abs(ph), top = gownIlluTopAt(T, ph);
    let lo = 1e9;
    if (d.illu !== 'none') lo = gownIlluBaseY(d.illuBase, aph, L);
    if (gownIlluBackOn(d) && aph >= 1.6) lo = Math.min(lo, neckTop(d, aph, L)); // the open back line she picked
    out.lo[x] = lo; out.top[x] = top; out.bind[x] = lo < top - 0.006 ? 1 : 0;
    if (d.illu === 'corset') {
      const q = ((Math.round(ph / DTH) % N) + N) % N, yw = waistY(B, d.waist, q) + 0.004, base = Math.min(gownIlluBaseY(d.illuBase, aph, L), top);
      out.cupLo[x] = yw; out.cupHi[x] = Math.max(yw, gownIlluCupBot(d.illuBase, aph, L, base));
    }
  }
  return out;
}
/** The gown's top edge in one direction (v198 `illuTopAt`). */
export function gownIlluTopAt(T: GownEnvelope, ph: number): number {
  let q = ph / DTH;
  q = ((q % N) + N) % N;
  const k0 = (q | 0) % N, k1 = (k0 + 1) % N, w = q - (q | 0);
  return T.top[k0]! * (1 - w) + T.top[k1]! * w;
}

/** The 2D calls the zone map uses. */
export type GownIlluCanvas = Pick<CanvasRenderingContext2D, 'globalCompositeOperation' | 'globalAlpha' | 'fillStyle' | 'fillRect' | 'beginPath' | 'moveTo' | 'lineTo' | 'closePath' | 'fill'>;
/**
 * The zone map (v198 `illuPaint`): red = sheer, green = the sheer neckline's bound edge (0.5 cm). Filled as shapes, so
 * steep edges (a plunge) stay smooth.
 */
export function paintGownIllu(g: GownIlluCanvas, B: GownRig, lines: GownIlluLines, y0: number, y1: number): void {
  const W = GOWN_ILLU_MAP.w, H = GOWN_ILLU_MAP.h, row = (y: number) => clamp((1 - (y - y0) / (y1 - y0)) * H, -2, H + 2), bindW = (0.5 * 0.01) / B.P.S;
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
  // One run of columns: a closed shape from its lower line to its upper line.
  const band = (ok: (x: number) => boolean, lo: (x: number) => number, hi: (x: number) => number, col: string) => {
    g.fillStyle = col;
    let x = 0;
    while (x < W) {
      if (!ok(x)) { x++; continue; }
      const a = x;
      while (x < W && ok(x)) x++;
      const b = x;
      g.beginPath(); g.moveTo(a, row(hi(a)));
      for (let c = a; c < b; c++) g.lineTo(c + 0.5, row(lo(c)));
      g.lineTo(b, row(lo(b - 1))); g.lineTo(b, row(hi(b - 1)));
      for (let c = b - 1; c >= a; c--) g.lineTo(c + 0.5, row(hi(c)));
      g.closePath(); g.fill();
    }
  };
  const top = () => y1 + 1;
  band((x) => lines.lo[x]! < y1, (x) => lines.lo[x]!, top, '#f00');
  band((x) => lines.cupHi[x]! > lines.cupLo[x]!, (x) => lines.cupLo[x]!, (x) => lines.cupHi[x]!, '#f00');
  band((x) => !!lines.bind[x], (x) => lines.top[x]! - bindW, top, '#0f0');
  g.globalCompositeOperation = 'source-over';
}

/** The illusion as built for this design: is there a sheer zone, the map's lines and range, the bones shown. */
export type GownIllu = { zoneOn: boolean; lines: GownIlluLines | null; y0: number; y1: number; bones: ReturnType<typeof gownBoneSet> | null; bonesShown: boolean };
/**
 * After the gown is laid on her: the zone, its lines and range, and the bones (v198 `buildIllu`). Fills the uniforms
 * (`u`), and paints the map when `g` is given. The stage sets `ilBoneCol` and `ilEdgeCol` (colours).
 */
export function buildGownIllu(B: GownRig, T: GownEnvelope, D: GownDress, d: GownIlluDesignFull, u: GownIlluUniforms | null = null, g: GownIlluCanvas | null = null): GownIllu {
  const L = D.L, on = !!D.geo && T.on && !!L, zone = on && (d.illu !== 'none' || gownIlluBackOn(d)), bs = on ? gownBoneSet(B, L, d.boning) : null, bones = !!bs && d.boneShow === 'on' && bs.n > 0, cm = 0.01 / B.P.S;
  const out: GownIllu = { zoneOn: zone, lines: null, y0: 0, y1: 1, bones: bs, bonesShown: bones };
  if (u) { u.ilOn.value = zone ? 1 : 0; u.ilBoneOn.value = bones ? 1 : 0; u.ilCmU.value = B.P.S * 100; u.ilDv.value = 0.45 * cm; }
  if (bones && u && L) {
    // Channel half-width, cm (spiral steel sits in a wider casing).
    u.ilBoneN.value = Math.min(16, bs.n); u.ilBoneW.value = bs.kind === 'corset' ? 0.5 : 0.42;
    for (let i = 0; i < 16; i++) {
      const a = bs.angs[i];
      if (a === undefined) { u.ilBoneA.value[i] = 0; u.ilBoneLo.value[i] = u.ilBoneHi.value[i] = -1e3; continue; }
      const q = ((Math.round(a / DTH) % N) + N) % N;
      u.ilBoneA.value[i] = a; u.ilBoneLo.value[i] = waistY(B, d.waist, q) - 1.0 * cm; u.ilBoneHi.value[i] = Math.min(gownIlluTopAt(T, a) - 1.4 * cm, L.yA + 0.01);
    }
  }
  if (zone && L) {
    let y0 = 1e9, y1 = -1e9;
    for (let q = 0; q < N; q++) { y0 = Math.min(y0, waistY(B, d.waist, q)); y1 = Math.max(y1, T.top[q]!); }
    y0 -= 3 * cm; y1 += 2 * cm;
    out.lines = gownIlluLines(B, T, L, d); out.y0 = y0; out.y1 = y1;
    if (u) u.ilY.value.set(y0, y1);
    if (g) paintGownIllu(g, B, out.lines, y0, y1);
  }
  return out;
}
/** The same zone, asked from code (metres, tests) (v198 `illuZoneAt`). */
export function gownIlluZoneAt(I: GownIllu, ph: number, y: number): boolean {
  const Ls = I.lines;
  if (!I.zoneOn || !Ls) return false;
  let x = Math.floor((ph / TAU + 0.5) * GOWN_ILLU_MAP.w);
  x = ((x % GOWN_ILLU_MAP.w) + GOWN_ILLU_MAP.w) % GOWN_ILLU_MAP.w;
  return y >= Ls.lo[x]! || (Ls.cupHi[x]! > Ls.cupLo[x]! && y >= Ls.cupLo[x]! && y <= Ls.cupHi[x]!);
}
/** The sheer panels laid on 150 cm tulle: their area, +30 % for shaping, plus seam allowances (metres) (v198 `illuMetres`). */
export function gownIlluMetres(B: GownRig, D: GownDress, I: GownIllu): number {
  if (!I.zoneOn || !D.geo) return 0;
  const R = (D.geo.attributes.rest!.array as Float32Array), CZ = D.cz, S = B.P.S, rows = D.nb + 2;
  let A = 0;
  for (let i = 0; i < rows - 1; i++) for (let q = 0; q < N; q++) {
    const a = i * N + q, b = i * N + ((q + 1) % N), c = a + N, d2 = b + N, x = (R[a * 3]! + R[d2 * 3]!) / 2, y = (R[a * 3 + 1]! + R[d2 * 3 + 1]!) / 2, z = (R[a * 3 + 2]! + R[d2 * 3 + 2]!) / 2;
    if (!gownIlluZoneAt(I, Math.atan2(x, z - CZ[a]!), y)) continue;
    for (const [p, r, s] of [[a, c, b], [b, c, d2]] as const) {
      const ux = R[r * 3]! - R[p * 3]!, uy = R[r * 3 + 1]! - R[p * 3 + 1]!, uz = R[r * 3 + 2]! - R[p * 3 + 2]!, vx = R[s * 3]! - R[p * 3]!, vy = R[s * 3 + 1]! - R[p * 3 + 1]!, vz = R[s * 3 + 2]! - R[p * 3 + 2]!;
      A += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
  }
  return Math.max(0.3, Math.ceil((((A * S * S) / 1.4) * 1.3 + 0.15) * 10) / 10);
}

/** The design in words, for the designer (v198 `illuSummary`). */
export function gownIlluSummary(B: GownRig, L: GownNeckLandmarks | null, d: GownIlluDesignFull): string[] {
  const out: string[] = [], col = { nude: 'nude', ivory: 'ivory', match: 'gown-colour' }[d.illuCol], cups = { sweetheart: 'sweetheart', straight: 'straight-across', plunge: 'plunge' }[d.illuBase];
  const nk = ({ sweetheart: 'sweetheart', v: 'V', off: 'off-shoulder', high: 'high', bateau: 'bateau' } as Record<string, string>)[d.neck];
  if (d.illu === 'neck') out.push(`Illusion neckline: lined ${cups} cups in the gown fabric, sheer ${col} tulle above them up to the ${nk} neckline`);
  if (d.illu === 'corset') out.push(`Sheer corset bodice: lined ${cups} cups, the rest of the bodice in sheer ${col} tulle down to the waistline`);
  if (gownIlluBackOn(d)) out.push(`Illusion back: sheer ${col} tulle from the open ${d.back === 'v' ? 'V' : 'scoop'} back up to the top edge`);
  if (d.boneShow === 'on' && d.boning !== 'soft') out.push(`Visible boning: ${gownBoneSet(B, L, d.boning).n} ${d.boning === 'corset' ? 'spiral steel (corset)' : 'flexible (complement)'} bones in channels that show through the bodice`);
  return out;
}
