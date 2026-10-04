import { NextResponse } from 'next/server';
import { buildEventManifest } from '@/lib/event-app-icon';
import { REENTRY_PARAM, isUrlSecretShaped, reentryRedeemPath } from '@/lib/guest-pass-hop';
import { loadEventIconSource } from '../_lib/icon-source';

/**
 * /<slug>/manifest.webmanifest — the couple's own web app manifest.
 *
 * This is what makes an installed tile THEIR wedding rather than our app:
 * `start_url` and `scope` are their address, so the icon opens the invitation
 * and stays inside it, and the icons are their mark.
 *
 * ⚠ NOT CACHED AT THE EDGE BY DEFAULT: a wedding goes from private to public
 * the day the couple launches their Save-the-Date, and a manifest cached from
 * before that would keep answering 404 (or, worse, keep answering) after the
 * state changed. It is cheap — a single row and a string.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const source = await loadEventIconSource(slug);
  if (!source) return new NextResponse('Not found', { status: 404 });

  /* 📲 THE TILE KEEPS THE GUEST IN (I9, owner 2026-10-04). The thank-you names
     this manifest with a one-time re-entry code (`?k=`, minted by
     `invite/enter/page.tsx`); the tile's FIRST open then goes through
     `/{slug}/redeem?k=…&to=hub`, which spends the code ONCE for the guest's
     normal pass in the tile's own cookie jar and opens the Event Hub. Nothing is
     checked here — an unknown code is refused, and logged, by the redeem. Every
     later launch finds the pass already there and spends nothing. */
  const code = new URL(req.url).searchParams.get(REENTRY_PARAM);
  const startUrl = isUrlSecretShaped(code) ? reentryRedeemPath(source.slug, code, 'hub') : null;

  return NextResponse.json(
    buildEventManifest({
      slug: source.slug,
      displayName: source.displayName,
      eventDate: source.eventDate,
      background: source.background,
      startUrl,
    }),
    {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        // A private event's manifest must never sit in a shared cache.
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    },
  );
}
