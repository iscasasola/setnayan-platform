import { type NextRequest } from 'next/server';

import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  resolvePublicProfile,
  mostRecentPublicChapter,
} from '@/lib/public-profile';
import { renderProfileOgJpeg } from '@/lib/social/profile-card';

/**
 * GET /api/og/u/[slug] — the Open Graph share card for a public account profile
 * at /u/[slug] (social-share follow-through item #7c). A Facebook/Pinterest share
 * of a public profile renders a rich card ONLY when the page exposes an
 * `og:image`; this route serves a personalized 1200×630 card — the account's
 * display name over the hero photo of their most-recent public celebration.
 *
 * SAFETY GATE (mirrors app/u/[userSlug]/page.tsx generateMetadata): the real,
 * name-bearing card is rendered ONLY when the profile is BOTH opted-in
 * (public_profile_enabled) AND has ≥1 public chapter. A disabled profile, an
 * enabled-but-empty profile, a missing account, or any render failure ALL fall
 * back to the static brand card — so a display name is never leaked for a
 * profile that isn't actually a public showcase (the /u name/existence oracle
 * the #7 series closes).
 *
 * Public (crawlers fetch with no session), Node runtime (native satori/sharp).
 * Short cache — a couple can publish a new chapter or swap a hero, and we want
 * the card to refresh within the hour.
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
    const resolved = await resolvePublicProfile(slug);

    // The exact same gate as the page's generateMetadata: only an opted-in
    // profile with ≥1 public chapter gets the personalized (name-bearing) card.
    const enabled = resolved?.user.public_profile_enabled === true;
    const publicEvents = resolved?.publicWebsiteEvents ?? [];
    if (!resolved || !enabled || publicEvents.length === 0) {
      return Response.redirect(DEFAULT_OG, 302);
    }

    const displayName = resolved.user.display_name?.trim() || 'A Setnayan profile';
    const subtitle =
      publicEvents.length >= 2
        ? 'A collection of celebrations'
        : 'A Setnayan celebration';

    // Hero from the most-recent public chapter. The stored value may be an
    // r2:// ref → presign it into a fetchable URL; a legacy http(s) value passes
    // through. A null hero simply renders the branded (photoless) card.
    const recent = mostRecentPublicChapter(publicEvents);
    const heroPhotoUrl = recent?.landing_page_hero_image_url
      ? await displayUrlForStoredAsset(recent.landing_page_hero_image_url).catch(
          () => null,
        )
      : null;

    const jpeg = await renderProfileOgJpeg({
      displayName,
      subtitle,
      heroPhotoUrl,
    });
    return jpegResponse(jpeg);
  } catch {
    return Response.redirect(DEFAULT_OG, 302);
  }
}
