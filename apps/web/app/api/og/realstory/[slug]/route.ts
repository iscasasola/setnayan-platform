import { type NextRequest } from 'next/server';

import { findRealWedding } from '@/lib/real-weddings';
import { renderRealStoryOgJpeg } from '@/lib/social/realstory-card';

/**
 * GET /api/og/realstory/[slug] — the 1200×630 Open Graph share card for a Real
 * Story showcase (/realstories/[slug]).
 *
 * PUBLIC, no auth — by design. Facebook, Pinterest, and every other link
 * crawler fetch the `og:image` URL server-side with no Setnayan session, so the
 * route can't gate on one. It only ever renders from the fixed, public
 * `REAL_WEDDINGS` set (404 on an unknown slug) — no arbitrary data, no PII
 * beyond what the public editorial already shows.
 *
 * satori + sharp are native → Node runtime. Deterministic per slug, so the
 * response is cached hard (immutable, 1 day) — the same model as
 * /api/social/card/[postId].
 */
export const runtime = 'nodejs';

const CARD_HEADERS = {
  'Content-Type': 'image/jpeg',
  'Cache-Control': 'public, max-age=86400, immutable',
} as const;

/** A Buffer isn't a BodyInit; copy into a fresh Uint8Array view for Response. */
function jpegResponse(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), { headers: CARD_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const wedding = findRealWedding(slug);
  if (!wedding) {
    return new Response('Not found', { status: 404 });
  }

  const descriptor = `A ${wedding.ceremonyType.toLowerCase()} ${wedding.venueSetting.toLowerCase()} wedding · ${wedding.city}`;

  try {
    const jpeg = await renderRealStoryOgJpeg({
      coupleNames: wedding.coupleNames,
      descriptor,
      dateLabel: wedding.eventDateLabel,
      palette: wedding.palette,
      isSample: wedding.isSample,
      heroPhotoUrl: null,
    });
    return jpegResponse(jpeg);
  } catch {
    // Never hand a crawler a 500 — fall back to the static brand OG card
    // (the same 1200×630 image the root layout uses as its default og:image).
    return Response.redirect(
      `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '')}/brand/og-card.webp`,
      302,
    );
  }
}
