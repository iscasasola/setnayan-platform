import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createAdminClient } from '@/lib/supabase/admin';
import { getR2Client } from '@/lib/r2';
import { parseStoredAsset } from '@/lib/uploads';
import { stripPhotoMetadata } from '@/lib/papic-derivatives';

// "Open full size to save" for ONE of a guest's tagged Papic photos — the per-tile
// save behind the /papic/me/[token] preview grid. Owner 2026-07-16: the save must
// be FULL RESOLUTION; RA 10173 / CLAUDE.md require geo/EXIF stripped on any
// outbound file. A presigned R2 URL can't do both (the stored original keeps its
// geo per spec), so this streams the full-res original through an on-the-fly
// `stripPhotoMetadata` sharp pass (rotate → drop EXIF/GPS → full-res JPEG) and
// NEVER hands out the raw original. Served INLINE so the guest can open it full
// size and long-press → Save to Photos. Falls back to the stripped AVIF web copy
// only if the original's pixels were dropped after 3 months.
//
// Guest-scoped by the personal QR token (same credential the page + download ZIP
// use); the requested photo must be a CLEAN, non-hidden capture the guest is
// actually tagged in. PHOTOS only — clips have no full-size save here.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const cleanToken = token?.trim();
  if (!cleanToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id')?.trim();
  const src = searchParams.get('src'); // 'seat' | 'guest'
  if (!id || (src !== 'seat' && src !== 'guest')) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve the guest by their personal QR token (mirrors the page + ZIP route).
  const { data: guest } = await admin
    .from('guests')
    .select('guest_id, event_id')
    .eq('qr_token', cleanToken)
    .is('deleted_at', null)
    .maybeSingle();
  if (!guest) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const guestId = guest.guest_id as string;
  const eventId = guest.event_id as string;

  const sourceTable = src === 'seat' ? 'papic_photos' : 'papic_guest_captures';

  // The requested capture must be one the guest is actually tagged in (dropped-tag
  // aware) — so a raw token can't pull an arbitrary event photo.
  const { data: tag } = await admin
    .from('photo_tags')
    .select('source_id')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .eq('source_table', sourceTable)
    .eq('source_id', id)
    .is('removed_at', null)
    .maybeSingle();
  if (!tag) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const idCol = src === 'seat' ? 'photo_id' : 'capture_id';
  const typeCol = src === 'seat' ? 'photo_type' : 'media_type';
  const { data: row } = await admin
    .from(sourceTable)
    .select(`r2_object_key, display_r2_key, full_res_dropped_at, ${typeCol}`)
    .eq(idCol, id)
    .eq('event_id', eventId)
    .eq('moderation_state', 'clean')
    .is('hidden_at', null)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const rec = row as Record<string, unknown>;
  if ((rec[typeCol] as string) === 'clip') {
    return NextResponse.json({ error: 'clips_unsupported' }, { status: 400 });
  }

  const orig = (rec.r2_object_key as string | null) ?? null;
  const display = (rec.display_r2_key as string | null) ?? null;
  const dropped = (rec.full_res_dropped_at as string | null) ?? null;

  // Same order as the ZIP + couple save-photo routes: full-res original stripped
  // on the fly, then the stripped web copy only if the original is gone — never raw.
  let ref: string | null;
  let needsStrip: boolean;
  let contentType: string;
  if (orig && !dropped) {
    ref = orig;
    needsStrip = true;
    contentType = 'image/jpeg';
  } else if (display) {
    ref = display;
    needsStrip = false;
    contentType = 'image/avif';
  } else if (orig) {
    ref = orig;
    needsStrip = true;
    contentType = 'image/jpeg';
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
    const out = needsStrip ? await stripPhotoMetadata(bytes) : Buffer.from(bytes);
    return new Response(new Uint8Array(out), {
      headers: {
        'Content-Type': contentType,
        // Inline: the guest opens it full size in a tab and long-presses to save.
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
