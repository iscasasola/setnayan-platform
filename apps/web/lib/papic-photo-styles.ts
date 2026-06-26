/**
 * apps/web/lib/papic-photo-styles.ts
 *
 * Papic camera STYLES — the in-capture "look" engine.
 *
 * Five looks the paparazzo can pick before a shot lands. Each is a real
 * image-processing pipeline (tone curves, channel WB, split-toning, grain,
 * bloom, chromatic aberration, vignette) — not a lazy CSS desaturate. The math
 * runs once, on the captured frame, on the device; nothing renders server-side.
 *
 * TWO entry points, by design:
 *
 *   1. cssPreviewFilter(style)  — a cheap `filter:` string for the LIVE <video>
 *      preview so the paparazzo *sees* the look in real time at zero CPU. It is
 *      only an APPROXIMATION (CSS can't do grain / bloom / channel-shift / light
 *      leaks); the captured photo is the exact thing.
 *
 *   2. applyPapicStyle(canvas, style) — the EXACT per-pixel pipeline, run ONCE
 *      on the still frame at shutter time. Mutates the canvas in place.
 *
 * Integration contract (load-bearing — see capture components):
 *   • Faces are embedded for auto-tag from the CLEAN frame, BEFORE styling.
 *     MONO crushes colour, LOMO shifts channels, CINE re-tones — all of which
 *     wreck face-api's 128-d descriptors and would silently tank the ≥0.85
 *     auto-tag. Draw clean → embed → THEN applyPapicStyle → encode upload.
 *   • The untagged-still-delivered + mixed-aspect gallery guarantees mean we
 *     never destructively crop. CINE paints 2.39:1 letterbox BARS (frame size
 *     and every face box unchanged) instead of cropping pixels away.
 *   • V1 has no video render pipeline, so clip BODIES stay un-styled; the clip
 *     POSTER frame is styled so the gallery thumbnail matches the look.
 *
 * Perf: getUserMedia frames are ~2 MP (≤1920×1080), so even the heaviest look
 * (LOMO: full-buffer chromatic-aberration resample + light leak + vignette) is
 * a handful of linear passes — well under a deliberate shutter's budget.
 *
 * Note on the `!` non-null assertions in the hot loops: this repo runs
 * `noUncheckedIndexedAccess`, so a typed-array read types as `number | undefined`.
 * Every read here is bounds-clamped, so the assertion is correct and keeps the
 * pixel math readable (the alternative — wrapping millions of accesses in a
 * helper — would only add overhead and noise).
 */

export type PapicStyle = 'ORIG' | 'RETRO' | 'MONO' | 'CINE' | 'LOMO';

export interface PapicStyleMeta {
  id: PapicStyle;
  /** Chip label shown on the capture chrome. */
  label: string;
  /** One-line paparazzo-facing description of the look. */
  blurb: string;
  /** Cheap live-preview approximation for the <video> element. */
  cssPreview: string;
}

/** Ordered for the picker — clean first, then the four creative looks. */
export const PAPIC_STYLES: readonly PapicStyleMeta[] = [
  {
    id: 'ORIG',
    label: 'Orig',
    blurb: 'Clean & true — a touch more pop',
    cssPreview: 'contrast(1.06) saturate(1.1) brightness(1.005)',
  },
  {
    id: 'RETRO',
    label: 'Retro',
    blurb: 'Warm film, matte shadows, fine grain',
    cssPreview: 'sepia(0.16) saturate(1.05) contrast(0.92) brightness(1.05)',
  },
  {
    id: 'MONO',
    label: 'Mono',
    blurb: 'Rich black & white, bright skin',
    cssPreview: 'grayscale(1) contrast(1.24) brightness(1.04)',
  },
  {
    id: 'CINE',
    label: 'Cine',
    blurb: 'Teal & orange, soft bloom, widescreen',
    cssPreview: 'contrast(1.14) saturate(1.12) brightness(0.99) hue-rotate(-6deg)',
  },
  {
    id: 'LOMO',
    label: 'Lomo',
    blurb: 'Lo-fi toy camera — saturated, leaky',
    cssPreview: 'saturate(1.5) contrast(1.2) brightness(1.05) hue-rotate(4deg)',
  },
] as const;

