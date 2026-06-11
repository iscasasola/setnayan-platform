import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { safeFetchImageBytes } from '@/lib/safe-image-fetch';
import { loadEditorialData } from '@/app/[slug]/_components/editorial/data';
import { composeCopy } from '@/app/[slug]/_components/editorial/compose';
import {
  bucketMoments,
  buildKwentoMagazine,
  prioritizeKwentoAnchors,
  type MagazineCapture,
  type MagazineKwento,
} from '@/lib/kwento-magazine';

// GET /dashboard/[eventId]/add-ons/papic/magazine — the Kwento Magazine,
// Variant A (0012 § Kwento Magazine): the FREE, couple-PRIVATE A4 keepsake.
//
// Variant A privacy: couple-only (auth + couple-membership gate), unblurred
// masters under the couple's own RLS where possible — the couple always sees
// 100% (locked). NO share affordance exists on this artifact; the shareable
// Variant B is a separate, gated pipeline (blur derivatives + amended
// consent), per the design. Response is a direct download, Cache-Control
// no-store, named after the couple.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Hard photo budget per render — serverless time/memory headroom. */
const MAX_IMAGES = 48;
const FETCH_CONCURRENCY = 4;

function initialsFrom(displayName: string): string {
  const words = displayName.split(/[^\p{L}]+/u).filter((w) => w.length > 1);
  const letters = words
    .filter((w) => !['and', 'at', '&', 'ni', 'nina'].includes(w.toLowerCase()))
    .map((w) => w[0]?.toUpperCase() ?? '');
  return letters.slice(0, 2).join('') || displayName.slice(0, 1).toUpperCase();
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await ctx.params;

  // Couple gate (mirrors the moderation page).
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

  // ── Assemble ──
  const admin = createAdminClient();

  // The FRAME — the same assembly the editorial recap uses (no fork).
  const editorial = await loadEditorialData(eventId);
  const copy = editorial ? composeCopy(editorial) : null;

  // The SPINE — both capture streams, photos only, not hidden.
  const [{ data: seatRows }, { data: guestRows }, { data: msgRows }] = await Promise.all([
    supabase
      .from('papic_photos')
      .select('photo_id, r2_object_key, captured_at')
      .eq('event_id', eventId)
      .eq('photo_type', 'photo')
      .is('hidden_at', null)
      .order('captured_at', { ascending: true })
      .limit(400),
    supabase
      .from('papic_guest_captures')
      .select('capture_id, r2_object_key, captured_at')
      .eq('event_id', eventId)
      .is('hidden_at', null)
      .order('captured_at', { ascending: true })
      .limit(400),
    // Kwentos: the couple APPROVED these (their private book shows what they
    // accepted — clean or flagged alike; it's the master view).
    supabase
      .from('photo_messages')
      .select('source_table, source_id, body_text, guest_id')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .is('user_deleted_at', null)
      .is('hard_deleted_at', null)
      .limit(200),
  ]);

  const refByKey = new Map<string, string>();
  const captures: MagazineCapture[] = [];
  for (const r of seatRows ?? []) {
    const key = `papic_photos:${r.photo_id as string}`;
    captures.push({
      sourceTable: 'papic_photos',
      sourceId: r.photo_id as string,
      capturedAtMs: Date.parse((r.captured_at as string) ?? '') || 0,
    });
    if (r.r2_object_key) refByKey.set(key, r.r2_object_key as string);
  }
  for (const r of guestRows ?? []) {
    const key = `papic_guest_captures:${r.capture_id as string}`;
    captures.push({
      sourceTable: 'papic_guest_captures',
      sourceId: r.capture_id as string,
      capturedAtMs: Date.parse((r.captured_at as string) ?? '') || 0,
    });
    if (r.r2_object_key) refByKey.set(key, r.r2_object_key as string);
  }

  if (captures.length === 0) {
    return NextResponse.json(
      { error: 'no_photos', message: 'The magazine fills in once Papic photos arrive.' },
      { status: 409 },
    );
  }

  // Author names for attribution.
  const messages = msgRows ?? [];
  const guestIds = [...new Set(messages.map((m) => m.guest_id as string))];
  const { data: authors } = guestIds.length
    ? await admin
        .from('guests')
        .select('guest_id, first_name, display_name')
        .in('guest_id', guestIds)
    : { data: [] as { guest_id: string; first_name: string | null; display_name: string | null }[] };
  const nameOf = new Map(
    (authors ?? []).map((g) => [
      g.guest_id as string,
      (g.display_name as string) || (g.first_name as string) || 'A guest',
    ]),
  );
  const kwentos: MagazineKwento[] = messages.map((m) => ({
    sourceTable: m.source_table as string,
    sourceId: m.source_id as string,
    body: m.body_text as string,
    author: nameOf.get(m.guest_id as string) ?? 'A guest',
  }));

  // Bucket + curate, then fetch ONLY curation-surviving images.
  const chapters = bucketMoments(captures);
  const picked = chapters.flatMap((ch) => prioritizeKwentoAnchors(ch, kwentos));
  const keys = [...new Set(picked.map((p) => `${p.sourceTable}:${p.sourceId}`))].slice(0, MAX_IMAGES);

  const images = new Map<string, Uint8Array>();
  for (let i = 0; i < keys.length; i += FETCH_CONCURRENCY) {
    const batch = keys.slice(i, i + FETCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (key) => {
        try {
          const ref = refByKey.get(key);
          if (!ref) return;
          const url = await displayUrlForStoredAsset(ref, { ttlSeconds: 600 });
          if (!url) return;
          const raw = await safeFetchImageBytes(url);
          if (!raw) return;
          const jpeg = await sharp(raw, { limitInputPixels: 50_000_000, failOn: 'truncated' })
            .rotate()
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          images.set(key, new Uint8Array(jpeg));
        } catch {
          // silent skip — the slot is dropped, never a crash
        }
      }),
    );
  }

  const { count: guestCount } = await supabase
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('deleted_at', null);

  const displayName = editorial?.displayName ?? 'The Wedding';
  const pdf = await buildKwentoMagazine({
    coupleNames: displayName,
    eventDateIso: editorial?.eventDate ?? null,
    monogramInitials: initialsFrom(displayName),
    prologueParagraphs: copy?.leadParagraphs ?? [],
    milestones: (editorial?.loveStory?.milestones ?? [])
      .map((m) => ({
        label: [m.year, m.title].filter(Boolean).join(' · '),
        detail: m.note ?? '',
      }))
      .filter((m) => m.label || m.detail),
    specialMessage: copy?.pullQuote ?? null,
    chapters,
    kwentos,
    images,
    totals: {
      photos: captures.length,
      kwentos: kwentos.length,
      guests: guestCount ?? null,
    },
  });

  const safeName = displayName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'kwento';
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}-Kwento-Magazine.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
