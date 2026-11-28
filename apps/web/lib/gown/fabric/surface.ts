/**
 * 👗 gown/fabric/surface — the cloth's surface in the shader (prototype v195 `dressMat.onBeforeCompile`, `TECH_FNS`): the
 * supplier's fabric photo printed at true size, the stock fabric's weave, lace on the gown's flat map, cut-outs (with
 * their edges and illusion mesh), and fabric techniques (pintucks, ruching, smocking, drapes, darts). The GLSL is the
 * prototype's own, extracted verbatim; this module only owns its uniforms and patches the material.
 *
 * Every piece is off until its uniform turns it on, so a gown with none of them draws exactly as before. Run it before
 * `gownClothShader` (the sheen patch), as v195 does.
 */
import * as THREE from 'three';
import { GOWN_MANNEQUIN } from '../scenes';

/** The vertex side: the rest shape, the flat map and the body's centre line ride along to the fragment. */
const VERTEX_HEAD = "attribute vec3 rest;\nattribute vec2 gmap;\nattribute float gcz;\nvarying vec3 vRest;\nvarying vec3 vRestN;\nvarying vec2 vG;\nvarying float vCz;\n";
const VERTEX_BEGIN = "#include <begin_vertex>\n  vRest = rest; vRestN = normal; vG = gmap; vCz = gcz;";
/** The fragment side's declarations. */
const FRAGMENT_HEAD = "uniform sampler2D fabMap;\nuniform vec2 fabScale;\nuniform float fabOn;\nuniform sampler2D weaveMap;\nuniform vec2 weaveScale;\nuniform float weaveOn, weaveAmt, weaveGain;\nuniform sampler2D laceMap;\nuniform float laceOn;\nuniform vec3 laceCol;\nuniform sampler2D cutMap;\nuniform float cutOn;\nuniform vec2 cutY;\nuniform vec2 cutBand;\nuniform float cutEdge;\nuniform float cutFill;\nuniform vec3 cutSkin;\nvarying vec3 vRest;\nvarying vec3 vRestN;\nvarying vec2 vG;\nvarying float vCz;\nfloat hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nuniform float techOn, tKind, tDir, tSp, tWhere, dKind, dSp, dWhere, dart, tCmU, tYS, tYW, tYA, tApex, tCowl;\n";
/** The techniques' height fields (v195 `TECH_FNS`). */
const TECH_FNS = `float tri1(float x) { return abs(fract(x) - 0.5) * 2.0; }
float th2(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float tnoise(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f); return mix(mix(th2(i), th2(i + vec2(1.0, 0.0)), f.x), mix(th2(i + vec2(0.0, 1.0)), th2(i + vec2(1.0, 1.0)), f.x), f.y); }
float techH(float kind, float dir, vec2 p, float s) {   // height of the fabric texture at p (cm): 1 = top of a fold, 0 = valley
  if (kind < 1.5) { float c = dir < 0.5 ? p.x : dir < 1.5 ? p.y : dir < 2.5 ? (p.x + p.y) * 0.7071 : abs(p.x) * 0.8 + p.y * 0.6;   // pintucks: a narrow sewn fold every s, flat cloth between
    float d = (fract(c / s + 0.5) - 0.5) * s; return exp(-d * d / 0.012); }
  if (kind < 2.5) { float c = dir > 1.5 ? p.x * 0.6 + p.y : dir > 0.5 ? p.y : p.x, a = dir > 1.5 ? p.x * 0.8 - p.y * 0.6 : dir > 0.5 ? p.x : p.y;   // ruching: soft gathered folds, uneven in width and depth, fading in and out
    c += s * 0.9 * (tnoise(vec2(a / (s * 2.6), c / (s * 3.2))) - 0.5); float f = pow(abs(sin(3.1416 * c / s)), 0.55);
    return f * (0.45 + 0.55 * tnoise(vec2(a / (s * 1.7) + 7.3, c / (s * 1.1) + 1.9))); }
  if (kind < 3.5) { vec2 q = p / s; float best = 9.0;   // smocking: soft pillows between stitched tacks (honeycomb), tiny gathers between them
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { float r = floor(q.y) + float(j); vec2 t = vec2(floor(q.x - 0.5 * mod(r, 2.0)) + float(i) + 0.5 * mod(r, 2.0), r); best = min(best, length((q - t) * vec2(1.0, 1.25))); }
    return smoothstep(0.0, 0.62, best) * (0.9 + 0.1 * sin(q.x * 25.13)); }
  if (kind < 4.5) return 0.5 + 0.5 * sin(6.2831 * (p.x * 0.8 - p.y) / s);   // Grecian: diagonal folds across the bodice
  if (kind < 5.5) return 0.5 + 0.5 * sin(6.2831 * length(vec2(p.x * 0.7, p.y - tCowl)) / s);   // cowl: arcs hanging below the neckline
  return 0.5 + 0.5 * sin(6.2831 * (p.x * 0.5 + p.y) / s);   // side swag
}
float tZone(float w, float ph, float y) {   // where a technique sits: 0 bodice, 1 waist band, 2 back panel, 3 skirt, 4 all over, 5 cowl, 6 swag
  if (w < 0.5) return y > tYS ? 1.0 : 0.0; if (w < 1.5) return abs(y - tYW) * tCmU < 5.0 ? 1.0 : 0.0; if (w < 2.5) return (abs(ph) > 2.35 && y > tYS) ? 1.0 : 0.0;
  if (w < 3.5) return y < tYS ? 1.0 : 0.0; if (w < 4.5) return 1.0; if (w < 5.5) return (1.0 - smoothstep(0.55, 0.95, abs(ph))) * smoothstep(tYA - 0.05, tYA, y);
  vec2 e = vec2((ph - 0.55) / 0.95, (y - (tYS - 0.2)) / 0.26); return 1.0 - smoothstep(0.55, 1.0, length(e)); }   // swag: a soft oval falling across the front of the skirt
`;
/** After the colour map: photo or weave, lace, cut-outs, techniques. */
const SURFACE = `#include <map_fragment>
  if (fabOn > 0.5) { vec3 p = vRest * vec3(fabScale.x, fabScale.y, fabScale.x); vec3 w = pow(abs(normalize(vRestN)), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
    vec3 c = texture2D(fabMap, vec2(p.z, p.y)).rgb * w.x + texture2D(fabMap, vec2(p.x, p.z)).rgb * w.y + texture2D(fabMap, vec2(p.x, p.y)).rgb * w.z;
    diffuseColor.rgb *= c; }
  else if (weaveOn > 0.5) { vec3 p = vRest * vec3(weaveScale.x, weaveScale.y, weaveScale.x); vec3 w = pow(abs(normalize(vRestN)), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);   // the weave, at thread scale
    float v = texture2D(weaveMap, vec2(p.z, p.y)).r * w.x + texture2D(weaveMap, vec2(p.x, p.z)).r * w.y + texture2D(weaveMap, vec2(p.x, p.y)).r * w.z;
    diffuseColor.rgb *= mix(1.0, v * weaveGain, weaveAmt); }
  if (laceOn > 0.5 && vG.y >= 0.0 && vG.y <= 1.0) { vec4 l = texture2D(laceMap, vG); diffuseColor.rgb = mix(diffuseColor.rgb, laceCol * l.rgb, l.a); }
  if (cutOn > 0.5 && vCz > -50.0) { vec2 d = vec2(vRest.x, vRest.z - vCz); vec2 cu = vec2(atan(d.x, d.y) / 6.2831853 + 0.5, (vRest.y - cutY.x) / (cutY.y - cutY.x));   // where on the cut map, worked out per pixel (no seam)
    vec4 m = texture2D(cutMap, cu); float e = 0.0;
    for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; e = max(e, texture2D(cutMap, cu + vec2(cos(a), sin(a)) * cutBand).r); }
    if (m.r > 0.5) {
      if (m.g > 0.5) { float th = fract(cu.y * 1400.0 + hh(floor(cu * vec2(900.0, 1.0))) * 0.6); if (th > 0.3 || hh(floor(cu * vec2(260.0, 1400.0))) > 0.75) discard; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.2); }   // slash: loose threads across the opening
      else if (cutFill > 0.5) { float net = max(step(0.86, fract(cu.x * 2600.0)), step(0.86, fract(cu.y * 2600.0))); diffuseColor.rgb = mix(cutSkin, diffuseColor.rgb, 0.16 + 0.3 * net); }   // illusion mesh: skin through fine net
      else discard;
    } else if (e > 0.5) {
      if (cutEdge > 0.5 && cutEdge < 1.5) diffuseColor.rgb *= 0.84;                                                     // bound: a piped edge
      else if (cutEdge > 1.5 && cutEdge < 2.5) { float f = hh(floor(cu * vec2(3200.0, 3200.0))); if (f > 0.55) discard; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.35); }   // frayed: loose threads
      else if (cutEdge > 2.5 && cutEdge < 3.5) { if (fract((cu.x + cu.y) * 900.0) > 0.7) discard; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.25); }   // scalloped lace edge
      else if (cutEdge > 3.5) { float b = length(fract(cu * vec2(1500.0, 1500.0)) - 0.5); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), b < 0.32 ? 0.75 : 0.0); }   // beaded edge
    } }
  if (techOn > 0.5 && vCz > -50.0) { vec2 dd = vec2(vRest.x, vRest.z - vCz); float ph = atan(dd.x, dd.y), rr = length(dd), y = vRest.y; vec2 p = vec2((tWhere > 1.5 && tWhere < 2.5 ? 3.14159 - abs(ph) : ph) * rr * tCmU, y * tCmU);   // fabric techniques: where on the cloth, in cm (a back panel measures from the centre back, so no seam shows)
    float zt = tZone(tWhere, ph, y), zd = tZone(dWhere, ph, y);
    if (tKind > 0.5 && zt > 0.0) { float e = tKind < 1.5 ? 0.03 : 0.1, h = techH(tKind, tDir, p, tSp), hx = techH(tKind, tDir, p + vec2(e, 0.0), tSp) - techH(tKind, tDir, p - vec2(e, 0.0), tSp), hy = techH(tKind, tDir, p + vec2(0.0, e), tSp) - techH(tKind, tDir, p - vec2(0.0, e), tSp);
      float H = tKind < 1.5 ? 0.06 : tKind < 2.5 ? 0.22 * tSp : 0.16 * tSp, ao = tKind < 1.5 ? 0.0 : tKind < 2.5 ? 0.16 : 0.2, fw = length(fwidth(p)), keep = tKind < 1.5 ? 1.0 - smoothstep(0.08, 0.3, fw) : 1.0 - smoothstep(tSp * 0.25, tSp * 0.6, fw);   // fold height (cm); fades out when too fine to see (no moiré)
      float lit = clamp((-hx * 0.55 + hy * 0.45) / (2.0 * e) * H, -0.35, 0.35);
      diffuseColor.rgb *= 1.0 + zt * keep * (lit - ao * (1.0 - h) + 0.05 * h); }
    if (dKind > 0.5 && zd > 0.0) { float e = 0.3, h = techH(dKind, 0.0, p, dSp), hx = techH(dKind, 0.0, p + vec2(e, 0.0), dSp) - techH(dKind, 0.0, p - vec2(e, 0.0), dSp), hy = techH(dKind, 0.0, p + vec2(0.0, e), dSp) - techH(dKind, 0.0, p - vec2(0.0, e), dSp);
      diffuseColor.rgb *= 1.0 + zd * ((-hx * 0.8 + hy * 0.6) / (2.0 * e) * dSp * 0.12 - 0.22 * (1.0 - h)); }
    if (dart > 0.5) { float ln = 1e3, ap = tApex, aph = abs(ph);   // darts and seams: distance (cm) to the sewn lines
      if (dart < 1.5) { vec2 a = vec2(1.5708, tYA - 0.02), b = vec2(ap * 0.8, tYA - 0.005); vec2 q = vec2(aph, y); vec2 ab = b - a; float k = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0); vec2 c = a + ab * k; ln = length(vec2((q.x - c.x) * rr, q.y - c.y)) * tCmU; }
      else if (dart < 2.5) { if (y < tYA - 0.05 && y > tYW - 0.1) { float w = 0.012 * (1.0 - abs(y - tYW) / 0.12); ln = (abs(abs(aph - ap) * rr) - max(0.0, w) * 0.5) * tCmU; ln = abs(ln); } }
      else if (dart < 3.5) { float f = aph < 1.5708 ? ap * (1.0 + 0.5 * max(0.0, tYA - y)) : 3.14159 - ap * (1.0 + 0.5 * max(0.0, tYA - y)); ln = abs(aph - f) * rr * tCmU; }
      else { if (y > tYS) { float k2 = aph / 0.7854; ln = abs(k2 - floor(k2 + 0.5)) * 0.7854 * rr * tCmU; } }
      if (ln < 0.11 && fract(y * tCmU / 0.45) > 0.35) diffuseColor.rgb *= 0.72; else if (ln < 0.35) diffuseColor.rgb *= 0.95; } }`;

