/**
 * 🎭 THE ENVELOPE, IN THE OWNER'S TWO STYLES (owner 23 Nov: *"we want both styles"*; drawing v22 `src/env2.js`). Built to read as a photograph: paper that takes light across its relief, gold foil and wax that
 * mirror a room, soft shadows cast flap on flap, flaps that bend as paper does while they turn, film tone.
 *   CLASSIC  — an ornate front flap cut to the couple's shape (v24: seven, scalloped the default), 1.34× the screen
 *              wide, gold edge, a gold wax seal carrying the event's logo.
 *   GATEFOLD — two embossed panels (v24: the sculpted lilies or one of six designs pressed in code), closed with the couple's seal OR a satin ribbon and bow, never both (owner 23 Nov:
 *              *"ribbon and wax seal never co exist together"*). Sealed: the whole seal rides the left panel, which opens
 *              first. Tied: the bow comes undone and the ribbon slides off before the panels part.
 * The wax seal never breaks: it stays on the flap it was pressed on and goes where that paper goes.
 */
import * as THREE from 'three';
import { ss } from '@/lib/reveal-motion';
import { mulberry32 } from '@/lib/wax-seal/types';
import { CLOTH_TOP } from '@/lib/veil-cloth';
import type { RevealLooksFull } from '@/lib/std-reveal-effects';
import { Hinge, Strip, alphaBox, canvas, ctx2d, ease, lay, room, satinTex, shadowPlane, stamp, texOf, wideness, type Ctx, type Scene, BUMP } from './kit';

/* a normal map made from a painted canvas: its light-and-dark becomes real relief, and its cut edge a bevel */
function normalsOf(src: HTMLCanvasElement, strength: number): THREE.Texture {
  const w = Math.min(512, Math.round(src.width / 2));
  const h = Math.round((w * src.height) / src.width);
  const k = canvas(w, h);
  const x = ctx2d(k);
  x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h);
  const p = d.data;
  const hgt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hgt[i] = ((p[i * 4]! * 0.3 + p[i * 4 + 1]! * 0.59 + p[i * 4 + 2]! * 0.11) / 255) * (p[i * 4 + 3]! / 255);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const l = hgt[j * w + Math.max(0, i - 1)]!;
      const r = hgt[j * w + Math.min(w - 1, i + 1)]!;
      const u = hgt[Math.max(0, j - 1) * w + i]!;
      const dn = hgt[Math.min(h - 1, j + 1) * w + i]!;
      const nx = (l - r) * strength;
      const ny = (dn - u) * strength;
      const nl = Math.sqrt(nx * nx + ny * ny + 1);
      const o = (j * w + i) * 4;
      p[o] = ((nx / nl) * 0.5 + 0.5) * 255;
      p[o + 1] = ((ny / nl) * 0.5 + 0.5) * 255;
      p[o + 2] = ((1 / nl) * 0.5 + 0.5) * 255;
      p[o + 3] = 255;
    }
  x.putImageData(d, 0, 0);
  return texOf(k);
}

type Paint = (x: CanvasRenderingContext2D, cw: number, ch: number) => void;
type FlapOpts = {
  w: number;
  h: number;
  hinge: 'top' | 'bottom' | 'left' | 'right';
  x: number;
  y: number;
  z: number;
  at: number;
  spring: Hinge;
  relief?: number;
  nx?: number;
  ny?: number;
  liner?: number;
  /** 🖥 how many phone-widths the screen is (`wideness`): the canvas widens with the flap, so the art keeps its size */
  wide?: number;
  shape: Paint;
  paint: Paint;
  foil?: Paint;
};

/** A FLAP: a sheet cut to a shape, lit across its relief, that bends as it turns. */
class Flap {
  geo: THREE.PlaneGeometry;
  g = new THREE.Group();
  L: number;
  base: Float32Array;
  h: Hinge;
  at: number;
  pa = 0;
  tip: { d: number; z: number; th: number } | null = null;
  constructor(
    scene: THREE.Scene,
    public o: FlapOpts,
  ) {
    const cw = Math.min(2048, Math.round(512 * (o.wide ?? 1)));
    const ch = Math.round((cw * o.h) / o.w);
    const col = canvas(cw, ch);
    const cx = ctx2d(col);
    const msk = canvas(cw, ch);
    const mx = ctx2d(msk);
    const mr = canvas(cw, ch);
    const rx = ctx2d(mr);
    mx.fillStyle = '#000';
    mx.fillRect(0, 0, cw, ch);
    mx.fillStyle = '#fff';
    o.shape(mx, cw, ch);
    mx.fill();
    cx.save();
    o.shape(cx, cw, ch);
    cx.clip();
    o.paint(cx, cw, ch);
    cx.restore();
    rx.fillStyle = 'rgb(0,214,0)';
    rx.fillRect(0, 0, cw, ch);
    if (o.foil) {
      rx.strokeStyle = 'rgb(0,70,255)';
      rx.fillStyle = 'rgb(0,70,255)';
      o.foil(rx, cw, ch);
      cx.strokeStyle = '#c9a24e';
      cx.fillStyle = '#c9a24e';
      o.foil(cx, cw, ch);
    }
    const map = texOf(col, { srgb: true });
    const mask = texOf(msk);
    const geo = (this.geo = new THREE.PlaneGeometry(o.w, o.h, o.nx ?? 20, o.ny ?? 26));
    const rough = texOf(mr);
    const front = new THREE.MeshStandardMaterial({ map, alphaMap: mask, alphaTest: 0.5, normalMap: normalsOf(col, o.relief ?? 5), normalScale: new THREE.Vector2(1, 1), roughnessMap: rough, metalnessMap: rough, roughness: 1, metalness: 1, envMapIntensity: 0.55 });
    const back = new THREE.MeshStandardMaterial({ color: o.liner ?? 0xe7dcc6, alphaMap: mask, alphaTest: 0.5, roughness: 0.9, side: THREE.BackSide, envMapIntensity: 0.3 });
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: mask, alphaTest: 0.5, side: THREE.DoubleSide });
    for (const m of [front, back]) {
      const me = new THREE.Mesh(geo, m);
      me.castShadow = true;
      me.receiveShadow = true;
      me.customDepthMaterial = dm;
      me.frustumCulled = false;
      this.g.add(me);
    }
    this.g.position.set(o.x, o.y, o.z);
    scene.add(this.g);
    this.L = o.hinge === 'top' || o.hinge === 'bottom' ? o.h : o.w;
    this.base = Float32Array.from(geo.attributes.position!.array as Float32Array);
    this.h = o.spring;
    this.at = o.at;
  }
  /** every row of the sheet turns a little less than the row before it: the free edge trails, as paper does */
  set(a: number, curl: number): void {
    const o = this.o;
    const p = this.geo.attributes.position as THREE.BufferAttribute;
    const b = this.base;
    const L = this.L;
    const N = 24;
    const cy = [0];
    const cz = [0];
    for (let i = 1; i <= N; i++) {
      const s = (i - 0.5) / N;
      const th = a - curl * s * s;
      cy.push(cy[i - 1]! + (L / N) * Math.cos(th));
      cz.push(cz[i - 1]! + (L / N) * Math.sin(th));
    }
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3]!;
      const y = b[i * 3 + 1]!;
      const d = o.hinge === 'top' ? o.h / 2 - y : o.hinge === 'bottom' ? y + o.h / 2 : o.hinge === 'left' ? x + o.w / 2 : o.w / 2 - x;
      const f = Math.max(0, Math.min(1, d / L)) * N;
      const k = Math.min(N - 1, Math.floor(f));
      const u = f - k;
      const py = cy[k]! + (cy[k + 1]! - cy[k]!) * u;
      const pz = cz[k]! + (cz[k + 1]! - cz[k]!) * u;
      if (o.hinge === 'top') p.setXYZ(i, x, o.h / 2 - py, pz);
      else if (o.hinge === 'bottom') p.setXYZ(i, x, -o.h / 2 + py, pz);
      else if (o.hinge === 'left') p.setXYZ(i, -o.w / 2 + py, y, pz);
      else p.setXYZ(i, o.w / 2 - py, y, pz);
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.tip = { d: cy[N]!, z: cz[N]!, th: a - curl };
  }
  step(dt: number, tau: number): void {
    if (tau >= this.at) this.h.target = 3.0;
    else if (tau >= 0 && tau > this.at - 0.25) this.h.target = -0.03;
    const a = this.h.step(dt);
    const w = dt > 0 ? (a - this.pa) / dt : 0;
    this.pa = a;
    this.set(a, Math.max(-0.5, Math.min(0.9, w * 0.16 + Math.sin(a) * 0.12)));
  }
}

