import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchGuestsByEvent,
  guestDisplayName,
  ROLE_LABELS,
} from '@/lib/guests';
import { fetchAssignments, fetchFloorPlan, fetchTables } from '@/lib/seating';
import {
  buildSeatingPdf,
  type SeatingPdfGuest,
  type SeatingPdfMode,
} from '@/lib/seating-pdf';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await ctx.params;
  const mode: SeatingPdfMode =
    new URL(req.url).searchParams.get('mode') === 'blueprint' ? 'blueprint' : 'moodboard';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // All reads go through the couple's RLS — a non-member gets empty/null.
  const { data: event } = await supabase
    .from('events')
    .select('display_name, slug, event_date, monogram_text, monogram_color')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) {
    return new NextResponse('Event not found', { status: 404 });
  }

  const [tables, assignments, guests, floorPlan, moodboard] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
    supabase
      .from('event_moodboard_saves')
      .select('palette_snapshot')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  const pdfGuests: SeatingPdfGuest[] = guests.map((g) => ({
    guest_id: g.guest_id,
    name: guestDisplayName(g),
    role: ROLE_LABELS[g.role] ?? 'Guest',
  }));

  // Mood-board palette → flat list of hex colours (drop non-hex).
  const snapshot = (moodboard.data?.palette_snapshot ?? {}) as Record<string, unknown>;
  const palette = Object.values(snapshot)
    .filter((v): v is string => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v))
    .map((v) => (v.startsWith('#') ? v : `#${v}`));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  // Setnayan mark for the header (optional — skip silently if unreachable).
  let logoPng: Uint8Array | null = null;
  try {
    const res = await fetch(`${appUrl}/brand/setnayan-mark-512.png`, { cache: 'force-cache' });
    if (res.ok) logoPng = new Uint8Array(await res.arrayBuffer());
  } catch {
    logoPng = null;
  }

  const pdf = await buildSeatingPdf({
    mode,
    appUrl,
    event,
    tables,
    assignments,
    guests: pdfGuests,
    floorPlan,
    palette,
    logoPng,
  });

  const safeName = (event.display_name || 'Wedding').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Seating-Plan-${safeName}-${mode}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
