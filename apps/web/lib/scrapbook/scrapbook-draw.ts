/**
 * Kwento scrapbook — everything that DRAWS (browser only; canvas 2D).
 *
 * One render path paints both the edit stage and the exported page, so what
 * the guest sees while arranging is what lands in the gallery. Each layer is
 * drawn once into a cached "tile" (the photo in its frame, the cut-out with its
 * white edge, the words on their label) with its shadow baked in; moving,
 * turning and resizing then only re-place tiles, which keeps a drag smooth on
 * a phone.
 *
 * Fonts: only faces the app already ships (`app/layout.tsx` puts them on
 * <html> as CSS variables), read back with getComputedStyle — no font is added
 * for this.
 */

import {
  PAGE_W,
  TAPES,
  centreCrop,
  clamp,
  pageHeight,
  seeded,
  toRad,
  type EdgeId,
  type FrameId,
  type LetteringId,
  type PaperId,
  type ScrapLayer,
  type ScrapPage,
  type Size,
  type TapeId,
} from './scrapbook-layout';

export type Drawable = HTMLCanvasElement;
/** A tile with its baked-in shadow margin. */
type Tile = HTMLCanvasElement & { inset?: number };

export type Sources = {
  photo: (id: string) => Drawable | null;
  cut: (id: string) => Drawable | null;
};

const PAPER_INK = '#2a2622';
const PAPER_FILL: Record<PaperId, string> = {
  kraft: '#c7a57a',
  grid: '#f6f2e7',
  dots: '#fbfaf5',
  linen: '#ece5d8',
  blush: '#f1d9cf',
  sage: '#dde3d1',
  night: '#1f2431',
};

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas_unavailable');
  return g;
}

// ── Lettering ────────────────────────────────────────────────────────────────

const LETTERING_VAR: Record<LetteringId, { cssVar: string; fallback: string; weight: number; size: number }> = {
  script: { cssVar: '--font-script', fallback: "'Snell Roundhand', cursive", weight: 400, size: 140 },
  serif: { cssVar: '--font-pahina-display', fallback: 'Georgia, serif', weight: 600, size: 104 },
  calligraphy: { cssVar: '--font-tangerine', fallback: "'Snell Roundhand', cursive", weight: 700, size: 170 },
  clean: { cssVar: '--font-hanken', fallback: 'system-ui, sans-serif', weight: 700, size: 96 },
};
const familyCache = new Map<LetteringId, string>();
function family(id: LetteringId): string {
  const hit = familyCache.get(id);
  if (hit) return hit;
  const spec = LETTERING_VAR[id];
  let fam = '';
  try {
    fam = getComputedStyle(document.documentElement).getPropertyValue(spec.cssVar).trim();
  } catch {
    /* no document (never on the client) */
  }
  const out = fam ? `${fam}, ${spec.fallback}` : spec.fallback;
  familyCache.set(id, out);
  return out;
}
export function letteringFont(id: LetteringId, px: number): string {
  return `${LETTERING_VAR[id].weight} ${Math.round(px)}px ${family(id)}`;
}
/** Resolves when every lettering face is ready for the canvas (it cannot wait for CSS). */
export async function loadLetterings(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(
    (Object.keys(LETTERING_VAR) as LetteringId[]).map((id) =>
      document.fonts.load(letteringFont(id, 40), 'Aa&').catch(() => []),
    ),
  );
}

// ── Paper ────────────────────────────────────────────────────────────────────

function noise(size: number, seed: number, dark: string, light: string, count: number): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const r = seeded(seed);
  for (let i = 0; i < count; i++) {
    g.fillStyle = r() < 0.5 ? dark : light;
    g.globalAlpha = r() * 0.5 + 0.15;
    const s = r() * 1.6 + 0.4;
    g.fillRect(r() * size, r() * size, s, s);
  }
  return c;
}

