import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { R2_BUCKETS, isR2Configured } from '@/lib/r2';
import { presignUploadUrl } from '@/lib/uploads';

/**
 * Iteration 0017 Patiktok — presigned-PUT endpoint for video objects.
 *
 * The generic `/api/upload` route caps the media bucket at 10 MB and only
 * whitelists images / PDF / audio — it cannot carry Patiktok video. This route
 * is the video-shaped sibling: it presigns direct-to-R2 PUTs for two kinds of
 * object, both in the public `media` bucket:
 *
 *   • kind=clip — a booth recording (≤ 60 MB), keyed
 *       patiktok/clips/{eventId}/{uuid}.{ext}
 *   • kind=reel — the rendered 9:16 MP4 (≤ 150 MB), keyed
 *       patiktok/renders/{eventId}/{jobId}.mp4
 *     (uploaded by the client-side WebCodecs renderer in PR3; the job row is
 *      finalized server-side via a service-role action, never by the browser.)
 *
 * Flow:
 *   1. Client POSTs { eventId, kind, contentType, sizeBytes, jobId? }.
 *   2. We auth via the Supabase session cookie and confirm the caller is a
 *      member of the event (booth is event-member-scoped so a coordinator can
 *      run it, not just the couple).
 *   3. We whitelist the MIME type, validate the size against the per-kind cap,
 *      and pin the object key.
 *   4. We hand back { uploadUrl, bucket, key }. The browser PUTs the body with
 *      Content-Type matching what it sent (the signature binds that header).
 */

const CLIP_MAX_BYTES = 60 * 1024 * 1024; // 60 MB — a 5–30s booth clip
const REEL_MAX_BYTES = 150 * 1024 * 1024; // 150 MB — a rendered 9:16 reel

// Browsers emit webm (Chrome/Firefox) or mp4 (Safari) from MediaRecorder, and
// the WebCodecs renderer (PR3) muxes mp4. Accept that union only.
const ALLOWED_VIDEO_MIME: ReadonlyMap<string, string> = new Map([
  ['video/webm', 'webm'],
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
]);

type RequestBody = {
  eventId?: string;
  kind?: 'clip' | 'reel';
  contentType?: string;
  sizeBytes?: number;
  jobId?: string;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return bad('invalid JSON body');
  }

  const { eventId, kind, contentType, sizeBytes, jobId } = body;

  if (typeof eventId !== 'string' || eventId.length === 0) {
    return bad('eventId required');
  }
  if (kind !== 'clip' && kind !== 'reel') {
    return bad('kind must be "clip" or "reel"');
  }
  if (kind === 'reel' && (typeof jobId !== 'string' || jobId.length === 0)) {
    return bad('jobId required for kind=reel');
  }
  if (typeof contentType !== 'string') {
    return bad('contentType required');
  }
  const ext = ALLOWED_VIDEO_MIME.get(contentType);
  if (!ext) {
    return bad(`unsupported video type: ${contentType}`);
  }
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return bad('sizeBytes must be a positive number');
  }
  const cap = kind === 'clip' ? CLIP_MAX_BYTES : REEL_MAX_BYTES;
  if (sizeBytes > cap) {
    return bad(
      `file too large: ${sizeBytes} bytes exceeds the ${Math.round(cap / 1024 / 1024)} MB cap for ${kind}`,
      413,
    );
  }

  if (!isR2Configured()) {
    // Graceful degrade: the owner hasn't wired R2 yet. Surface a clear 503 the
    // client can show, rather than a 500 from requireR2Client().
    return bad('storage not configured — R2 credentials are not set', 503);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad('unauthorized', 401);

  // Event-membership check. RLS would also protect the eventual row writes, but
  // we gate the presign itself so a non-member can't mint upload URLs against
  // someone else's event prefix.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    return bad('not a member of this event', 403);
  }

  const key =
    kind === 'clip'
      ? `patiktok/clips/${eventId}/${randomUUID()}.${ext}`
      : `patiktok/renders/${eventId}/${jobId}.mp4`;
  const bucket = R2_BUCKETS.media;

  try {
    const uploadUrl = await presignUploadUrl({
      bucket,
      key,
      contentType,
      sizeBytes,
    });
    return NextResponse.json({ uploadUrl, bucket, key });
  } catch (err) {
    Sentry.captureException(err);
    return bad('could not presign upload', 500);
  }
}
