import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveMonogram } from '@/lib/monogram';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-data';
import { renderEventLandingQrPng } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { logQueryError } from '@/lib/supabase/error-detect';

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
    // The design columns join the read so the PNG carries the couple's CHOSEN
    // lockup, not a generic initials badge — the same mark resolveMonogram hands
    // every other surface. The CANONICAL list, never a hand-typed near-copy.
    .select(`event_id, slug, ${HERO_MONOGRAM_COLUMNS}`)
    .eq('slug', slug)
    .maybeSingle();

  if (!event) {
    return new NextResponse('Wedding website not found.', { status: 404 });
  }

  const monogram = resolveMonogram(event);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  // Canonical URL form — nested /u/ under the cutover flag, bare root otherwise
  // (resolve self-noops OFF; no query pre-cutover). NB the public CDN cache
  // below (s-maxage) means a flipped PNG lags up to a day, but the bare URL it
  // encodes keeps working (the dispatcher redirects it), so the lag is benign.
  const ownerSlug = await resolveEventOwnerSlug(supabase, event.event_id);

  // Render at 1024px so the printed PNG stays crisp at A4 / postcard sizes.
  //
  // ⚠ CORRECTED 2026-09-16 (owner decision #19). This route used to say the PNG
  // path "doesn't compose with compositeMonogram (which operates on raw SVG
  // strings)" and shipped a bare code. That reason was true of the function and
  // false of the product — the downloaded file is the one that gets printed and
  // handed over. lib/qr-monogram-raster.ts draws the SAME badge as outlines and
  // composites it onto the raster; the code still decodes to the same url.
  // 🔑 A BADGE THAT DID NOT DRAW MUST NOT LOOK LIKE ONE THAT DID. The composite
  // falls back to the plain code on any failure — right, because the guest's
  // scannable code is the thing that must never break — but the first cut of
  // this route passed no error handler, so production served the bare PNG with
  // 200 and nothing anywhere said so. The header below carries that fact onto
  // the wire, where it can be measured without log access.
  let markError: unknown = null;
  const png = await renderEventLandingQrPng({
    appUrl,
    slug,
    ownerSlug,
    monogram,
    onMonogramError: (err) => {
      markError = err;
      logQueryError('EventLandingQrPng.monogram', err, { eventId: event.event_id }, 'graceful_degrade');
    },
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // 'composited' = the couple's mark is in these pixels. 'fallback' = it is
      // not, and why is in the logs. See the note above the render.
      'X-Setnayan-Monogram': markError ? 'fallback' : 'composited',
      // Cache-friendly: same slug + same monogram → same PNG. 30-day public
      // CDN cache; browsers immediately revalidate on monogram change because
      // they re-derive the URL from the slug each visit.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=2592000',
    },
  });
}
