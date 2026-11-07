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
 * 🔑 NO NEW CROPPER. The sets, their meaning and the object-position math are `lib/hub-canvas.ts`'s; this file only
 * reads the two columns into those types (drop, never repair — the Maker's own sanitiser rule).
 */
import type { CSSProperties } from 'react';

import {
  HUB_DEFAULT_FOCAL,
  HUB_DEFAULT_ZOOM,
  HUB_FOCAL_POINTS,
  HUB_ZOOMS,
  focalToObjectPosition,
  type HubFocalPoint,
  type HubZoom,
} from './hub-canvas';

/** The screen right after "Open my shop": "Add your logo". */
export const OPEN_SHOP_LOGO_PATH = '/open-shop/logo';

/** How a logo sits in its round frame. */
export type LogoFrame = { focal: HubFocalPoint; zoom: HubZoom };

export const DEFAULT_LOGO_FRAME: LogoFrame = { focal: HUB_DEFAULT_FOCAL, zoom: HUB_DEFAULT_ZOOM };

/** The Maker's "How close" words, unchanged (`scene-background-row.tsx`). */
export const LOGO_ZOOM_LABEL: Record<HubZoom, string> = { 100: 'As it is', 120: 'Closer', 150: 'Closest' };

const inSet = <T,>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

/** Read the two columns (or two form fields). Anything outside the closed sets is dropped to the default. */
export function readLogoFrame(row: { logo_focal?: unknown; logo_zoom?: unknown } | null | undefined): LogoFrame {
  const f = Number(row?.logo_focal);
  const z = Number(row?.logo_zoom);
  return {
    focal: inSet(HUB_FOCAL_POINTS, f) ? f : HUB_DEFAULT_FOCAL,
    zoom: inSet(HUB_ZOOMS, z) ? z : HUB_DEFAULT_ZOOM,
  };
}

/** The columns to write for a frame — NULL for a default, so an untouched logo stores nothing. */
export function logoFrameColumns(frame: LogoFrame): { logo_focal: number | null; logo_zoom: number | null } {
  return {
    logo_focal: frame.focal === HUB_DEFAULT_FOCAL ? null : frame.focal,
    logo_zoom: frame.zoom === HUB_DEFAULT_ZOOM ? null : frame.zoom,
  };
}

/** The `<img>` style every logo surface uses: the Maker's object-position + the same zoom, from the same point. */
export function logoFrameStyle(frame: LogoFrame | null | undefined): CSSProperties {
  const f = frame ?? DEFAULT_LOGO_FRAME;
  const position = focalToObjectPosition(f.focal);
  return f.zoom === HUB_DEFAULT_ZOOM
    ? { objectPosition: position }
    : { objectPosition: position, transform: `scale(${f.zoom / 100})`, transformOrigin: position };
}
