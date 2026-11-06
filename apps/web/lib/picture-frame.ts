/**
 * picture-frame.ts — how ONE picture sits in its round frame: the align (9-point focal) and the zoom.
 *
 * ⚖ Owner, 2026-11-06, asked whether a person's profile picture gets the same align + zoom as the business logo:
 * *"yes, use the same control"*. So the shop logo (`vendor_profiles.logo_focal` / `logo_zoom`) and the profile
 * picture (`users.profile_photo_focal` / `profile_photo_zoom`) share this ONE model, ONE `<img>` style and ONE
 * control (`app/_components/picture-frame-control.tsx`). The words and the sets are the Event Hub Maker photo's own
 * (`lib/hub-canvas.ts` · `scene-background-row.tsx`) — no new cropper.
 *
 * 🔑 Each picture only names its two columns (`PICTURE_FRAME_FIELDS`); the meaning of the numbers, how a bad value
 * is read (dropped to the default, never repaired — the Maker's sanitiser rule) and how it is drawn live here once.
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

/** How a picture sits in its round frame. */
export type PictureFrame = { focal: HubFocalPoint; zoom: HubZoom };

export const DEFAULT_PICTURE_FRAME: PictureFrame = { focal: HUB_DEFAULT_FOCAL, zoom: HUB_DEFAULT_ZOOM };

/** The Maker's "How close" words, unchanged (`scene-background-row.tsx`). */
export const PICTURE_ZOOM_LABEL: Record<HubZoom, string> = { 100: 'As it is', 120: 'Closer', 150: 'Closest' };

/** The pictures that wear a frame, and the two columns (= form fields) each one stores it in. */
export const PICTURE_FRAME_FIELDS = {
  logo: { focal: 'logo_focal', zoom: 'logo_zoom' },
  profile_photo: { focal: 'profile_photo_focal', zoom: 'profile_photo_zoom' },
} as const;

export type FramedPicture = keyof typeof PICTURE_FRAME_FIELDS;

const inSet = <T,>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

/** Read a stored or posted pair. Anything outside the closed sets is dropped to the default. */
export function readPictureFrame(focalRaw: unknown, zoomRaw: unknown): PictureFrame {
  const f = Number(focalRaw);
  const z = Number(zoomRaw);
  return {
    focal: inSet(HUB_FOCAL_POINTS, f) ? f : HUB_DEFAULT_FOCAL,
    zoom: inSet(HUB_ZOOMS, z) ? z : HUB_DEFAULT_ZOOM,
  };
}

/** The pair to write — NULL for a default, so an untouched picture stores nothing. */
export function pictureFrameValues(frame: PictureFrame): { focal: number | null; zoom: number | null } {
  return {
    focal: frame.focal === HUB_DEFAULT_FOCAL ? null : frame.focal,
    zoom: frame.zoom === HUB_DEFAULT_ZOOM ? null : frame.zoom,
  };
}

/** The `<img>` style every framed picture uses: the Maker's object-position + the same zoom, from the same point. */
export function pictureFrameStyle(frame: PictureFrame | null | undefined): CSSProperties {
  const f = frame ?? DEFAULT_PICTURE_FRAME;
  const position = focalToObjectPosition(f.focal);
  return f.zoom === HUB_DEFAULT_ZOOM
    ? { objectPosition: position }
    : { objectPosition: position, transform: `scale(${f.zoom / 100})`, transformOrigin: position };
}

/* ── The profile picture's own two columns ─────────────────────────────────────────────────────────────────── */

/** Read `users.profile_photo_focal` / `profile_photo_zoom` (or the two posted fields). */
export function readProfilePhotoFrame(
  row: { profile_photo_focal?: unknown; profile_photo_zoom?: unknown } | null | undefined,
): PictureFrame {
  return readPictureFrame(row?.profile_photo_focal, row?.profile_photo_zoom);
}

/** The `users` columns to write for a profile picture's frame. */
export function profilePhotoFrameColumns(frame: PictureFrame): {
  profile_photo_focal: number | null;
  profile_photo_zoom: number | null;
} {
  const v = pictureFrameValues(frame);
  return { profile_photo_focal: v.focal, profile_photo_zoom: v.zoom };
}