export const DEFAULT_PAPIC_STYLE: PapicStyle = 'ORIG';

const STYLE_IDS = new Set<PapicStyle>(PAPIC_STYLES.map((s) => s.id));

/** Narrow an arbitrary string to a known style (falls back to the default). */
export function asPapicStyle(value: string | null | undefined): PapicStyle {
  return value && STYLE_IDS.has(value as PapicStyle)
    ? (value as PapicStyle)
    : DEFAULT_PAPIC_STYLE;
}

/** Live-preview `filter:` string for the <video> element. */
export function cssPreviewFilter(style: PapicStyle): string {
  return PAPIC_STYLES.find((s) => s.id === style)?.cssPreview ?? 'none';
}

/** CINE target aspect — used only to size the letterbox bars, never to crop. */
export const CINE_ASPECT = 2.39;

// ───────────────────────────── math helpers ─────────────────────────────────

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Rec.601-ish perceptual luminance (0–255). */
const luma = (r: number, g: number, b: number) =>
  0.299 * r + 0.587 * g + 0.114 * b;

/** Smooth 0→1 ramp between two edges (Hermite). */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Build a 256-entry tone-curve LUT. `amount` blends identity → a smooth S-curve
 * (contrast pivoting on mid-grey). Point ops read the LUT — one lookup per
 * channel per pixel.
 */
function sCurveLUT(amount: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    const x = i / 255;
    const s = x * x * (3 - 2 * x); // smoothstep == gentle S around 0.5
    lut[i] = clamp255((x + amount * (s - x)) * 255);
  }
  return lut;
}

/**
 * A "lifted black / rolled-off white" matte LUT — maps [0,255] into
 * [lift, 255-roll] then applies a small S for body. Gives film its flat,
 * faded shadow without killing all contrast.
 */
function matteLUT(lift: number, roll: number, sAmount: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const span = 255 - lift - roll;
  for (let i = 0; i < 256; i += 1) {
    const x = i / 255;
    const s = x * x * (3 - 2 * x);
    const shaped = x + sAmount * (s - x);
    lut[i] = clamp255(lift + shaped * span);
  }
  return lut;
}

/** Separable box blur over an RGBA Float buffer (≈Gaussian after 2–3 passes). */
function boxBlurRGBA(
  buf: Float32Array,
  w: number,
  h: number,
  radius: number,
  passes: number,
): Float32Array {
  const tmp = new Float32Array(buf.length);
  const win = radius * 2 + 1;
  for (let p = 0; p < passes; p += 1) {
    // horizontal
    for (let y = 0; y < h; y += 1) {
      const row = y * w * 4;
      for (let c = 0; c < 4; c += 1) {
        let acc = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const xx = Math.min(w - 1, Math.max(0, k));
          acc += buf[row + xx * 4 + c]!;
        }
        for (let x = 0; x < w; x += 1) {
          tmp[row + x * 4 + c] = acc / win;
          const add = Math.min(w - 1, x + radius + 1);
          const sub = Math.max(0, x - radius);
          acc += buf[row + add * 4 + c]! - buf[row + sub * 4 + c]!;
        }
      }
    }
    // vertical
    for (let x = 0; x < w; x += 1) {
      const col = x * 4;
      for (let c = 0; c < 4; c += 1) {
        let acc = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const yy = Math.min(h - 1, Math.max(0, k));
          acc += tmp[yy * w * 4 + col + c]!;
        }
        for (let y = 0; y < h; y += 1) {
          buf[y * w * 4 + col + c] = acc / win;
          const add = Math.min(h - 1, y + radius + 1);
          const sub = Math.max(0, y - radius);
          acc += tmp[add * w * 4 + col + c]! - tmp[sub * w * 4 + col + c]!;
        }
      }
    }
  }
  return buf;
}

