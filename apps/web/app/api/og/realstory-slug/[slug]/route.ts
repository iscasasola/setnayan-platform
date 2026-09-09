import { type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { formatEventDate } from '@/lib/events';
import { resolveStoryCover } from '@/lib/story-cover';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { stableMediaPath } from '@/lib/papic-display-ref';
import { loadEditorialData } from '@/app/[slug]/_components/editorial/data';
import {
  renderRealStoryOgJpeg,
  renderCoupleMonogramOgJpeg,
  type RealStoryCardFormat,
} from '@/lib/social/realstory-card';

/**
 * GET /api/og/realstory-slug/[slug]?format=og|square|story — the Open Graph
 * share card for a REAL couple's editorial at /[slug] (vs
 * /api/og/realstory/[slug], which serves the curated samples). Used as the
 * `og:image` on the couple's own page so a Facebook/Pinterest share of their
 * wedding shows the editorial card — their hero photo when published, with the
 * white-type scrim — deep-linking to the editorial.
 *
 *   og     1200×630   link unfurl (default — the og:image)
 *   square 1080×1080  feed post (Instagram / Facebook)
 *   story  1080×1920  Reels / TikTok / IG-FB Stories (9:16)
 *
 * square/story (share-asset completion 2026-07-17, mirroring #3294's recap
 * route): the postable FILE-ASSETS behind the editorial's "Save story card"
 * button + the vendor dashboard's featured-story card. They render ONLY on the
 * published branch (the same publish gate as the og card) and carry the subtle
 * "made with Setnayan" mark; the unpublished MONOGRAM fallback stays the
 * 1200×630 unfurl card regardless of format — there is no story-asset for an
 * unpublished editorial.
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

const FORMATS = new Set<RealStoryCardFormat>(['og', 'square', 'story']);

function jpegResponse(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), { headers: CARD_HEADERS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const raw = req.nextUrl.searchParams.get('format') ?? 'og';
  const format: RealStoryCardFormat = FORMATS.has(raw as RealStoryCardFormat)
    ? (raw as RealStoryCardFormat)
    : 'og';
  try {
    const admin = createAdminClient();
    const { data: ev } = await admin
      .from('events')
      .select(
        'event_id, display_name, event_date, monogram_text, monogram_color, story_cover_kind, story_cover_ref, landing_page_hero_image_url',
      )
      .eq('slug', slug)
      .maybeSingle();
    const event = ev as {
      event_id?: string;
      display_name?: string | null;
      event_date?: string | null;
      monogram_text?: string | null;
      monogram_color?: string | null;
      story_cover_kind?: string | null;
      story_cover_ref?: string | null;
      landing_page_hero_image_url?: string | null;
    } | null;
    if (!event?.event_id) return Response.redirect(DEFAULT_OG, 302);

    /*
      ── THE HOST'S CHOSEN COVER (`02` §6 · 08 step 1.5) ────────────────────
      The third of the cover's three jobs. Resolved BEFORE the card is built
      and RE-CHECKED as it resolves, so a capture a guest has since vetoed —
      or a supplier frame since withdrawn — stops being the share card without
      anybody having to remember to change it. `null` falls through to the
      hero ladder below, which is what this route did before covers existed.

      ⚠ IT IS STILL GATED ON PUBLICATION. A cover chosen while the story is a
      draft does not change the invitation-phase card: the cover leads the
      STORY's card, and there is no story to share yet.
    */
    const cover = await resolveStoryCover(admin, event.event_id, event);
    /*
      🔑 THE COVER GETS THE SAME CRAWLER-DURABILITY TREATMENT AS THE HERO, and
      it is not optional. A presigned URL baked into a crawler's cache EXPIRES,
      and the card then breaks quietly weeks later with nothing to blame — this
      repo has already paid for that on prerendered pages, and
      `the-invitation-is-not-our-billboard.test.ts` caught this exact regression
      in review when the cover was resolved to a presign.

      So: the stable, signature-less streaming route first, exactly as the hero
      does. `stableMediaPath` returns null for a non-`r2://` ref, and the route
      itself serves only its allowlisted public media bucket — anything else
      falls back to the presign, which is the behaviour the hero already has for
      legacy and website images.
    */
    const coverStablePath = cover?.key ? stableMediaPath(cover.key) : null;
    const coverPhotoUrl = cover?.key
      ? (coverStablePath && coverStablePath.startsWith('/papic/media/')
          ? `${SITE_URL}${coverStablePath}`
          : await displayUrlForStoredAsset(cover.key))
      : null;

    // A PUBLISHED editorial → the editorial card (hero photo + scrim).
    const data = await loadEditorialData(event.event_id);
    if (data?.published && cover?.kind === 'monogram') {
      // THE MONOGRAM IS A COVER, NOT A FALLBACK. Chosen deliberately, it wins
      // over the editorial card — the same render the invitation card uses,
      // reached by a choice instead of by the absence of a story.
      return jpegResponse(
        await renderCoupleMonogramOgJpeg({
          coupleNames: event.display_name ?? '',
          dateLabel: event.event_date ? formatEventDate(event.event_date) : '',
          monogramText: event.monogram_text ?? null,
          monogramColor: event.monogram_color ?? null,
        }),
      );
    }
    if (data?.published) {
      const descriptor = data.venueCity
        ? `A wedding in ${data.venueCity}`
        : 'A Setnayan Real Story';
      const jpeg = await renderRealStoryOgJpeg(
        {
          coupleNames: data.displayName,
          descriptor,
          dateLabel: data.eventDateFormatted ?? '',
          palette: data.monogramColor ? [data.monogramColor] : [],
          isSample: false,
          // The host's cover first — it is the picture they chose to be known
          // by. Then the STABLE streaming media URL (survives presign expiry
          // across a crawler's cache re-fetch), then the presigned hero.
          heroPhotoUrl: coverPhotoUrl ?? data.heroStableUrl ?? data.heroPhotoUrl,
        },
        format,
      );
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
