// lib/papic-upload/lanes.ts — the small JSON calls a shot makes on its way up.
//
// Three lanes, one shape: the guest camera (/api/papic/guest-capture, cookie
// session), the supplier camera (/api/vendor/papic-capture, signed-in
// supplier) and a claimed seat camera (/api/papic/seat-capture, the seat's
// signed-in claimer — the host's own camera among them). NONE carries file bytes — the routes refuse them (Vercel caps a
// function body at 4.5 MB; measured 413 in production 2026-10-23).

import { CLIENT_CAPTURE_ID_FIELD } from '../papic-client-capture-id';
import type { QueuedShot } from './schedule';
import type { CaptureLane, CaptureTier } from './tiers';

export const LANE_ENDPOINT: Readonly<Record<CaptureLane, string>> = {
  guest: '/api/papic/guest-capture',
  vendor: '/api/vendor/papic-capture',
  seat: '/api/papic/seat-capture',
};

export interface LaneAnswer {
  httpStatus: number;
  body: Record<string, unknown> | null;
}

/** The fields every op carries for this shot. */
export function shotFields(shot: QueuedShot): Record<string, unknown> {
  const base: Record<string, unknown> = {
    [CLIENT_CAPTURE_ID_FIELD]: shot.id,
    media_type: shot.media,
    // 🔒 Every call names the event the shot was TAKEN at and who took it — the
    // route refuses (and the phone waits) when this phone's pass or sign-in now
    // speaks for another event or another person (review 2026-10-23, blocker 2).
    event_id: shot.eventId,
    // 🕐 The shutter — the window is judged by it, not by arrival.
    captured_at_ms: shot.capturedAtMs,
  };
  if (shot.ownerTag) base.owner_tag = shot.ownerTag;
  // 📷 The chapter the camera showed at the shutter — every op, so sign and record judge the same shot the same way.
  if (shot.chapterId) base.chapter_id = shot.chapterId;
  // 📲 Added from the phone's gallery — priced at the upload price, held to the event day (guest upload v2).
  if (shot.source === 'phone') base.source = 'phone';
  if (shot.lane === 'vendor') base.consent = shot.consent === true;
  return base;
}

export function signBody(shot: QueuedShot, tier: CaptureTier): Record<string, unknown> {
  const t = shot.tiers[tier]!;
  return {
    ...shotFields(shot),
    op: 'sign',
    tier,
    content_type: t.contentType,
    size_bytes: t.size,
    ...(shot.durationMs ? { duration_ms: shot.durationMs } : {}),
  };
}

export function recordBody(shot: QueuedShot): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...shotFields(shot),
    op: 'record',
  };
  if (shot.durationMs) body.duration_ms = shot.durationMs;
  if (shot.lane === 'guest') {
    if (shot.sharePublicly) body.share_publicly = true;
    if (shot.faceVectors && shot.faceVectors.length > 0) body.face_vectors = shot.faceVectors;
    if (shot.subjectCenter) body.subject_center = shot.subjectCenter;
    // 🏷 The phone burned the event's mark into the copies it sent — else the server marks its own.
    if (shot.copiesMarked) body.copies_marked = true;
  } else {
    if (shot.deviceModel) body.device_model = shot.deviceModel;
    if (shot.lane === 'seat') {
      // 📷 A seat records through `recordSeatCapture`, which stamps the location (when the RA 10173 control is on)
      // and matches the faces read on the phone (`autoTagSeatCapture`) — the two things the old seat screen sent.
      if (shot.faceVectors && shot.faceVectors.length > 0) body.face_vectors = shot.faceVectors;
      if (shot.geo) body.geo = shot.geo;
    }
  }
  return body;
}

export function attachBody(shot: QueuedShot, tiers: readonly CaptureTier[]): Record<string, unknown> {
  return { ...shotFields(shot), op: 'attach', tiers };
}

export async function callLane(lane: CaptureLane, body: Record<string, unknown>): Promise<LaneAnswer> {
  try {
    const res = await fetch(LANE_ENDPOINT[lane], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { httpStatus: res.status, body: json };
  } catch {
    return { httpStatus: 0, body: null };
  }
}
