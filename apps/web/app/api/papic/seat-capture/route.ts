// app/api/papic/seat-capture/route.ts — a claimed SEAT camera's lane on the ONE Papic camera.
//
// 📷 OWNER 2026-11-22: *"we only have one camera interface and that should be it"* · *"a no scroll full screen
// camera page"*. A seat camera (the host's own camera, and every camera a host hands out) used to run its own,
// older screen (`papic-seat-capture.tsx`) with its own sender. It now shoots on the approved camera
// (`app/papic/guest/_components/papic-guest-capture.tsx`, prototype papic_camera_complete_2026-10-24) and sends
// through the shared uploader (`lib/papic-upload/`), whose 'seat' lane calls THIS route.
//
// 🔑 NOTHING ABOUT WHAT A SEAT SHOT COSTS OR WHO MAY TAKE ONE MOVED HERE. The record step calls
// `recordSeatCapture` (app/papic/actions.ts) — the seat's whole fence: the burst limiter, the 10-second clip cap,
// the capture window, the paid-order gate, the put-away gate, the RA 10173 geo control, the uploads switch, and
// the credit reservation + insert in ONE transaction (`papic_record_seat_capture`). This route only:
//   · sign   — presigns the ONE object a tier may be written to, in the seat's own folder
//              (`papic/event-<event>/seat-<seat>/…`, the folder `/api/upload`'s seat branch has always minted and
//              `papicSeatCapturePolicy` pins the recorded ref to);
//   · record — checks the object landed, then hands its ref to `recordSeatCapture`, and the phone's face
//              vectors to `autoTagSeatCapture` (the old screen's two calls, unchanged);
//   · attach — nothing: a seat sends its original alone and the server makes the copies, as it always has.
//
// 🔒 IDEMPOTENT ON THE SHUTTER'S OWN ID. The key carries the shot's client capture id, so a retry whose first
// answer was lost finds the row that already holds that key and is answered with it — it is never recorded (or
// charged) twice. The old seat screen had no such check.
//
// 🚫 JSON ONLY. The bytes go straight to R2 on the presigned PUT (Vercel refuses a body over 4.5 MB).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isR2Configured, r2Head, R2_BUCKETS } from '@/lib/r2';
import { presignUploadUrl, encodeR2Ref } from '@/lib/uploads';
import { readClientCaptureId, CLIENT_CAPTURE_ID_FIELD } from '@/lib/papic-client-capture-id';
import {
  CAPTURE_PUT_TTL_SECONDS,
  TIER_RULES,
  captureTierKey,
  isCaptureTier,
  validateTierRequest,
  type CaptureTier,
} from '@/lib/papic-upload/tiers';
import { autoTagSeatCapture, recordSeatCapture } from '@/app/papic/actions';
import { RECORD_TYPES, SEAT_TIERS, faceVectorsOf, geoOf, seatRefusal } from '@/lib/papic-seat-lane';

export const dynamic = 'force-dynamic';

const MAX_JSON_BYTES = 64 * 1024;
const BUCKET = R2_BUCKETS.media;

