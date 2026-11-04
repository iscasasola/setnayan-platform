/**
 * THE PHOTO FRAME — one framing per photo, every size derived from it
 * (Photo Frame Template, owner-approved 2026-11-04; slice A1b).
 *
 * 🔒 THE CONTRACT is `setnayan-handoff-src/prototypes-4nov/photo_frame_template_2026-11-04_fable.html`,
 * section "The template contract". Every function below is a rule of that
 * section, ported verbatim from its script (`frameRect`, `deriveRect`,
 * `clampFocus`, `applySnap`, `snapZoom`):
 *
 *   type Framing = { focusX, focusY, zoom }
 *     focusX, focusY ∈ [0,1]  the point of the ORIGINAL that sits at the frame's centre
 *     zoom ∈ [1, 3]           1 = the frame just covers the shorter side (no bars, ever)
 *     default {0.5, 0.5, 1}   = today's centre crop, so "Looks good" with no touch
 *                               changes nothing a viewer sees.
 *
 *   frame crop  s0 = max(fw/iw, fh/ih), scale = s0·zoom, crop fw/scale × fh/scale,
 *               centred on (focusX·iw, focusY·ih), clamped inside the image.
 *   any size    keep the crop's height and widen to A (or keep its width and grow
 *               down); wider views show more, never less; when the original runs
 *               out, cut FROM THE TOP, keeping the frame's bottom edge, so the mark
 *               stays in view.
 *
 * Pure: imported by the Frame step (browser), the display sites (server and
 * browser) and the guards. No DOM, no React.
 *
 * WHERE THE FRAMING LIVES — in the stored object's NAME. The public copy is the
 * whole original with the mark burned inside the frame; its key ends
 * `…-fr-<fx·10⁴>-<fy·10⁴>-<zoom·10³>-<w>x<h>.<ext>`. Every display already
 * reads the ref, so a display derives its crop with ZERO extra reads (owner
 * rule: one batched read per screen), and re-framing writes a new key, so no
 * CDN can serve the old framing. `supplier_photo_originals.frame` mirrors it for
 * the re-mark job; the key is the truth.
 */
import { FRAME_ASPECT, type Box, type FrameShape } from './photo-frame-shape';

export type { FrameShape } from './photo-frame-shape';
export { FRAME_ASPECT } from './photo-frame-shape';

export type Framing = { focusX: number; focusY: number; zoom: number };

export const DEFAULT_FRAMING: Readonly<Framing> = Object.freeze({ focusX: 0.5, focusY: 0.5, zoom: 1 });
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

/* ── snapping, as the shipped logo editor (`snapInFrame` / LOGO_SLIDER_SNAP) ── */

/** The photo's centre settles on the frame's centre lines within this many CSS px… */
export const SNAP_PX = 7;
/** …and lets go only past this many, so there is no sticky feel. */
export const RELEASE_PX = 11;
/** Zoom settles on exactly 1× within 8 %. */
export const ZOOM_SNAP = 0.08;

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

/* ── the framing in the stored name ────────────────────────────────────── */

export type StoredFraming = Framing & { width: number; height: number };

const FR_RE = /-fr-(\d{1,5})-(\d{1,5})-(\d{3,4})-(\d{1,5})x(\d{1,5})\.[a-z0-9]+(?=$|[?#])/;

/** `fr-5000-5000-1000-1200x1600` — prefix a file name with it before upload. */
export function framingStem(f: StoredFraming): string {
  const n = (v: number, k: number) => Math.round(clamp(v, 0, 1e9) * k).toString();
  return `fr-${n(f.focusX, 1e4)}-${n(f.focusY, 1e4)}-${n(f.zoom, 1e3)}-${Math.round(f.width)}x${Math.round(f.height)}`;
}

/** The upload name for a framed copy: the framing, then the extension. */
export function framedFileName(original: string, f: StoredFraming): string {
  const ext = /\.([a-z0-9]+)$/i.exec(original)?.[1]?.toLowerCase() ?? 'jpg';
  return `${framingStem(f)}.${ext}`;
}

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

/* ── gestures, as pure steps (the editor feeds them pointer deltas) ───────── */

export type SnapState = { x: boolean; y: boolean; z: boolean };

/**
 * Settle a raw focus onto the centre lines (`applySnap`). `pxPerUnitX/Y` are
 * CSS px per unit of focus (sc·iw, sc·ih). Returns the resting focus and the
 * new snap state; `ticked` is true when a line was newly caught (the haptic).
 */
export function snapFocus(
  raw: { focusX: number; focusY: number },
  pxPerUnitX: number,
  pxPerUnitY: number,
  was: SnapState,
): { focusX: number; focusY: number; snap: SnapState; ticked: boolean } {
  const bx = (was.x ? RELEASE_PX : SNAP_PX) / pxPerUnitX;
  const by = (was.y ? RELEASE_PX : SNAP_PX) / pxPerUnitY;
  const nx = Math.abs(raw.focusX - 0.5) < bx;
  const ny = Math.abs(raw.focusY - 0.5) < by;
  return {
    focusX: nx ? 0.5 : raw.focusX,
    focusY: ny ? 0.5 : raw.focusY,
    snap: { x: nx, y: ny, z: was.z },
    ticked: (nx && !was.x) || (ny && !was.y),
  };
}

/** Settle zoom on exactly 1× near the bottom (`snapZoom`). */
export function snapZoom(z: number, was: SnapState): { zoom: number; snap: SnapState; ticked: boolean } {
  const nz = z < 1 + ZOOM_SNAP ? 1 : z;
  const ticked = nz === 1 && !was.z && z !== 1;
  return { zoom: clamp(nz, ZOOM_MIN, ZOOM_MAX), snap: { ...was, z: nz === 1 }, ticked };
}

/**
 * Zoom about a point (the pinch centre, the trackpad cursor): the original
 * pixel under `p` stays under `p`. `p` in frame CSS px, frame fw×fh.
 */
export function zoomAbout(
  iw: number,
  ih: number,
  fw: number,
  fh: number,
  f: Framing,
  p: { x: number; y: number },
  nextZoom: number,
): Framing {
  const sc = frameScale(iw, ih, fw, fh, f.zoom);
  const ux = f.focusX + (p.x - fw / 2) / (sc * iw);
  const uy = f.focusY + (p.y - fh / 2) / (sc * ih);
  const sc2 = frameScale(iw, ih, fw, fh, nextZoom);
  return { focusX: ux - (p.x - fw / 2) / (sc2 * iw), focusY: uy - (p.y - fh / 2) / (sc2 * ih), zoom: nextZoom };
}