function sealBump(c: Ctx): THREE.Texture {
  const { logo } = c;
  const press = c.seal.recipe.press;
  const k = canvas(256, 256);
  const x = ctx2d(k);
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 256, 256);
  const g = x.createRadialGradient(128, 128, 20, 128, 128, 126);
  g.addColorStop(0, '#9a9a9a');
  g.addColorStop(0.72, '#8a8a8a');
  g.addColorStop(0.86, '#c8c8c8');
  g.addColorStop(1, '#5a5a5a');
  x.fillStyle = g;
  x.beginPath();
  x.arc(128, 128, 126, 0, 7);
  x.fill();
  x.strokeStyle = '#e8e8e8';
  x.lineWidth = 5;
  x.beginPath();
  x.arc(128, 128, 86, 0, 7);
  x.stroke();
  x.strokeStyle = '#3c3c3c';
  x.lineWidth = 3;
  x.beginPath();
  x.arc(128, 128, 78, 0, 7);
  x.stroke();
  /* 🔏 THE COUPLE'S OWN LOGO, PRESSED INTO THE WAX AND FITTED TO IT (owner 23 Nov: *"Seal needs to adapt to logo"*):
     cropped to its own ink and scaled so its box's corners touch the inner ring — a wide, a tall and a square logo
     each fill the face for their shape, never squeezed into a fixed square. The press is the couple's own: where the
     die landed (`offset`) and its slight tilt (`skew`), from the candle-stamp maker's recipe. White = raised. */
  const box = alphaBox(logo);
  if (box) {
    const f = 148 / Math.hypot(box.w, box.h);
    const w = box.w * f;
    const h = box.h * f;
    x.save();
    x.translate(128 + press.offset[0] * 5, 128 + press.offset[1] * 5);
    x.rotate(press.skew * 0.12);
    x.globalCompositeOperation = 'lighten';
    x.drawImage(logo, box.x, box.y, box.w, box.h, -w / 2, -h / 2, w, h);
    x.restore();
  }
  return texOf(k);
}

/**
 * A wax seal in two halves (it stays on the paper it was pressed on). 🔏 It is the COUPLE'S seal: its outline is their
 * pour (the recipe's seed and irregularity, as the candle-stamp maker pours it), its size their pour amount, its
 * depth their press, its sheen their finish, and its colour the wax they chose when they minted it — else the
 * drawing's gold. `vertical`: split down the middle (the gatefold's seam), else across (the classic's flap).
 */
function makeSeal(c: Ctx, size: number, vertical: boolean): THREE.Group[] {
  const { recipe, color } = c.seal;
  const R = size * (0.92 + recipe.pour.amount * 0.16);
  const rnd = mulberry32(recipe.seed);
  const ph1 = rnd() * Math.PI * 2;
  const ph2 = rnd() * Math.PI * 2;
  const irr = recipe.pour.irregularity;
  const wax = new THREE.MeshPhysicalMaterial({
    /* the couple's wax is a colour they picked on screen (sRGB); the scenes are built in linear numbers */
    color: color ? new THREE.Color(color).convertSRGBToLinear() : 0xb98a2c,
    metalness: color ? 0.3 : 0.82,
    roughness: recipe.wax.finish === 'glossy' ? 0.22 : 0.3,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
    bumpMap: sealBump(c),
    bumpScale: 0.045 * BUMP * (0.55 + 0.6 * recipe.press.depth),
    side: THREE.DoubleSide,
    envMapIntensity: 1.1,
  });
  const halves: THREE.Group[] = [];
  for (const hf of [0, 1]) {
    const prof = [new THREE.Vector2(0, 0.085)];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      prof.push(new THREE.Vector2(R * 0.8 + Math.sin(a) * R * 0.16, Math.cos(a) * 0.085));
    }
    prof.push(new THREE.Vector2(R, 0));
    const geo = new THREE.LatheGeometry(prof, 36, hf * Math.PI - (vertical ? 0 : Math.PI / 2), Math.PI);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      const an = Math.atan2(z, x);
      const wob = r > R * 0.66 ? 1 + irr * (0.18 * Math.sin(an * 5 + ph1) + 0.1 * Math.sin(an * 11 + ph2)) : 1;
      p.setX(i, x * wob);
      p.setZ(i, z * wob);
      uv.setXY(i, (x * wob) / (R * 2.05) + 0.5, 0.5 - (z * wob) / (R * 2.05));
    }
    geo.computeVertexNormals();
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, wax);
    mesh.castShadow = true;
    const g = new THREE.Group();
    g.add(mesh);
    c.scene.add(g);
    halves.push(g);
  }
  return halves;
}

/** 🖼 The classic's front flap is this many times the width of the screen (drawing v24 `BL`): its shoulders and upright
 *  sides are never in view, so no shape ever shows a vertical cut. */
export const FLAP_BL = 1.34;

/** How far the wax stands off its paper, along the paper's own face (the classic's flap). */
const SEAL_LIFT = 0.07;
/** The gatefold's seal: how far it stands off the left panel, along that panel's face (drawing v22). */
const SEAL_OFF = 0.02;

