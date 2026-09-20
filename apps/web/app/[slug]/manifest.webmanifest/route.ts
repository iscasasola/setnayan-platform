import { NextResponse } from 'next/server';
import { buildEventManifest } from '@/lib/event-app-icon';
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

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const source = await loadEventIconSource(slug);
  if (!source) return new NextResponse('Not found', { status: 404 });

  return NextResponse.json(
    buildEventManifest({
      slug: source.slug,
      displayName: source.displayName,
      eventDate: source.eventDate,
      background: source.background,
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
