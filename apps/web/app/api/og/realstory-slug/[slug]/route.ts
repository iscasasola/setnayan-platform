import { type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { loadEditorialData } from '@/app/[slug]/_components/editorial/data';
import { renderRealStoryOgJpeg } from '@/lib/social/realstory-card';

/**
 * GET /api/og/realstory-slug/[slug] — the Open Graph share card for a REAL
 * couple's editorial at /[slug] (vs /api/og/realstory/[slug], which serves the
 * curated samples). Used as the `og:image` on the couple's own page so a
 * Facebook/Pinterest share of their wedding shows the editorial card — their
 * hero photo when published, with the white-type scrim — deep-linking to the
 * editorial.
 *
 * Gate: renders ONLY when the event has a PUBLISHED editorial (`data.published`);
 * otherwise it 302s to the static brand card. So during the invitation/event
 * phases (or for any non-editorial page) a share falls back to the brand image,
 * and the editorial card appears the moment the couple's story goes live. The
 * RA 10173 public-showcase consent gates the /realstories INDEX, not the couple
 * sharing their OWN public page, so it isn't required here.
 *
 * Public (crawlers fetch with no session), Node runtime (native satori/sharp).
 * Shorter cache than the immutable sample route — a couple can republish or
 * swap their hero photo, and we want the card to refresh within the hour.
 */
export const runtime = 'nodejs';

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');
const DEFAULT_OG = `${SITE_URL}/brand/og-card.webp`;

const CARD_HEADERS = {
  'Content-Type': 'image/jpeg',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
} as const;

function jpegResponse(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), { headers: CARD_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const admin = createAdminClient();
    const { data: ev } = await admin
      .from('events')
      .select('event_id')
      .eq('slug', slug)
      .maybeSingle();
    const eventId = (ev as { event_id?: string } | null)?.event_id;
    if (!eventId) return Response.redirect(DEFAULT_OG, 302);

    const data = await loadEditorialData(eventId);
    if (!data || !data.published) return Response.redirect(DEFAULT_OG, 302);

    const descriptor = data.venueCity
      ? `A wedding in ${data.venueCity}`
      : 'A Setnayan Real Story';
    const jpeg = await renderRealStoryOgJpeg({
      coupleNames: data.displayName,
      descriptor,
      dateLabel: data.eventDateFormatted ?? '',
      palette: data.monogramColor ? [data.monogramColor] : [],
      isSample: false,
      heroPhotoUrl: data.heroPhotoUrl,
    });
    return jpegResponse(jpeg);
  } catch {
    return Response.redirect(DEFAULT_OG, 302);
  }
}