/** What is inside: its lining, and a warm light that pours out as the flaps part, then clears to the card. */
class Inside {
  inner: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  lamp: THREE.PointLight;
  constructor(c: Ctx, cy: number) {
    const k = canvas(128, 222);
    const x = ctx2d(k);
    const g = x.createRadialGradient(64, 111, 6, 64, 111, 130);
    g.addColorStop(0, '#e6cf9c');
    g.addColorStop(0.5, '#c9ac6e');
    g.addColorStop(1, '#8f7440');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 222);
    this.inner = new THREE.Mesh(new THREE.PlaneGeometry(c.W * 1.04, c.H * 1.04), new THREE.MeshBasicMaterial({ map: texOf(k, { srgb: true }), transparent: true }));
    this.inner.position.z = -0.05;
    this.inner.visible = false;
    c.scene.add(this.inner);
    const gc = canvas(128, 128);
    const gx = ctx2d(gc);
    const gg = gx.createRadialGradient(64, 64, 2, 64, 64, 64);
    gg.addColorStop(0, 'rgba(255,246,214,1)');
    gg.addColorStop(0.35, 'rgba(255,214,140,.7)');
    gg.addColorStop(1, 'rgba(255,190,90,0)');
    gx.fillStyle = gg;
    gx.fillRect(0, 0, 128, 128);
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(c.W * 1.5, c.W * 1.5), new THREE.MeshBasicMaterial({ map: texOf(gc), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.glow.position.set(0, cy, -0.03);
    c.scene.add(this.glow);
    this.lamp = new THREE.PointLight(0xffd9a0, 0, 7, 0);
    this.lamp.position.set(0, cy, 0.5);
    c.scene.add(this.lamp);
  }
  step(open: number, x: number): void {
    const o = Math.max(0, Math.min(1, open));
    this.glow.material.opacity = Math.min(0.55, o * 0.9) * (1 - ss(0.55, 0.95, x));
    this.glow.scale.setScalar(0.5 + o * 1.6);
    this.lamp.intensity = 1.3 * Math.PI * o * (1 - ss(0.55, 0.95, x));
    this.inner.material.opacity = 1 - ss(0.76, 0.84, x);
  }
}

/** The envelopes' stage: a room to mirror, a warm key light with a soft shadow, a cool fill. */
function stage(c: Ctx): void {
  c.scene.environment = room(c);
  c.scene.add(new THREE.AmbientLight(0xfff1dc, 0.28 * Math.PI));
  const k = new THREE.DirectionalLight(0xfff4e2, 1.25 * Math.PI);
  k.position.set(-2.6, 3.8, 5.2);
  k.castShadow = true;
  k.shadow.mapSize.set(2048, 2048);
  const sc = k.shadow.camera;
  sc.left = -3;
  sc.right = 3;
  sc.top = 4;
  sc.bottom = -4;
  sc.near = 1;
  sc.far = 20;
  k.shadow.bias = -0.0012;
  k.shadow.normalBias = 0.02;
  k.shadow.radius = 6;
  c.scene.add(k);
  const f = new THREE.DirectionalLight(0xdfe6ff, 0.22 * Math.PI);
  f.position.set(3, -1, 4);
  c.scene.add(f);
  shadowPlane(c, -0.03, 0.5);
}

/** 3a · ENVELOPE, CLASSIC */
export const envelopeClassic = (): Scene => {
  let c: Ctx;
  const flaps: Flap[] = [];
  let seal: THREE.Group[] = [];
  let inside: Inside;
  const T = 6.6;
  return {
    /* 🖼 the envelope is larger than the screen: it reaches 12 % past every edge, as the cloth does, so neither the body
       nor the flap ever shows a vertical edge (owner 23 Nov: *"the upper part must not cut vertically"*) */
    bleed: CLOTH_TOP,
    legacyT: T,
    pbr: true,
    exposure: 1.05,
    async init(cx) {
      c = cx;
      const { W, H, HW, HH, scene: s } = c;
      const TY = HH - H * 0.56;
      const YS = HH - H * 0.27;
      stage(c);
      const [paper, dam] = await Promise.all([c.art('paper'), c.art('damask')]);
      /* 🖥 on a wide screen every flap is a wider sheet of the same paper: `pw` is a flap's width on the phone */
      const wide = wideness(c.px);
      const plain: Paint = (x, cw, ch) => {
        const pw = cw / wide;
        lay(x, paper, [130, 130, 330, 300], cw, { dy: 0, dw: pw, dh: ch, step: pw, anchor: 'center' });
        x.fillStyle = 'rgba(255,250,240,.18)';
        x.fillRect(0, 0, cw, ch);
      };
      const hb = TY + HH;
      /* bottom flap: from the foot up to the seal */
      flaps.push(
        new Flap(s, {
          w: W,
          h: hb,
          hinge: 'bottom',
          x: 0,
          y: -HH + hb / 2,
          z: 0,
          at: 4.4,
          spring: new Hinge(4.6, 3.3),
          relief: 3,
          wide,
          shape: (x, cw, ch) => {
            x.beginPath();
            x.moveTo(0, ch);
            x.lineTo(cw, ch);
            x.lineTo(cw / 2, 0);
            x.closePath();
          },
          paint: (x, cw, ch) => {
            plain(x, cw, ch);
            x.fillStyle = '#a8843a';
            x.textAlign = 'center';
            x.font = `500 ${Math.round((cw / wide) * 0.075)}px Georgia, serif`;
            x.fillText('Tap to open', cw / 2, ch * 0.5);
          },
          foil: (x, cw, ch) => {
            x.lineWidth = 3;
            x.beginPath();
            x.moveTo(4, ch - 2);
            x.lineTo(cw / 2, 5);
            x.lineTo(cw - 4, ch - 2);
            x.stroke();
            x.lineWidth = 2;
            const y = ch * 0.6;
            x.beginPath();
            const pw = cw / wide;
            x.moveTo(cw / 2 - pw * 0.2, y);
            x.lineTo(cw / 2 - pw * 0.045, y);
            x.moveTo(cw / 2 + pw * 0.045, y);
            x.lineTo(cw / 2 + pw * 0.2, y);
            x.stroke();
            x.beginPath();
            x.moveTo(cw / 2, y - 14);
            x.lineTo(cw / 2 + 13, y);
            x.lineTo(cw / 2, y + 14);
            x.lineTo(cw / 2 - 13, y);
            x.closePath();
            x.stroke();
          },
        }),
      );
      /* the side flaps, meeting under the seal */
      for (const side of [-1, 1]) {
        flaps.push(
          new Flap(s, {
            w: HW,
            h: H,
            hinge: side < 0 ? 'left' : 'right',
            x: (side * HW) / 2,
            y: 0,
            z: side < 0 ? 0.014 : 0.028,
            at: side < 0 ? 3.0 : 3.7,
            spring: new Hinge(4.6, 3.3),
            relief: 3,
            wide,
            shape: (x, cw, ch) => {
              const ty = ((HH - TY) / H) * ch;
              x.beginPath();
              if (side < 0) {
                x.moveTo(0, 0);
                x.lineTo(cw, ty);
                x.lineTo(0, ch);
              } else {
                x.moveTo(cw, 0);
                x.lineTo(0, ty);
                x.lineTo(cw, ch);
              }
              x.closePath();
            },
            paint: plain,
            foil: (x, cw, ch) => {
              const ty = ((HH - TY) / H) * ch;
              x.lineWidth = 2;
              x.beginPath();
              if (side < 0) {
                x.moveTo(2, 2);
                x.lineTo(cw - 3, ty);
                x.lineTo(2, ch - 2);
              } else {
                x.moveTo(cw - 2, 2);
                x.lineTo(3, ty);
                x.lineTo(cw - 2, ch - 2);
              }
              x.stroke();
            },
          }),
        );
      }
      /* the front flap: cut to the couple's shape (drawing v24 `flap`), embossed, edged in gold. It is BL times the width
         of the screen, so its shoulders and upright sides are never in view: only its lower edge crosses the screen, and
         the envelope reads as larger than the screen (owner 23 Nov: *"We want the illusion that it is larger than the
         screen"*). Its art is drawn at its old size. */
      const ht = HH - TY;
      const shape = c.looks.flap;
      /** a phone's share of the flap's canvas (the flap is `wide` phones and BL screens across) */
      const phoneOf = (cw: number) => cw / wide;
      const scallop = (x: CanvasRenderingContext2D, cw: number, ch: number, inset: number, per: number, bg: number) => {
        const y0 = ((HH - YS) / ht) * ch;
        /* the scallops keep their shape on a wide screen: more of them, not wider ones */
        const n = Math.max(per, Math.round(per * wide));
        const pw = phoneOf(cw);
        x.beginPath();
        x.moveTo(inset, 0);
        x.lineTo(inset, y0 - inset);
        for (let i = 1; i <= n; i++) {
          const ax = inset + ((cw / 2 - inset) * (i - 1)) / n;
          const ay = y0 + ((ch - y0) * (i - 1)) / n - inset;
          const bx = inset + ((cw / 2 - inset) * i) / n;
          const by = y0 + ((ch - y0) * i) / n - inset;
          x.quadraticCurveTo((ax + bx) / 2 - pw * 0.035, (ay + by) / 2 + ch * bg, bx, by);
        }
        for (let i = n; i >= 1; i--) {
          const ax = cw - (inset + ((cw / 2 - inset) * i) / n);
          const ay = y0 + ((ch - y0) * i) / n - inset;
          const bx = cw - (inset + ((cw / 2 - inset) * (i - 1)) / n);
          const by = y0 + ((ch - y0) * (i - 1)) / n - inset;
          x.quadraticCurveTo((ax + bx) / 2 + pw * 0.035, (ay + by) / 2 + ch * bg, bx, by);
        }
        x.lineTo(cw - inset, 0);
        x.closePath();
      };
      /* the deckle's torn edge: the same bite at every place along it, every time it is drawn */
      const hsh = (i: number, j: number) => {
        const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
        return h - Math.floor(h);
      };
      const outline = (x: CanvasRenderingContext2D, cw: number, ch: number, inset: number) => {
        const y0 = ((HH - YS) / ht) * ch;
        const m = cw / 2;
        const b = ch - inset;
        if (shape === 'scallop') return scallop(x, cw, ch, inset, 3, 0.075);
        if (shape === 'double') return scallop(x, cw, ch, inset, 2, 0.13);
        x.beginPath();
        x.moveTo(inset, 0);
        if (shape === 'deepv') {
          x.lineTo(inset, y0 * 0.25);
          x.lineTo(m, b);
          x.lineTo(cw - inset, y0 * 0.25);
        } else if (shape === 'euro') {
          x.lineTo(inset, y0 * 0.55);
          x.quadraticCurveTo(cw * 0.34, ch * 0.8, m, b);
          x.quadraticCurveTo(cw * 0.66, ch * 0.8, cw - inset, y0 * 0.55);
        } else if (shape === 'round') {
          const cy2 = y0 * 0.8 + (b - y0 * 0.8) / 0.75;
          x.lineTo(inset, y0 * 0.8);
          x.bezierCurveTo(cw * 0.16, cy2, cw * 0.84, cy2, cw - inset, y0 * 0.8);
        } else if (shape === 'square') {
          const rr = ch * 0.05;
          x.lineTo(inset, b - rr);
          x.quadraticCurveTo(inset, b, inset + rr, b);
          x.lineTo(cw - inset - rr, b);
          x.quadraticCurveTo(cw - inset, b, cw - inset, b - rr);
        } else {
          /* deckle: torn by hand, the bites as small on a wide screen as on the phone */
          const n2 = Math.round(54 * wide);
          const ys = y0 * 0.6;
          x.lineTo(inset, ys);
          for (let i = 1; i <= n2; i++) {
            const u = i / n2;
            x.lineTo(inset + (m - inset) * u, ys + (b - ys) * Math.pow(u, 1.12) + (i < n2 ? (hsh(i, 3) - 0.5) * ch * 0.024 : 0));
          }
          for (let i = n2 - 1; i >= 0; i--) {
            const u = i / n2;
            x.lineTo(cw - inset - (m - inset) * u, ys + (b - ys) * Math.pow(u, 1.12) + (i ? (hsh(i, 7) - 0.5) * ch * 0.024 : 0));
          }
        }
        x.lineTo(cw - inset, 0);
        x.closePath();
      };
      flaps.push(
        new Flap(s, {
          w: W * FLAP_BL,
          h: ht,
          hinge: 'top',
          x: 0,
          y: HH - ht / 2,
          z: 0.045,
          at: 0.9,
          spring: new Hinge(2.6, 2.6),
          relief: 7,
          nx: 24,
          ny: 30,
          wide: wide * FLAP_BL,
          shape: (x, cw, ch) => outline(x, cw, ch, 0),
          paint: (x, cw, ch) => {
            /* the paper across the whole flap, as the drawing lays it; the damask at its old size: one phone screen is
               `cw / wide / BL` of this wider sheet */
            const bw = phoneOf(cw);
            const pw = bw / FLAP_BL;
            lay(x, paper, [130, 130, 330, 300], cw, { dy: 0, dw: bw, dh: ch, step: bw, anchor: 'center' });
            x.fillStyle = 'rgba(255,250,240,.18)';
            x.fillRect(0, 0, cw, ch);
            x.globalCompositeOperation = 'multiply';
            /* the drawing's one panel on the phone; on a wide screen the panels meet edge to edge, mirrored */
            lay(x, dam, [40, 76, 480, 500], cw, { dy: ch * 0.02, dw: pw * 0.92, dh: ch * 0.9, step: wide > 1 ? pw * 0.92 : pw, anchor: 'center' });
            x.globalCompositeOperation = 'source-over';
          },
          foil: (x, cw, ch) => {
            x.lineWidth = 5;
            outline(x, cw, ch, 5);
            x.stroke();
            x.lineWidth = 1.6;
            outline(x, cw, ch, 15);
            x.stroke();
          },
        }),
      );
      for (const f of flaps) f.set(0, 0);
      seal = makeSeal(c, 0.5, false);
      inside = new Inside(c, TY);
    },
    step(dt, _t, tau) {
      const { H, HH } = c;
      let top: Flap | null = null;
      for (const f of flaps) {
        f.step(dt, tau);
        if (f.o.hinge === 'top') top = f;
      }
      if (top?.tip) {
        /* the seal stays on the flap's point and rises with it. It sits ON the paper: its offsets run along the flap's
           own surface (0.03 in from the point, 0.07 off the face), never along the screen — so once the flap passes
           upright the wax turns away behind it, and never floats over the flap's lining (owner 23 Nov: *"envelope
           wax seal overlapped when opening"*) */
        const tp = top.tip;
        const sn = Math.sin(tp.th);
        const cs = Math.cos(tp.th);
        const y = HH - tp.d + 0.03 * cs + SEAL_LIFT * sn;
        const z = 0.045 + tp.z - 0.03 * sn + SEAL_LIFT * cs;
        for (const h of seal) {
          h.position.set(0, y, z);
          h.rotation.x = -tp.th;
        }
      } else for (const h of seal) h.position.set(0, HH - H * 0.56 + 0.03, 0.045 + SEAL_LIFT);
      inside.step(top ? top.h.a / 2.2 : 0, tau < 0 ? 0 : tau / T);
    },
  };
};

/* ── the satin ribbon (drawing `src/ribbon.js`) ───────────────────────────── */

type Twist = (s: number, t: number) => number;
/** A satin band with width in space: it turns over as it twists, cups slightly across, and throws a shadow. */
class RibbonMesh {
  M = 4;
  pos: Float32Array;
  geo = new THREE.BufferGeometry();
  mesh: THREE.Mesh;
  constructor(
    public s: Strip,
    public w: number,
    mat: THREE.Material,
    public twist: Twist = () => 0,
    public camber = 0.009,
  ) {
    const n = s.n;
    const M = this.M;
    const idx: number[] = [];
    const uv = new Float32Array(n * (M + 1) * 2);
    for (let i = 0; i < n; i++)
      for (let j = 0; j <= M; j++) {
        uv[(i * (M + 1) + j) * 2] = j / M;
        uv[(i * (M + 1) + j) * 2 + 1] = i / (n - 1);
        if (i < n - 1 && j < M) {
          const a = i * (M + 1) + j;
          idx.push(a, a + 1, a + M + 1, a + 1, a + M + 2, a + M + 1);
        }
      }
    this.pos = new Float32Array(n * (M + 1) * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.update(0);
  }
  update(t: number): void {
    const p = this.s.p;
    const n = this.s.n;
    const M = this.M;
    const v = this.pos;
    const hw = this.w / 2;
    const cb = this.camber;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1) * 3;
      const b = Math.min(n - 1, i + 1) * 3;
      let tx = p[b]! - p[a]!;
      let ty = p[b + 1]! - p[a + 1]!;
      let tz = p[b + 2]! - p[a + 2]!;
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1e-6;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      let nx = -tx * tz;
      let ny = -ty * tz;
      let nz = 1 - tz * tz;
      let nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (nl < 1e-3) {
        nx = 0;
        ny = 1;
        nz = 0;
        nl = 1;
      }
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;
      const ph = this.twist(i / (n - 1), t);
      const co = Math.cos(ph);
      const si = Math.sin(ph);
      const wx = bx * co + nx * si;
      const wy = by * co + ny * si;
      const wz = bz * co + nz * si;
      const ux = nx * co - bx * si;
      const uy = ny * co - by * si;
      const uz = nz * co - bz * si;
      const k = i * 3;
      for (let j = 0; j <= M; j++) {
        const u = (j / M) * 2 - 1;
        const q = (i * (M + 1) + j) * 3;
        const cu = cb * (1 - u * u);
        v[q] = p[k]! + wx * u * hw + ux * cu;
        v[q + 1] = p[k + 1]! + wy * u * hw + uy * cu;
        v[q + 2] = p[k + 2]! + wz * u * hw + uz * cu;
      }
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

/**
 * The bow across the gatefold's seam and the way it comes undone (the owner's reference): one tail is drawn, the bow
 * COLLAPSES (its loops pass through the knot), one strand is left across the seam; it is drawn out sideways and
 * slides off with a flutter and a twist; only then do the panels part.
 */
class GateRibbon {
  mat: THREE.MeshStandardMaterial;
  parts: Record<string, { st: Strip; rm: RibbonMesh }> = {};
  swapped = false;
  gone = false;
  knot: THREE.Mesh;
  sR: { st: Strip; rm: RibbonMesh } | null = null;
  t0 = 0;
  tw = 0;
  u = 0;
  constructor(
    private c: Ctx,
    private y: number,
    private kx: number,
    private z: number,
  ) {
    const { HW, scene } = c;
    this.mat = new THREE.MeshStandardMaterial({ map: satinTex('#8a4a5e', '#bd7487', '#cf8c9c'), side: THREE.DoubleSide, roughness: 0.24, metalness: 0.16, envMapIntensity: 1.9 });
    const mk = (name: string, pts: number[][], w: number, tw?: Twist) => {
      const st = new Strip(pts);
      st.base = Float32Array.from(st.rest);
      const rm = new RibbonMesh(st, w, this.mat, tw);
      scene.add(rm.mesh);
      this.parts[name] = { st, rm };
      return st;
    };
    const wd = 0.3;
    let pts: number[][] = [];
    for (let i = 0; i <= 11; i++) pts.push([-HW - 0.3 + ((kx + HW + 0.3) * i) / 11, y, z]);
    const bl = mk('bandL', pts, wd);
    bl.hold(0, -HW - 0.3, y, z);
    bl.hold(11, kx, y, z);
    pts = [];
    for (let i = 0; i <= 17; i++) pts.push([kx + ((HW + 0.3 - kx) * i) / 17, y, z]);
    const br = mk('bandR', pts, wd);
    br.hold(0, kx, y, z);
    br.hold(17, HW + 0.3, y, z);
    const arc = (sg: number) => {
      const o: number[][] = [];
      const n = 20;
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * Math.PI * 2;
        const r = 0.5;
        o.push([kx + sg * Math.sin(a / 2) * r * 1.45, y + Math.sin(a) * r * 0.44 - Math.sin(a / 2) * 0.1, z + 0.03 + Math.sin(a / 2) * 0.16]);
      }
      return o;
    };
    for (const S2 of ['L', 'R']) {
      const sg = S2 === 'L' ? -1 : 1;
      const lp = mk('loop' + S2, arc(sg), wd, (s) => Math.PI * s * sg);
      lp.hold(0, kx, y, z + 0.03);
      lp.hold(lp.n - 1, kx, y, z + 0.03);
      lp.stiff = 0.5;
      const tp: number[][] = [];
      for (let k = 0; k <= 18; k++) tp.push([kx + sg * (k * 0.03 + 0.1 * Math.sin(k * 0.34)), y - k * 0.125, z + 0.02 + 0.03 * Math.sin(k * 0.5)]);
      const tl = mk('tail' + S2, tp, wd, (s, t) => (0.55 * Math.sin(s * 2.6 + sg) + 0.12 * Math.sin(t * 0.5 + s * 3)) * s);
      tl.hold(0, kx, y, z + 0.02);
      tl.stiff = 0.028;
      tl.damp = 0.975;
      tl.fl = 0.1;
    }
    this.knot = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 12), this.mat);
    this.knot.scale.set(1.25, 1, 0.7);
    this.knot.position.set(kx, y, z + 0.07);
    this.knot.castShadow = true;
    scene.add(this.knot);
  }
  step(dt: number, t: number, tau: number): void {
    const P = this.parts;
    const { kx, y, z } = this;
    const { HW } = this.c;
    if (this.gone) return;
    if (!this.swapped) {
      if (tau >= 0) {
        const a = ease(tau / 0.9);
        const b = ease((tau - 0.5) / 0.8);
        const cc = ease((tau - 1.2) / 0.7);
        P.loopL!.st.scaleRest(P.loopL!.st.base!, 1 - 0.95 * a);
        P.loopL!.st.shrink = 1 - 0.95 * a;
        P.loopR!.st.scaleRest(P.loopR!.st.base!, 1 - 0.95 * b);
        P.loopR!.st.shrink = 1 - 0.95 * b;
        P.loopL!.rm.mesh.visible = a < 0.97;
        P.loopR!.rm.mesh.visible = b < 0.97;
        const e = P.tailR!.st.n - 1;
        P.tailR!.st.scaleRest(P.tailR!.st.base!, 1 - 0.93 * cc);
        if (a > 0 && cc < 0.05) P.tailR!.st.hold(e, kx + 0.62 + a * 0.12, y - 2.22 - a * 0.04, z + 0.08);
        else P.tailR!.st.free(e);
        P.tailR!.rm.mesh.visible = cc < 0.97;
        const ks = 1 - cc * 0.98;
        this.knot.scale.set(1.25 * ks + 0.001, ks + 0.001, 0.7 * ks + 0.001);
      }
      for (const [name, part] of Object.entries(P)) {
        const tail = name.startsWith('tail');
        part.st.step(dt, 0, tail ? -6 : name.startsWith('loop') ? -1.2 : 0, 0, tail ? t : null);
        part.rm.update(t);
      }
      if (tau >= 1.95) {
        /* one strand is left: the tail that hangs, and the band to the right */
        this.swapped = true;
        this.knot.visible = false;
        const tl = P.tailL!.st;
        const br = P.bandR!.st;
        const pts: number[][] = [];
        for (let i = tl.n - 1; i >= 1; i--) pts.push([tl.p[i * 3]!, tl.p[i * 3 + 1]!, tl.p[i * 3 + 2]!]);
        for (let i = 0; i < br.n; i++) pts.push([br.p[i * 3]!, br.p[i * 3 + 1]!, br.p[i * 3 + 2]!]);
        const sr = new Strip(pts);
        sr.damp = 0.99;
        this.sR = { st: sr, rm: new RibbonMesh(sr, 0.3, this.mat, (s) => this.tw * Math.sin(s * 6.5 - this.u * 5) + this.u * 1.6 * (1 - s)) };
        this.c.scene.add(this.sR.rm.mesh);
        for (const k of ['tailL', 'tailR', 'bandR', 'loopL', 'loopR']) P[k]!.rm.mesh.visible = false;
        P.bandL!.st.free(11);
        P.bandL!.st.damp = 0.99;
        this.t0 = tau;
        this.tw = 0;
        this.u = 0;
      }
      return;
    }
    const u = (this.u = tau - this.t0);
    const sr = this.sR!.st;
    const e2 = sr.n - 1;
    this.tw = Math.min(1.25, u * 1.6);
    /* drawn out to the right, faster as it goes */
    sr.hold(e2, HW + 0.3 + 4.6 * u * u + 0.9 * u, y - 0.55 * u * u, z + 0.12);
    sr.step(dt, 0, -2.6, 0, t);
    this.sR!.rm.update(t);
    const bl = P.bandL!.st;
    bl.hold(0, -HW - 0.3 - 3.6 * u * u - 0.4 * u, y - 0.3 * u * u, z);
    bl.step(dt, 0, -2.2, 0, t);
    P.bandL!.rm.update(t);
    if (u > 2.2) {
      this.gone = true;
      this.sR!.rm.mesh.visible = false;
      P.bandL!.rm.mesh.visible = false;
    }
  }
}

