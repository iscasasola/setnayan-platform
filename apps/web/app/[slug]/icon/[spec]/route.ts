import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { buildEventIconSvg } from '@/lib/event-app-icon';
import { loadEventIconSource } from '../../_lib/icon-source';

/**
 * /<slug>/icon/192.svg · /<slug>/icon/512.svg · /<slug>/icon/512.png …
 *
 * ONE route for both platforms, because two routes drift. Android reads the SVG
 * out of the manifest; iOS ignores manifest icons entirely and takes the PNG
 * through `apple-touch-icon`, so the PNG is rasterised from the very same SVG
 * string rather than drawn a second way.
 *
 * `spec` is `<size>.<ext>` and lives in its OWN segment: Next.js has no partly
 * dynamic segment, so `icon-[spec]` is not a route. Anything outside the size
 * list is a 404 rather than a guess, so this cannot be used as an arbitrary
 * image resizer.
 */
export const dynamic = 'force-dynamic';

const SIZES = new Set([120, 152, 167, 180, 192, 256, 384, 512]);

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; spec: string }> }) {
  const { slug, spec } = await ctx.params;
  const match = /^(\d{2,4})\.(svg|png)$/.exec(spec ?? '');
  if (!match) return new NextResponse('Not found', { status: 404 });
  const size = Number(match[1]);
  const ext = match[2];
  if (!SIZES.has(size)) return new NextResponse('Not found', { status: 404 });

  const source = await loadEventIconSource(slug);
  if (!source) return new NextResponse('Not found', { status: 404 });

  const svg = buildEventIconSvg({
    markSvg: source.markSvg,
    initials: source.initials,
    background: source.background,
    size,
  });

  if (ext === 'svg') {
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  }

  // iOS home-screen icons must be PNG. A failure here would otherwise hand iOS
  // a broken image and leave a grey tile on somebody's phone, so it falls back
  // to the SVG's own bytes with an honest content type rather than 500ing.
  try {
    const png = await sharp(Buffer.from(svg), { density: 384 })
      .resize(size, size, { fit: 'contain' })
      .png()
      .toBuffer();
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[icon] PNG rasterisation failed, serving the SVG', err);
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  }
}
