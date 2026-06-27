import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRolePalette } from '@/lib/mood-board';
import type { ReceptionDesign } from '@/lib/reception-scene';
import { buildMoodboardPrintable } from '@/lib/moodboard-printable';

export const dynamic = 'force-dynamic';
// One-page, data-only render (no image rasterization) — fast, but bound it so a
// slow logo fetch can't hang the function.
export const maxDuration = 15;

/**
 * Free, one-page printable Mood Board (2026-06-28). DISTINCT from the multi-page
 * concept-pdf route — palette grouped per role + a reception-design summary +
 * the couple's names and date, on a light print-safe page. RLS scopes every read
 * to the couple's own event.
 */
export async function GET(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data: event } = await supabase
    .from('events')
    .select('display_name, event_date, role_palette, reception_design')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) return new NextResponse('Event not found', { status: 404 });

  const palette = sanitizeRolePalette(event.role_palette ?? {});
  const design: ReceptionDesign =
    event.reception_design && typeof event.reception_design === 'object'
      ? (event.reception_design as ReceptionDesign)
      : {};

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
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

  const pdf = await buildMoodboardPrintable({
    event: {
      display_name: event.display_name,
      event_date: event.event_date,
    },
    palette,
    design,
    logoPng,
  });

  const safeName = (event.display_name || 'Wedding')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Mood-Board-${safeName}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
