// lib/papic-seat-lane.ts — the pure rules of a seat camera's lane on the ONE Papic camera
// (app/api/papic/seat-capture/route.ts). Pure: no I/O, so the route and its unit test read the same rules.

import type { PapicGeoInput } from '@/lib/papic-geo';
import type { CaptureTier } from '@/lib/papic-upload/tiers';

/** The tiers a seat sends: a photo's original; a clip's poster + raw. Everything else the server makes. */
export const SEAT_TIERS: Readonly<Record<'photo' | 'clip', readonly CaptureTier[]>> = {
  photo: ['original'],
  clip: ['poster', 'clip_raw'],
};

/** Content types a seat object may carry, so the record step can find the key the phone wrote. */
export const RECORD_TYPES: Readonly<Partial<Record<CaptureTier, readonly string[]>>> = {
  original: ['image/jpeg', 'image/webp'],
  poster: ['image/jpeg', 'image/webp'],
  clip_raw: ['video/mp4', 'video/webm'],
};

/**
 * `recordSeatCapture`'s refusals, in the uploader's words (lib/papic-upload/schedule.ts `classifyAnswer`):
 * credits → kept until a top-up · window / paid order / put-away / uploads off / reissued → kept and asked again ·
 * a transient fault → retried. Nothing here may read as a photograph that landed.
 */
export function seatRefusal(code: string): { status: number; error: string } {
  switch (code) {
    case 'camera_points_exhausted':
    case 'camera_photo_cap':
    case 'camera_video_cap':
      return { status: 402, error: 'camera_points_exhausted' };
    case 'capture_not_started':
    case 'capture_window_closed':
    case 'uploads_closed':
    case 'event_put_away':
    case 'awaiting_payment':
    case 'not_owned':
    case 'revoked':
    case 'not_your_seat':
      return { status: 403, error: code };
    case 'clip_too_long':
      return { status: 422, error: 'too_long' };
    case 'missing_input':
      return { status: 422, error: 'bad_request' };
    default:
      // too_fast · record_failed · unavailable · lookup_failed · unauthenticated · anything new → try again.
      return { status: 503, error: code || 'record_failed' };
  }
}

/** A face vector list the matcher may take: ≤ 50 faces of 128 finite numbers. Anything else is dropped. */
export function faceVectorsOf(raw: unknown): number[][] {
  if (!Array.isArray(raw)) return [];
  const out: number[][] = [];
  for (const v of raw.slice(0, 50)) {
    if (Array.isArray(v) && v.length === 128 && v.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      out.push(v as number[]);
    }
  }
  return out;
}

export function geoOf(raw: unknown): PapicGeoInput | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const g = raw as Record<string, unknown>;
  if (g.unavailable === true) return { unavailable: true };
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const lat = num(g.lat);
  const lon = num(g.lon);
  if (lat === null || lon === null) return { unavailable: true };
  return { lat, lon, accuracyM: num(g.accuracyM) };
}

