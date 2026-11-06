/**
 * open-shop-logo.ts — a shop logo's align + zoom, and where the logo is asked (owner, the 2026-11-06 gate walk, A2).
 *
 * Owner, verbatim: logo *"if it does not want to upload, then it has no use here"* (step 1 refused signed-out:
 * "You must be signed in to upload") and *"zoom and align"*. So:
 *   • the logo leaves step 1 and is asked RIGHT AFTER the shop opens, signed in, on its own screen
 *     (`OPEN_SHOP_LOGO_PATH`) — Skip lands on Today, where "Add your logo" stays a first step;
 *   • the frame is the Event Hub Maker photo's own control, reused as-is — 9-point align (`HUB_FOCAL_POINTS`) and
 *     zoom 100 / 120 / 150 (`HUB_ZOOMS`) — stored beside the logo (`vendor_profiles.logo_focal` / `logo_zoom`,
 *     migration 20271316444107), so moving the frame never needs a re-upload;
 *   • every logo surface draws through `logoFrameStyle` → `focalToObjectPosition` + zoom.
 *
 * 🔑 NO NEW CROPPER. The model, the read rule and the style are `lib/picture-frame.ts`'s — the ONE frame the logo
 * shares with the profile picture (owner 2026-11-06: *"yes, use the same control"*); this file only names the logo's
 * two columns.
 */
import {
  DEFAULT_PICTURE_FRAME,
  PICTURE_ZOOM_LABEL,
  pictureFrameStyle,
  pictureFrameValues,
  readPictureFrame,
  type PictureFrame,
} from './picture-frame';

/** The screen right after "Open my shop": "Add your logo". */
export const OPEN_SHOP_LOGO_PATH = '/open-shop/logo';

/** How a logo sits in its round frame — the ONE picture frame (`lib/picture-frame.ts`), shared with the profile picture. */
export type LogoFrame = PictureFrame;

export const DEFAULT_LOGO_FRAME: LogoFrame = DEFAULT_PICTURE_FRAME;

/** The Maker's "How close" words, unchanged (`scene-background-row.tsx`). */
export const LOGO_ZOOM_LABEL = PICTURE_ZOOM_LABEL;

/** Read the two columns (or two form fields). Anything outside the closed sets is dropped to the default. */
export function readLogoFrame(row: { logo_focal?: unknown; logo_zoom?: unknown } | null | undefined): LogoFrame {
  return readPictureFrame(row?.logo_focal, row?.logo_zoom);
}

/** The columns to write for a frame — NULL for a default, so an untouched logo stores nothing. */
export function logoFrameColumns(frame: LogoFrame): { logo_focal: number | null; logo_zoom: number | null } {
  const v = pictureFrameValues(frame);
  return { logo_focal: v.focal, logo_zoom: v.zoom };
}

/** The `<img>` style every logo surface uses — the one picture-frame style (`pictureFrameStyle`). */
export function logoFrameStyle(frame: LogoFrame | null | undefined) {
  return pictureFrameStyle(frame);
}
