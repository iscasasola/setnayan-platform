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
import { ZOOM_MAX, ZOOM_MIN, frameScale, type Framing, type StoredFraming } from './photo-frame-display';

// The display half (crop, CSS, reading the framing back) lives in ./photo-frame-display so a page that only
// DRAWS a framed photo does not carry the Frame step's gestures; it is all re-exported here.
export {
  ZOOM_MAX,
  ZOOM_MIN,
  clampFraming,
  deriveRect,
  frameRect,
  frameScale,
  framedImageStyle,
  framingFromRef,
  rectImageStyle,
  type Framing,
  type StoredFraming,
} from './photo-frame-display';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type { FrameShape } from './photo-frame-shape';
export { FRAME_ASPECT } from './photo-frame-shape';

export const DEFAULT_FRAMING: Readonly<Framing> = Object.freeze({ focusX: 0.5, focusY: 0.5, zoom: 1 });

/* ── snapping, as the shipped logo editor (`snapInFrame` / LOGO_SLIDER_SNAP) ── */

/** The photo's centre settles on the frame's centre lines within this many CSS px… */
export const SNAP_PX = 7;
/** …and lets go only past this many, so there is no sticky feel. */
export const RELEASE_PX = 11;
/** Zoom settles on exactly 1× within 8 %. */
export const ZOOM_SNAP = 0.08;

/* ── the framing in the stored name ────────────────────────────────────── */

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
