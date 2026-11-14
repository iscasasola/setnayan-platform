/**
 * 🎬 THE STORY DRAWING — one 1080×1920 canvas scene used by BOTH the 10-second story video (`story-video-impl.tsx`)
 * and the seal's entrance (`seal-plaque.tsx`): owner 15 Nov, *"for the seal. it shows the video you created then the
 * medal goes to the placque"*. A faithful port of `storyRig` + `stripSlot` from the approved prototype
 * `badge-milestones_v35.html`: the award bursts in, rays turn, a shine sweeps, sparkles rise, then AWARDED TO, the
 * shop's name, the award lines and the gold SETNAYAN hallmark ("AN EXCLUSIVE SETNAYAN BADGE / SEAL") arrive one by
 * one, signed setnayan.com.
 *
 * Owner rulings kept: NO necklace ribbon (the prototype's `neck` path is not ported).
 *
 * v46/v47 (`badge-milestones_v47.html`, DECISION_LOG "NO. 1 — THE REVEAL"): `reveal` (No. 1 only) wraps the scene
 * in a stage whose red velvet curtains are simulated cloth (Verlet, rail rings pulled open 3.5–5.1 s) under a valance,
 * with aerodynamic black-and-gold confetti (v48: a burst + a steady rain, no gaps; the opening words on a dark pool,
 * outlined), and makes it 15 s; every other award keeps the 10-second scene unchanged.
 *
 * Drawn on the device; nothing is uploaded. Loaded ONLY by a dynamic import (it is never in a page's first bundle).
 */
import { SY_PATH } from '@/lib/photo-mark-geometry';

export const STORY_W = 1080;
export const STORY_H = 1920;
/** The story video's length, seconds. */
export const STORY_S = 10;
/** Where the seal's entrance hands over to the plaque, seconds. */
export const INTRO_END = 4.6;
/** The No. 1 reveal's length (curtains part, then the full scene), seconds — v46. */
export const REVEAL_S = 15;
/** The award's centre line on the canvas. */
export const STORY_MY = 780;

export type StoryInput = {
  /** The award's SVG markup (a badge or a seal). */
  svg: string;
  /** "BADGE" or "SEAL" — the hallmark's last word. */
  word: 'BADGE' | 'SEAL';
  /** The tier's light colour (hex, 6 digits). */
  tone: string;
  shopName: string;
  /** First line under the shop ("Gold · Completed bookings"). */
  line1: string;
  /** Second line ("Awarded on 12 Jan 2026"); optional. */
  line2?: string;
  /**
   * v46 — THE NO. 1 REVEAL (No. 1 only): a stage hung with red velvet curtains, the teaser line, the curtains part,
   * the seal bursts in behind them, black-and-gold confetti keeps falling, the valance stays. Makes the scene 15 s.
   */
  reveal?: boolean;
};

export type StoryRig = {
  canvas: HTMLCanvasElement;
  /** Paint the scene at `t` seconds. */
  frame: (t: number) => void;
  /** The award's drawn size on the canvas (px at 1080 wide). */
  dw: number;
  dh: number;
  /** Hide the award (the seal has flown off to its plaque). */
  hide: boolean;
  /** The scene's length, seconds: REVEAL_S (15) with `reveal`, else STORY_S (10). */
  dur: number;
};

/** The plaque's wood slots belong to the plaque only: drop the whole (nested) `<g class="sl-slot">`, balanced. */
export function stripSlot(sv: string): string {
  const a = sv.indexOf('<g class="sl-slot">');
  if (a < 0) return sv;
  const re = /<g[\s>]|<\/g>/g;
  re.lastIndex = a;
  let d = 0;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(sv))) {
    if (mm[0] === '</g>') {
      if (--d === 0) return sv.slice(0, a) + sv.slice(re.lastIndex);
    } else d++;
  }
  return sv;
}

/** Give an SVG string a namespace so it decodes as an image. */
export function asImageSvg(svg: string): string {
  return /xmlns=/.test(svg.slice(0, 300))
    ? svg
    : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ');
}

/** The award's size inside the 900×858 stage, from its viewBox. */
export function artBox(svg: string): { vb: number[]; dw: number; dh: number } {
  const raw = (svg.match(/viewBox="([^"]+)"/) || [null, '0 0 1 1'])[1] ?? '0 0 1 1';
  const vb = raw.split(/[ ,]+/).map(Number);
  const ar = (vb[2] || 1) / (vb[3] || 1);
  const dw = ar > 900 / 858 ? 900 : 858 * ar;
  return { vb, dw, dh: dw / ar };
}

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

