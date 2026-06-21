import { type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { formatEventDate } from '@/lib/events';
import { loadEditorialData } from '@/app/[slug]/_components/editorial/data';
import {
  renderRealStoryOgJpeg,
  renderCoupleMonogramOgJpeg,
} from '@/lib/social/realstory-card';

/**
 * GET /api/og/realstory-slug/[slug] — the Open Graph share card for a REAL
 * couple's editorial at /[slug] (vs /api/og/realstory/[slug], which serves the
 * curated samples). Used as the `og:image` on the couple's own page so a
 * Facebook/Pinterest share of their wedding shows the editorial card — their
 * hero photo when published, with the white-type scrim — deep-linking to the
 * editorial.
 *
 * Card per phase: a PUBLISHED editorial → the editorial card (hero photo +
 * scrim); otherwise → the couple's own MONOGRAM card (their mark + names + date
 * on cream, mirroring their /[slug] hero), so a shared invitation always shows
 * THEM, and the editorial card takes over the moment their story goes live. Only
 * a missing event / render failure 302s to the static brand image. The
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
      .select('event_id, display_name, event_date, monogram_text, monogram_color')
      .eq('slug', slug)
      .maybeSingle();
    const event = ev as {
      event_id?: string;
      display_name?: string | null;
      event_date?: string | null;
      monogram_text?: string | null;
      monogram_color?: string | null;
    } | null;
    if (!event?.event_id) return Response.redirect(DEFAULT_OG, 302);

    // A PUBLISHED editorial → the editorial card (hero photo + scrim).
    const data = await loadEditorialData(event.event_id);
    if (data?.published) {
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
    }

    // Otherwise (invitation / Save-the-Date phase, no editorial yet) → the
    // couple's own MONOGRAM card, mirroring their /[slug] hero, so a shared
    // invitation shows THEIR mark + names + date — not the generic brand image
    // (owner 2026-06-21 "why is the cover photo … not the look of the page").
    const jpeg = await renderCoupleMonogramOgJpeg({
      coupleNames: event.display_name ?? '',
      dateLabel: event.event_date ? formatEventDate(event.event_date) : '',
      monogramText: event.monogram_text ?? null,
      monogramColor: event.monogram_color ?? null,
    });
    return jpegResponse(jpeg);
  } catch {
    return Response.redirect(DEFAULT_OG, 302);
  }
}