/* ── the gatefold's panel designs, drawn in code (drawing v24 `PROC` + `press`) ─────────────────────────────────
   Each is drawn across BOTH panels (FW = the whole envelope on the phone), then pressed into the paper: a shadow below
   and to the right, a highlight above and to the left, so the relief map reads it as embossed. */

type Ink = CanvasRenderingContext2D;
const hs2 = (i: number, j: number) => {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h);
};
function press(x: Ink, fn: (x: Ink) => void): void {
  x.save();
  x.lineCap = 'round';
  x.lineJoin = 'round';
  for (const [dx, dy, col] of [
    [3, 3.4, 'rgba(62,44,20,.72)'],
    [-2.2, -2.6, 'rgba(255,255,255,.95)'],
    [0, 0, 'rgba(150,120,74,.7)'],
  ] as const) {
    x.save();
    x.translate(dx, dy);
    x.strokeStyle = col;
    x.fillStyle = col;
    fn(x);
    x.restore();
  }
  x.restore();
}
function leaf(x: Ink, px: number, py: number, an: number, L: number): void {
  x.save();
  x.translate(px, py);
  x.rotate(an);
  x.beginPath();
  x.moveTo(0, 0);
  x.quadraticCurveTo(L * 0.5, -L * 0.28, L, 0);
  x.quadraticCurveTo(L * 0.5, L * 0.28, 0, 0);
  x.moveTo(0, 0);
  x.lineTo(L * 0.9, 0);
  x.stroke();
  x.restore();
}
function bloomAt(x: Ink, px: number, py: number, R: number, rot: number, np: number): void {
  x.save();
  x.translate(px, py);
  x.rotate(rot);
  for (let k = 0; k < np; k++) {
    x.rotate(6.283 / np);
    x.beginPath();
    x.moveTo(0, 0);
    x.bezierCurveTo(R * 0.5, -R * 0.25, R * 0.95, -R * 0.3, R, 0);
    x.bezierCurveTo(R * 0.95, R * 0.3, R * 0.5, R * 0.25, 0, 0);
    x.stroke();
  }
  x.beginPath();
  x.arc(0, 0, R * 0.16, 0, 7);
  x.fill();
  x.restore();
}
const PANEL: Record<Exclude<RevealLooksFull['panel'], 'lily' | 'monogram'>, (x: Ink, FW: number, FH: number) => void> = {
  deco(x, FW, FH) {
    const cx = FW / 2;
    const cy = FH * 0.42;
    x.lineWidth = 4;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * 6.283;
      const r0 = FW * (i % 2 ? 0.3 : 0.22);
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      x.lineTo(cx + Math.cos(a) * FH, cy + Math.sin(a) * FH);
      x.stroke();
    }
    for (const r of [0.13, 0.17, 0.22]) {
      x.beginPath();
      x.arc(cx, cy, FW * r, 0, 7);
      x.stroke();
    }
    x.lineWidth = 6;
    for (const [ox, oy, sx, sy] of [
      [0, 0, 1, 1],
      [FW, 0, -1, 1],
      [0, FH, 1, -1],
      [FW, FH, -1, -1],
    ] as const) {
      for (let k = 1; k <= 3; k++) {
        const d = 40 + k * 34;
        x.beginPath();
        x.moveTo(ox + sx * d, oy + sy * (d + 150));
        x.lineTo(ox + sx * d, oy + sy * d);
        x.lineTo(ox + sx * (d + 150), oy + sy * d);
        x.stroke();
      }
    }
  },
  geo(x, FW, FH) {
    const sp = FW / 5;
    x.lineWidth = 3;
    for (let i = -14; i < 14; i++)
      for (let o = 0; o < 2; o++) {
        x.beginPath();
        x.moveTo(i * sp + o * 9, 0);
        x.lineTo(i * sp + o * 9 + FH * 0.58, FH);
        x.stroke();
        x.beginPath();
        x.moveTo(i * sp - o * 9, 0);
        x.lineTo(i * sp - o * 9 - FH * 0.58, FH);
        x.stroke();
      }
  },
  botanical(x, FW, FH) {
    x.lineWidth = 3.5;
    for (const sg of [-1, 1])
      for (const st of [
        [0.05, 0.34, 0.3, 0.04, 1],
        [0.12, 0.2, 0.42, 0.46, 0.62],
      ] as const) {
        const p0 = [FW / 2 + sg * FW * st[0], FH];
        const p1 = [FW / 2 + sg * FW * st[1], FH * 0.72];
        const p2 = [FW / 2 + sg * FW * st[2] * 0.5, FH * (st[3] + 0.3)];
        const p3 = [FW / 2 + sg * FW * st[2], FH * st[3]];
        const n = 13;
        x.beginPath();
        x.moveTo(p0[0]!, p0[1]!);
        x.bezierCurveTo(p1[0]!, p1[1]!, p2[0]!, p2[1]!, p3[0]!, p3[1]!);
        x.stroke();
        for (let t = 1; t <= n; t++) {
          const u = t / (n + 0.5);
          const v = 1 - u;
          const at = (k: 0 | 1) => v * v * v * p0[k]! + 3 * v * v * u * p1[k]! + 3 * v * u * u * p2[k]! + u * u * u * p3[k]!;
          const tan = (k: 0 | 1) => 3 * v * v * (p1[k]! - p0[k]!) + 6 * v * u * (p2[k]! - p1[k]!) + 3 * u * u * (p3[k]! - p2[k]!);
          leaf(x, at(0), at(1), Math.atan2(tan(1), tan(0)) + (t % 2 ? 1 : -1) * 0.85, FW * 0.15 * st[4] * (1.05 - u * 0.5));
        }
      }
  },
  lace(x, FW, FH) {
    const R = FW / 16;
    const cx = FW / 2;
    const cy = FH * 0.42;
    x.lineWidth = 3;
    for (let i = 0; i * R * 2 < FH + R; i++)
      for (const ex of [0, FW]) {
        x.beginPath();
        x.arc(ex, i * R * 2, R * 1.9, 0, 7);
        x.stroke();
        x.beginPath();
        x.arc(ex, i * R * 2, R * 1.1, 0, 7);
        x.stroke();
      }
    for (let i = 0; i * R * 2 < FW + R; i++)
      for (const ey of [0, FH]) {
        x.beginPath();
        x.arc(i * R * 2, ey, R * 1.9, 0, 7);
        x.stroke();
      }
    for (const [rr, cnt] of [
      [0.34, 18],
      [0.24, 14],
      [0.14, 10],
    ] as const) {
      for (let k = 0; k < cnt; k++) {
        const a = (k / cnt) * 6.283;
        x.save();
        x.translate(cx + Math.cos(a) * FW * rr, cy + Math.sin(a) * FW * rr);
        x.rotate(a);
        x.beginPath();
        x.ellipse(0, 0, FW * 0.05, FW * 0.028, 0, 0, 7);
        x.stroke();
        x.restore();
      }
      x.beginPath();
      x.arc(cx, cy, FW * (rr - 0.055), 0, 7);
      x.stroke();
    }
    for (let i = 0; i < 46; i++)
      for (let k = 0; k < 70; k++) {
        const px = (i + (k % 2) * 0.5) * 24;
        const py = k * 26;
        if (Math.hypot(px - cx, py - cy) > FW * 0.41 && px > R * 2.4 && px < FW - R * 2.4 && py > R * 2.4 && py < FH - R * 2.4) {
          x.beginPath();
          x.arc(px, py, 2.4, 0, 7);
          x.fill();
        }
      }
  },
  pressed(x, FW, FH) {
    x.lineWidth = 2.8;
    for (let i = 0; i < 30; i++) bloomAt(x, hs2(i, 1) * FW, hs2(i, 2) * FH, FW * (0.045 + hs2(i, 3) * 0.06), hs2(i, 4) * 6.283, 5 + Math.floor(hs2(i, 5) * 3));
    for (let i = 0; i < 22; i++) {
      const px = hs2(i, 11) * FW;
      const py = hs2(i, 12) * FH;
      const an = hs2(i, 13) * 6.283;
      const L = FW * 0.12;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + Math.cos(an) * L, py + Math.sin(an) * L);
      x.stroke();
      for (let k = 1; k <= 3; k++) {
        const qx = px + (Math.cos(an) * L * k) / 3.4;
        const qy = py + (Math.sin(an) * L * k) / 3.4;
        leaf(x, qx, qy, an + 0.8, L * 0.34);
        leaf(x, qx, qy, an - 0.8, L * 0.34);
      }
    }
  },
};
/** The event's own monogram in a half-drop field, each one pressed (drawing v24 `PROC.monogram`). */
function monogramField(x: Ink, FW: number, FH: number, logo: HTMLCanvasElement): void {
  const st = FW / 3.2;
  for (let r = -1; r * st * 0.9 < FH + st; r++)
    for (let col = -1; col < 5; col++) {
      const px = col * st + (r % 2 ? st / 2 : 0) + st * 0.3;
      const py = r * st * 0.9 + st * 0.4;
      const sz = st * 0.5;
      stamp(x, logo, px + 2.5, py + 3, sz, '#46341a', 0.5);
      stamp(x, logo, px - 2, py - 2.4, sz, '#ffffff', 0.9);
      stamp(x, logo, px, py, sz, '#b3935a', 0.6);
    }
  press(x, (x2) => {
    for (let r = -1; r * st * 0.9 < FH + st; r++)
      for (let col = -1; col < 5; col++) {
        x2.beginPath();
        x2.arc(col * st + (r % 2 ? 0 : st / 2) + st * 0.3, r * st * 0.9 + st * 0.4, 4, 0, 7);
        x2.fill();
      }
  });
}
/**
 * Both panels of a code-drawn design, at the phone's size: the paper on each panel (as the drawing draws it), then the
 * design across the pair. Each panel then lays its own half of this outward from the seam, as the lilies are laid.
 */
