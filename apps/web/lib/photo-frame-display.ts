/**
 * THE DISPLAY HALF of the photo frame (Photo Frame Template, 2026-11-04; slice A1b): the framing's crop
 * (`frameRect` / `deriveRect`), its CSS (`rectImageStyle`) and reading it back from a stored name
 * (`framingFromRef` / `framedImageStyle`). Every rule is documented in `lib/photo-frame.ts`, which
 * re-exports all of this — import from there unless you only DRAW a framed photo.
 *
 * Kept apart because `FramedImg` draws the supplier avatar on every event page: a module in a shared chunk
 * keeps every export any chunk uses, so the Frame step's gestures and snapping rode along into every page's
 * first load while this lived in one file (+1.4 KB gzipped in the Maker's, measured 2026-11-04).
 */
import { FRAME_ASPECT, type Box, type FrameShape } from './photo-frame-shape';

export type Framing = { focusX: number; focusY: number; zoom: number };

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The scale (CSS px per original px) a frame of fw×fh shows the image at. */
export function frameScale(iw: number, ih: number, fw: number, fh: number, zoom: number): number {
  return Math.max(fw / iw, fh / ih) * zoom;
}

/** Hold the focus so the crop can never leave the image (the editor's `clampFocus`). */
export function clampFraming(iw: number, ih: number, aspect: number, f: Framing): Framing {
  const zoom = clamp(f.zoom, ZOOM_MIN, ZOOM_MAX);
  // Work in a unit frame of the right aspect; the clamp is scale-free.
  const fw = aspect;
  const fh = 1;
  const sc = frameScale(iw, ih, fw, fh, zoom);
  const hw = fw / (2 * sc * iw);
  const hh = fh / (2 * sc * ih);
  return {
    focusX: hw >= 0.5 ? 0.5 : clamp(f.focusX, hw, 1 - hw),
    focusY: hh >= 0.5 ? 0.5 : clamp(f.focusY, hh, 1 - hh),
    zoom,
  };
}

/** The frame crop, in ORIGINAL pixels. */
export function frameRect(iw: number, ih: number, aspect: number, f: Framing): Box {
  const c = clampFraming(iw, ih, aspect, f);
  const sc = frameScale(iw, ih, aspect, 1, c.zoom);
  const w = aspect / sc;
  const h = 1 / sc;
  const left = clamp(c.focusX * iw - w / 2, 0, iw - w);
  const top = clamp(c.focusY * ih - h / 2, 0, ih - h);
  return { left, top, width: w, height: h };
}

/**
 * Any other place, of aspect A: widen (or grow down) from the frame crop —
 * never less, unless the original runs out, then cut from the TOP.
 */
export function deriveRect(iw: number, ih: number, aspect: number, f: Framing, A: number): Box {
  const fr = frameRect(iw, ih, aspect, f);
  let w: number;
  let h: number;
  if (A >= fr.width / fr.height) {
    h = fr.height;
    w = h * A;
  } else {
    w = fr.width;
    h = w / A;
  }
  if (w > iw) {
    w = iw;
    h = w / A;
  }
  if (h > ih) {
    h = ih;
    w = h * A;
  }
  // Narrower than the frame (a tall place on a short original): keep the
  // frame's RIGHT edge, the mark's side — the horizontal twin of the contract's
  // "cut from the top, keeping the frame's bottom edge". (The prototype centres
  // here; centred, a 5:7 card on a wide photo shaves the plate's right end.)
  let x = w >= fr.width ? fr.left + fr.width / 2 - w / 2 : fr.left + fr.width - w;
  let y = h >= fr.height ? fr.top + fr.height / 2 - h / 2 : fr.top + fr.height - h;
  x = clamp(x, 0, iw - w);
  y = clamp(y, 0, ih - h);
  return { left: x, top: y, width: w, height: h };
}

/**
 * The CSS that draws `rect` of an iw×ih image filling a box of any size:
 * an absolutely-positioned <img> inside a `position:relative; overflow:hidden`
 * box. Percentages, so it holds at every width with no measurement.
 */
export function rectImageStyle(iw: number, ih: number, rect: Box): {
  position: 'absolute';
  left: string;
  top: string;
  width: string;
  height: string;
  maxWidth: 'none';
} {
  const pct = (n: number) => `${(Math.round(n * 1e4) / 1e2).toString()}%`;
  return {
    position: 'absolute',
    left: pct(-rect.left / rect.width),
    top: pct(-rect.top / rect.height),
    width: pct(iw / rect.width),
    height: pct(ih / rect.height),
    maxWidth: 'none',
  };
}

export type StoredFraming = Framing & { width: number; height: number };

const FR_RE = /-fr-(\d{1,5})-(\d{1,5})-(\d{3,4})-(\d{1,5})x(\d{1,5})\.[a-z0-9]+(?=$|[?#])/;

/** Read the framing back from a ref or a URL; null for a photo never framed. */
export function framingFromRef(ref: string | null | undefined): StoredFraming | null {
  if (!ref) return null;
  const m = FR_RE.exec(ref);
  if (!m) return null;
  const f = {
    focusX: Number(m[1]) / 1e4,
    focusY: Number(m[2]) / 1e4,
    zoom: Number(m[3]) / 1e3,
    width: Number(m[4]),
    height: Number(m[5]),
  };
  if (!(f.width > 0 && f.height > 0) || f.focusX > 1 || f.focusY > 1 || f.zoom < ZOOM_MIN || f.zoom > ZOOM_MAX) return null;
  return f;
}

/** The style that shows a framed photo in a box of aspect A (null = not framed; draw it as before). */
export function framedImageStyle(ref: string | null | undefined, shape: FrameShape, A: number) {
  const f = framingFromRef(ref);
  if (!f) return null;
  return rectImageStyle(f.width, f.height, deriveRect(f.width, f.height, FRAME_ASPECT[shape], f, A));
}