export async function storyRig(o: StoryInput): Promise<StoryRig> {
  const W = STORY_W;
  const H = STORY_H;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d') as Ctx;
  const tc = o.tone;
  const MY = STORY_MY;
  const src = stripSlot(o.svg);
  const { dw, dh } = artBox(src);
  let svg = src
    .replace(/(<svg[^>]*?)\swidth="[\d.]+"/, '$1')
    .replace(/(<svg[^>]*?)\sheight="[\d.]+"/, '$1')
    .replace('<svg ', `<svg width="${Math.round(dw)}" height="${Math.round(dh)}" `);
  svg = asImageSvg(svg);
  const im = new Image();
  const imUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  im.src = imUrl;
  await im.decode().catch(() => {});
  URL.revokeObjectURL(imUrl);
  const mk = new Path2D(SY_PATH);
  const bc = document.createElement('canvas');
  bc.width = 900;
  bc.height = 858;
  const b = bc.getContext('2d') as Ctx;
  const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3));
  const back = (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const k = 1.9;
    return 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);
  };
  const SP = Array.from({ length: 46 }, (_, k) => ({ x: (k * 197) % W, y: (k * 389) % H, r: 2 + (k % 5), v: 30 + (k % 7) * 12, p: k * 0.7 }));
  const gd = x.createLinearGradient(0, 1600, 0, 1720);
  gd.addColorStop(0, '#FFF3B8');
  gd.addColorStop(0.45, '#E8B84A');
  gd.addColorStop(0.55, '#B8861E');
  gd.addColorStop(1, '#FFE08A');
  const fadeText = (txt: string, font: string, y: number, t0: number, t: number, fill: string, alpha = 1, ls = '0px') => {
    const a = ease((t - t0) / 0.6);
    if (a <= 0) return;
    x.save();
    x.globalAlpha = a * alpha;
    x.font = font;
    x.letterSpacing = ls;
    x.fillStyle = fill;
    x.textAlign = 'center';
    x.fillText(txt, W / 2, y + (1 - a) * 28);
    x.restore();
  };
  const REV = !!o.reveal;
  const rig: StoryRig = { canvas: c, frame, dw, dh, hide: false, dur: REV ? REVEAL_S : STORY_S };
  function base(t: number) {
    const bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#17120c');
    bg.addColorStop(0.55, '#0b0907');
    bg.addColorStop(1, '#000');
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);
    const pulse = 1 + 0.06 * Math.sin(t * 2.2);
    const gl = x.createRadialGradient(W / 2, MY, 40, W / 2, MY, 640 * pulse);
    gl.addColorStop(0, tc + 'cc');
    gl.addColorStop(0.45, tc + '33');
    gl.addColorStop(1, 'transparent');
    x.globalAlpha = ease(t / 1.2);
    x.fillStyle = gl;
    x.fillRect(0, 0, W, H);
    x.save();
    x.translate(W / 2, MY);
    x.rotate(t * 0.14);
    x.globalAlpha = 0.11 * ease((t - 0.4) / 1);
    x.fillStyle = tc;
    for (let k = 0; k < 24; k++) {
      x.rotate(Math.PI / 12);
      x.beginPath();
      x.moveTo(-20, 0);
      x.lineTo(20, 0);
      x.lineTo(0, -1000);
      x.fill();
    }
    x.restore();
    x.globalAlpha = 1;
    SP.forEach((p) => {
      const y = (((p.y - t * p.v) % H) + H) % H;
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + p.p);
      x.globalAlpha = tw * 0.7 * ease((t - 1) / 1);
      x.fillStyle = p.r > 4 ? '#FFE9A8' : '#fff';
      x.beginPath();
      x.arc(p.x, y, p.r, 0, 7);
      x.fill();
    });
    x.globalAlpha = 1;
    if (t > 0.85 && t < 2.4) {
      const q = (t - 0.85) / 1.55;
      x.strokeStyle = tc;
      x.lineWidth = 10 * (1 - q);
      x.globalAlpha = 1 - q;
      x.beginPath();
      x.arc(W / 2, MY, 200 + q * 620, 0, 7);
      x.stroke();
      x.globalAlpha = 1;
    }
    const sc = 0.15 + 0.85 * back(t / 1.05);
    const fy = t > 1.05 ? Math.sin((t - 1.05) * 1.5) * 12 : 0;
    const rot = t > 1.05 ? Math.sin((t - 1.05) * 1.1) * 0.025 : (1 - t / 1.05) * -0.5;
    b.clearRect(0, 0, 900, 858);
    b.globalCompositeOperation = 'source-over';
    b.drawImage(im, (900 - dw) / 2, (858 - dh) / 2, dw, dh);
    const sw = (((t - 1.6) % 3.2) + 3.2) % 3.2;
    if (t > 1.6 && sw < 1.1) {
      const sx = -300 + (sw / 1.1) * 1500;
      b.globalCompositeOperation = 'source-atop';
      const sg = b.createLinearGradient(sx - 140, 0, sx + 140, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,.55)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      b.fillStyle = sg;
      b.save();
      b.translate(450, 429);
      b.rotate(0.35);
      b.translate(-450, -429);
      b.fillRect(sx - 140, -300, 280, 1500);
      b.restore();
    }
    if (!rig.hide) {
      x.save();
      x.translate(W / 2, MY + fy);
      x.rotate(rot);
      x.scale(sc, sc);
      x.globalAlpha = ease(t / 0.35);
      x.drawImage(bc, -450, -429);
      x.restore();
    }
    x.globalAlpha = 1;
    if (t > 0.8 && t < 1.6) {
      const q = (t - 0.8) / 0.8;
      const fl = x.createRadialGradient(W / 2, MY, 0, W / 2, MY, 700);
      fl.addColorStop(0, 'rgba(255,255,255,' + 0.8 * (1 - q) + ')');
      fl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = fl;
      x.fillRect(0, 0, W, H);
    }
    fadeText('AWARDED TO', '800 34px system-ui,sans-serif', 1290, 1.6, t, '#fff', 0.75, '4px');
    x.save();
    x.shadowColor = tc;
    x.shadowBlur = 30;
    fadeText(o.shopName, '600 92px Georgia,serif', 1400, 2.0, t, '#fff');
    x.restore();
    fadeText(o.line1, '500 40px system-ui,sans-serif', 1475, 2.6, t, '#fff', 0.8);
    if (o.line2) fadeText(o.line2, '500 40px system-ui,sans-serif', 1530, 2.9, t, '#fff', 0.8);
    const ha = ease((t - 3.4) / 0.7);
    if (ha > 0) {
      x.save();
      x.globalAlpha = ha;
      x.font = '700 40px Georgia,serif';
      x.letterSpacing = '10px';
      const tw = x.measureText('SETNAYAN').width;
      const lx = W / 2 - (64 + 22 + tw) / 2;
      x.shadowColor = 'rgba(232,184,74,.55)';
      x.shadowBlur = 18;
      x.save();
      x.translate(lx, 1622);
      x.scale(0.016, -0.016);
      x.translate(0, -4000);
      x.fillStyle = gd;
      x.fill(mk);
      x.restore();
      x.textAlign = 'left';
      x.fillStyle = gd;
      x.fillText('SETNAYAN', lx + 86, 1668);
      x.shadowBlur = 0;
      x.textAlign = 'center';
      x.font = '600 22px system-ui,sans-serif';
      x.letterSpacing = '6px';
      x.fillStyle = '#E8C670';
      x.globalAlpha = ha * 0.85;
      const hm = 'AN EXCLUSIVE SETNAYAN ' + o.word;
      x.fillText(hm, W / 2, 1742);
      const hw = x.measureText(hm).width / 2;
      x.fillRect(W / 2 - hw - 110, 1734, 80, 1.5);
      x.fillRect(W / 2 + hw + 30, 1734, 80, 1.5);
      x.restore();
    }
    fadeText('setnayan.com', '500 24px system-ui,sans-serif', 1810, 3.9, t, '#fff', 0.5, '2px');
  }

  // ── THE NO. 1 REVEAL (v47 — owner 15 Nov: "a reveal effect for the no1 … 15 seconds"; "make it realistic …
  // following the flow, gravity, movement and all physics"; "make it flow properly just like our drop down ribbon").
  // Two velvet curtains are REAL CLOTH, simulated like the drop-down ribbon: a grid of points in 3D (Verlet), held by
  // distance springs, pulled down by gravity, slowed by air. The top row hangs from rings on a rail. To open, a cord
  // pulls the leading ring off-stage; it shoves the next rings along the rail (they bunch), the fabric between rings
  // folds forward and back like an accordion, and the folds travel down the cloth. The hem lags behind the top
  // (inertia), swings out, and settles. Light comes from the upper left; velvet glows where it turns away (sheen).
  // The cloth steps at a fixed 1/120 s, so the recorded video and the live entrance move the same.
  const OPEN0 = 3.5;
  const B0 = 4.4;
  const RAIL = 172;
  const FLOOR = 1905;
  const CC = 22;
  const CR = 24;
  const G = 2600;
  const AIR = 0.996;
  const SUB = 1 / 120;
  const F3 = 2600;
  type Curtain = { side: number; p: Float32Array; q: Float32Array; ring: number[]; rv: number[]; cons: Float32Array; L0x: number; L0y: number };
  let val: HTMLCanvasElement | null = null;
  let CL: Curtain[] = [];
  let simT = -1.2;
  function mkCurtain(side: number): Curtain {
    // side -1 = left curtain, +1 = right (mirrored)
    const fw = 820;
    const L0x = fw / (CC - 1);
    const L0y = (FLOOR - RAIL) / (CR - 1);
    const gap = L0x * 0.6;
    const p = new Float32Array(CC * CR * 3);
    const q = new Float32Array(CC * CR * 3);
    const ring: number[] = [];
    const rv: number[] = [];
    for (let c = 0; c < CC; c++) {
      ring.push(W / 2 + side * (8 + c * gap));
      rv.push(0);
    }
    for (let r = 0; r < CR; r++)
      for (let c = 0; c < CC; c++) {
        const k = (r * CC + c) * 3;
        p[k] = ring[c]!;
        p[k + 1] = RAIL + r * L0y;
        p[k + 2] = Math.sin((c * Math.PI) / 2) * Math.sqrt(Math.max(0, L0x * L0x - gap * gap));
        q[k] = p[k]!;
        q[k + 1] = p[k + 1]!;
        q[k + 2] = p[k + 2]!;
      }
    const cons: number[] = [];
    const diag = Math.hypot(L0x, L0y) * 0.985;
    for (let r = 0; r < CR; r++)
      for (let c = 0; c < CC; c++) {
        const a = r * CC + c;
        if (c < CC - 1) cons.push(a, a + 1, L0x);
        if (r < CR - 1) cons.push(a, a + CC, L0y);
        if (r < CR - 1 && c < CC - 1) cons.push(a, a + CC + 1, diag, a + 1, a + CC, diag);
        if (r < CR - 2) cons.push(a, a + 2 * CC, 2 * L0y);
      }
    return { side, p, q, ring, rv, cons: new Float32Array(cons), L0x, L0y };
  }
  function railStep(cu: Curtain, t: number, dt: number) {
    // the cord: the leading ring (the stage-centre edge, index 0) is pulled off-stage
    const s = cu.side;
    const u = Math.min(1, Math.max(0, (t - OPEN0) / 1.6));
    const pull = u < 1 ? u * u * (3 - 2 * u) : 1;
    const target = W / 2 + s * (8 + pull * (W / 2 - 8 - 80)); // where the hand on the cord is taking the leading ring
    const R = cu.ring;
    const V = cu.rv;
    const smin = 9;
    V[0] = V[0]! + ((target - R[0]!) * 90 - V[0]! * 16) * dt; // a firm pull through a little stretch in the cord
    for (let c = 0; c < CC; c++) {
      R[c] = R[c]! + V[c]! * dt; // rings run on the rail with friction
      V[c] = V[c]! * Math.pow(0.02, dt);
    }
    for (let c = 1; c < CC; c++) {
      // a ring is shoved along when the one behind reaches it
      const d = (R[c]! - R[c - 1]!) * s;
      if (d < smin) {
        R[c] = R[c]! + (smin - d) * s;
        V[c] = s * Math.max(V[c]! * s, V[c - 1]! * s * 0.8);
      }
      if (d > cu.L0x * 0.98) R[c] = R[c]! - (d - cu.L0x * 0.98) * s;
    }
  }
  function clothStep(cu: Curtain, t: number) {
    const { p, q } = cu;
    const n = CC * CR;
    const dt = SUB;
    const dt2 = dt * dt;
    const K = cu.cons;
    const m = K.length;
    railStep(cu, t, dt);
    for (let i = CC; i < n; i++) {
      const k = i * 3;
      const vx = (p[k]! - q[k]!) * AIR;
      const vy = (p[k + 1]! - q[k + 1]!) * AIR;
      const vz = (p[k + 2]! - q[k + 2]!) * AIR;
      q[k] = p[k]!;
      q[k + 1] = p[k + 1]!;
      q[k + 2] = p[k + 2]!;
      p[k] = p[k]! + vx;
      p[k + 1] = p[k + 1]! + vy + G * dt2;
      p[k + 2] = p[k + 2]! + vz;
      if (p[k + 1]! > FLOOR + 30) p[k + 1] = FLOOR + 30; // the hem brushes the stage floor
    }
    for (let c = 0; c < CC; c++) {
      const k = c * 3;
      const nb = c ? Math.abs(cu.ring[c]! - cu.ring[c - 1]!) : Math.abs(cu.ring[1]! - cu.ring[0]!);
      const dz = Math.sqrt(Math.max(0, cu.L0x * cu.L0x - nb * nb));
      q[k] = p[k]!;
      q[k + 1] = p[k + 1]!;
      q[k + 2] = p[k + 2]!;
      p[k] = cu.ring[c]!;
      p[k + 1] = RAIL;
      p[k + 2] = Math.sin((c * Math.PI) / 2) * dz;
    }
    for (let it = 0; it < 8; it++)
      for (let e = 0; e < m; e += 3) {
        const a = K[e]! * 3;
        const b = K[e + 1]! * 3;
        const L = K[e + 2]!;
        const dx = p[b]! - p[a]!;
        const dy = p[b + 1]! - p[a + 1]!;
        const dz = p[b + 2]! - p[a + 2]!;
        const d = Math.hypot(dx, dy, dz) || 1;
        const f2 = ((d - L) / d) * 0.5 * 2;
        const pa = a < CC * 3 ? 0 : 1;
        const pb = b < CC * 3 ? 0 : 1;
        const wa = pa && pb ? 0.5 : pa ? 1 : 0;
        const wb = pa && pb ? 0.5 : pb ? 1 : 0;
        if (wa) {
          p[a] = p[a]! + dx * f2 * wa;
          p[a + 1] = p[a + 1]! + dy * f2 * wa;
          p[a + 2] = p[a + 2]! + dz * f2 * wa;
        }
        if (wb) {
          p[b] = p[b]! - dx * f2 * wb;
          p[b + 1] = p[b + 1]! - dy * f2 * wb;
          p[b + 2] = p[b + 2]! - dz * f2 * wb;
        }
      }
  }
  const LT = (() => {
    const l = [-0.38, -0.5, 0.78];
    const n = Math.hypot(l[0]!, l[1]!, l[2]!);
    return l.map((v) => v / n) as [number, number, number];
  })();
  const prj = (p: Float32Array, k: number): [number, number, number] => {
    const sc = F3 / (F3 - p[k + 2]!);
    return [W / 2 + (p[k]! - W / 2) * sc, RAIL + (p[k + 1]! - RAIL) * sc, p[k + 2]!];
  };
  function drawCurtain(cu: Curtain, spot: number) {
    // smooth (Gouraud-style) velvet: a normal per POINT, averaged from the faces around it, lit, then each cell is
    // painted with a gradient across it, so the folds read as soft round velvet, not facets
    const p = cu.p;
    const n = CC * CR;
    const P: [number, number, number][] = [];
    const N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) P.push(prj(p, i * 3));
    for (let r = 0; r < CR - 1; r++)
      for (let c = 0; c < CC - 1; c++) {
        const i = (r * CC + c) * 3;
        const j = i + 3;
        const k = i + CC * 3;
        const e1x = p[j]! - p[i]!;
        const e1y = p[j + 1]! - p[i + 1]!;
        const e1z = p[j + 2]! - p[i + 2]!;
        const e2x = p[k]! - p[i]!;
        const e2y = p[k + 1]! - p[i + 1]!;
        const e2z = p[k + 2]! - p[i + 2]!;
        let nx = e1y * e2z - e1z * e2y;
        let ny = e1z * e2x - e1x * e2z;
        let nz = e1x * e2y - e1y * e2x;
        if (nz < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }
        for (const v of [i, j, k, k + 3]) {
          N[v] = N[v]! + nx;
          N[v + 1] = N[v + 1]! + ny;
          N[v + 2] = N[v + 2]! + nz;
        }
      }
    // each point's lit colour, kept as numbers (the prototype formats then re-parses the same values)
    const col: [number, number, number][] = new Array(n);
    for (let v = 0; v < n; v++) {
      const k = v * 3;
      const nn = Math.hypot(N[k]!, N[k + 1]!, N[k + 2]!) || 1;
      const nx = N[k]! / nn;
      const ny = N[k + 1]! / nn;
      const nz = Math.abs(N[k + 2]! / nn);
      const dif = Math.max(0, nx * LT[0] + ny * LT[1] + nz * LT[2]);
      const rim = Math.pow(1 - nz, 1.5);
      const sh = (0.08 + 1.25 * Math.pow(dif, 1.3)) * spot;
      col[v] = [Math.min(255, 150 * sh + 230 * rim * 0.45) | 0, Math.min(255, 8 * sh + 62 * rim * 0.45) | 0, Math.min(255, 30 * sh + 84 * rim * 0.45) | 0];
    }
    // velvet folds run top to bottom, so each fold is painted as ONE strip down the whole cloth (it follows every point
    // of the simulated edge), shaded across by its two edge colours, then darkened under the valance and at the floor
    const cs: string[] = [];
    for (let c = 0; c < CC; c++) {
      let r0 = 0;
      let g0 = 0;
      let b0 = 0;
      for (let r = 2; r < CR - 2; r++) {
        const m = col[r * CC + c]!;
        r0 += m[0];
        g0 += m[1];
        b0 += m[2];
      }
      const nr = CR - 4;
      cs.push(`rgb(${(r0 / nr) | 0},${(g0 / nr) | 0},${(b0 / nr) | 0})`);
    }
    const S: { c: number; z: number }[] = [];
    for (let c = 0; c < CC - 1; c++) {
      let z = 0;
      for (let r = 0; r < CR; r++) z += P[r * CC + c]![2] + P[r * CC + c + 1]![2];
      S.push({ c, z });
    }
    S.sort((u, v) => u.z - v.z);
    const top = P[0]![1];
    const bot = P[(CR - 1) * CC]![1];
    const vg = x.createLinearGradient(0, top, 0, bot + 40);
    vg.addColorStop(0, 'rgba(0,0,0,.6)');
    vg.addColorStop(0.12, 'rgba(0,0,0,0)');
    vg.addColorStop(0.8, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.45)');
    for (const f of S) {
      const c = f.c;
      const mid = CR >> 1;
      const A = P[mid * CC + c]!;
      const B = P[mid * CC + c + 1]!;
      x.beginPath();
      for (let r = 0; r < CR; r++) {
        const v = P[r * CC + c]!;
        if (r) x.lineTo(v[0], v[1]);
        else x.moveTo(v[0], v[1]);
      }
      for (let r = CR - 1; r >= 0; r--) {
        const v = P[r * CC + c + 1]!;
        x.lineTo(v[0], v[1]);
      }
      x.closePath();
      const g = x.createLinearGradient(A[0], A[1], B[0] === A[0] ? B[0] + 0.01 : B[0], B[1]);
      g.addColorStop(0, cs[c]!);
      g.addColorStop(1, cs[c + 1]!);
      x.fillStyle = g;
      x.fill();
      x.strokeStyle = g;
      x.lineWidth = 1;
      x.stroke();
      x.fillStyle = vg;
      x.fill();
    }
    // the gold edge braid on the stage-centre edge and the bullion fringe on the hem, riding the cloth
    x.lineCap = 'round';
    x.strokeStyle = '#d9a93f';
    x.lineWidth = 10;
    x.beginPath();
    for (let r = 0; r < CR; r++) {
      const v = P[r * CC]!;
      if (r) x.lineTo(v[0], v[1]);
      else x.moveTo(v[0], v[1]);
    }
    x.stroke();
    x.strokeStyle = '#fff1c0';
    x.lineWidth = 3;
    x.stroke();
    x.strokeStyle = '#c8952f';
    x.lineWidth = 12;
    x.beginPath();
    for (let c = 0; c < CC; c++) {
      const v = P[(CR - 1) * CC + c]!;
      if (c) x.lineTo(v[0], v[1]);
      else x.moveTo(v[0], v[1]);
    }
    x.stroke();
    for (let c = 0; c < CC - 1; c++) {
      const a = P[(CR - 1) * CC + c]!;
      const b = P[(CR - 1) * CC + c + 1]!;
      for (let k = 0; k < 4; k++) {
        const u = k / 4;
        const fx = a[0] + (b[0] - a[0]) * u;
        const fy = a[1] + (b[1] - a[1]) * u;
        const sw = (a[0] - b[0]) * 0.02;
        x.strokeStyle = k % 2 ? '#f3d27a' : '#a8781f';
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(fx, fy);
        x.lineTo(fx + sw * 6, fy + 34);
        x.stroke();
      }
    }
    x.lineCap = 'butt';
  }
  if (REV) {
    val = document.createElement('canvas');
    val.width = W;
    val.height = 240;
    const v = val.getContext('2d')!;
    const vv = v.createLinearGradient(0, 0, 0, 200);
    vv.addColorStop(0, '#3a0410');
    vv.addColorStop(0.6, '#8a0c24');
    vv.addColorStop(1, '#5a0618');
    v.fillStyle = vv;
    v.beginPath();
    v.moveTo(0, 0);
    v.lineTo(W, 0);
    v.lineTo(W, 150);
    for (let k = 8; k >= 0; k--) {
      const cx = (k * W) / 8;
      v.quadraticCurveTo(cx + W / 16, 230, cx, 150);
    }
    v.closePath();
    v.fill();
    v.strokeStyle = '#e9c56a';
    v.lineWidth = 7;
    v.beginPath();
    v.moveTo(0, 150);
    for (let k = 0; k < 8; k++) {
      const cx = (k * W) / 8;
      v.quadraticCurveTo(cx + W / 16, 226, cx + W / 8, 150);
    }
    v.stroke();
    const vt = v.createLinearGradient(0, 40, 0, 64);
    vt.addColorStop(0, '#7a5410');
    vt.addColorStop(0.5, '#fff1c0');
    vt.addColorStop(1, '#a8781f');
    v.fillStyle = vt;
    v.fillRect(0, 44, W, 16);
    for (let k = 0; k < 8; k++) {
      const cx = (k * W) / 8 + W / 16;
      v.fillStyle = '#f3d27a';
      v.beginPath();
      v.arc(cx, 206, 9, 0, 7);
      v.fill();
      v.fillStyle = '#c8952f';
      v.fillRect(cx - 3, 212, 6, 18);
    }
    CL = [mkCurtain(-1), mkCurtain(1)];
  }
  function simTo(t: number) {
    // fixed 1/120 s steps up to t; a jump back (or a skip forward) re-hangs and settles the cloth
    if (t < simT - 0.05) {
      CL = [mkCurtain(-1), mkCurtain(1)];
      simT = -1.2;
    }
    if (t - simT > 3) simT = t - 3;
    while (simT < t) {
      for (const cu of CL) clothStep(cu, simT);
      simT += SUB;
    }
  }
  // confetti physics: a light square of paper. Its drag depends on how flat it meets the air (area = |cos flip|), a
  // tilted piece glides sideways (lift ∝ sin 2·flip), the airflow keeps it tumbling, and the cannon's cloud stays
  // dense (little drag) for its first instant, then spreads and slows.
  type Bit = { rain?: boolean; x: number; y: number; vx: number; vy: number; age: number; f: number; w: number; spin: number; r: number; vr: number; sw: number; sh: number; gold: boolean; d: number };
  function cfStep(c: Bit, dt: number, g: number, k: number, lift: number) {
    const age = (c.age += dt);
    const A = 0.12 + 0.88 * Math.abs(Math.cos(c.f));
    const ke = k * Math.min(1, Math.pow(age / 0.32, 2));
    const sp = Math.hypot(c.vx, c.vy);
    c.vx += (-ke * A * sp * c.vx + lift * Math.sin(2 * c.f) * Math.abs(c.vy) * 0.35) * dt;
    c.vy += (g - ke * A * sp * c.vy) * dt;
    c.w += (c.vy * 0.004 * Math.sin(2 * c.f) - c.w * 0.6) * dt * 6;
    c.f += (c.w + c.spin) * dt;
    c.r += c.vr * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
  }
  let VC: Bit[] | null = null;
  let vcLast = -1;
  const VGOLD = ['#684606', '#7c560c', '#946818', '#aa7a20', '#c8952f', '#dcb04c', '#ecc870', '#fae08c'];
  // the video's own confetti: up from the lower corners, then it falls and comes back from the top
  function vconf(tt: number) {
    if (!VC || tt < vcLast) {
      VC = Array.from({ length: 110 }, (_, k) => {
        const L = k % 2 === 0;
        const a = (L ? -1 : 1) * (0.18 + Math.random() * 0.42);
        const sp = 2600 + Math.random() * 1900;
        return {
          x: L ? 20 : W - 20,
          y: H - 30,
          vx: -Math.sin(a) * sp,
          vy: -Math.cos(a) * sp,
          age: 0,
          f: Math.random() * 6.3,
          w: 0,
          spin: (Math.random() - 0.5) * 14,
          r: Math.random() * 6.3,
          vr: (Math.random() - 0.5) * 4,
          sw: 14 + Math.random() * 12,
          sh: 22 + Math.random() * 20,
          gold: Math.random() < 0.62,
          d: (k % 3) * 0.16,
        };
      });
      // v48 (owner: no gaps): a steady rain alongside the burst, spread over one screen above the top
      for (let k = 0; k < 140; k++)
        VC.push({
          rain: true,
          x: Math.random() * W,
          y: -40 - Math.random() * H,
          vx: (Math.random() - 0.5) * 120,
          vy: 620 + Math.random() * 240,
          age: 1,
          f: Math.random() * 6.3,
          w: 0,
          spin: (Math.random() - 0.5) * 14,
          r: Math.random() * 6.3,
          vr: (Math.random() - 0.5) * 4,
          sw: 14 + Math.random() * 12,
          sh: 22 + Math.random() * 20,
          gold: Math.random() < 0.62,
          d: 0,
        });
      vcLast = tt;
    }
    const dt = Math.min(0.05, Math.max(0, tt - vcLast));
    vcLast = tt;
    for (const c of VC) {
      if (tt < c.d) continue;
      for (let s = 0; s < 2; s++) cfStep(c, dt / 2, 2300, 0.009, 1.6);
      if (c.y > H + 60) {
        c.y = c.rain ? -40 - Math.random() * 60 : -40 - Math.random() * H;
        c.rain = true;
        c.x = Math.random() * W;
        c.vx = (Math.random() - 0.5) * 120;
        c.vy = 200 + Math.random() * 120;
        c.age = 1;
      }
      const k = Math.abs(Math.cos(c.f));
      const ky = Math.max(0.08, k);
      const cr = Math.cos(c.r);
      const sr = Math.sin(c.r);
      x.setTransform(cr, sr, -sr * ky, cr * ky, c.x, c.y);
      const l = (10 + k * k * 70) | 0;
      x.fillStyle = c.gold ? VGOLD[Math.round(k * 7)]! : `rgb(${l},${l},${(16 + k * k * 70) | 0})`;
      x.fillRect(-c.sw / 2, -c.sh / 2, c.sw, c.sh);
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
  }
  const gd2 = x.createLinearGradient(0, 760, 0, 1100);
  gd2.addColorStop(0, '#fff3c4');
  gd2.addColorStop(0.4, '#e9c56a');
  gd2.addColorStop(0.6, '#b8861e');
  gd2.addColorStop(1, '#f7dc8e');
  function frame(t: number) {
    if (!REV || !val) return base(t);
    if (t < B0) {
      x.fillStyle = '#050304';
      x.fillRect(0, 0, W, H);
    } else base(t - B0);
    simTo(t);
    const spot = t < OPEN0 ? 0.75 + 0.25 * Math.min(1, t / 1) : 1;
    for (const cu of CL) drawCurtain(cu, spot);
    if (t < OPEN0 + 0.6) {
      const a = Math.min(1, t / 0.8) * (1 - Math.max(0, (t - OPEN0) / 0.6));
      const sx = W / 2 + Math.sin(t * 1.3) * 260 * (1 - Math.min(1, t / 3));
      const sy = 900 + Math.cos(t * 1.1) * 120 * (1 - Math.min(1, t / 3));
      x.save();
      x.globalCompositeOperation = 'lighter';
      const sl = x.createRadialGradient(sx, sy, 10, sx, sy, 520);
      sl.addColorStop(0, `rgba(120,90,60,${0.5 * a})`);
      sl.addColorStop(0.6, `rgba(60,30,20,${0.2 * a})`);
      sl.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = sl;
      x.fillRect(0, 0, W, H);
      x.restore();
      const ta = Math.min(1, Math.max(0, (t - 0.9) / 0.7)) * (1 - Math.max(0, (t - OPEN0 + 0.3) / 0.5));
      if (ta > 0) {
        x.save();
        x.globalAlpha = ta;
        // v48: a dark pool behind the words so gold never sits straight on red velvet
        x.save();
        x.translate(W / 2, 950);
        x.scale(1, 0.62);
        const pool = x.createRadialGradient(0, 0, 0, 0, 0, 560);
        pool.addColorStop(0, 'rgba(4,2,3,.88)');
        pool.addColorStop(0.6, 'rgba(4,2,3,.7)');
        pool.addColorStop(1, 'rgba(4,2,3,0)');
        x.fillStyle = pool;
        x.fillRect(-560, -560, 1120, 1120);
        x.restore();
        x.textAlign = 'center';
        x.lineJoin = 'round';
        x.strokeStyle = 'rgba(6,3,4,.9)';
        x.fillStyle = gd2;
        x.shadowColor = 'rgba(0,0,0,.9)';
        x.shadowBlur = 22;
        const T = (f: string, ls: string, lw: number, s: string, y: number) => {
          x.font = f;
          x.letterSpacing = ls;
          x.lineWidth = lw;
          x.strokeText(s, W / 2, y);
          x.fillText(s, W / 2, y);
        };
        T('600 48px Georgia,serif', '12px', 8, 'AND THE', 790);
        T('700 124px Georgia,serif', '6px', 12, 'No. 1', 925);
        T('600 54px Georgia,serif', '8px', 8, 'SUPPLIER OF THE YEAR', 1020);
        T('600 54px Georgia,serif', '8px', 8, 'IS…', 1100);
        x.restore();
      }
    }
    if (t > OPEN0 + 1.3) vconf(t - (OPEN0 + 1.3));
    x.drawImage(val, 0, 0);
  }
  return rig;
}

/** The recorder's codec order (owner brief): mp4 avc1 → mp4 → webm vp9 → webm; none = a still PNG. */
export const STORY_MIME_ORDER = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'] as const;

export function pickStoryMime(isSupported: ((m: string) => boolean) | null): string | null {
  if (!isSupported) return null;
  return STORY_MIME_ORDER.find((m) => isSupported(m)) ?? null;
}
