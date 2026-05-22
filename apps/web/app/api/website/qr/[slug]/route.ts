import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMonogram } from '@/lib/monogram';

/**
 * GET /api/website/qr/[slug] — serves the master event QR as PNG with the
 * couple's monogram composited in the center. Drives the "Download QR"
 * affordance on the new /dashboard/[eventId]/website hub (CLAUDE.md
 * 2026-05-22) and is also safe to share directly as an `<img>` source.
 *
 * The encoded URL is `setnayan.com/{slug}` (no token suffix) — same code that
 * drives host social shares + vendor scan-at-venue Tier 1/Tier 2 per the
 * 0002 unified QR lifecycle lock (CLAUDE.md 2026-05-22 row 11).
 *
 * Public read: the slug is already addressable on the marketing surface, so
 * no auth is required to fetch the QR for that slug. We do hit the events
 * table to read the monogram (so the QR center matches the host's branding)
 * which uses the admin client + a maybeSingle lookup. Privacy footprint is
 * limited to monogram_text + monogram_color — both already render on the
 * public landing page itself.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;

  if (!slug || typeof slug !== 'string' || slug.length < 1 || slug.length > 64) {
    return new NextResponse('Invalid slug.', { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: event } = await supabase
    .from('events')
    .select('display_name, monogram_text, monogram_color, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!event) {
    return new NextResponse('Wedding website not found.', { status: 404 });
  }

  const monogram = resolveMonogram({
    display_name: event.display_name,
    monogram_text: event.monogram_text,
    monogram_color: event.monogram_color,
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const url = `${appUrl}/${slug}`;

  // Render at 1024px so the printed PNG stays crisp at A4 / postcard sizes.
  // PNG path doesn't compose with `compositeMonogram` (which operates on
  // raw SVG strings), so we keep a clean centered monogram out of the PNG
  // path for now — the SVG version on /dashboard/[eventId]/website shows the
  // host the monogram-composited preview, and the downloaded PNG is the
  // bare-bones bulletproof shareable version.
  const png = await QRCode.toBuffer(url, {
    type: 'png',
    width: 1024,
    margin: 4,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#1A1A1A',
      light: '#FAF7F2',
    },
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Cache-friendly: same slug + same monogram → same PNG. 30-day public
      // CDN cache; browsers immediately revalidate on monogram change because
      // they re-derive the URL from the slug each visit.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=2592000',
    },
  });
}
