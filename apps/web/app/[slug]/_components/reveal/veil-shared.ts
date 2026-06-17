/**
 * Shared veil "cloth body" — the bits every organic reveal in the library has in
 * common: the gold Setnayan mark, the procedural tulle-net + filigree-lace-hem
 * texture, and the recolourable cloth material with its fresnel sheen.
 *
 * The motion differs per template (sheer multi-touch lift · crown-pinned fold ·
 * the curtain), but they all share THIS net body + lace hem + gold accent (per
 * the locked design: "the 3 organic reveals share net body + procedural lace
 * hem + fold-whitening + colour-only customization"). Keeping it here means a
 * single source for the look and zero three.js duplication across the veils.
 *
 * Pure helpers — no React, no top-level DOM. `buildVeilTextures` touches the
 * canvas, so it is only ever called from inside a client component's effect.
 */

import * as THREE from 'three';

export const GOLD = '#cb9e4b';

// Official Setnayan brand mark, drawn as a gold thread accent in the lace.
export const MARK_PATH =
  'M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z';

export function markUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5333.3335 5333.3335" width="140" height="140"><path d="${MARK_PATH}" fill="${GOLD}" fill-rule="nonzero" transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/**
 * Build the veil's coverage (alpha) + gold-thread (emissive) textures: a fine
 * tulle net, a scalloped filigree-lace hem of outline star-flowers + picots, and
 * the small gold Setnayan mark scattered through the field.
 */
