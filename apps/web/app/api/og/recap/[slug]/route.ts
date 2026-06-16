import { type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { isRecapPublished, loadRecapCardData } from '@/lib/auto-recap';
import { renderRecapOgJpeg } from '@/lib/social/recap-card';

/**
 * GET /api/og/recap/[slug] — the 1200×630 Open Graph share card for a published
 * Auto-Recap (/[slug]/recap).
 *
 * PUBLIC, no auth — link crawlers (Facebook, Messenger, Viber) fetch the
 * og:image with no Setnayan session. The route renders ONLY when the couple has
 * PUBLISHED the recap, from public-safe data (curated gallery / wall-safe
 * derivatives + the wall-approved voice count). An unknown slug or an
 * unpublished recap falls back to the static brand card — never a 500, never a
 * leak.
 *
 * satori + sharp are native → Node runtime. Not cached hard: the stat line
 * changes as photos/voices land, so a short max-age keeps a re-share fresh
 * within the hour without re-rendering on every crawl.
 */
export const runtime = 'nodejs';

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) return brandFallback();

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

    const jpeg = await renderRecapOgJpeg({
      coupleNames: card.coupleNames,
      monogramInitials: card.monogramInitials,
      monogramColor: card.monogramColor,
      dateLabel: card.dateLabel,
      statLine: statLine(card.stats),
      heroPhotoUrl: card.heroUrl,
    });
    return jpegResponse(jpeg);
  } catch {
    return brandFallback();
  }
}