/**
 * Unsharp-mask sharpen / micro-contrast. `amount` 0.45 ≈ subtle edge crisp,
 * higher values pull out texture (skin pores, fabric, hair). Works on a blurred
 * copy so it adds local contrast without the haloing of a raw 3×3 kernel.
 */
function unsharp(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number,
  radius: number,
): void {
  const blur = new Float32Array(data); // copy of the source
  boxBlurRGBA(blur, w, h, radius, 2);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp255(data[i]! + amount * (data[i]! - blur[i]!));
    data[i + 1] = clamp255(data[i + 1]! + amount * (data[i + 1]! - blur[i + 1]!));
    data[i + 2] = clamp255(data[i + 2]! + amount * (data[i + 2]! - blur[i + 2]!));
  }
}

/** Standard normal sample (Box–Muller) — for organic, non-banded film grain. */
function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ───────────────────────────── the five looks ───────────────────────────────

/**
 * 1 · ORIG — clean realism with modern polish.
 * Subtle S-curve contrast, +10% vibrance (saturation that protects already-
 * saturated pixels and skin), +5%-ish unsharp. Neutral 5500 K (no WB shift).
 */
function applyOrig(data: Uint8ClampedArray, w: number, h: number): void {
  const lut = sCurveLUT(0.18);
  const vib = 0.1;
  for (let i = 0; i < data.length; i += 4) {
    let r = lut[data[i]!]!;
    let g = lut[data[i + 1]!]!;
    let b = lut[data[i + 2]!]!;
    // Vibrance: boost least-saturated pixels most (skin/neutrals stay natural).
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    const avg = (r + g + b) / 3;
    const k = 1 + vib * (1 - sat);
    r = avg + (r - avg) * k;
    g = avg + (g - avg) * k;
    b = avg + (b - avg) * k;
    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }
  unsharp(data, w, h, 0.45, 1); // ≈ +5% perceived sharpness
}

/**
 * 2 · RETRO — analog warmth + organic texture.
 * Lifted matte blacks, warm WB (+yellow), green/blue split into the shadows,
 * a 20% radial vignette, and fine monochrome Gaussian grain (35mm feel).
 */
function applyRetro(data: Uint8ClampedArray, w: number, h: number): void {
  const lut = matteLUT(22, 6, 0.12); // raised black point, gentle roll-off
  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.hypot(cx, cy);
  for (let i = 0; i < data.length; i += 4) {
    const pixel = i >> 2;
    const px = pixel % w;
    const py = Math.floor(pixel / w);
    let r = lut[data[i]!]!;
    let g = lut[data[i + 1]!]!;
    let b = lut[data[i + 2]!]!;
    // Warm white balance (+15% toward yellow: lift R, hold G, drop B).
    r *= 1.07;
    b *= 0.9;
    // Split-tone: push cool green/blue into the shadows only.
    const shadow = 1 - smoothstep(0, 150, luma(r, g, b));
    g += 6 * shadow;
    b += 10 * shadow;
    // 20% radial vignette.
    const dist = Math.hypot(px - cx, py - cy) / maxD;
    const vig = 1 - 0.2 * smoothstep(0.55, 1.05, dist);
    r *= vig;
    g *= vig;
    b *= vig;
    // Fine monochrome grain (same noise to all channels = luminance grain).
    const n = gauss() * 6;
    data[i] = clamp255(r + n);
    data[i + 1] = clamp255(g + n);
    data[i + 2] = clamp255(b + n);
  }
}

/**
 * 3 · MONO — rich black & white, bright skin, lots of texture.
 * Custom luminance heavy on R+G (keeps skin luminous instead of muddy — a
 * classic red-filter B&W portrait trick), a crushed-toe / lifted-shoulder
 * contrast curve for deep blacks + crisp whites, and aggressive micro-contrast.
 */
