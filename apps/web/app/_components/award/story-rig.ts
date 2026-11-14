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
 * outlined), and makes it 15 s. v49 (owner-approved Fable prototype): the valance is cloth on a rail of coupled springs,
 * tassels are chains with heavy bobs, the hem fringe swings, the house lights fade up and the video dips to dark to
 * loop; in the app the same cloth carries on into the plaque (`exitStart` / `exit` / `gone`) and hands over its confetti; every other award keeps the 10-second scene unchanged.
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
// ── v49 (`badge-milestones_v49.html`, owner-approved "ok"): the reveal's timing and its springs, pure so a test holds them ──
/** The house lights come up over the first 1.1 s (from 94% dark). */
export const FADE_IN_S = 1.1;
/** The shared video dips back to that dark over its last 0.5 s, so it loops with no cut. */
export const LOOP_DIP_S = 0.5;
/** In the app the cord starts hauling the curtains this long before the medal leaves. */
export const EXIT_LEAD_S = 0.35;
/** How far past their open stops the curtains are hauled off the rail ends (canvas px), over 1.25 s. */
export const EXIT_XOUT = 660;
/** The exit layer's longest life, seconds (it removes itself sooner, once everything is gone). */
export const EXIT_S = 4;
/** The rail: a row of damped springs — stiffness to its rest line, damping, and the coupling between neighbours. */
export const RAIL_K = 260;
export const RAIL_C = 3.6;
export const RAIL_W = 2600;

const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
/** How dark the house is at `t` (0.94 → 0 over FADE_IN_S). */
export const houseDark = (t: number) => (t < FADE_IN_S ? (1 - smooth(t / FADE_IN_S)) * 0.94 : 0);
/** How dark the loop dip is at `t` (0 → 0.94 over the last LOOP_DIP_S, reaching it 0.05 s before the end). */
export const loopDark = (t: number, dur: number) => (t > dur - LOOP_DIP_S ? Math.min(1, (t - (dur - LOOP_DIP_S)) / 0.45) * 0.94 : 0);
/** The extra distance the exit cord has hauled the curtains, `t` s into the scene, when it started at `exc` (-1 = never). */
export const exitHaul = (t: number, exc: number) => (exc >= 0 && t > exc ? EXIT_XOUT * smooth(Math.min(1, Math.max(0, (t - exc) / 1.25))) : 0);
/** The medal's float on the stage, `tb` s after it burst in: its offset (px) and turn (rad). */
export const medalPose = (tb: number) => ({ fy: tb > 1.05 ? Math.sin((tb - 1.05) * 1.5) * 12 : 0, rot: tb > 1.05 ? Math.sin((tb - 1.05) * 1.1) * 0.025 : 0 });
/** One step of the rail springs: each point is pulled to its rest line, damped, and coupled to its neighbours. */
export function railSpringStep(ry: Float32Array, rv: Float32Array, dt: number): void {
  const n = ry.length;
  for (let i = 0; i < n; i++) {
    const l = ry[i ? i - 1 : i]!;
    const r2 = ry[i < n - 1 ? i + 1 : i]!;
    rv[i] = rv[i]! + (-RAIL_K * ry[i]! - RAIL_C * rv[i]! + RAIL_W * (l + r2 - 2 * ry[i]!)) * dt;
  }
  for (let i = 0; i < n; i++) ry[i] = ry[i]! + rv[i]! * dt;
}

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
  /**
   * v50: the canvas is drawn at this fraction of 1080×1920 (≤ 1). The in-app entrance passes what the screen actually
   * shows (`min(innerWidth, innerHeight·9/16)·min(1.5, dpr)/1080`); the story video keeps 1 (full 1080×1920).
   */
  scale?: number;
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
  /** v49: the shared video dips to dark over its last 0.5 s, so it loops with no cut (the recorder sets it). */
  loop?: boolean;
  // ── v49, the No. 1 reveal only (undefined for every other award) ──
  /** v51: builds the stage still (medal hidden) ahead of the switch, so the exit's first frame is light. */
  prep?: () => void;
  /** In the app (not the video): the cord starts hauling the curtains a beat (EXLEAD) before the medal leaves. */
  app?: () => void;
  /** Starts the exit: the medal leaves the stage (it flies as its own layer); `top` = the letter-box above the picture, in canvas px. */
  exitStart?: (o?: { top?: number }) => void;
  /** Draws the exit at `te` seconds after it started onto `g` (the stage still fades by `a`); `simOnly` only steps the cloth. */
  exit?: (g: CanvasRenderingContext2D, te: number, a: number, simOnly?: boolean) => void;
  /** How long the exit layer may live, seconds. */
  exitDur?: number;
  /** The medal's float pose at `t` (its offset and turn on the stage). */
  pose?: (t: number) => { fy: number; rot: number };
  /** The reveal's confetti pieces in the air right now (the plaque's canvas adopts them). */
  confetti?: () => RevealPiece[];
  /** True once the curtains are off the rail ends and the valance is hoisted out of the frame. */
  gone?: () => boolean;
  /** How far the valance's top edge has been hoisted above the frame (≤ 0, canvas px): the layer is clipped there. */
  top?: () => number;
  /** The staged medal (900×858), as last drawn. */
  medal?: HTMLCanvasElement;
  /** The award's viewBox. */
  vb?: number[];
};

