import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { createAdminClient } from '@/lib/supabase/admin';
import { getR2Client } from '@/lib/r2';
import { parseStoredAsset } from '@/lib/uploads';
import { stripPhotoMetadata } from '@/lib/papic-derivatives';

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
          .select('photo_id, r2_object_key, display_r2_key, full_res_dropped_at, photo_type, captured_at')
          .in('photo_id', photoIds)
          .eq('moderation_state', 'clean')
          .is('hidden_at', null)
      : Promise.resolve({
          data: [] as Array<{
            photo_id: string;
            r2_object_key: string;
            display_r2_key: string | null;
            full_res_dropped_at: string | null;
            photo_type: string;
            captured_at: string | null;
          }>,
        }),
    captureIds.length
      ? admin
          .from('papic_guest_captures')
          .select('capture_id, r2_object_key, display_r2_key, full_res_dropped_at, media_type, captured_at')
          .in('capture_id', captureIds)
          .eq('moderation_state', 'clean')
          .is('hidden_at', null)
      : Promise.resolve({
          data: [] as Array<{
            capture_id: string;
            r2_object_key: string;
            display_r2_key: string | null;
            full_res_dropped_at: string | null;
            media_type: string;
            captured_at: string | null;
          }>,
        }),
  ]);

  type Item = {
    id: string;
    ref: string;
    kind: 'photo' | 'clip';
    at: string | null;
    // Whether the fetched bytes still need an on-the-fly metadata strip before
    // they leave the server (true only for a raw PHOTO original with no derivative).
    needsStrip: boolean;
    ext: string;
  };
  const items: Item[] = [];
  // PRIVACY (RA 10173 · CLAUDE.md "geo stripped on outbound shares"): a PHOTO's
  // full-res original carries EXIF GPS (DSLR-bridge / native-app / camera-roll
  // sources), so it must NEVER be handed to the guest raw. Prefer `display_r2_key`
  // — the AVIF web copy sharp already built with all metadata dropped — and ship
  // that (`.avif`). If no derivative exists yet, fall back to the original but flag
  // it for an on-the-fly metadata strip (`.jpg`), never the raw bytes. Display is
  // preferred regardless, so a 3-month-dropped original just yields the web copy.
  // CLIPS keep their video original (`.mp4`) — MP4 GPS strip needs an ffmpeg pass
  // Vercel can't run on the serving path, so it is DEFERRED (see report);
  // browser-captured Papic clips carry no GPS anyway.
  const dl = (
    orig: string | null,
    display: string | null,
    isClip: boolean,
  ): Pick<Item, 'ref' | 'needsStrip' | 'ext'> | null => {
    if (isClip) return orig ? { ref: orig, needsStrip: false, ext: 'mp4' } : null;
    if (display) return { ref: display, needsStrip: false, ext: 'avif' };
    if (orig) return { ref: orig, needsStrip: true, ext: 'jpg' };
    return null;
  };
  for (const p of photosRes.data ?? []) {
    const isClip = p.photo_type === 'clip';
    const sel = dl(p.r2_object_key, p.display_r2_key, isClip);
    if (sel) {
      items.push({
        id: p.photo_id,
        kind: isClip ? 'clip' : 'photo',
        at: p.captured_at ?? null,
        ...sel,
      });
    }
  }
  for (const c of capturesRes.data ?? []) {
    const isClip = c.media_type === 'clip';
    const sel = dl(c.r2_object_key, c.display_r2_key, isClip);
    if (sel) {
      items.push({
        id: c.capture_id,
        kind: isClip ? 'clip' : 'photo',
        at: c.captured_at ?? null,
        ...sel,
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
        // Last-line geo strip: a raw photo original (no derivative) is scrubbed of
        // EXIF/GPS here before it enters the zip. Best-effort — if the strip fails
        // we DROP the item rather than ship the geo-bearing original.
        let out: Buffer;
        if (it.needsStrip) {
          try {
            out = await stripPhotoMetadata(bytes);
          } catch {
            continue;
          }
        } else {
          out = Buffer.from(bytes);
        }
        const day = (it.at ?? '').slice(0, 10) || 'photo';
        archive.append(out, {
          name: `${day}-${String(++n).padStart(4, '0')}-${it.id}.${it.ext}`,
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