function panelArt(paper: HTMLImageElement, design: Exclude<RevealLooksFull['panel'], 'lily'>, ch: number, logo: HTMLCanvasElement): HTMLCanvasElement {
  const pw = 512;
  const k = canvas(pw * 2, ch);
  const x = ctx2d(k);
  for (const side of [0, 1]) x.drawImage(paper, 130, 130, 330, 300, side * pw, 0, pw, ch);
  if (design === 'monogram') monogramField(x, pw * 2, ch, logo);
  else press(x, (x2) => PANEL[design](x2, pw * 2, ch));
  return k;
}

/** 3b · ENVELOPE, GATEFOLD — closed with the couple's seal or a ribbon and bow (never both); the panels open like doors */
export const envelopeGatefold = (): Scene => {
  const flaps: Flap[] = [];
  let inside: Inside;
  let rib: GateRibbon | null = null;
  let seal: THREE.Group[] = [];
  let HWg = 1.5;
  /* 🔏 Sealed: the couple's seal on the seam (owner 23 Nov: *"envelope gatefold use wax seal logo as well"*), where the
     bow would sit. 🎀 Tied: the bow on the seam and no seal (owner 23 Nov: *"ribbon and wax seal never co exist
     together"*; drawing v22 "Closed with"). */
  const SEAL_Y = 0.3;
  const T = 7.4;
  return {
    legacyT: T,
    pbr: true,
    exposure: 1.0,
    async init(c) {
      const { HW, H, scene: s } = c;
      const tied = c.closure === 'ribbon';
      HWg = HW;
      stage(c);
      const wide = wideness(c.px);
      /* 🎨 the couple's panel design (drawing v24): the sculpted lilies (the art), or one drawn in code and pressed */
      const design = c.looks.panel;
      const calla: HTMLImageElement | HTMLCanvasElement = design === 'lily' ? await c.art('calla') : panelArt(await c.art('paper'), design, Math.round((512 * H) / (HW / wide)), c.logo);
      for (const side of [-1, 1]) {
        flaps.push(
          new Flap(s, {
            w: HW,
            h: H,
            hinge: side < 0 ? 'left' : 'right',
            x: (side * HW) / 2,
            y: 0,
            z: 0.01,
            /* sealed, the tap frees the seal and the panels part from 1.0, the left one first; tied, they wait for the ribbon.
               A soft spring, so either opens slowly (drawing v22) */
            at: (tied ? 3.5 : 1.0) + (side < 0 ? 0 : 0.35),
            spring: new Hinge(0.95, 2.3),
            relief: 9,
            nx: 18,
            ny: 30,
            liner: 0xe9dfca,
            wide,
            shape: (x, cw, ch) => {
              x.beginPath();
              x.rect(0, 0, cw, ch);
            },
            paint: (x, cw, ch) => {
              /* the design at its own size, laid outward from the seam (a wide screen gets more lilies, more pattern) */
              const pw = cw / wide;
              /* on a wide screen the art's own border is trimmed, so the copies meet without a line */
              const trim = wide > 1 ? calla.width * 0.012 : 0;
              lay(x, calla, [(side < 0 ? 0 : calla.width / 2) + trim, 0, calla.width / 2 - 2 * trim, calla.height], cw, { dy: 0, dw: pw, dh: ch, step: pw, anchor: side < 0 ? 'right' : 'left' });
              x.strokeStyle = 'rgba(96,80,54,.38)';
              x.lineWidth = 3;
              const a = side < 0 ? 26 : 12;
              const b = side < 0 ? cw - 12 : cw - 26;
              x.strokeRect(a, 26, b - a, ch - 52);
              x.strokeStyle = 'rgba(255,255,255,.75)';
              x.lineWidth = 2;
              x.strokeRect(a + 3, 29, b - a, ch - 52);
              const gr = x.createLinearGradient(side < 0 ? cw - 26 : 0, 0, side < 0 ? cw : 26, 0);
              gr.addColorStop(side < 0 ? 0 : 1, 'rgba(60,44,20,0)');
              gr.addColorStop(side < 0 ? 1 : 0, 'rgba(60,44,20,.28)');
              x.fillStyle = gr;
              x.fillRect(side < 0 ? cw - 26 : 0, 0, 26, ch);
            },
          }),
        );
      }
      for (const f of flaps) f.set(0, 0);
      inside = new Inside(c, -0.12);
      if (tied) rib = new GateRibbon(c, SEAL_Y, 0, 0.1);
      else seal = makeSeal(c, 0.4, true);
      placeSeal();
    },
    step(dt, t, tau) {
      /* the bow comes undone and the ribbon leaves BEFORE the panels move */
      rib?.step(dt, t, tau);
      for (const f of flaps) f.step(dt, tau);
      placeSeal();
      inside.step((flaps[0]?.h.a ?? 0) / 2.2, tau < 0 ? 0 : tau / T);
    },
  };
  /* 🔏 the seal is never broken (owner 23 Nov: *"The wax seal stays on the left flap. Do no break the seal"*): the whole
     seal rides the left panel's free edge, standing off the paper along that panel's own face, and turns with it; the
     left panel opens first, so the right panel comes free from under the seal */
  function placeSeal(): void {
    const tp = flaps[0]?.tip;
    if (!tp) return;
    for (const half of seal) {
      half.position.set(-(HWg - tp.d) - Math.sin(tp.th) * SEAL_OFF, SEAL_Y, 0.01 + tp.z + Math.cos(tp.th) * SEAL_OFF);
      half.rotation.y = -tp.th;
    }
  }
};