/** One piece of the reveal's confetti (canvas px at 1080 wide; speeds per second). */
export type RevealPiece = { rain?: boolean; x: number; y: number; vx: number; vy: number; age: number; f: number; w: number; spin: number; r: number; vr: number; sw: number; sh: number; gold: boolean; d: number };

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
  // v50: drawn at the size the screen shows (the scene is still laid out in 1080×1920 units, scaled by KS)
  const KS = Math.min(1, o.scale || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(W * KS);
  c.height = Math.round(H * KS);
  // `let`: the No. 1 exit draws the same curtains and valance on another canvas for a while
  let x = c.getContext('2d') as Ctx;
  const tc = o.tone;
  const MY = STORY_MY;
  const src = stripSlot(o.svg);
  const { vb, dw, dh } = artBox(src);
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
  // ── v50: everything costly is drawn ONCE into its own canvas, then blitted (owner: "Super laggy… everything is like
  // pausing"). Re-rasterising the seal's SVG every frame was the stall; a shadowBlur per frame was the rest. ──
  let IMC: HTMLCanvasElement | null = null;
  let SNC: HTMLCanvasElement | null = null;
  let HMC: HTMLCanvasElement | null = null;
  let TZC: HTMLCanvasElement | null = null;
  const mkCanvas = (w: number, h: number) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return cv;
  };
  /** The seal, rasterised once into a 900×858 bitmap. */
  function sealBitmap(): HTMLCanvasElement {
    if (IMC) return IMC;
    IMC = mkCanvas(900, 858);
    IMC.getContext('2d')?.drawImage(im, (900 - dw) / 2, (858 - dh) / 2, dw, dh);
    return IMC;
  }
  /** The shop's name with its glow (drawn at y 1400 → 140 in this 220-tall strip). */
  function shopBitmap(): HTMLCanvasElement {
    if (SNC) return SNC;
    SNC = mkCanvas(W, 220);
    const g = SNC.getContext('2d');
    if (g) {
      g.shadowColor = tc;
      g.shadowBlur = 30;
      g.font = '600 92px Georgia,serif';
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.fillText(o.shopName, W / 2, 140);
    }
    return SNC;
  }
  /** The gold SETNAYAN hallmark block (y 1560–1840 of the scene). */
  function hallmarkBitmap(): HTMLCanvasElement {
    if (HMC) return HMC;
    HMC = mkCanvas(W, 280);
    const g = HMC.getContext('2d') as Ctx | null;
    if (g) {
      g.translate(0, -1560);
      g.font = '700 40px Georgia,serif';
      g.letterSpacing = '10px';
      const tw = g.measureText('SETNAYAN').width;
      const lx = W / 2 - (64 + 22 + tw) / 2;
      g.shadowColor = 'rgba(232,184,74,.55)';
      g.shadowBlur = 18;
      g.save();
      g.translate(lx, 1622);
      g.scale(0.016, -0.016);
      g.translate(0, -4000);
      g.fillStyle = gd;
      g.fill(mk);
      g.restore();
      g.textAlign = 'left';
      g.fillStyle = gd;
      g.fillText('SETNAYAN', lx + 86, 1668);
      g.shadowBlur = 0;
      g.textAlign = 'center';
      g.font = '600 22px system-ui,sans-serif';
      g.letterSpacing = '6px';
      g.fillStyle = '#E8C670';
      g.globalAlpha = 0.85;
      const hm = 'AN EXCLUSIVE SETNAYAN ' + o.word;
      g.fillText(hm, W / 2, 1742);
      const hw = g.measureText(hm).width / 2;
      g.fillRect(W / 2 - hw - 110, 1734, 80, 1.5);
      g.fillRect(W / 2 + hw + 30, 1734, 80, 1.5);
    }
    return HMC;
  }
  const REV = !!o.reveal;
  const rig: StoryRig = { canvas: c, frame, dw, dh, hide: false, dur: REV ? REVEAL_S : STORY_S };
  const DUR = rig.dur;
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
    const { fy } = medalPose(t);
    const rot = t > 1.05 ? medalPose(t).rot : (1 - t / 1.05) * -0.5;
    b.clearRect(0, 0, 900, 858);
    b.globalCompositeOperation = 'source-over';
    b.drawImage(sealBitmap(), 0, 0);
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
    {
      const a = ease((t - 2.0) / 0.6);
      if (a > 0) {
        x.globalAlpha = a;
        x.drawImage(shopBitmap(), 0, 1400 - 140 + (1 - a) * 28);
        x.globalAlpha = 1;
      }
    }
    fadeText(o.line1, '500 40px system-ui,sans-serif', 1475, 2.6, t, '#fff', 0.8);
    if (o.line2) fadeText(o.line2, '500 40px system-ui,sans-serif', 1530, 2.9, t, '#fff', 0.8);
    const ha = ease((t - 3.4) / 0.7);
    if (ha > 0) {
      x.globalAlpha = ha;
      x.drawImage(hallmarkBitmap(), 0, 1560);
      x.globalAlpha = 1;
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
  // v49: the valance, the rail springs, the tassels, the fringe and the exit
  const VS = 6;
  const VN = 10 * VS + 1;
  const VR = 5;
  const VTOP = -46;
  const VFOLD = 7;
  const TN = 6;
  const TSEG = 11;
  const BOBM = 4;
  const FRL = 36;
  const EXLEAD = EXIT_LEAD_S;
  const VAIR = 0.9965;
  const TAIR = 0.9976;
  const FAIR = 0.975;
  const KY = 620;
  const KE = 520;
  const KJ = 200;
  const HK = 520;
  const BK = 30;
  const BC = 1.3;
  const BKICK = 120;
  const WV = 1.6;
  const WZ = 2.0;
  const WT = 2.8;
  const IAV = 30;
  const IAZ = 60;
  const IAT = 170;
  type Tassel = { ak: number; p: Float32Array; q: Float32Array };
  type Valance = { p: Float32Array; q: Float32Array; K: Float32Array; T: Tassel[]; ry: Float32Array; rv: Float32Array; N: Float32Array; bx: number; bv: number; f0: boolean; f1: boolean; f2: boolean };
  let VA: Valance | null = null;
  let EX = -1;
  let EXC = -1;
  let LIFT = 330;
  let SNAP: HTMLCanvasElement | null = null;
  type Curtain = {
    side: number;
    p: Float32Array;
    q: Float32Array;
    ring: number[];
    rv: number[];
    cons: Float32Array;
    L0x: number;
    L0y: number;
    hit: Uint8Array;
    ft: Float32Array;
    fq: Float32Array;
  };
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
    const ft = new Float32Array(CC * 3);
    const h0 = (CR - 1) * CC * 3;
    for (let c = 0; c < CC; c++) {
      ft[c * 3] = p[h0 + c * 3]!;
      ft[c * 3 + 1] = p[h0 + c * 3 + 1]! + FRL;
      ft[c * 3 + 2] = p[h0 + c * 3 + 2]!;
    }
    return { side, p, q, ring, rv, cons: new Float32Array(cons), L0x, L0y, hit: new Uint8Array(CC), ft, fq: new Float32Array(ft) };
  }
  function railStep(cu: Curtain, t: number, dt: number) {
    // the cord: the leading ring (the stage-centre edge, index 0) is pulled off-stage
    const s = cu.side;
    const u = Math.min(1, Math.max(0, (t - OPEN0) / 1.6));
    const pull = u < 1 ? u * u * (3 - 2 * u) : 1;
    let target = W / 2 + s * (8 + pull * (W / 2 - 8 - 80)); // where the hand on the cord is taking the leading ring
    // the exit: the cord hauls the whole bunch off the end of the rail
    target += s * exitHaul(t, EXC);
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
        if (!cu.hit[c]) {
          // a ring knocking into the next one knocks the rail: the knock travels along it as a wave
          cu.hit[c] = 1;
          const rel = (V[c - 1]! - V[c]!) * s;
          if (rel > 40) railKick(R[c]!, Math.min(1, rel / 320) * KJ);
        }
        R[c] = R[c]! + (smin - d) * s;
        V[c] = s * Math.max(V[c]! * s, V[c - 1]! * s * 0.8);
      } else if (d > smin + 4) cu.hit[c] = 0;
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
    // the hem fringe: every strand is a pendulum on its hem point, so it trails the cloth and swings in after it
    const F = cu.ft;
    const Q = cu.fq;
    const h0 = (CR - 1) * CC * 3;
    const fl = FLOOR + FRL + 24;
    for (let c = 0; c < CC; c++) {
      const k = c * 3;
      const hk = h0 + k;
      const vx = (F[k]! - Q[k]!) * FAIR;
      const vy = (F[k + 1]! - Q[k + 1]!) * FAIR;
      const vz = (F[k + 2]! - Q[k + 2]!) * FAIR;
      Q[k] = F[k]!;
      Q[k + 1] = F[k + 1]!;
      Q[k + 2] = F[k + 2]!;
      F[k] = F[k]! + vx;
      F[k + 1] = F[k + 1]! + vy + G * dt2;
      F[k + 2] = F[k + 2]! + vz;
      const dx = F[k]! - p[hk]!;
      const dy = F[k + 1]! - p[hk + 1]!;
      const dz = F[k + 2]! - p[hk + 2]!;
      const f = FRL / (Math.hypot(dx, dy, dz) || 1);
      F[k] = p[hk]! + dx * f;
      F[k + 1] = p[hk + 1]! + dy * f;
      F[k + 2] = p[hk + 2]! + dz * f;
      if (F[k + 1]! > fl) {
        F[k + 1] = fl;
        F[k] = F[k]! - vx * 0.5;
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
    // each point's lit colour as numbers, not strings: no garbage per frame (v50)
    const CRr = new Float32Array(n);
    const CGg = new Float32Array(n);
    const CBb = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      const k = v * 3;
      const nn = Math.hypot(N[k]!, N[k + 1]!, N[k + 2]!) || 1;
      const nx = N[k]! / nn;
      const ny = N[k + 1]! / nn;
      const nz = Math.abs(N[k + 2]! / nn);
      const dif = Math.max(0, nx * LT[0] + ny * LT[1] + nz * LT[2]);
      const rim = Math.pow(1 - nz, 1.5);
      const sh = (0.08 + 1.25 * Math.pow(dif, 1.3)) * spot;
      CRr[v] = Math.min(255, 150 * sh + 230 * rim * 0.45);
      CGg[v] = Math.min(255, 8 * sh + 62 * rim * 0.45);
      CBb[v] = Math.min(255, 30 * sh + 84 * rim * 0.45);
    }
    // velvet folds run top to bottom, so each fold is painted as ONE strip down the whole cloth (it follows every point
    // of the simulated edge), shaded across by its two edge colours, then darkened under the valance and at the floor
    const cs: string[] = [];
    for (let c = 0; c < CC; c++) {
      let r0 = 0;
      let g0 = 0;
      let b0 = 0;
      for (let r = 2; r < CR - 2; r++) {
        const v = r * CC + c;
        r0 += CRr[v]! | 0;
        g0 += CGg[v]! | 0;
        b0 += CBb[v]! | 0;
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
    }
    // v50: the shade under the valance and at the floor, filled ONCE over the curtain's outline (not once per fold)
    x.beginPath();
    for (let c = 0; c < CC; c++) {
      const v = P[c]!;
      if (c) x.lineTo(v[0], v[1]);
      else x.moveTo(v[0], v[1]);
    }
    for (let r = 1; r < CR; r++) {
      const v = P[r * CC + CC - 1]!;
      x.lineTo(v[0], v[1]);
    }
    for (let c = CC - 2; c >= 0; c--) {
      const v = P[(CR - 1) * CC + c]!;
      x.lineTo(v[0], v[1]);
    }
    for (let r = CR - 2; r > 0; r--) {
      const v = P[r * CC]!;
      x.lineTo(v[0], v[1]);
    }
    x.closePath();
    x.fillStyle = vg;
    x.fill();
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
    // v49: each strand runs from its hem point to its own pendulum tip
    const FT: [number, number, number][] = [];
    for (let c = 0; c < CC; c++) FT.push(prj(cu.ft, c * 3));
    x.lineWidth = 3;
    for (let ps = 0; ps < 2; ps++) {
      x.strokeStyle = ps ? '#f3d27a' : '#a8781f';
      x.beginPath();
      for (let c = 0; c < CC - 1; c++) {
        const a = P[(CR - 1) * CC + c]!;
        const b = P[(CR - 1) * CC + c + 1]!;
        const ta = FT[c]!;
        const tb = FT[c + 1]!;
        for (let k = ps; k < 4; k += 2) {
          const u = k / 4;
          const fx = a[0] + (b[0] - a[0]) * u;
          const fy = a[1] + (b[1] - a[1]) * u;
          x.moveTo(fx, fy);
          x.quadraticCurveTo(fx, fy + FRL * 0.55, ta[0] + (tb[0] - ta[0]) * u, ta[1] + (tb[1] - ta[1]) * u);
        }
      }
      x.stroke();
    }
    x.lineCap = 'butt';
  }
  // v49 (owner 15 Nov: "The upper curtain is not moving the strings on the curtains is not moving. The remaining
  // curtains after it opens will pull out as the placque comes in and binds with the seal. Make each part connect and
  // animate smoothly.") The valance is cloth too (a strip of Verlet points hanging from the same rail), the rail itself
  // is a row of damped springs that carries every knock along its length as a wave, each tassel is a little chain with
  // a heavy bob, and every strand of the hem fringe is a pendulum on its hem point. Nothing here is a drawn wiggle: it
  // is all stepped, on the same fixed 1/120 s clock (`simTo`).
  const vDepth = (c: number) => {
    const u = (c % VS) / VS;
    return 150 + 160 * u * (1 - u);
  };
  function railKick(xx: number, j: number) {
    if (!VA) return;
    const i = Math.max(1, Math.min(VN - 2, Math.round((xx / W) * 8 * VS) + VS));
    VA.rv[i] = VA.rv[i]! + j;
    VA.rv[i - 1] = VA.rv[i - 1]! + j * 0.5;
    VA.rv[i + 1] = VA.rv[i + 1]! + j * 0.5;
  }
  function mkValance(): Valance {
    const n = VN * VR;
    const p = new Float32Array(n * 3);
    const q = new Float32Array(n * 3);
    const K: number[] = [];
    for (let r = 0; r < VR; r++)
      for (let c = 0; c < VN; c++) {
        const k = (r * VN + c) * 3;
        const f = r / (VR - 1);
        p[k] = ((c - VS) * W) / (8 * VS);
        p[k + 1] = VTOP + (vDepth(c) - VTOP) * f;
        p[k + 2] = -VFOLD * Math.cos((c * 2 * Math.PI) / VS) * f;
        q[k] = p[k]!;
        q[k + 1] = p[k + 1]!;
        q[k + 2] = p[k + 2]!;
      }
    const add = (a: number, b: number, st: number) => {
      const ka = a * 3;
      const kb = b * 3;
      K.push(a, b, Math.hypot(p[ka]! - p[kb]!, p[ka + 1]! - p[kb + 1]!, p[ka + 2]! - p[kb + 2]!), st);
    };
    for (let r = 0; r < VR; r++)
      for (let c = 0; c < VN; c++) {
        const a = r * VN + c;
        if (c < VN - 1 && r) add(a, a + 1, 1);
        if (r < VR - 1) add(a, a + VN, 1);
        if (r < VR - 1 && c < VN - 1) {
          add(a, a + VN + 1, 0.3);
          add(a + 1, a + VN, 0.3);
        }
        if (c < VN - 2 && r) add(a, a + 2, 0.5);
      }
    const T: Tassel[] = [];
    for (let sc = 0; sc < 10; sc++) {
      const c = sc * VS + VS / 2;
      const ak = ((VR - 1) * VN + c) * 3;
      const tp = new Float32Array(TN * 3);
      const tq = new Float32Array(TN * 3);
      for (let j = 0; j < TN; j++) {
        tp[j * 3] = p[ak]!;
        tp[j * 3 + 1] = p[ak + 1]! + j * TSEG;
        tp[j * 3 + 2] = p[ak + 2]!;
      }
      tq.set(tp);
      T.push({ ak, p: tp, q: tq });
    }
    return { p, q, K: new Float32Array(K), T, ry: new Float32Array(VN), rv: new Float32Array(VN), N: new Float32Array(n * 3), bx: 0, bv: 0, f0: false, f1: false, f2: false };
  }
  // the air the moving curtains push along: a gust that travels with each curtain's heavy leading edge
  function wind(xx: number) {
    let w = 0;
    for (const cu of CL) {
      const v = cu.rv[0]!;
      if (v > 1 || v < -1) {
        const d = (xx - cu.ring[0]!) / 210;
        w += v * Math.exp(-d * d);
      }
    }
    return w;
  }
  function valStep(t: number) {
    const V = VA!;
    const { p, q, ry, rv, K } = V;
    const dt = SUB;
    const dt2 = dt * dt;
    const n = VN * VR;
    const m = K.length;
    const P3 = VN * 3;
    if (!V.f0 && t >= OPEN0) {
      // the cord goes taut: the rail jumps at the middle
      V.f0 = true;
      for (let i = -5; i <= 5; i++) rv[VS + 4 * VS + i] = rv[VS + 4 * VS + i]! + KY * (1 - Math.abs(i) / 6);
    }
    if (!V.f1 && t >= OPEN0 + 1.6) {
      // the leading rings hit their stops
      V.f1 = true;
      for (let i = 0; i < 5; i++) {
        rv[VS + 1 + i] = rv[VS + 1 + i]! + KE;
        rv[VN - 2 - VS - i] = rv[VN - 2 - VS - i]! + KE;
      }
    }
    let ly = 0;
    if (EX >= 0 && t >= EX) {
      if (!V.f2) {
        // the hoist takes up: a jerk at one end, then the batten sways on its lines
        V.f2 = true;
        V.bv = BKICK;
        for (let i = 0; i < 10; i++) rv[i] = rv[i]! - HK * (1 - i / 10);
      }
      const u = Math.min(1, Math.max(0, (t - EX - 0.1) / 1.15));
      ly = -LIFT * u * u;
    }
    railSpringStep(ry, rv, dt);
    V.bv += (-BK * V.bx - BC * V.bv) * dt;
    V.bx += V.bv * dt;
    const i1 = 0.83 * t;
    const i2 = 1.71 * t;
    const gz = 15 * t;
    for (let i = VN; i < n; i++) {
      const k = i * 3;
      const f = ((i / VN) | 0) / (VR - 1);
      const xx = p[k]!;
      const vx = (p[k]! - q[k]!) * VAIR;
      const vy = (p[k + 1]! - q[k + 1]!) * VAIR;
      const vz = (p[k + 2]! - q[k + 2]!) * VAIR;
      q[k] = p[k]!;
      q[k + 1] = p[k + 1]!;
      q[k + 2] = p[k + 2]!;
      const w = wind(xx);
      const idle = Math.sin(i1 + xx * 0.0041) + 0.6 * Math.sin(i2 + xx * 0.0093 + 1.3);
      p[k] = p[k]! + vx + (WV * w + IAV * idle) * f * dt2;
      p[k + 1] = p[k + 1]! + vy + G * dt2;
      p[k + 2] = p[k + 2]! + vz + (WZ * Math.abs(w) * Math.sin(xx * 0.045 + gz) + IAZ * idle) * f * dt2;
    }
    for (let c = 0; c < VN; c++) {
      const k = c * 3;
      q[k] = p[k]!;
      q[k + 1] = p[k + 1]!;
      q[k + 2] = p[k + 2]!;
      p[k] = ((c - VS) * W) / (8 * VS) + V.bx;
      p[k + 1] = VTOP + ry[c]! + ly;
      p[k + 2] = 0;
    }
    for (let it = 0; it < 6; it++)
      for (let e = 0; e < m; e += 4) {
        const a = K[e]! * 3;
        const b = K[e + 1]! * 3;
        const dx = p[b]! - p[a]!;
        const dy = p[b + 1]! - p[a + 1]!;
        const dz = p[b + 2]! - p[a + 2]!;
        const d = Math.hypot(dx, dy, dz) || 1;
        const f = ((d - K[e + 2]!) / d) * K[e + 3]!;
        if (a >= P3) {
          const h = b >= P3 ? 0.5 : 1;
          p[a] = p[a]! + dx * f * h;
          p[a + 1] = p[a + 1]! + dy * f * h;
          p[a + 2] = p[a + 2]! + dz * f * h;
          if (b >= P3) {
            p[b] = p[b]! - dx * f * h;
            p[b + 1] = p[b + 1]! - dy * f * h;
            p[b + 2] = p[b + 2]! - dz * f * h;
          }
        } else if (b >= P3) {
          p[b] = p[b]! - dx * f;
          p[b + 1] = p[b + 1]! - dy * f;
          p[b + 2] = p[b + 2]! - dz * f;
        }
      }
    // the tassels: a cord of short links and a heavier bob, each hanging from its own scallop
    for (const Ts of V.T) {
      const tp = Ts.p;
      const tq = Ts.q;
      const ak = Ts.ak;
      for (let j = 1; j < TN; j++) {
        const k = j * 3;
        const sl = j === TN - 1 ? 0.45 : 1;
        const xx = tp[k]!;
        const vx = (tp[k]! - tq[k]!) * TAIR;
        const vy = (tp[k + 1]! - tq[k + 1]!) * TAIR;
        const vz = (tp[k + 2]! - tq[k + 2]!) * TAIR;
        tq[k] = tp[k]!;
        tq[k + 1] = tp[k + 1]!;
        tq[k + 2] = tp[k + 2]!;
        const w = wind(xx);
        const idle = Math.sin(i1 + xx * 0.0041) + 0.6 * Math.sin(i2 + xx * 0.0093 + 1.3);
        tp[k] = tp[k]! + vx + (WT * w + IAT * idle) * sl * dt2;
        tp[k + 1] = tp[k + 1]! + vy + G * dt2;
        tp[k + 2] = tp[k + 2]! + vz + WZ * 0.5 * Math.abs(w) * Math.sin(xx * 0.045 + gz) * sl * dt2;
      }
      tp[0] = p[ak]!;
      tp[1] = p[ak + 1]!;
      tp[2] = p[ak + 2]!;
      for (let it = 0; it < 6; it++)
        for (let j = 0; j < TN - 1; j++) {
          const a = j * 3;
          const b = a + 3;
          const wa = j ? 1 : 0;
          const wb = j === TN - 2 ? 1 / BOBM : 1;
          const dx = tp[b]! - tp[a]!;
          const dy = tp[b + 1]! - tp[a + 1]!;
          const dz = tp[b + 2]! - tp[a + 2]!;
          const d = Math.hypot(dx, dy, dz) || 1;
          const f = (d - TSEG) / d / (wa + wb);
          if (wa) {
            tp[a] = tp[a]! + dx * f * wa;
            tp[a + 1] = tp[a + 1]! + dy * f * wa;
            tp[a + 2] = tp[a + 2]! + dz * f * wa;
          }
          tp[b] = tp[b]! - dx * f * wb;
          tp[b + 1] = tp[b + 1]! - dy * f * wb;
          tp[b + 2] = tp[b + 2]! - dz * f * wb;
        }
    }
  }
  function drawValance(spot: number) {
    const V = VA!;
    const p = V.p;
    const n = VN * VR;
    const N = V.N;
    N.fill(0);
    const P: [number, number, number][] = new Array(n);
    for (let i = 0; i < n; i++) P[i] = prj(p, i * 3);
    for (let r = 0; r < VR - 1; r++)
      for (let c = 0; c < VN - 1; c++) {
        const i = (r * VN + c) * 3;
        const j = i + 3;
        const k = i + VN * 3;
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
    const cs: string[] = new Array(VN);
    for (let c = 0; c < VN; c++) {
      let sh = 0;
      let rm = 0;
      for (let r = 1; r < VR; r++) {
        const k = (r * VN + c) * 3;
        const nn = Math.hypot(N[k]!, N[k + 1]!, N[k + 2]!) || 1;
        const nz = Math.abs(N[k + 2]! / nn);
        const dif = Math.max(0, (N[k]! / nn) * LT[0] + (N[k + 1]! / nn) * LT[1] + nz * LT[2]);
        sh += 0.08 + 1.25 * Math.pow(dif, 1.3);
        rm += Math.pow(1 - nz, 1.5);
      }
      sh = (sh / (VR - 1)) * spot;
      rm = (rm / (VR - 1)) * 0.45;
      cs[c] = `rgb(${Math.min(255, 150 * sh + 230 * rm) | 0},${Math.min(255, 8 * sh + 62 * rm) | 0},${Math.min(255, 30 * sh + 84 * rm) | 0})`;
    }
    const y0 = P[VS]![1] - VTOP;
    const vg = x.createLinearGradient(0, y0, 0, y0 + 200);
    vg.addColorStop(0, 'rgba(0,0,0,.58)');
    vg.addColorStop(0.6, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.34)');
    const B0r = (VR - 1) * VN;
    const M = (VR >> 1) * VN;
    // v50: one strip per two columns with a 3-stop gradient (slightly overlapped, no stroke), and the shade filled ONCE
    for (let c = 0; c < VN - 1; c += 2) {
      const c2 = Math.min(VN - 1, c + 2);
      const A = P[M + c]!;
      const B = P[M + c2]!;
      x.beginPath();
      for (let r = 0; r < VR; r++) {
        const v = P[r * VN + c]!;
        if (r) x.lineTo(v[0] - 0.8, v[1]);
        else x.moveTo(v[0] - 0.8, v[1]);
      }
      for (let r = VR - 1; r >= 0; r--) {
        const v = P[r * VN + c2]!;
        x.lineTo(v[0] + 0.8, v[1]);
      }
      x.closePath();
      const g = x.createLinearGradient(A[0], A[1], B[0] === A[0] ? B[0] + 0.01 : B[0], B[1]);
      g.addColorStop(0, cs[c]!);
      g.addColorStop(0.5, cs[c + 1]!);
      g.addColorStop(1, cs[c2]!);
      x.fillStyle = g;
      x.fill();
    }
    x.beginPath();
    for (let c = 0; c < VN; c++) {
      const v = P[c]!;
      if (c) x.lineTo(v[0], v[1]);
      else x.moveTo(v[0], v[1]);
    }
    for (let c = VN - 1; c >= 0; c--) {
      const v = P[B0r + c]!;
      x.lineTo(v[0], v[1]);
    }
    x.closePath();
    x.fillStyle = vg;
    x.fill();
    // the gold band, riding the cloth
    x.lineCap = 'butt';
    x.lineJoin = 'round';
    const band = (w: number, col: string, dy: number) => {
      x.strokeStyle = col;
      x.lineWidth = w;
      x.beginPath();
      for (let c = 0; c < VN; c++) {
        const rr = (52 - VTOP) / ((vDepth(c) - VTOP) / (VR - 1));
        const r0 = Math.min(VR - 2, rr | 0);
        const u = rr - r0;
        const a = P[r0 * VN + c]!;
        const b = P[(r0 + 1) * VN + c]!;
        const xx = a[0] + (b[0] - a[0]) * u;
        const yy = a[1] + (b[1] - a[1]) * u + dy;
        if (c) x.lineTo(xx, yy);
        else x.moveTo(xx, yy);
      }
      x.stroke();
    };
    band(16, '#7a5410', 0);
    band(11, '#d9b455', 0.5);
    band(4, '#fff1c0', -1.5);
    // the scalloped gold trim on the hem
    x.strokeStyle = '#e9c56a';
    x.lineWidth = 7;
    x.lineCap = 'round';
    x.beginPath();
    for (let sc = 0; sc < 10; sc++) {
      const c0 = sc * VS;
      const a = P[B0r + c0]!;
      x.moveTo(a[0], a[1] - 3);
      for (let c = c0 + 1; c < c0 + VS; c++) {
        const v = P[B0r + c]!;
        const w = P[B0r + c + 1]!;
        if (c < c0 + VS - 1) x.quadraticCurveTo(v[0], v[1] - 3, (v[0] + w[0]) / 2, (v[1] + w[1]) / 2 - 3);
        else x.quadraticCurveTo(v[0], v[1] - 3, w[0], w[1] - 3);
      }
    }
    x.stroke();
    // tassels: cord, knot, skirt
    for (const Ts of V.T) {
      const Q: [number, number, number][] = [];
      for (let j = 0; j < TN; j++) Q.push(prj(Ts.p, j * 3));
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.strokeStyle = '#a8781f';
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(Q[0]![0], Q[0]![1]);
      for (let j = 1; j < TN - 1; j++) x.quadraticCurveTo(Q[j]![0], Q[j]![1], (Q[j]![0] + Q[j + 1]![0]) / 2, (Q[j]![1] + Q[j + 1]![1]) / 2);
      x.lineTo(Q[TN - 1]![0], Q[TN - 1]![1]);
      x.stroke();
      x.strokeStyle = '#f3d27a';
      x.lineWidth = 2;
      x.stroke();
      const b = Q[TN - 1]!;
      const a = Q[TN - 2]!;
      let dx = b[0] - a[0];
      let dy = b[1] - a[1];
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const nx = -dy;
      const ny = dx;
      const SK = 34;
      x.fillStyle = '#c8952f';
      x.beginPath();
      x.moveTo(b[0] + nx * 6, b[1] + ny * 6);
      x.lineTo(b[0] + dx * SK + nx * 10, b[1] + dy * SK + ny * 10);
      x.lineTo(b[0] + dx * SK - nx * 10, b[1] + dy * SK - ny * 10);
      x.lineTo(b[0] - nx * 6, b[1] - ny * 6);
      x.closePath();
      x.fill();
      x.strokeStyle = '#8a6414';
      x.lineWidth = 1.5;
      x.beginPath();
      for (const o2 of [-5, 0, 5]) {
        x.moveTo(b[0] + nx * o2 * 0.5, b[1] + ny * o2 * 0.5);
        x.lineTo(b[0] + dx * SK + nx * o2, b[1] + dy * SK + ny * o2);
      }
      x.stroke();
      x.fillStyle = '#e9c56a';
      x.beginPath();
      x.arc(Q[0]![0], Q[0]![1], 6, 0, 7);
      x.fill();
      x.fillStyle = '#f3d27a';
      x.beginPath();
      x.arc(b[0], b[1], 10, 0, 7);
      x.fill();
      x.fillStyle = '#fff1c0';
      x.beginPath();
      x.arc(b[0] - 3, b[1] - 3, 3.2, 0, 7);
      x.fill();
    }
  }

  if (REV) {
    VA = mkValance();
    CL = [mkCurtain(-1), mkCurtain(1)];
  }
  function simTo(t: number) {
    // fixed 1/120 s steps up to t; a jump back (or a skip forward) re-hangs and settles the cloth
    if (t < simT - 0.05) {
      CL = [mkCurtain(-1), mkCurtain(1)];
      VA = mkValance();
      EX = -1;
      simT = -1.2;
    }
    if (t - simT > 3) simT = t - 3;
    while (simT < t) {
      for (const cu of CL) clothStep(cu, simT);
      valStep(simT);
      simT += SUB;
    }
  }
  // confetti physics: a light square of paper. Its drag depends on how flat it meets the air (area = |cos flip|), a
  // tilted piece glides sideways (lift ∝ sin 2·flip), the airflow keeps it tumbling, and the cannon's cloud stays
  // dense (little drag) for its first instant, then spreads and slows.
  type Bit = RevealPiece;
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
      x.setTransform(cr * KS, sr * KS, -sr * ky * KS, cr * ky * KS, c.x * KS, c.y * KS);
      const l = (10 + k * k * 70) | 0;
      x.fillStyle = c.gold ? VGOLD[Math.round(k * 7)]! : `rgb(${l},${l},${(16 + k * k * 70) | 0})`;
      x.fillRect(-c.sw / 2, -c.sh / 2, c.sw, c.sh);
    }
    x.setTransform(KS, 0, 0, KS, 0, 0);
  }
  const gd2 = x.createLinearGradient(0, 760, 0, 1100);
  gd2.addColorStop(0, '#fff3c4');
  gd2.addColorStop(0.4, '#e9c56a');
  gd2.addColorStop(0.6, '#b8861e');
  gd2.addColorStop(1, '#f7dc8e');
  /** v48 words on their dark pool, outlined and glowing (y 380–1340 of the scene), drawn once (v50). */
  function teaserBitmap(): HTMLCanvasElement {
    if (TZC) return TZC;
    TZC = mkCanvas(W, 960);
    const g = TZC.getContext('2d') as Ctx | null;
    if (g) {
      g.translate(0, -380);
      // a dark pool behind the words so gold never sits straight on red velvet
      g.save();
      g.translate(W / 2, 950);
      g.scale(1, 0.62);
      const pool = g.createRadialGradient(0, 0, 0, 0, 0, 560);
      pool.addColorStop(0, 'rgba(4,2,3,.88)');
      pool.addColorStop(0.6, 'rgba(4,2,3,.7)');
      pool.addColorStop(1, 'rgba(4,2,3,0)');
      g.fillStyle = pool;
      g.fillRect(-560, -560, 1120, 1120);
      g.restore();
      g.textAlign = 'center';
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(6,3,4,.9)';
      g.fillStyle = gd2;
      g.shadowColor = 'rgba(0,0,0,.9)';
      g.shadowBlur = 22;
      const T = (f: string, ls: string, lw: number, s2: string, y: number) => {
        g.font = f;
        g.letterSpacing = ls;
        g.lineWidth = lw;
        g.strokeText(s2, W / 2, y);
        g.fillText(s2, W / 2, y);
      };
      T('600 48px Georgia,serif', '12px', 8, 'AND THE', 790);
      T('700 124px Georgia,serif', '6px', 12, 'No. 1', 925);
      T('600 54px Georgia,serif', '8px', 8, 'SUPPLIER OF THE YEAR', 1020);
      T('600 54px Georgia,serif', '8px', 8, 'IS…', 1100);
    }
    return TZC;
  }
  function frame(t: number) {
    x.setTransform(KS, 0, 0, KS, 0, 0);
    if (!REV || !VA) return base(t);
    if (t < B0) {
      // the same dark the stage opens on, so nothing steps when the stage lights
      const bg = x.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#17120c');
      bg.addColorStop(0.55, '#0b0907');
      bg.addColorStop(1, '#000');
      x.fillStyle = bg;
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
        x.globalAlpha = ta;
        x.drawImage(teaserBitmap(), 0, 380);
        x.globalAlpha = 1;
      }
    }
    if (t > OPEN0 + 1.3) vconf(t - (OPEN0 + 1.3));
    drawValance(spot);
    // the house is dark first, then the light comes up; the shared video dips back to that same dark so it loops with no cut
    if (t < FADE_IN_S) {
      x.fillStyle = `rgba(3,2,3,${houseDark(t)})`;
      x.fillRect(0, 0, W, H);
    }
    if (rig.loop && t > DUR - LOOP_DIP_S) {
      x.fillStyle = `rgba(3,2,3,${loopDark(t, DUR)})`;
      x.fillRect(0, 0, W, H);
    }
  }
  // v50: warm every cache and settle the cloth BEFORE the first shown frame, so nothing is built mid-show
  if (REV) {
    base(4);
    frame(2);
    frame(0);
  }
  if (REV) {
    rig.vb = vb;
    rig.medal = bc;
    rig.exitDur = EXIT_S;
    rig.pose = (t) => medalPose(t - B0);
    rig.confetti = () => VC || [];
    // the exit (in the app only): the stage is kept as one still, the medal is gone from it (it flies as its own
    // layer), and from here the curtains run off the rail ends and the valance is hoisted, drawn on whatever canvas is
    // handed in
    // v51: the stage still (medal hidden) is built ahead of the switch — the reveal loop calls this in its last 1.2 s —
    // so the exit's first frame is light (owner: it went "straight to the logo placing the plaque")
    rig.prep = () => {
      if (SNAP) return;
      const h0 = rig.hide;
      rig.hide = true;
      SNAP = document.createElement('canvas');
      SNAP.width = Math.round(W * KS);
      SNAP.height = Math.round(H * KS);
      const k0 = x;
      x = SNAP.getContext('2d') as Ctx;
      x.setTransform(KS, 0, 0, KS, 0, 0);
      base(DUR - B0);
      x = k0;
      rig.hide = h0;
    };
    rig.exitStart = (o2) => {
      EX = DUR;
      LIFT = 340 + Math.max(0, (o2 && o2.top) || 0);
      rig.prep?.();
      rig.hide = true;
    };
    rig.exit = (g, te, a, simOnly) => {
      simTo(DUR + te);
      if (simOnly) return;
      const k0 = x;
      x = g as Ctx;
      if (a > 0 && SNAP) {
        g.globalAlpha = a;
        g.drawImage(SNAP, 0, 0, W, H);
        g.globalAlpha = 1;
      }
      for (const cu of CL) drawCurtain(cu, 1);
      drawValance(1);
      x = k0;
    };
    // in the app the cord starts hauling the curtains a beat before the medal leaves: a hanging cloth's hem only
    // follows its top after the pull has travelled down it (about 1.6 s here), so the tops go first and the hems whip
    // out as the plaque lands
    rig.app = () => {
      EXC = DUR - EXLEAD;
    };
    // how far the valance's top edge has been hoisted above the frame (the layer is clipped there, so nothing pops
    // into the letter-box)
    rig.top = () => Math.min(0, VA!.p[VS * 3 + 1]! - VTOP - 24);
    rig.gone = () => {
      if (!VA || VA.p[VS * 3 + 1]! > -LIFT + 8) return false;
      for (const cu of CL) {
        const p = cu.p;
        const s2 = cu.side;
        for (let i = 0; i < p.length; i += 3) if ((p[i]! - W / 2) * s2 < W / 2 + 60) return false;
      }
      return true;
    };
  }
  return rig;
}

/** The recorder's codec order (owner brief): mp4 avc1 → mp4 → webm vp9 → webm; none = a still PNG. */
export const STORY_MIME_ORDER = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'] as const;

export function pickStoryMime(isSupported: ((m: string) => boolean) | null): string | null {
  if (!isSupported) return null;
  return STORY_MIME_ORDER.find((m) => isSupported(m)) ?? null;
}