const tex1 = (rgba: [number, number, number, number]) => { const t = new THREE.DataTexture(new Uint8Array(rgba), 1, 1); t.needsUpdate = true; return t; };

/** The uniforms one gown's surface reads (v195 `fab.u`, `weave.u`, `lace.u`, `cut.u`, `tech.u`). */
export function gownSurfaceUniforms() {
  const num = (v = 0) => ({ value: v });
  return {
    fabMap: { value: tex1([255, 255, 255, 255]) as THREE.Texture }, fabScale: { value: new THREE.Vector2(1, 1) }, fabOn: num(),
    weaveMap: { value: tex1([255, 255, 255, 255]) as THREE.Texture }, weaveScale: { value: new THREE.Vector2(1, 1) }, weaveOn: num(), weaveAmt: num(0.5), weaveGain: num(1),
    laceMap: { value: tex1([0, 0, 0, 0]) as THREE.Texture }, laceOn: num(), laceCol: { value: new THREE.Color(0xf3ecdc) },
    // v200 raised lace: on/off and how far a motif stands off the cloth (in the normal).
    laceRaise: num(), laceBump: num(0.0014),
    cutMap: { value: tex1([0, 0, 0, 0]) as THREE.Texture }, cutOn: num(), cutY: { value: new THREE.Vector2(0, 1) }, cutBand: { value: new THREE.Vector2(0.002, 0.002) }, cutEdge: num(), cutFill: num(), cutSkin: { value: new THREE.Color(GOWN_MANNEQUIN.color) },
    techOn: num(), tKind: num(), tDir: num(), tSp: num(), tWhere: num(), dKind: num(), dSp: num(), dWhere: num(), dart: num(), tCmU: num(), tYS: num(), tYW: num(), tYA: num(), tApex: num(), tCowl: num(),
  };
}
export type GownSurfaceUniforms = ReturnType<typeof gownSurfaceUniforms>;

