import { type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { isRecapPublished, loadRecapCardData } from '@/lib/auto-recap';
import { renderRecapOgJpeg, type RecapCardFormat } from '@/lib/social/recap-card';

/**
 * GET /api/og/recap/[slug]?format=og|square|story — the shareable card for a
 * published Auto-Recap (/[slug]/recap).
 *
 *   og     1200×630   link unfurl (default — the og:image)
 *   square 1080×1080  feed post (Instagram / Facebook)
 *   story  1080×1920  Reels / TikTok / IG-FB Stories (9:16)
 *
 * PUBLIC, no auth — link crawlers (Facebook, Messenger, Viber) fetch the
 * og:image with no Setnayan session, and the recap page's "Save story card"
 * button fetches the ?format=story asset for the native share sheet. The route
 * renders ONLY when the couple has PUBLISHED the recap, from public-safe data
 * (curated gallery / wall-safe derivatives + the wall-approved voice count). An
 * unknown slug or an unpublished recap falls back to the static brand card —
 * never a 500, never a leak. The story/square cards carry a subtle "made with
 * Setnayan" mark (they're Setnayan-composed artifacts — sign-off #4).
 *
 * satori + sharp are native → Node runtime. Not cached hard: the stat line
 * changes as photos/voices land, so a short max-age keeps a re-share fresh
 * within the hour without re-rendering on every crawl.
 */
export const runtime = 'nodejs';

const FORMATS = new Set<RecapCardFormat>(['og', 'square', 'story']);

const CARD_HEADERS = {
  'Content-Type': 'image/jpeg',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
} as const;

function jpegResponse(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), { headers: CARD_HEADERS });
}

function brandFallback(): Response {
  return Response.redirect(
    `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '')}/brand/og-card.webp`,
    302,
  );
}

function statLine(stats: { photos: number; voices: number; guests: number | null }): string {
  const bits = [`${stats.photos} ${stats.photos === 1 ? 'photo' : 'photos'}`];
  if (stats.voices > 0) bits.push(`${stats.voices} ${stats.voices === 1 ? 'voice' : 'voices'}`);
  if (stats.guests && stats.guests > 0) bits.push(`${stats.guests} guests`);
  return bits.join(' · ');
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) return brandFallback();

  const raw = req.nextUrl.searchParams.get('format') ?? 'og';
  const format: RecapCardFormat = FORMATS.has(raw as RecapCardFormat)
    ? (raw as RecapCardFormat)
    : 'og';

  try {
    const admin = createAdminClient();
    const { data: event } = await admin
      .from('events')
      .select('event_id')
      .ilike('slug', slug)
      .maybeSingle();
    if (!event) return brandFallback();

    if (!(await isRecapPublished(event.event_id))) return brandFallback();

    const card = await loadRecapCardData(event.event_id);
    if (!card) return brandFallback();

    const jpeg = await renderRecapOgJpeg(
      {
        coupleNames: card.coupleNames,
        monogramInitials: card.monogramInitials,
        monogramColor: card.monogramColor,
        dateLabel: card.dateLabel,
        statLine: statLine(card.stats),
        heroPhotoUrl: card.heroUrl,
      },
      format,
    );
    return jpegResponse(jpeg);
  } catch {
    return brandFallback();
  }
}