type Body = Record<string, unknown>;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json({ error: 'bytes_not_accepted' }, 415);
  }
  let body: Body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_JSON_BYTES) return json({ error: 'bad_request' }, 413);
    body = JSON.parse(raw) as Body;
    if (!body || typeof body !== 'object') throw new Error('shape');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const token = typeof body.owner_tag === 'string' ? body.owner_tag.trim() : '';
  const eventId = typeof body.event_id === 'string' ? body.event_id.trim() : '';
  const clientCaptureId = readClientCaptureId(body[CLIENT_CAPTURE_ID_FIELD]);
  if (!token || !eventId || !clientCaptureId) return json({ error: 'bad_request' }, 400);
  const media: 'photo' | 'clip' = body.media_type === 'clip' ? 'clip' : 'photo';

  // 1. The seat's claimer, signed in. RLS returns the row only to its claimer, so the read is the authorization.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'unauthenticated' }, 401);
  const { data: seat, error: seatErr } = await supabase
    .from('paparazzi_seats')
    .select('seat_id, event_id, revoked_at, claimer_user_id')
    .eq('claim_qr_token', token)
    .maybeSingle();
  if (seatErr) {
    console.error('[supabase-error] app/api/papic/seat-capture/route.ts · from:paparazzi_seats.select', seatErr);
    return json({ error: 'lookup_failed' }, 503);
  }
  // Another person's camera on this phone: the shot waits for its own camera to be open again (never recorded here).
  if (!seat || seat.claimer_user_id !== user.id) return json({ error: 'other_owner' }, 409);
  if (seat.event_id !== eventId) return json({ error: 'other_event' }, 409);
  if (seat.revoked_at) return json({ error: 'revoked' }, 403);
  if (!isR2Configured()) return json({ error: 'uploads_unavailable' }, 503);

  const seatId = seat.seat_id as string;
  const keyFor = (tier: CaptureTier, contentType: string) =>
    captureTierKey({ lane: 'seat', ownerId: seatId, eventId, clientCaptureId, tier, contentType });
  const mainTier: CaptureTier = media === 'clip' ? 'clip_raw' : 'original';

  /** The row this shot already made, if a first answer was lost — found by the keys only this shot can own. */
  const admin = createAdminClient();
  const recordedRow = async (): Promise<{ photo_id: string } | null | 'error'> => {
    const refs = (RECORD_TYPES[mainTier] ?? [])
      .map((t) => keyFor(mainTier, t))
      .filter((k): k is string => !!k)
      .map((k) => encodeR2Ref(BUCKET, k));
    if (refs.length === 0) return null;
    const { data, error } = await admin
      .from('papic_photos')
      .select('photo_id')
      .eq('paparazzi_seat_id', seatId)
      .in('r2_object_key', refs)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] app/api/papic/seat-capture/route.ts · from:papic_photos.select(r2_object_key)', error);
      return 'error';
    }
    return (data as { photo_id: string } | null) ?? null;
  };

  const op = body.op;

  // ── sign ──────────────────────────────────────────────────────────────────
  if (op === 'sign') {
    const tier = body.tier;
    if (!isCaptureTier(tier) || !SEAT_TIERS[media].includes(tier)) return json({ error: 'bad_tier' }, 400);
    const contentType = typeof body.content_type === 'string' ? body.content_type : '';
    const sizeBytes = Number(body.size_bytes);
    const valid = validateTierRequest({ tier, contentType, sizeBytes });
    if (!valid.ok) return json({ error: valid.error }, 400);
    const prior = await recordedRow();
    if (prior === 'error') return json({ error: 'lookup_failed' }, 503);
    if (prior) return json({ status: 'ok', already: true, captureId: prior.photo_id }, 200);
    const key = keyFor(tier, contentType);
    if (!key) return json({ error: 'bad_tier' }, 400);
    try {
      const uploadUrl = await presignUploadUrl({
        bucket: BUCKET,
        key,
        contentType: contentType.split(';')[0]!.trim().toLowerCase(),
        sizeBytes,
        ttlSeconds: CAPTURE_PUT_TTL_SECONDS,
      });
      return json({ status: 'ok', uploadUrl }, 200);
    } catch (err) {
      console.error('[papic-seat-capture] presign failed', err instanceof Error ? err.message : err);
      return json({ error: 'sign_failed' }, 503);
    }
  }

  // ── record ────────────────────────────────────────────────────────────────
  if (op === 'record') {
    const prior = await recordedRow();
    if (prior === 'error') return json({ error: 'lookup_failed' }, 503);
    if (prior) return json({ status: 'ok', captureId: prior.photo_id, wantFull: false }, 200);

    /** Find the object the phone wrote for a tier (whichever allowed type it carried), within that tier's size rule. */
    const landed = async (tier: CaptureTier): Promise<string | null> => {
      for (const type of RECORD_TYPES[tier] ?? []) {
        const key = keyFor(tier, type);
        if (!key) continue;
        const head = await r2Head({ bucket: BUCKET, key });
        if (!head) continue;
        const rule = TIER_RULES[tier];
        if (!Number.isFinite(head.size) || head.size < rule.minBytes || head.size > rule.maxBytes) return null;
        return encodeR2Ref(BUCKET, key);
      }
      return null;
    };
    const mainRef = await landed(mainTier);
    if (!mainRef) return json({ error: 'object_missing', missing: [mainTier] }, 409);
    const posterRef = media === 'clip' ? await landed('poster') : null;

    const durationMs =
      typeof body.duration_ms === 'number' && Number.isFinite(body.duration_ms) && body.duration_ms > 0
        ? Math.round(body.duration_ms)
        : undefined;
    const capturedAtMs =
      typeof body.captured_at_ms === 'number' && Number.isFinite(body.captured_at_ms) ? body.captured_at_ms : undefined;
    const chapterId = typeof body.chapter_id === 'string' && body.chapter_id ? body.chapter_id : null;

    const result = await recordSeatCapture(
      token,
      mainRef,
      media,
      posterRef ?? undefined,
      durationMs,
      geoOf(body.geo),
      capturedAtMs,
      chapterId,
    );
    if (!result.ok) {
      const r = seatRefusal(result.error);
      return json({ error: r.error }, r.status);
    }

    // 🙂 Faces read ON THE PHONE (only the vectors travel) → the seat's matcher. Best-effort, exactly as before:
    // a missed face tag never touches the photograph.
    const vectors = media === 'photo' ? faceVectorsOf(body.face_vectors) : [];
    if (result.photoId && vectors.length > 0) {
      try {
        await autoTagSeatCapture(token, result.photoId, vectors);
      } catch {
        /* best-effort */
      }
    }
    return json(
      {
        status: 'ok',
        captureId: result.photoId,
        wantFull: false,
        count: result.count,
        ...(result.eventPool?.soft ? { poolLow: true } : {}),
      },
      200,
    );
  }

  // ── attach ────────────────────────────────────────────────────────────────
  // A seat sends every piece in its record step; there is nothing later to attach.
  if (op === 'attach') return json({ status: 'ok', wantFull: false }, 200);

  return json({ error: 'bad_request' }, 400);
}