/** The shader hooks the surface patch needs exist in this three.js (held by a test). */
export function gownSurfaceReady(): boolean {
  const p = THREE.ShaderLib.physical;
  return p.vertexShader.includes('#include <begin_vertex>') && p.fragmentShader.includes('#include <map_fragment>');
}

/** The surface patch: use inside the material's `onBeforeCompile`, before the sheen patch. */
export function gownSurfaceShader(u: GownSurfaceUniforms) {
  return (sh: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = VERTEX_HEAD + sh.vertexShader.replace('#include <begin_vertex>', VERTEX_BEGIN);
    sh.fragmentShader = FRAGMENT_HEAD + TECH_FNS + sh.fragmentShader.replace('#include <map_fragment>', SURFACE);
  };
}

/** The flat lace line the raised lace replaces (v200 `raisedLaceShader`'s `flat`): the surface patch writes it verbatim. */
const LACE_FLAT = 'if (laceOn > 0.5 && vG.y >= 0.0 && vG.y <= 1.0) { vec4 l = texture2D(laceMap, vG); diffuseColor.rgb = mix(diffuseColor.rgb, laceCol * l.rgb, l.a); }';
const LACE_RAISED = `if (laceOn > 0.5 && vG.y >= 0.0 && vG.y <= 1.0) { vec4 l = texture2D(laceMap, vG);
    if (laceRaise > 0.5) { vec2 tx = vec2(1.0 / 1024.0, 1.0 / 2048.0) * 1.8; float hL = texture2D(laceMap, vG - vec2(tx.x, 0.0)).a, hR = texture2D(laceMap, vG + vec2(tx.x, 0.0)).a, hD = texture2D(laceMap, vG - vec2(0.0, tx.y)).a, hU = texture2D(laceMap, vG + vec2(0.0, tx.y)).a;
      float lit = clamp((hU - hD) * 0.32 - abs(hR - hL) * 0.06, -0.16, 0.18), sh2 = texture2D(laceMap, vG + vec2(0.0, tx.y * 2.4)).a;   // lit along its upper edges; its own shadow falls just below it on the cloth
      diffuseColor.rgb *= 1.0 - 0.2 * max(0.0, sh2 - l.a); diffuseColor.rgb = mix(diffuseColor.rgb, laceCol * l.rgb * (1.0 + lit), l.a); }
    else diffuseColor.rgb = mix(diffuseColor.rgb, laceCol * l.rgb, l.a); }`;