/** `unit` is pixels per page unit, so a pattern keeps its size at any resolution. */
export function paintPaper(g: CanvasRenderingContext2D, w: number, h: number, id: PaperId, unit: number): void {
  g.fillStyle = PAPER_FILL[id];
  g.fillRect(0, 0, w, h);
  const night = id === 'night';
  const grain = noise(256, 7 + id.length, night ? '#0b0d12' : 'rgb(60,40,20)', night ? '#3a4152' : '#ffffff', id === 'kraft' ? 2600 : 1400);
  const pat = g.createPattern(grain, 'repeat');
  if (pat) {
    g.save();
    g.globalAlpha = id === 'kraft' ? 0.55 : 0.32;
    g.fillStyle = pat;
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  const r = seeded(99);
  g.save();
  if (id === 'kraft') {
    g.strokeStyle = 'rgba(90,60,30,0.16)';
    g.lineWidth = Math.max(1, unit * 1.2);
    for (let i = 0; i < 420; i++) {
      const x = r() * w;
      const y = r() * h;
      const a = r() * Math.PI;
      const l = (8 + r() * 26) * unit;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  } else if (id === 'grid') {
    g.strokeStyle = 'rgba(74,120,170,0.20)';
    g.lineWidth = Math.max(1, unit * 1.4);
    const step = 40 * unit;
    for (let x = step; x < w; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = step; y < h; y += step) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(190,80,70,0.30)';
    g.beginPath();
    g.moveTo(step * 2.2, 0);
    g.lineTo(step * 2.2, h);
    g.stroke();
  } else if (id === 'dots') {
    g.fillStyle = 'rgba(60,62,72,0.24)';
    const step = 34 * unit;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        g.beginPath();
        g.arc(x, y, 2.2 * unit, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (id === 'linen') {
    g.strokeStyle = 'rgba(120,100,70,0.07)';
    g.lineWidth = Math.max(1, unit);
    for (let y = 0; y < h; y += 3 * unit) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + (r() - 0.5) * 2 * unit);
      g.stroke();
    }
    for (let x = 0; x < w; x += 3 * unit) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + (r() - 0.5) * 2 * unit, h);
      g.stroke();
    }
  } else if (night) {
    for (let i = 0; i < 260; i++) {
      g.fillStyle = r() < 0.7 ? 'rgba(224,204,160,0.75)' : 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.arc(r() * w, r() * h, (r() * 1.8 + 0.4) * unit, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, night ? 'rgba(0,0,0,0.35)' : 'rgba(60,40,20,0.14)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}

export function paintBackground(g: CanvasRenderingContext2D, w: number, h: number, page: ScrapPage, src: Sources): void {
  const bg = page.background;
  const photo = bg.kind === 'photo' ? src.photo(bg.src) : null;
  if (photo) {
    const k = centreCrop(photo.width, photo.height, w / h);
    g.drawImage(photo, k.sx, k.sy, k.sw, k.sh, 0, 0, w, h);
    if (page.fade > 0) {
      g.fillStyle = `rgba(251,249,244,${clamp(page.fade, 0, 0.7)})`;
      g.fillRect(0, 0, w, h);
    }
    return;
  }
  paintPaper(g, w, h, bg.kind === 'paper' ? bg.paper : 'kraft', w / PAGE_W);
}

// ── Tiles ────────────────────────────────────────────────────────────────────

function withShadow(src: HTMLCanvasElement, blur: number, oy: number, alpha: number): Tile {
  const m = Math.ceil(blur * 1.5 + Math.abs(oy));
  const c: Tile = makeCanvas(src.width + 2 * m, src.height + 2 * m);
  const g = ctx2d(c);
  g.shadowColor = `rgba(28,20,12,${alpha})`;
  g.shadowBlur = blur;
  g.shadowOffsetY = oy;
  g.drawImage(src, m, m);
  c.inset = m;
  return c;
}

function tornPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, amp: number, step: number, r: () => number) {
  g.beginPath();
  g.moveTo(x + r() * amp, y + r() * amp);
  for (let i = step; i < w; i += step) g.lineTo(x + i, y + r() * amp);
  for (let i = 0; i < h; i += step) g.lineTo(x + w - r() * amp, y + i);
  for (let i = w; i > 0; i -= step) g.lineTo(x + i, y + h - r() * amp);
  for (let i = h; i > 0; i -= step) g.lineTo(x + r() * amp, y + i);
  g.closePath();
}

function grain(g: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const pat = g.createPattern(noise(128, seed, 'rgb(120,100,70)', '#ffffff', 500), 'repeat');
  if (!pat) return;
  g.save();
  g.globalAlpha = 0.18;
  g.fillStyle = pat;
  g.fillRect(0, 0, w, h);
  g.restore();
}

export function tapeStrip(w: number, h: number, id: TapeId, seed: number): HTMLCanvasElement {
  const st = TAPES.find((t) => t.id === id) ?? TAPES[0];
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const r = seeded(seed);
  const z = h / 7;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w, 0);
  for (let y = 0; y <= h; y += z) g.lineTo(w - (Math.floor(y / z) % 2 ? z * 0.7 : 0) - r() * 2, y);
  g.lineTo(0, h);
  for (let y = h; y >= 0; y -= z) g.lineTo((Math.floor(y / z) % 2 ? z * 0.7 : 0) + r() * 2, y);
  g.closePath();
  g.fillStyle = st.fill;
  g.fill();
  g.save();
  g.clip();
  if (st.pattern === 'dots') {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let y = h / 4; y < h; y += h / 2.4) {
      for (let x = (y / 3) % 24; x < w; x += h / 2.2) {
        g.beginPath();
        g.arc(x, y, h * 0.07, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (st.pattern === 'stripes') {
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = h * 0.12;
    for (let x = -h; x < w + h; x += h * 0.45) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + h, 0);
      g.stroke();
    }
  } else if (st.pattern === 'grid') {
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = h * 0.05;
    for (let x = 0; x < w; x += h * 0.3) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 0; y < h; y += h * 0.3) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(0, 0, w, h * 0.35);
  g.restore();
  return c;
}

function photoTile(src: Drawable, frame: FrameId, caption: string, seed: number, tape: TapeId): Tile {
  const TW = 900;
  const r = seeded(seed);
  if (frame === 'polaroid') {
    const side = TW * 0.06;
    const bottom = TW * 0.25;
    const inner = TW - side * 2;
    const c = makeCanvas(TW, side + inner + bottom);
    const g = ctx2d(c);
    g.fillStyle = '#fdfbf6';
    g.fillRect(0, 0, c.width, c.height);
    grain(g, c.width, c.height, seed);
    const k = centreCrop(src.width, src.height, 1);
    g.drawImage(src, k.sx, k.sy, k.sw, k.sh, side, side, inner, inner);
    if (caption) {
      g.fillStyle = PAPER_INK;
      g.font = letteringFont('script', TW * 0.12);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(caption, TW / 2, side + inner + bottom * 0.5, inner);
    }
    return withShadow(c, 26, 10, 0.38);
  }
  if (frame === 'round') {
    const c = makeCanvas(TW, TW);
    const g = ctx2d(c);
    g.beginPath();
    g.arc(TW / 2, TW / 2, TW / 2, 0, Math.PI * 2);
    g.fillStyle = '#fdfbf6';
    g.fill();
    g.save();
    g.beginPath();
    g.arc(TW / 2, TW / 2, TW / 2 - TW * 0.035, 0, Math.PI * 2);
    g.clip();
    const k = centreCrop(src.width, src.height, 1);
    g.drawImage(src, k.sx, k.sy, k.sw, k.sh, 0, 0, TW, TW);
    g.restore();
    return withShadow(c, 24, 9, 0.36);
  }
  if (frame === 'stamp') {
    const w = TW;
    const h = TW * 1.18;
    const hole = TW * 0.034;
    const step = hole * 2.7;
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    g.fillStyle = '#fbf7ee';
    g.fillRect(0, 0, w, h);
    grain(g, w, h, seed);
    const pad = TW * 0.085;
    const k = centreCrop(src.width, src.height, (w - pad * 2) / (h - pad * 2));
    g.drawImage(src, k.sx, k.sy, k.sw, k.sh, pad, pad, w - pad * 2, h - pad * 2);
    g.globalCompositeOperation = 'destination-out';
    for (let x = step / 2; x < w; x += step) {
      g.beginPath();
      g.arc(x, 0, hole, 0, Math.PI * 2);
      g.arc(x, h, hole, 0, Math.PI * 2);
      g.fill();
    }
    for (let y = step / 2; y < h; y += step) {
      g.beginPath();
      g.arc(0, y, hole, 0, Math.PI * 2);
      g.arc(w, y, hole, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    return withShadow(c, 18, 7, 0.32);
  }
  const a = clamp(src.width / src.height, 0.75, 1.45);
  if (frame === 'torn') {
    const pad = TW * 0.06;
    const ph = (TW - pad * 2) / a;
    const c = makeCanvas(TW, ph + pad * 2);
    const g = ctx2d(c);
    tornPath(g, 0, 0, TW, c.height, TW * 0.022, TW * 0.018, r);
    g.fillStyle = '#fbf8f0';
    g.fill();
    grain(g, TW, c.height, seed);
    g.save();
    tornPath(g, pad, pad, TW - pad * 2, ph, TW * 0.01, TW * 0.02, r);
    g.clip();
    const k = centreCrop(src.width, src.height, a);
    g.drawImage(src, k.sx, k.sy, k.sw, k.sh, pad, pad, TW - pad * 2, ph);
    g.restore();
    return withShadow(c, 22, 9, 0.34);
  }
  if (frame === 'taped') {
    const border = TW * 0.028;
    const over = TW * 0.07;
    const ph = (TW - border * 2) / a;
    const c = makeCanvas(TW, ph + border * 2 + over);
    const g = ctx2d(c);
    g.save();
    g.shadowColor = 'rgba(28,20,12,0.35)';
    g.shadowBlur = 22;
    g.shadowOffsetY = 9;
    g.fillStyle = '#ffffff';
    g.fillRect(0, over, TW, ph + border * 2);
    g.restore();
    const k = centreCrop(src.width, src.height, a);
    g.drawImage(src, k.sx, k.sy, k.sw, k.sh, border, over + border, TW - border * 2, ph);
    const tw = TW * 0.36;
    const th = TW * 0.11;
    const strip = tapeStrip(tw, th, tape, seed);
    g.save();
    g.translate(TW / 2 + (r() - 0.5) * TW * 0.1, over + th * 0.2);
    g.rotate(toRad((r() - 0.5) * 10));
    g.drawImage(strip, -tw / 2, -th / 2);
    g.restore();
    const out: Tile = makeCanvas(TW + 60, c.height + 60);
    ctx2d(out).drawImage(c, 30, 30);
    out.inset = 30;
    return out;
  }
  const c = makeCanvas(TW, TW / a);
  const k = centreCrop(src.width, src.height, a);
  ctx2d(c).drawImage(src, k.sx, k.sy, k.sw, k.sh, 0, 0, TW, TW / a);
  return withShadow(c, 22, 9, 0.34);
}

/**
 * The sticker edge: the cut-out's silhouette, hardened, stamped in a ring
 * around itself — a dilation without a convolution — then the cut-out on top.
 */
function cutTile(src: Drawable, edge: EdgeId): Tile {
  const long = Math.max(src.width, src.height);
  const t = edge === 'white' ? Math.round(long * 0.024) : edge === 'thin' ? Math.round(long * 0.01) : 0;
  const pad = t + 2;
  const c = makeCanvas(src.width + pad * 2, src.height + pad * 2);
  const g = ctx2d(c);
  if (t > 0) {
    const sil = makeCanvas(src.width, src.height);
    const sg = ctx2d(sil);
    sg.drawImage(src, 0, 0);
    const d = sg.getImageData(0, 0, sil.width, sil.height);
    const p = d.data;
    for (let i = 3; i < p.length; i += 4) {
      const on = p[i]! > 70;
      p[i - 3] = 255;
      p[i - 2] = 255;
      p[i - 1] = 255;
      p[i] = on ? 255 : 0;
    }
    sg.putImageData(d, 0, 0);
    for (let k = 0; k < 32; k++) {
      const an = (k / 32) * Math.PI * 2;
      g.drawImage(sil, pad + Math.cos(an) * t, pad + Math.sin(an) * t);
    }
    g.drawImage(sil, pad, pad);
  }
  g.drawImage(src, pad, pad);
  return withShadow(c, 16, 6, 0.32);
}

function stickerTile(ch: string): Tile {
  const c = makeCanvas(320, 320);
  const g = ctx2d(c);
  g.font = "230px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, 160, 172);
  return withShadow(c, 8, 3, 0.22);
}

function wordsTile(text: string, lettering: LetteringId, color: string, label: boolean, seed: number): Tile {
  const px = LETTERING_VAR[lettering].size;
  const meas = ctx2d(makeCanvas(8, 8));
  meas.font = letteringFont(lettering, px);
  const lines = (text || ' ').split('\n');
  const lw = Math.max(...lines.map((l) => meas.measureText(l).width), px * 0.6);
  const lh = px * 1.1;
  const padX = label ? px * 0.55 : px * 0.15;
  const padY = label ? px * 0.3 : px * 0.12;
  const w = lw + padX * 2;
  const h = lh * lines.length + padY * 2;
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  if (label) {
    tornPath(g, 0, 0, w, h, px * 0.06, px * 0.12, seeded(seed));
    g.fillStyle = color === '#ffffff' ? PAPER_INK : '#fbf6e9';
    g.fill();
    grain(g, w, h, seed);
  }
  g.fillStyle = color;
  g.font = letteringFont(lettering, px);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, w / 2, padY + lh * (i + 0.5)));
  return label ? withShadow(c, 14, 5, 0.28) : withShadow(c, 6, 2, color === '#ffffff' ? 0.45 : 0.12);
}

/** Caches every layer's tile by what it LOOKS like, so moving a layer never redraws it. */
export class TileCache {
  private tiles = new Map<string, Tile>();
  constructor(private readonly src: Sources) {}

  clear() {
    this.tiles.clear();
  }

  private key(l: ScrapLayer) {
    return [l.kind, l.src, l.frame, l.caption, l.edge, l.text, l.lettering, l.color, l.label, l.tape, l.seed].join('|');
  }

  tile(l: ScrapLayer): Tile | null {
    const key = this.key(l);
    const hit = this.tiles.get(key);
    if (hit) return hit;
    let t: Tile | null = null;
    if (l.kind === 'photo') {
      const p = l.src ? this.src.photo(l.src) : null;
      if (p) t = photoTile(p, l.frame ?? 'polaroid', l.caption ?? '', l.seed, l.tape ?? 'gold');
    } else if (l.kind === 'cut') {
      const k = l.src ? this.src.cut(l.src) : null;
      if (k) t = cutTile(k, l.edge ?? 'white');
    } else if (l.kind === 'sticker') {
      t = stickerTile(l.text ?? '✨');
    } else if (l.kind === 'words') {
      t = wordsTile(l.text ?? '', l.lettering ?? 'script', l.color ?? PAPER_INK, !!l.label, l.seed);
    } else if (l.kind === 'tape') {
      t = withShadow(tapeStrip(520, 120, l.tape ?? 'gold', l.seed), 6, 2, 0.14);
    }
    if (!t) return null;
    if (this.tiles.size > 160) this.tiles.clear();
    this.tiles.set(key, t);
    return t;
  }

  /** The layer's drawn size in page units, without its shadow margin. */
  size(l: ScrapLayer): Size | null {
    const t = this.tile(l);
    if (!t) return null;
    const m = t.inset ?? 0;
    const s = l.w / (t.width - m * 2);
    return { w: l.w, h: (t.height - m * 2) * s };
  }
}

/** `fadeId` draws one layer see-through — the one being dragged over the bin. */
export function paintLayers(
  g: CanvasRenderingContext2D,
  layers: readonly ScrapLayer[],
  tiles: TileCache,
  scale: number,
  fadeId: string | null = null,
): void {
  for (const l of layers) {
    const t = tiles.tile(l);
    if (!t) continue;
    g.globalAlpha = l.id === fadeId ? 0.45 : 1;
    const m = t.inset ?? 0;
    const s = (l.w / (t.width - m * 2)) * scale;
    g.save();
    g.translate(l.x * scale, l.y * scale);
    g.rotate(toRad(l.rot));
    g.drawImage(t, (-t.width * s) / 2, (-t.height * s) / 2, t.width * s, t.height * s);
    g.restore();
  }
  g.globalAlpha = 1;
}

/** The dashed outline and the gold turn-and-resize handle. `dpr` keeps them finger-sized. */
export function paintSelection(g: CanvasRenderingContext2D, l: ScrapLayer, size: Size, scale: number, dpr: number): void {
  const w = size.w * scale;
  const h = size.h * scale;
  const hr = 15 * dpr;
  g.save();
  g.translate(l.x * scale, l.y * scale);
  g.rotate(toRad(l.rot));
  g.lineWidth = 2 * dpr;
  g.setLineDash([7 * dpr, 6 * dpr]);
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.strokeRect(-w / 2, -h / 2, w, h);
  g.lineDashOffset = 6.5 * dpr;
  g.strokeStyle = 'rgba(30,34,41,0.7)';
  g.strokeRect(-w / 2, -h / 2, w, h);
  g.setLineDash([]);
  g.beginPath();
  g.arc(w / 2, h / 2, hr, 0, Math.PI * 2);
  g.fillStyle = '#C5A059';
  g.fill();
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.strokeStyle = '#1E2229';
  g.beginPath();
  g.arc(w / 2, h / 2, hr * 0.48, -0.3, Math.PI * 1.35);
  g.stroke();
  g.restore();
}

/** The finished page as a JPEG, `width` pixels wide (the decorator's export cap). */
export async function exportPage(page: ScrapPage, tiles: TileCache, src: Sources, width = 1440): Promise<Blob> {
  const scale = width / PAGE_W;
  const c = makeCanvas(width, pageHeight(page.shape) * scale);
  const g = ctx2d(c);
  paintBackground(g, c.width, c.height, page, src);
  paintLayers(g, page.layers, tiles, scale);
  const blob = await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.9));
  if (!blob) throw new Error('export_failed');
  return blob;
}

/** A photo, read once into a canvas no larger than `max` on its long edge. */
export function toCanvas(img: CanvasImageSource & { width: number; height: number }, w: number, h: number, max: number): HTMLCanvasElement {
  const s = Math.min(1, max / Math.max(w, h));
  const c = makeCanvas(w * s, h * s);
  ctx2d(c).drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * Loads a photo for drawing. Remote Papic photos are presigned R2 GETs and are
 * read with `crossOrigin = 'anonymous'` — without it the canvas is tainted and
 * neither the cut-out nor the export can read it (the reel renderer loads the
 * same URLs the same way, `lib/reel-render.ts`).
 */
export function loadPhoto(url: string, max = 1600): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('blob:') && !url.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        resolve(toCanvas(img, img.naturalWidth, img.naturalHeight, max));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('photo_unreadable'));
    img.src = url;
  });
}
