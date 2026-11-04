import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchEventViewer, viewerAreaLevel } from '@/lib/event-viewer.server';
import { fetchScheduleBlocks } from '@/lib/schedule';
import { readBlockRosMeta } from '@/lib/schedule-ros';
import { readScheduleSuppliers } from '@/lib/schedule-suppliers-read';
import { ScheduleUnreadError, personDayPdf, schedulePdf } from '@/lib/schedule-pdf';
import { readPrintDay } from '@/lib/schedule-view-as-people';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { sharePdfPaper } from '@/lib/share-pdf-papers';
import { printedDate } from '@/lib/print-pieces';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// 📤 The schedule as a FILE — the budget's PDF route (`api/budget/[eventId]/export`), for the Schedule (owner
// 2026-11-01: "just like our budget design pdf. do the same for  schedule"). `lib/schedule-pdf.ts` on the shared
// engine; the Schedule's Share button (`SharePdfButton`) fetches it and hands the phone the file.
//
// Doors, BEFORE any moment is read:
//   1. signed in;
//   2. the host, or a delegate the host shared The Day with (`viewerAreaLevel(…, 'schedule')`) — a stranger is
//      refused here, never handed an empty schedule that RLS quietly answered with no rows.
// A refused read is a sentence and a 503, never a file of zeros (`ScheduleUnreadError`).
//
//   ?paper=a4|letter|long   Paper ▾ (A4 default)
//   ?names=0                the "Include names" switch off — no Who column
//
// 👤 POST — ONE PERSON'S DAY (event chapters slice 6, owner 2026-11-04 "Any View as person, Pro"). The View as screen
// sends the day it drew (`PrintDay`); the same two doors, then Pro (the per-person views are Pro, plan §3b), then
// `readPrintDay` (plain strings, inside the limits) — and the file prints exactly that. The same route, so no new
// Vercel function. ?paper= as above.
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ eventId: string }> };

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request, { params }: Params) {
  const { eventId } = await params;
  const q = new URL(req.url).searchParams;
  const unread = () =>
    new NextResponse(new ScheduleUnreadError().message, { status: 503, headers: NO_STORE });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Please sign in to share your schedule.', { status: 401 });

  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (viewerAreaLevel(viewer, 'schedule') === null) {
    return new NextResponse("The schedule isn't shared with you. Ask the hosts for access.", { status: 403 });
  }

  // One round trip: the event's head, the moments, who does each, and the suppliers' names.
  const [eventRes, blocks, meta, suppliers] = await Promise.all([
    supabase.from('events_host').select('display_name, event_date, event_date_precision').eq('event_id', eventId).maybeSingle(),
    fetchScheduleBlocks(supabase, eventId).catch(() => null),
    readBlockRosMeta(supabase, eventId),
    readScheduleSuppliers(supabase, eventId),
  ]);
  const event = eventRes.data as { display_name: string | null; event_date: string | null; event_date_precision: string | null } | null;
  if (eventRes.error) return unread();
  if (!event) return new NextResponse('Event not found.', { status: 404 });
  if (!blocks || !meta) return unread();
  // 🔌 A refused supplier read prints no "A booked supplier" in every Who (reads-are-honest, 2026-11-02 audit #16).
  if (!suppliers) return unread();

  const shopName = new Map(suppliers.map((s) => [s.vendor_id, s.vendor_name]));
  const who = new Map<string, string[]>();
  const supplierIds = new Map<string, string[]>();
  for (const [blockId, m] of meta) {
    const ids = m.responsible_vendor_ids ?? [];
    supplierIds.set(blockId, ids);
    // A tagged supplier whose name did not come back still counts as somebody — never a blank "Who".
    const people = ids.map((id) => shopName.get(id) ?? 'A booked supplier');
    if (m.responsible_party?.trim()) people.push(m.responsible_party.trim());
    who.set(blockId, people);
  }

  const eventName = event.display_name?.trim() || 'Your event';
  const fileSlug =
    eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event';

  let bytes: Uint8Array;
  try {
    bytes = await schedulePdf({
      eventName,
      eventDate: printedDate(event.event_date, event.event_date_precision),
      blocks,
      who,
      supplierIds,
      includeNames: q.get('names') !== '0',
      generatedAt: new Date(),
      paper: sharePdfPaper(q.get('paper')),
    });
  } catch (e) {
    if (e instanceof ScheduleUnreadError) return unread();
    console.error('[schedule-export] the PDF could not be drawn', e instanceof Error ? e.message : e, { event_id: eventId });
    return new NextResponse("Your schedule's file couldn't be made just now. Please try again.", { status: 500, headers: NO_STORE });
  }
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="setnayan-${fileSlug}-schedule.pdf"`,
      ...NO_STORE,
    },
  });
}

/** The most a day's JSON may weigh (a 400-line day is well under it). */
const PRINT_DAY_MAX_BYTES = 200_000;

export async function POST(req: Request, { params }: Params) {
  const { eventId } = await params;
  const q = new URL(req.url).searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Please sign in to share your schedule.', { status: 401 });

  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (viewerAreaLevel(viewer, 'schedule') === null) {
    return new NextResponse("The schedule isn't shared with you. Ask the hosts for access.", { status: 403 });
  }
  // 💎 One person's day is Pro, like the view it prints — the REAL gate (a POST never reads the owner's "view as Free"
  // switch, lib/view-as-free-never-changes-a-save.test.ts). A refused Pro read is "not Pro", never a free file.
  const pro = await eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId).catch(() => false);
  if (!pro) return new NextResponse('A schedule for one person is part of Pro.', { status: 402, headers: NO_STORE });

  const text = await req.text();
  if (text.length > PRINT_DAY_MAX_BYTES) return new NextResponse('That schedule is too long to print.', { status: 413, headers: NO_STORE });
  let day: ReturnType<typeof readPrintDay> = null;
  try {
    day = readPrintDay(JSON.parse(text));
  } catch {
    day = null;
  }
  if (!day) return new NextResponse("That schedule couldn't be read. Please try again.", { status: 400, headers: NO_STORE });

  const eventRes = await supabase.from('events_host').select('display_name, event_date, event_date_precision').eq('event_id', eventId).maybeSingle();
  if (eventRes.error) return new NextResponse(new ScheduleUnreadError().message, { status: 503, headers: NO_STORE });
  const event = eventRes.data as { display_name: string | null; event_date: string | null; event_date_precision: string | null } | null;
  if (!event) return new NextResponse('Event not found.', { status: 404 });

  const eventName = event.display_name?.trim() || 'Your event';
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let bytes: Uint8Array;
  try {
    bytes = await personDayPdf({
      eventName,
      eventDate: printedDate(event.event_date, event.event_date_precision),
      day,
      generatedAt: new Date(),
      paper: sharePdfPaper(q.get('paper')),
    });
  } catch (e) {
    console.error('[schedule-export] a person’s PDF could not be drawn', e instanceof Error ? e.message : e, { event_id: eventId });
    return new NextResponse("This schedule's file couldn't be made just now. Please try again.", { status: 500, headers: NO_STORE });
  }
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="setnayan-${slug(eventName) || 'event'}-${slug(day.person) || 'person'}-schedule.pdf"`,
      ...NO_STORE,
    },
  });
}