const LACE_BUMP = `#include <normal_fragment_maps>
  if (laceOn > 0.5 && laceRaise > 0.5 && vG.y >= 0.0 && vG.y <= 1.0) { vec2 dSTdx = dFdx(vG), dSTdy = dFdy(vG); float Hll = texture2D(laceMap, vG).a; vec2 dHdxy = laceBump * vec2(texture2D(laceMap, vG + dSTdx).a - Hll, texture2D(laceMap, vG + dSTdy).a - Hll);
    vec3 vSx = dFdx(-vViewPosition), vSy = dFdy(-vViewPosition), R1 = cross(vSy, normal), R2 = cross(normal, vSx); float fDet = dot(vSx, R1) * faceDirection; vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2); normal = normalize(abs(fDet) * normal - vGrad); }`;
/**
 * Raised (3D) lace (v200 `raisedLaceShader`): the lace map read as a height map, a bump on the normal lit from above and
 * a soft shadow cast by each motif onto the cloth; no geometry. Chain it after the surface patch (it rewrites its lace
 * line); `laceRaise` turns it on.
 */
export function gownRaisedLaceShader(u: Pick<GownSurfaceUniforms, 'laceRaise' | 'laceBump'>) {
  return (sh: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) => {
    sh.uniforms.laceRaise = u.laceRaise;
    sh.uniforms.laceBump = u.laceBump;
    if (!sh.fragmentShader.includes(LACE_FLAT)) return;
    sh.fragmentShader = 'uniform float laceRaise, laceBump;\n' + sh.fragmentShader.replace(LACE_FLAT, LACE_RAISED).replace('#include <normal_fragment_maps>', LACE_BUMP);
  };
}