function applyMono(data: Uint8ClampedArray, w: number, h: number): void {
  const wr = 0.4;
  const wg = 0.45;
  const wb = 0.15;
  // Contrast curve: crush below ~12%, lift above ~88%, smooth body between.
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    const x = i / 255;
    const toe = smoothstep(0.04, 0.16, x); // → pure black at the bottom
    const shoulder = smoothstep(0.84, 0.97, x); // → crisp white at the top
    const body = x * x * (3 - 2 * x);
    lut[i] = clamp255((toe * (0.85 * body) + shoulder * 0.15) * 255);
  }
  for (let i = 0; i < data.length; i += 4) {
    const idx = clamp255(wr * data[i]! + wg * data[i + 1]! + wb * data[i + 2]!) | 0;
    const gray = lut[idx]!;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  unsharp(data, w, h, 0.9, 2); // strong micro-contrast for texture
}

/**
 * 4 · CINE — teal & orange Hollywood split-tone + bloom + 2.39:1 framing.
 * Highlights/mids drift to warm amber, shadows to deep cyan/teal; a soft bloom
 * lifts the brightest pixels; widescreen bars are PAINTED (never cropped) so the
 * stored frame and every face box stay intact.
 */
function applyCine(data: Uint8ClampedArray, w: number, h: number): void {
  const contrast = sCurveLUT(0.2);
  for (let i = 0; i < data.length; i += 4) {
    let r = contrast[data[i]!]!;
    let g = contrast[data[i + 1]!]!;
    let b = contrast[data[i + 2]!]!;
    const L = luma(r, g, b) / 255;
    // Split-toning: lerp shadow tint → highlight tint by luminance, added on
    // top of the original so detail survives (this is grade, not a duotone).
    const high = smoothstep(0.5, 1, L); // amber pull in mids→highlights
    const low = 1 - smoothstep(0, 0.5, L); // teal pull in shadows
    r += high * 18 - low * 10;
    g += high * 6 + low * 4;
    b += -high * 14 + low * 22;
    data[i] = clamp255(r);
    data[i + 1] = clamp255(g);
    data[i + 2] = clamp255(b);
  }

  // Bloom: bright-pass (>~90% luma) → blur → screen-composite for a soft glow.
  const bright = new Float32Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const L = luma(data[i]!, data[i + 1]!, data[i + 2]!);
    const m = L > 230 ? (L - 230) / 25 : 0; // 0..1 above ~90%
    bright[i] = data[i]! * m;
    bright[i + 1] = data[i + 1]! * m;
    bright[i + 2] = data[i + 2]! * m;
  }
  const radius = Math.max(2, Math.round(Math.min(w, h) / 200));
  boxBlurRGBA(bright, w, h, radius, 3);
  for (let i = 0; i < data.length; i += 4) {
    // screen: 255 - (255-a)(255-b)/255
    data[i] = clamp255(255 - ((255 - data[i]!) * (255 - bright[i]! * 0.8)) / 255);
    data[i + 1] = clamp255(255 - ((255 - data[i + 1]!) * (255 - bright[i + 1]! * 0.8)) / 255);
    data[i + 2] = clamp255(255 - ((255 - data[i + 2]!) * (255 - bright[i + 2]! * 0.8)) / 255);
  }

  // Widescreen letterbox — painted bars, non-destructive. 2.39:1 is a LANDSCAPE
  // ratio, so only bar landscape frames; a portrait candid keeps its full height
  // (it still gets the teal/orange grade + bloom, just no cinemascope crop).
  const targetH = w / CINE_ASPECT;
  if (w > h && targetH < h) {
    const bar = Math.floor((h - targetH) / 2);
    for (let y = 0; y < h; y += 1) {
      if (y >= bar && y < h - bar) continue;
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        data[i] = 8;
        data[i + 1] = 9;
        data[i + 2] = 11;
      }
    }
  }
}

/**
 * 5 · LOMO — high-energy toy camera. Heavy sharp-falloff vignette, +35%
 * saturation, cross-processed channel curves (green into highlights, red into
 * shadows), 3–5px radial chromatic aberration, and a warm linear light leak.
 */
