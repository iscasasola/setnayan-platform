import { NextResponse } from 'next/server';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { renderVenueSvg, type ReceptionDesign } from '@/lib/reception-scene';
import { buildConceptPdf } from '@/lib/concept-pdf';
import { safeFetchImageBytes } from '@/lib/safe-image-fetch';

export const dynamic = 'force-dynamic';
// Server-side render (scene raster + image fetches + pdf-lib) — give it a
// generous-but-bounded budget so a slow image host can't hang the function.
export const maxDuration = 20;

// Bound the work — the grid shows 6 inspirations.
const MAX_INSPIRATIONS = 6;

export async function GET(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  // RLS scopes every read to the couple's own event.
  const { data: event } = await supabase
    .from('events')
    .select(
      'display_name, slug, event_date, monogram_text, monogram_color, role_palette, reception_design',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) return new NextResponse('Event not found', { status: 404 });

  const { data: inspoRows } = await supabase
    .from('event_inspiration_assets')
    .select('image_url, slot_position')
    .eq('event_id', eventId)
    .is('removed_at', null)
    .order('slot_position', { ascending: true })
    .limit(40);

  // ---- palette + role colors (mirror the Mood Board page) -----------------
  const palette = sanitizeRolePalette(event.role_palette ?? {});
  const reception = palette.reception ?? [];
  const swatches = Array.from(
    new Set([
      ...reception,
      ...(palette.bride ?? []),
      ...(palette.groom ?? []),
      ...(palette.wedding_party ?? []),
      ...(palette.guest ?? []),
    ]),
  ).slice(0, 6);
  const design: ReceptionDesign =
    event.reception_design && typeof event.reception_design === 'object'
      ? (event.reception_design as ReceptionDesign)
      : {};
  const roleColors = {
    bride: palette.bride?.[0],
    groom: palette.groom?.[0],
    party: palette.wedding_party?.[0],
    guest: palette.guest?.[0],
    guestPalette: palette.guest ?? [],
  };

  // ---- rasterize the stylized scene (the "custom template"), 3:2 ----------
  let scenePng: Uint8Array;
  try {
    const svg = renderVenueSvg(design, reception, roleColors);
    const buf = await sharp(Buffer.from(svg), { density: 150 })
      .resize(1200, 800, { fit: 'cover' })
      .png()
      .toBuffer();
    scenePng = new Uint8Array(buf);
  } catch {
    // 1×1 fallback so the PDF still generates.
    scenePng = new Uint8Array(
      await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ECE6DD' } })
        .png()
        .toBuffer(),
    );
  }

  // ---- fetch + square-crop the inspirations -------------------------------
  const urls = (inspoRows ?? [])
    .map((r) => r.image_url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .slice(0, MAX_INSPIRATIONS);
  const inspirations: Uint8Array[] = [];
  await Promise.all(
    urls.map(async (url) => {
      // SSRF-guarded + timed-out fetch (the image_url column can, by schema,
      // hold a host-pasted URL once url_paste ships).
      const bytes = await safeFetchImageBytes(url);
      if (!bytes) return;
      try {
        const png = await sharp(Buffer.from(bytes), {
          limitInputPixels: 24_000_000, // reject decompression-bomb images
          failOn: 'truncated',
        })
          .resize(600, 600, { fit: 'cover' })
          .png()
          .toBuffer();
        inspirations.push(new Uint8Array(png));
      } catch {
        /* skip undecodable image */
      }
    }),
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  // Setnayan mark (optional).
  let logoPng: Uint8Array | null = null;
  try {
    const res = await fetch(`${appUrl}/brand/setnayan-mark-512.png`, {
      cache: 'force-cache',
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) logoPng = new Uint8Array(await res.arrayBuffer());
  } catch {
    logoPng = null;
  }

  // Website QR (optional).
  let qrPng: Uint8Array | null = null;
  if (event.slug) {
    try {
      const png = await QRCode.toBuffer(`${appUrl}/${event.slug}`, {
        type: 'png',
        width: 320,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#1E2229', light: '#FFFFFF' },
      });
      qrPng = new Uint8Array(png);
    } catch {
      qrPng = null;
    }
  }

  const pdf = await buildConceptPdf({
    appUrl,
    event: {
      display_name: event.display_name,
      slug: event.slug,
      event_date: event.event_date,
      monogram_text: event.monogram_text,
      monogram_color: event.monogram_color,
    },
    design,
    palette: swatches,
    scenePng,
    resultPng: null, // photoreal render slots in once "Make it real" ships
    inspirations,
    logoPng,
    qrPng,
  });

  const safeName = (event.display_name || 'Wedding')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Concept-${safeName}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
