/**
 * open-shop-logo.ts — a shop logo's frame, and where the logo is asked (owner, the 2026-11-06 gate walk, A2; the
 * frame reshaped 7 Nov, prototype v21, A3).
 *
 * Owner, verbatim: logo *"if it does not want to upload, then it has no use here"* (step 1 refused signed-out:
 * "You must be signed in to upload"), *"zoom and align"*, then (7 Nov) *"drag and pinch to zoom"* and *"change and
 * save automatically"*. So:
 *   • the logo leaves step 1 and is asked RIGHT AFTER the shop opens, signed in, on its own screen
 *     (`OPEN_SHOP_LOGO_PATH`) — Skip lands on Today, where "Add your logo" stays a first step;
 *   • the frame is continuous — x / y 0–100 and zoom 100–300 (`lib/picture-frame.ts`), set by dragging and pinching the
 *     circle itself (`PictureFrameControl`), stored beside the logo (`vendor_profiles.logo_focal_x` / `logo_focal_y` /
 *     `logo_zoom`, migration 20271316444107) so moving the frame never needs a re-upload;
 *   • every logo surface draws through `logoFrameStyle` → `pictureFrameStyle`.
 *
 * The keypad + "How close" menu this replaced (the Maker's 9-point `HUB_FOCAL_POINTS` + `HUB_ZOOMS`) never shipped:
 * the migration was reshaped before it reached production.
 */
import type { CSSProperties } from 'react';

import {
  DEFAULT_PICTURE_FRAME,
  PICTURE_FRAME_FIELDS,
  pictureFrameStyle,
  pictureFrameValues,
  readPictureFrame,
  type PictureFrame,
} from './picture-frame';

/** The screen right after "Open my shop": "Add your logo". */
export const OPEN_SHOP_LOGO_PATH = '/open-shop/logo';

/** How a logo sits in its round frame. */
export type LogoFrame = PictureFrame;

export const DEFAULT_LOGO_FRAME: LogoFrame = DEFAULT_PICTURE_FRAME;

/** The form field names the logo's frame posts under — the column names, one for one (`PICTURE_FRAME_FIELDS.logo`). */
export const LOGO_FRAME_INPUTS = PICTURE_FRAME_FIELDS.logo;

type LogoFrameRow = { logo_focal_x?: unknown; logo_focal_y?: unknown; logo_zoom?: unknown };

/** Read the three columns (or three form fields). Anything outside its range is dropped to the default. */
export function readLogoFrame(row: LogoFrameRow | null | undefined): LogoFrame {
  return readPictureFrame(row?.logo_focal_x, row?.logo_focal_y, row?.logo_zoom);
}

/** Read the frame a form posted (`LOGO_FRAME_INPUTS`). */
export function readLogoFrameFromForm(form: FormData): LogoFrame {
  return readLogoFrame({
    logo_focal_x: form.get(LOGO_FRAME_INPUTS.x),
    logo_focal_y: form.get(LOGO_FRAME_INPUTS.y),
    logo_zoom: form.get(LOGO_FRAME_INPUTS.zoom),
  });
}

/** Does this form carry the frame control at all? (An older client posts the logo alone and keeps its frame.) */
export function formCarriesLogoFrame(form: FormData): boolean {
  return form.has(LOGO_FRAME_INPUTS.x) || form.has(LOGO_FRAME_INPUTS.y) || form.has(LOGO_FRAME_INPUTS.zoom);
}

/** The columns to write for a frame — NULL for a default value, so an untouched logo stores nothing. */
export function logoFrameColumns(frame: LogoFrame): {
  logo_focal_x: number | null;
  logo_focal_y: number | null;
  logo_zoom: number | null;
} {
  const v = pictureFrameValues(frame);
  return { logo_focal_x: v.x, logo_focal_y: v.y, logo_zoom: v.zoom };
}

/** The `<img>` style every logo surface uses (with `object-fit: cover`). */
export function logoFrameStyle(frame: LogoFrame | null | undefined): CSSProperties {
  return pictureFrameStyle(frame);
}

/**
 * 🔎 WHETHER A LOGO SAVE MUST BE QR-SCANNED (controller, 7 Nov — "skip the server QR check when only focal/zoom
 * changed, IF the action can tell"). The action CAN tell, and only from the database, never from the form: it reads
 * the stored `logo_url` and compares. The SAME picture as stored = a frame-only save (every drag / pinch on the
 * autosaving logo step); that picture was scanned when it went in, and the admin retro-scan sweeps stored logos —
 * so no second download + decode per gesture. A NEW or DIFFERENT picture is always scanned; a failed read
 * (`stored` undefined) scans too — it fails toward the check, never away from it. A removal has nothing to scan.
 * Held by app/open-shop/the-logo-is-framed-by-hand.test.ts.
 */
export function logoNeedsQrScan(next: string | null, stored: string | null | undefined): boolean {
  if (!next) return false;
  if (stored === undefined) return true;
  return next !== stored;
}