function applyLomo(data: Uint8ClampedArray, w: number, h: number): void {
  // Cross-process per-channel curves: red lifts in shadows, green pops in
  // highlights, blue crushed — the classic C-41-in-E6 colour cast.
  const rLUT = new Uint8ClampedArray(256);
  const gLUT = new Uint8ClampedArray(256);
  const bLUT = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    const x = i / 255;
    rLUT[i] = clamp255((x + 0.12 * (1 - x) * x * 4) * 255); // red lifts in lows
    gLUT[i] = clamp255(x * x * (3 - 2 * x) * 1.05 * 255); // green pops in highs
    bLUT[i] = clamp255((x * 0.88 + 0.04) * 255); // blue crushed + small lift
  }

  // Chromatic aberration needs the pre-shift pixels — snapshot first.
  const src = new Uint8ClampedArray(data); // copy
  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.hypot(cx, cy);
  const shift = Math.max(3, Math.min(5, Math.round(Math.min(w, h) / 360)));
  const sat = 1.35;
  // Light-leak anchor (top-right warm streak).
  const leakX = w * 0.85;
  const leakY = h * 0.12;
  const leakMax = Math.hypot(w, h) * 0.6;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      // Radial direction (outward from centre) drives the channel shift.
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const nd = dist / maxD;
      const ux = dist === 0 ? 0 : dx / dist;
      const uy = dist === 0 ? 0 : dy / dist;
      const s = shift * nd; // 0 at centre → full at the corners
      const rx = Math.min(w - 1, Math.max(0, Math.round(x + ux * s)));
      const ry = Math.min(h - 1, Math.max(0, Math.round(y + uy * s)));
      const bx = Math.min(w - 1, Math.max(0, Math.round(x - ux * s)));
      const by = Math.min(h - 1, Math.max(0, Math.round(y - uy * s)));
      let r = rLUT[src[(ry * w + rx) * 4]!]!; // red pulled outward
      let g = gLUT[src[i + 1]!]!; // green stays centred
      let bch = bLUT[src[(by * w + bx) * 4 + 2]!]!; // blue pulled inward

      // +35% saturation.
      const avg = (r + g + bch) / 3;
      r = avg + (r - avg) * sat;
      g = avg + (g - avg) * sat;
      bch = avg + (bch - avg) * sat;

      // Heavy vignette with a SHARP falloff (toy-lens light cutoff).
      const vig = 1 - 0.62 * smoothstep(0.45, 0.92, nd);
      r *= vig;
      g *= vig;
      bch *= vig;

      // Warm linear light leak — screen-blended, strongest near the anchor.
      const leak = 1 - Math.min(1, Math.hypot(x - leakX, y - leakY) / leakMax);
      const lk = leak * leak * 0.5;
      r = 255 - ((255 - r) * (255 - 255 * lk)) / 255;
      g = 255 - ((255 - g) * (255 - 150 * lk)) / 255;
      bch = 255 - ((255 - bch) * (255 - 40 * lk)) / 255;

      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(bch);
    }
  }
}

// ───────────────────────────── public entry ─────────────────────────────────

/**
 * Apply a Papic style to a canvas IN PLACE. The canvas must already hold the
 * captured frame (drawn from the live video). ORIG is a real pass too (subtle
 * polish), so every captured photo gets a deliberate look.
 *
 * MUST run AFTER the clean frame has been used for face embedding — see the
 * integration contract at the top of this file.
 */
export function applyPapicStyle(
  canvas: HTMLCanvasElement,
  style: PapicStyle,
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  if (!w || !h) return;
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;

  switch (style) {
    case 'RETRO':
      applyRetro(data, w, h);
      break;
    case 'MONO':
      applyMono(data, w, h);
      break;
    case 'CINE':
      applyCine(data, w, h);
      break;
    case 'LOMO':
      applyLomo(data, w, h);
      break;
    case 'ORIG':
    default:
      applyOrig(data, w, h);
      break;
  }

  ctx.putImageData(image, 0, 0);
}