export function buildVeilTextures(markImg: HTMLImageElement | null): {
  alpha: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
} {
  const S = 2048; // hi-res so the fine tulle thread stays crisp when it fills the screen
  const SC = S / 1024; // scale fixed-px motifs (marks · flowers) with the resolution
  const cv = (): HTMLCanvasElement => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return c;
  };
  const aC = cv();
  const a = aC.getContext('2d')!;
  const eC = cv();
  const e = eC.getContext('2d')!;
  a.fillStyle = '#2a2a2a';
  a.fillRect(0, 0, S, S);
  e.fillStyle = '#000';
  e.fillRect(0, 0, S, S);

  const td = (cx: number, cy: number, L: number, W: number, ang: number) => {
    const p: Array<[number, number]> = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * 6.2832;
      const r = (1 - Math.cos(t)) / 2;
      const x = W * Math.sin(t) * Math.pow(r, 0.8);
      const y = -L * r;
      p.push([cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)]);
    }
    return p;
  };
  const star = (ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, col: string, lw: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    for (let k = 0; k < 8; k++) {
      const p = td(cx, cy, R, R * 0.42, (k / 8) * 6.2832);
      ctx.beginPath();
      ctx.moveTo(p[0]![0], p[0]![1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i]![0], p[i]![1]);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.fillStyle = col;
    for (let b = 0; b < 6; b++) {
      const aa = (b / 6) * 6.2832;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(aa) * R * 0.2, cy + Math.sin(aa) * R * 0.2, lw * 0.9, 0, 6.2832);
      ctx.fill();
    }
  };

  // fine tulle net — a dense, faint mesh so it reads as smooth sheer tulle with no
  // visible gaps even when the veil fills the screen (ref: fine bridal tulle).
  a.strokeStyle = 'rgba(255,255,255,0.12)';
  a.lineWidth = 1;
  for (let d = -S; d < S * 2; d += 3) {
    a.beginPath();
    a.moveTo(d, 0);
    a.lineTo(d + S, S);
    a.stroke();
    a.beginPath();
    a.moveTo(d, S);
    a.lineTo(d + S, 0);
    a.stroke();
  }

  const laceTop = Math.floor(S * 0.8);
  for (let i = 0; i < 24; i++) {
    star(a, ((i * 137) % S), 40 + ((i * 211) % (laceTop - 110)), (8 + (i % 5)) * SC, 'rgba(255,255,255,0.78)', SC);
  }

  // gold Setnayan mark accents
  if (markImg) {
    const mwG = cv();
    mwG.width = mwG.height = 120;
    const gc = mwG.getContext('2d')!;
    gc.drawImage(markImg, 0, 0, 120, 120);
    const mwW = cv();
    mwW.width = mwW.height = 120;
    const wc = mwW.getContext('2d')!;
    wc.drawImage(markImg, 0, 0, 120, 120);
    wc.globalCompositeOperation = 'source-in';
    wc.fillStyle = '#fff';
    wc.fillRect(0, 0, 120, 120);
    for (let k = 0; k < 11; k++) {
      const mx = 70 + ((k * 173) % (S - 140));
      const my = 110 + ((k * 251) % (laceTop - 200));
      const ms = 42 * SC;
      e.drawImage(mwG, mx - ms / 2, my - ms / 2, ms, ms);
      a.globalAlpha = 0.5;
      a.drawImage(mwW, mx - ms / 2, my - ms / 2, ms, ms);
      a.globalAlpha = 1;
    }
  }

  // scalloped filigree-lace hem
  const units = 12;
  const period = S / units;
  const rscal = period * 0.46;
  const baseE = S - 3;
  const topE = baseE - rscal;
  const topTrim = topE - rscal * 1.4;
  a.save();
  a.beginPath();
  a.rect(0, topTrim, S, topE - topTrim);
  for (let u = 0; u < units; u++) {
    const cxs = period * (u + 0.5);
    a.moveTo(cxs + rscal, topE);
    a.arc(cxs, topE, rscal, 0, Math.PI, false);
  }
  a.clip();
  a.strokeStyle = 'rgba(255,255,255,0.5)';
  a.lineWidth = 1;
  for (let d = -S; d < S * 2; d += 8) {
    a.beginPath();
    a.moveTo(d, topTrim);
    a.lineTo(d + S, S);
    a.stroke();
    a.beginPath();
    a.moveTo(d, S);
    a.lineTo(d + S, topTrim);
    a.stroke();
  }
  a.restore();
  for (let u = 0; u < units; u++) star(a, period * (u + 0.5), topE - 3, period * 0.3, 'rgba(255,255,255,0.92)', 1.3);
  a.strokeStyle = 'rgba(255,255,255,0.9)';
  a.lineWidth = 2;
  for (let u = 0; u < units; u++) {
    a.beginPath();
    a.arc(period * (u + 0.5), topE, rscal, 0, Math.PI, false);
    a.stroke();
  }
  // clip alpha to the scallop silhouette below topE
  const mk = cv();
  const mc = mk.getContext('2d')!;
  mc.fillStyle = '#fff';
  mc.fillRect(0, 0, S, topE);
  for (let u = 0; u < units; u++) {
    mc.beginPath();
    mc.arc(period * (u + 0.5), topE, rscal, 0, Math.PI, false);
    mc.fill();
  }
  a.globalCompositeOperation = 'destination-in';
  a.drawImage(mk, 0, 0);
  a.globalCompositeOperation = 'source-over';
  // picots
  for (let u = 0; u < units; u++) {
    const cx = period * (u + 0.5);
    for (let deg = 14; deg < 170; deg += 20) {
      const ar = (deg * Math.PI) / 180;
      a.fillStyle = 'rgba(255,255,255,0.95)';
      a.beginPath();
      a.arc(cx + Math.cos(ar) * (rscal + 4), topE + Math.sin(ar) * (rscal + 4), 2, 0, 6.2832);
      a.fill();
    }
  }

  const alpha = new THREE.CanvasTexture(aC);
  const emissive = new THREE.CanvasTexture(eC);
  alpha.anisotropy = 8;
  // sRGB on the emissive so the gold reads true
  // (CanvasTexture defaults are fine for the alpha map).
  return { alpha, emissive };
}

/**
 * The recolourable veil cloth material: sheer, double-sided tulle that whitens +
 * grows more opaque where it folds away from the camera (fresnel sheen). `color`
 * is the Mood-Board tulle colour; the gold Setnayan mark stays gold via the
 * emissive map. Callers set `mat.color` per-frame to track live colour changes
 * and assign `alphaMap` / `emissiveMap` from `buildVeilTextures`.
 */
export function makeVeilMaterial(color: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color || '#f3ece1'),
    roughness: 0.84,
    metalness: 0,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
    emissive: new THREE.Color(GOLD),
    emissiveIntensity: 0.85,
  });
  // Fresnel sheen — whiter + more opaque where the fabric folds away.
  mat.onBeforeCompile = (sh: { vertexShader: string; fragmentShader: string }) => {
    sh.vertexShader =
      'varying vec3 vWP;varying vec3 vNN;\n' +
      sh.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.0)).xyz;vNN=normalize(mat3(modelMatrix)*objectNormal);',
      );
    sh.fragmentShader =
      'varying vec3 vWP;varying vec3 vNN;\n' +
      sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nvec3 V=normalize(cameraPosition-vWP);float fr=pow(1.0-abs(dot(V,normalize(vNN))),1.8);gl_FragColor.rgb+=fr*0.7;gl_FragColor.a=clamp(gl_FragColor.a+fr*0.5,0.0,1.0);',
      );
  };
  return mat;
}
