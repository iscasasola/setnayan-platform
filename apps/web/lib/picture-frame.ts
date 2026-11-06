/**
 * picture-frame.ts — how a picture sits in a round frame: drag to move, pinch to zoom (owner 7 Nov, prototype v21
 * `open_shop_redesign_2026-11-06/open-shop-redesign.html`, the logo step: *"drag and pinch to zoom"*, *"change and
 * save automatically"*). Shared by every round-photo surface — the shop logo first, the profile picture (A4) next —
 * through ONE control, `app/_components/picture-frame-control.tsx`.
 *
 * A frame is three whole numbers:
 *   x, y  — object-position, 0–100 % (50 · 50 = centred)
 *   zoom  — 100–300 % (100 = the picture just covers the circle · 300 = 3×)
 *
 * 🔑 GEOMETRY (cover). The picture is W × H with min(W, H) = the circle D. With `object-fit: cover`,
 * `object-position: x% y%` and `transform: scale(z)` about the SAME point, the picture's left edge sits at
 * x·(D − W·z) and its top at y·(D − H·z) — both ≤ 0 for every x, y ∈ [0, 1] and z ≥ 1. So the clamp that keeps the
 * circle full is simply x, y ∈ [0, 100] and zoom ∈ [100, 300]: an empty edge cannot be drawn.
 *
 * Pure — no DOM. The control measures the circle (D) and the picture's aspect and hands them in.
 */
import type { CSSProperties } from 'react';

export type PictureFrame = { x: number; y: number; zoom: number };

export const PICTURE_ZOOM_MIN = 100;
export const PICTURE_ZOOM_MAX = 300;
/** One press of − or + (and one keyboard step). */
export const PICTURE_ZOOM_STEP = 10;

export const DEFAULT_PICTURE_FRAME: PictureFrame = { x: 50, y: 50, zoom: 100 };

/**
 * Each framed picture's three stored columns — also the form fields its control posts (`PictureFrameControl
 * picture="…"`). A new framed picture adds ONE line here and mounts the same control.
 */
export const PICTURE_FRAME_FIELDS = {
  logo: { x: 'logo_focal_x', y: 'logo_focal_y', zoom: 'logo_zoom' },
} as const;

export type FramedPicture = keyof typeof PICTURE_FRAME_FIELDS;

/** The circle's size in px and the picture's natural width ÷ height (1 until it has loaded). */
export type FrameBox = { size: number; aspect: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Tenths while a finger moves (smooth); whole numbers when stored (`storedPictureFrame`). */
const r1 = (v: number) => Math.round(v * 10) / 10;

function cover(box: FrameBox) {
  const D = box.size > 0 ? box.size : 1;
  const a = Number.isFinite(box.aspect) && box.aspect > 0 ? box.aspect : 1;
  return { D, W: D * Math.max(1, a), H: D * Math.max(1, 1 / a) };
}

/** Move the picture by (dx, dy) circle px — only along an axis that has slack; the picture follows the finger. */
export function panPictureFrame(frame: PictureFrame, box: FrameBox, dx: number, dy: number): PictureFrame {
  const { D, W, H } = cover(box);
  const z = frame.zoom / 100;
  const sx = W * z - D;
  const sy = H * z - D;
  return {
    ...frame,
    x: sx > 0.5 ? r1(clamp(frame.x - (dx / sx) * 100, 0, 100)) : frame.x,
    y: sy > 0.5 ? r1(clamp(frame.y - (dy / sy) * 100, 0, 100)) : frame.y,
  };
}

/** Zoom to `zoom` %, keeping the picture point under (mx, my) — circle px — still. */
export function zoomPictureFrameAt(frame: PictureFrame, box: FrameBox, zoom: number, mx: number, my: number): PictureFrame {
  const { D, W, H } = cover(box);
  const z = frame.zoom / 100;
  const z2 = clamp(Math.round(zoom), PICTURE_ZOOM_MIN, PICTURE_ZOOM_MAX);
  const zz = z2 / 100;
  const left = (frame.x / 100) * (D - W * z);
  const top = (frame.y / 100) * (D - H * z);
  const u = (mx - left) / (W * z);
  const v = (my - top) / (H * z);
  const sx = D - W * zz;
  const sy = D - H * zz;
  return {
    zoom: z2,
    x: sx < -0.5 ? r1(clamp(((mx - u * W * zz) / sx) * 100, 0, 100)) : frame.x,
    y: sy < -0.5 ? r1(clamp(((my - v * H * zz) / sy) * 100, 0, 100)) : frame.y,
  };
}

/** The `<img>` style every framed surface uses (with `object-fit: cover`): the same point positions and scales. */
export function pictureFrameStyle(frame: PictureFrame | null | undefined): CSSProperties {
  const f = frame ?? DEFAULT_PICTURE_FRAME;
  const position = `${f.x}% ${f.y}%`;
  return f.zoom === PICTURE_ZOOM_MIN
    ? { objectPosition: position }
    : { objectPosition: position, transform: `scale(${f.zoom / 100})`, transformOrigin: position };
}

/** Whole numbers inside the ranges — what is posted and stored. */
export function storedPictureFrame(frame: PictureFrame): PictureFrame {
  return {
    x: Math.round(clamp(frame.x, 0, 100)),
    y: Math.round(clamp(frame.y, 0, 100)),
    zoom: Math.round(clamp(frame.zoom, PICTURE_ZOOM_MIN, PICTURE_ZOOM_MAX)),
  };
}

const wholeIn = (v: unknown, lo: number, hi: number): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};

/**
 * Read three stored values (columns or form fields). Each one outside its range — or not a whole number — is DROPPED
 * to its default, never repaired (the Maker sanitiser's rule): a value nobody chose is not drawn as a guess.
 */
export function readPictureFrame(x: unknown, y: unknown, zoom: unknown): PictureFrame {
  return {
    x: wholeIn(x, 0, 100) ?? DEFAULT_PICTURE_FRAME.x,
    y: wholeIn(y, 0, 100) ?? DEFAULT_PICTURE_FRAME.y,
    zoom: wholeIn(zoom, PICTURE_ZOOM_MIN, PICTURE_ZOOM_MAX) ?? DEFAULT_PICTURE_FRAME.zoom,
  };
}
