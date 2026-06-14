import { type NextRequest } from 'next/server';

import { renderManifestoCard, type ManifestoFormat } from '@/lib/social/manifesto-card';

/**
 * GET /api/og/manifesto?format=og|square|story — the shareable "Living Memories"
 * manifesto card (the /our-story og:image, and a postable feed/story asset).
 *
 * PUBLIC, no auth — by design. Link crawlers (Facebook, Pinterest, etc.) fetch
 * the og:image server-side with no session. Renders only the fixed brand card
 * (no arbitrary data, no PII). satori + sharp are native → Node runtime;
 * deterministic, so cached hard (immutable, 1 day).
 *
 *   og     1200×630   link unfurl (default)
 *   square 1080×1080  feed post
 *   story  1080×1920  Reels / TikTok / Stories
 */
export const runtime = 'nodejs';

const CARD_HEADERS = {
  'Content-Type': 'image/jpeg',
  'Cache-Control': 'public, max-age=86400, immutable',
} as const;

const FORMATS = new Set<ManifestoFormat>(['og', 'square', 'story']);

/** A Buffer isn't a BodyInit; copy into a fresh Uint8Array view for Response. */
function jpegResponse(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), { headers: CARD_HEADERS });
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('format') ?? 'og';
  const format: ManifestoFormat = FORMATS.has(raw as ManifestoFormat)
    ? (raw as ManifestoFormat)
    : 'og';

  try {
    const jpeg = await renderManifestoCard(format);
    return jpegResponse(jpeg);
  } catch {
    // Never hand a crawler a 500 — fall back to the static brand OG card.
    return Response.redirect(
      `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '')}/brand/og-card.webp`,
      302,
    );
  }
}
