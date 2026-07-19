import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { R2_BUCKETS, isR2Configured } from '@/lib/r2';
import { presignUploadUrl } from '@/lib/uploads';

/**
 * Creator Adventure-Chapter TEASER — presigned-PUT endpoint.
 *
 * The teaser is a short 9:16 clip the creator's browser renders (lib/reel-render
 * — WebCodecs mp4 / MediaRecorder webm) from the chapter's Papic-gallery photos
 * + one Setnayan-owned track. This mints a direct-to-R2 PUT for the finished
 * blob, in the public `media` bucket, keyed:
 *
 *   creator/teasers/{chapterId}.{ext}
 *
 * Flow:
 *   1. Client POSTs { chapterId, contentType, sizeBytes }.
 *   2. We auth via the Supabase session cookie AND confirm the caller OWNS the
 *      chapter (RLS Pattern A: user_id = auth.uid()) — so a creator can only
 *      mint an upload URL under their OWN chapter's key.
 *   3. We whitelist the MIME type, validate size, pin the key.
 *   4. We hand back { uploadUrl, bucket, key }; the browser PUTs the body with a
 *      Content-Type matching what it sent (the signature binds that header).
 *
 * The chapter row's `teaser_r2_key` is set server-side by finalizeChapterTeaser
 * (a service-scoped action), never by the browser.
 */

const TEASER_MAX_BYTES = 60 * 1024 * 1024; // 60 MB — a few-second 9:16 clip

// The client renderer emits webm (Chrome/Firefox MediaRecorder — the path taken
// whenever there's music) or mp4 (WebCodecs / Safari). Accept that union only.
const ALLOWED_VIDEO_MIME: ReadonlyMap<string, string> = new Map([
  ['video/webm', 'webm'],
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
]);

type RequestBody = {
  chapterId?: string;
  contentType?: string;
  sizeBytes?: number;
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

  const { chapterId, contentType, sizeBytes } = body;

  if (typeof chapterId !== 'string' || chapterId.length === 0) {
    return bad('chapterId required');
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
  if (sizeBytes > TEASER_MAX_BYTES) {
    return bad(
      `file too large: ${sizeBytes} bytes exceeds the ${Math.round(
        TEASER_MAX_BYTES / 1024 / 1024,
      )} MB teaser cap`,
      413,
    );
  }

  if (!isR2Configured()) {
    return bad('storage not configured — R2 credentials are not set', 503);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad('unauthorized', 401);

  // Ownership gate. RLS (Pattern A) would already stop a cross-user row write,
  // but we confirm here so a non-owner can't mint an upload URL under someone
  // else's chapter key prefix.
  const { data: chapter } = await supabase
    .from('creator_chapters')
    .select('chapter_id')
    .eq('chapter_id', chapterId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!chapter) return bad('chapter not found', 404);

  const bucket = R2_BUCKETS.media;
  const key = `creator/teasers/${chapterId}.${ext}`;

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
