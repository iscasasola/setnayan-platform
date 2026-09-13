import { type NextRequest } from 'next/server';

import { displayUrlForStoredAsset } from '@/lib/uploads';
import { fetchVendor } from '@/app/v/[slug]/page';
import { isPubliclyVisible } from '@/lib/vendor-visibility';
import { resolveVendorDisplayName } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { renderVendorOgPng } from '@/lib/social/vendor-card';
import { composeVendorOgDescription } from '@/lib/vendor-og-description';

/**
 * GET /api/og/v/[slug] — the Open Graph share card for a public shop page
 * (E1, "a shop's link preview never broke"). Modelled on
 * `app/api/og/u/[slug]/route.ts`.
 *
 * WHY (owner): "a universal representation of a vendor that they will be
 * proud of to share to the public." Before this route existed, a shop's
 * og:image was either a presigned R2 URL that expired 24h after the share
 * (`X-Amz-Expires=86400` — a broken image the next day) or, for a shop with
 * no logo, nothing at all. This route serves a card at a PERMANENT address —
 * `vendorMetadataBySlug` (`app/v/[slug]/page.tsx`) points og:image,
 * twitter:image and the structured-data `image` here instead of at the raw
 * logo.
 *
 * SAFETY GATE (mirrors `vendorMetadataBySlug` exactly — same `fetchVendor`,
 * same two checks, in the same order): the real, name-bearing card renders
 * ONLY for a shop that is BOTH publicly visible (`isPubliclyVisible`, the
 * exact check the page itself 404s on) AND not a demo vendor (`is_demo`).
 * A hidden/archived shop, a demo shop, a missing slug, or any render failure
 * ALL fall back to the static brand card — so this route can never be used to
 * probe whether a hidden shop exists, or to leak a demo shop's name.
 * Hybrid-anonymity is honoured too: the card's name is
 * `resolveVendorDisplayName`'s output, the SAME function the page title and
 * the JSON-LD `name` already use — never the raw `business_name`.
 *
 * The logo is read through `displayUrlForStoredAsset`, which — since N4
 * part 3 (2026-09-11) — signs ONLY the public media bucket
 * (`lib/site-media-ref.ts`'s `publicBucketServeRef`, the same allow-list a
 * `vendor_profiles.logo_url` value is checked against everywhere else it is
 * read). A logo ref naming a private bucket (it shouldn't, but the column is
 * browser-writable) is refused there and the card renders without a logo,
 * never signs it.
 *
 * Public (crawlers fetch with no session), Node runtime (native
 * satori/sharp). Short cache — a shop can swap its logo or tagline, and we
 * want the card to refresh within the hour.
 */
export const runtime = 'nodejs';

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');
const DEFAULT_OG = `${SITE_URL}/brand/og-card.webp`;

const CARD_HEADERS = {
  'Content-Type': 'image/png',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
} as const;

function pngResponse(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), { headers: CARD_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const vendor = await fetchVendor(slug);

    // The exact same gate as vendorMetadataBySlug: hidden/archived AND demo
    // vendors fall back to the static brand card, never the personalized one.
    if (!vendor || !isPubliclyVisible(vendor.public_visibility) || vendor.is_demo === true) {
      return Response.redirect(DEFAULT_OG, 302);
    }

    const displayName = resolveVendorDisplayName({
      business_name: vendor.business_name,
      name_revealed_at: vendor.name_revealed_at ?? null,
      primary_canonical_service: vendor.services?.[0] ?? null,
      location_city: vendor.location_city,
      services: vendor.services ?? null,
      screen_name: vendor.screen_name ?? null,
      isPaidTier: isTrueNameTier(vendor.tier_state ?? null),
      is_verified: vendor.verification_state === 'verified',
    });

    const description = composeVendorOgDescription(vendor);

    // Same r2:// trap as every other read of a shop's logo — resolved through
    // the public-bucket-only signer (lib/site-media-ref.ts), swallowed on
    // failure so a broken logo degrades the card instead of breaking the share.
    const logoUrl = await displayUrlForStoredAsset(vendor.logo_url).catch(() => null);

    const png = await renderVendorOgPng({
      displayName,
      description,
      logoUrl,
    });
    return pngResponse(png);
  } catch {
    return Response.redirect(DEFAULT_OG, 302);
  }
}
