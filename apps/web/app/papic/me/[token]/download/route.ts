import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { createAdminClient } from '@/lib/supabase/admin';
import { getR2Client } from '@/lib/r2';
import { parseStoredAsset } from '@/lib/uploads';

// "Download my photos" — stream a ZIP of the captures a GUEST is tagged in
// ("photos of you"), scoped by their personal QR token (the same credential the
// /papic/me/[token] page uses). Mirrors the couple's studio gallery-zip route,
// but guest-scoped via photo_tags: removed_at IS NULL so a dropped "not me" tag
// excludes the photo, and only clean-screened captures are included. Store mode
// (media is already compressed → no CPU), one object buffered at a time so
// memory stays bounded while the zip streams out as it's built.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_ITEMS = 500;

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const cleanToken = token?.trim();
  if (!cleanToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Resolve the guest by their personal QR token (mirrors the page's read).
  const { data: guest } = await admin
    .from('guests')
    .select('guest_id, event_id')
    .eq('qr_token', cleanToken)
    .is('deleted_at', null)
    .maybeSingle();
  if (!guest) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const guestId = guest.guest_id as string;
  const eventId = guest.event_id as string;

  const client = getR2Client();
  if (!client) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  // The guest's tagged captures — dropped-tag aware, newest first.
  const { data: tags } = await admin
    .from('photo_tags')
    .select('source_table, source_id, created_at')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(MAX_ITEMS);
  if (!tags || tags.length === 0) {
    return NextResponse.json({ error: 'no_photos' }, { status: 404 });
  }

  const photoIds = tags
    .filter((t) => t.source_table === 'papic_photos')
    .map((t) => t.source_id as string);
  const captureIds = tags
    .filter((t) => t.source_table === 'papic_guest_captures')
    .map((t) => t.source_id as string);

  const [photosRes, capturesRes] = await Promise.all([
    photoIds.length
      ? admin
          .from('papic_photos')
          .select('photo_id, r2_object_key, photo_type, captured_at')
          .in('photo_id', photoIds)
          .eq('moderation_state', 'clean')
          .is('hidden_at', null)
      : Promise.resolve({
          data: [] as Array<{
            photo_id: string;
            r2_object_key: string;
            photo_type: string;
            captured_at: string | null;
          }>,
        }),
    captureIds.length
      ? admin
          .from('papic_guest_captures')
          .select('capture_id, r2_object_key, media_type, captured_at')
          .in('capture_id', captureIds)
          .eq('moderation_state', 'clean')
          .is('hidden_at', null)
      : Promise.resolve({
          data: [] as Array<{
            capture_id: string;
            r2_object_key: string;
            media_type: string;
            captured_at: string | null;
          }>,
        }),
  ]);

  type Item = { id: string; ref: string; kind: 'photo' | 'clip'; at: string | null };
  const items: Item[] = [];
  for (const p of photosRes.data ?? []) {
    if (p.r2_object_key) {
      items.push({
        id: p.photo_id,
        ref: p.r2_object_key,
        kind: p.photo_type === 'clip' ? 'clip' : 'photo',
        at: p.captured_at ?? null,
      });
    }
  }
  for (const c of capturesRes.data ?? []) {
    if (c.r2_object_key) {
      items.push({
        id: c.capture_id,
        ref: c.r2_object_key,
        kind: c.media_type === 'clip' ? 'clip' : 'photo',
        at: c.captured_at ?? null,
      });
    }
  }
  if (items.length === 0) return NextResponse.json({ error: 'no_photos' }, { status: 404 });

  const archive = archiver('zip', { store: true });
  archive.on('error', () => {
    // Terminal stream error — abort so the client connection closes cleanly.
    archive.abort();
  });

  // Feed the archive sequentially (one object buffered at a time → bounded
  // memory) while the response streams the zip out as it's built.
  void (async () => {
    let n = 0;
    for (const it of items) {
      const parsed = parseStoredAsset(it.ref);
      if (!parsed || parsed.kind !== 'r2') continue;
      try {
        const obj = await client.send(
          new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
        );
        if (!obj.Body) continue;
        const bytes = await obj.Body.transformToByteArray();
        const ext = it.kind === 'clip' ? 'mp4' : 'jpg';
        const day = (it.at ?? '').slice(0, 10) || 'photo';
        archive.append(Buffer.from(bytes), {
          name: `${day}-${String(++n).padStart(4, '0')}-${it.id}.${ext}`,
        });
      } catch {
        // Skip a missing/failed object — never abort the whole download.
      }
    }
    await archive.finalize();
  })();

  const body = Readable.toWeb(archive) as unknown as ReadableStream;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="my-setnayan-photos.zip"',
      'Cache-Control': 'no-store',
    },
  });
}
