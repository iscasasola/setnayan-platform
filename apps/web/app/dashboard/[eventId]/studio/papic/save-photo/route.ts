import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@/lib/supabase/server';
import { getR2Client } from '@/lib/r2';
import { parseStoredAsset } from '@/lib/uploads';
import { stripPhotoMetadata } from '@/lib/papic-derivatives';

// "Save to phone" for ONE Papic photo — the per-tile save behind SavePhotoButton
// in the couple's studio gallery. Owner 2026-07-16: the save must be FULL
// RESOLUTION (whatever the original is), and RA 10173 / CLAUDE.md require the
// geo/EXIF be stripped on any outbound file. A presigned R2 URL can't satisfy
// both (the stored original keeps its geo per spec), so this route streams the
// full-res original through an on-the-fly `stripPhotoMetadata` sharp pass
// (rotate → drop EXIF/GPS → full-res JPEG) and NEVER hands out the raw original.
// If the original's pixels were dropped after 3 months, it falls back to the
// already-stripped AVIF web copy so the save never 404s.
//
// Couple-only (auth + couple-membership gate, mirrors gallery-zip). PHOTOS only —
// clips are saved via the lightbox video path (MP4 GPS strip is the deferred
// ffmpeg case). nodejs runtime: sharp needs node.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id')?.trim();
  const src = searchParams.get('src'); // 'seat' | 'guest'
  if (!id || (src !== 'seat' && src !== 'guest')) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // Couple gate.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Resolve the row under the couple's RLS session, event-scoped + visible.
  const table = src === 'seat' ? 'papic_photos' : 'papic_guest_captures';
  const idCol = src === 'seat' ? 'photo_id' : 'capture_id';
  const typeCol = src === 'seat' ? 'photo_type' : 'media_type';
  const { data: row } = await supabase
    .from(table)
    .select(`r2_object_key, display_r2_key, full_res_dropped_at, ${typeCol}`)
    .eq(idCol, id)
    .eq('event_id', eventId)
    .is('hidden_at', null)
    .neq('moderation_state', 'nsfw_blocked')
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const rec = row as Record<string, unknown>;
  // Clips are saved via the video path — MP4/container GPS strip is the deferred
  // ffmpeg case (browser-captured clips carry no GPS anyway).
  if ((rec[typeCol] as string) === 'clip') {
    return NextResponse.json({ error: 'clips_unsupported' }, { status: 400 });
  }

  const orig = (rec.r2_object_key as string | null) ?? null;
  const display = (rec.display_r2_key as string | null) ?? null;
  const dropped = (rec.full_res_dropped_at as string | null) ?? null;

  // Same order as the ZIP routes: full-res original stripped on the fly, then the
  // stripped web copy only if the original's pixels are gone — never raw.
  let ref: string | null;
  let needsStrip: boolean;
  let contentType: string;
  let ext: string;
  if (orig && !dropped) {
    ref = orig;
    needsStrip = true;
    contentType = 'image/jpeg';
    ext = 'jpg';
  } else if (display) {
    ref = display;
    needsStrip = false;
    contentType = 'image/avif';
    ext = 'avif';
  } else if (orig) {
    ref = orig;
    needsStrip = true;
    contentType = 'image/jpeg';
    ext = 'jpg';
  } else {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const client = getR2Client();
  if (!client) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
  const parsed = parseStoredAsset(ref);
  if (!parsed || parsed.kind !== 'r2') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const obj = await client.send(
      new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
    );
    if (!obj.Body) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const bytes = await obj.Body.transformToByteArray();
    // Last-line geo strip: a raw photo original is scrubbed of EXIF/GPS here. If
    // the strip fails we FAIL rather than serve the geo-bearing original.
    const out = needsStrip ? await stripPhotoMetadata(bytes) : Buffer.from(bytes);
    return new Response(new Uint8Array(out), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="setnayan-photo-${id}.${ext}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
