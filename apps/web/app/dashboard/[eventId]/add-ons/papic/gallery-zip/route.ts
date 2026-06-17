import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { Readable } from 'node:stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { createClient } from '@/lib/supabase/server';
import { getR2Client } from '@/lib/r2';
import { parseStoredAsset } from '@/lib/uploads';

// "Download all" — stream the couple's Papic captures (photos + clip videos) as
// a ZIP, so they can pull the whole gallery to their phone/computer WITHOUT
// connecting Google Drive. Couple-only (auth + couple-membership gate, mirrors
// the magazine route). Streams: each R2 object is fetched + appended one at a
// time (bounded memory), and the zip is piped to the client as it's built —
// no compression (photos/videos are already compressed → store mode, no CPU).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_ITEMS = 1000;

export async function GET(_req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;

  // Couple gate.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const client = getR2Client();
  if (!client) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });

  // The couple's captures — photos + clip videos, not hidden, not NSFW-blocked.
  const [{ data: seatRows }, { data: guestRows }] = await Promise.all([
    supabase
      .from('papic_photos')
      .select('photo_id, r2_object_key, photo_type, captured_at')
      .eq('event_id', eventId)
      .is('hidden_at', null)
      .neq('moderation_state', 'nsfw_blocked')
      .order('captured_at', { ascending: true })
      .limit(MAX_ITEMS),
    supabase
      .from('papic_guest_captures')
      .select('capture_id, r2_object_key, captured_at')
      .eq('event_id', eventId)
      .is('hidden_at', null)
      .neq('moderation_state', 'nsfw_blocked')
      .order('captured_at', { ascending: true })
      .limit(MAX_ITEMS),
  ]);

  type Item = { id: string; ref: string; kind: 'photo' | 'clip'; at: string | null };
  const items: Item[] = [];
  for (const r of seatRows ?? []) {
    if (r.r2_object_key) {
      items.push({
        id: r.photo_id as string,
        ref: r.r2_object_key as string,
        kind: r.photo_type === 'clip' ? 'clip' : 'photo',
        at: (r.captured_at as string) ?? null,
      });
    }
  }
  for (const r of guestRows ?? []) {
    if (r.r2_object_key) {
      items.push({
        id: r.capture_id as string,
        ref: r.r2_object_key as string,
        kind: 'photo',
        at: (r.captured_at as string) ?? null,
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
      'Content-Disposition': 'attachment; filename="setnayan-papic-photos.zip"',
      'Cache-Control': 'no-store',
    },
  });
}
