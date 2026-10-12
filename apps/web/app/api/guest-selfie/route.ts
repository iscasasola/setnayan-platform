import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { readGuestSession } from '@/lib/guest-session';
import { R2_BUCKETS, isR2Configured } from '@/lib/r2';
import { encodeR2Ref, presignUploadUrl } from '@/lib/uploads';
import { giftDoor, giftPurposeOf } from '@/lib/gift-door.server';

/**
 * Guest-selfie presign — the RSVP selfie's direct-to-R2 upload URL.
 *
 * Mirrors /api/upload, but authorizes via the guest SESSION COOKIE
 * (`readGuestSession`) instead of a Supabase auth session: a guest RSVPing
 * from their QR-scanned invitation is cookie-authenticated, not Supabase-
 * authed, so /api/upload would 401 them. The object key is pinned to the
 * session's own event + guest, so a guest can only ever write their own
 * selfie — the client never gets to choose the path.
 *
 * 🎁 ONE DOOR, THREE PURPOSES (owner 2026-10-08, E-Gifts › "I sent it"). A body
 * carrying `purpose: 'gift-shot'` asks for the upload URL of a guest's gift
 * SCREENSHOT (private bucket, their own `gift-shots/<event>/<guest>/` folder),
 * and `purpose: 'gift-record'` hands the couple what the guest says they sent.
 * Both are `lib/gift-door.server.ts` — this file only hands them over. They
 * ride this route because every route file is one Vercel route against a hard
 * ceiling; a body with NO purpose is the RSVP selfie, exactly as before.
 *
 * Selfies are EVENT photos → never watermarked (owner directive; see
 * lib/watermark.ts). The full-res JPEG the client PUTs here is the
 * face-recognition enrollment asset Papic (0012) will consume.
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — a phone selfie JPEG is well under this
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest): Promise<NextResponse> {
  /* The body is read ONCE, here, so a gift request can be told from a selfie. A body that
     is not JSON stays `undefined` and is refused below exactly where it always was. */
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    parsed = undefined;
  }
  const gift = giftPurposeOf(parsed);
  if (gift) return giftDoor(gift, parsed as Record<string, unknown>);

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: 'Uploads are not configured. Please contact support.' },
      { status: 503 },
    );
  }

  const session = await readGuestSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Your invitation session expired — reopen your QR link and try again.' },
      { status: 401 },
    );
  }

  if (parsed === undefined) {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  const body = parsed as { contentType?: string; sizeBytes?: number };

  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  const baseType = contentType.split(';')[0]?.trim() ?? '';
  if (!ALLOWED_MIME.has(baseType)) {
    return NextResponse.json(
      { error: `Unsupported file type "${contentType || 'unknown'}".` },
      { status: 400 },
    );
  }

  const sizeBytes = typeof body.sizeBytes === 'number' ? body.sizeBytes : NaN;
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json(
      { error: 'sizeBytes must be a positive integer.' },
      { status: 400 },
    );
  }
  if (sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: `Selfie is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB — max ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const bucketName = R2_BUCKETS.media;
  const ext = baseType === 'image/png' ? 'png' : baseType === 'image/webp' ? 'webp' : 'jpg';
  // Key is derived from the SESSION, never from client input — a guest can
  // only ever write under their own event/guest prefix.
  const objectKey = `events/${session.event_id}/guest-selfies/${session.guest_id}/${randomUUID()}.${ext}`;

  try {
    const uploadUrl = await presignUploadUrl({
      bucket: bucketName,
      key: objectKey,
      contentType,
      sizeBytes,
    });
    return NextResponse.json(
      { uploadUrl, r2Ref: encodeR2Ref(bucketName, objectKey) },
      { status: 200 },
    );
  } catch (err) {
    Sentry.captureException(err, {
      tags: { route: 'api/guest-selfie' },
      extra: { event_id: session.event_id, guest_id: session.guest_id },
    });
    return NextResponse.json(
      { error: 'Could not generate upload URL. Please try again.' },
      { status: 500 },
    );
  }
}
