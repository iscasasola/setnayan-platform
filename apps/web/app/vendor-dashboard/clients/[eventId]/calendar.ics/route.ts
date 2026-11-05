import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { blockRelevance } from '@/lib/vendor-timeline';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';
import { icsDocument } from '@/lib/ics-text';
import { timelineIcsEvents, type TimelineIcsBlock } from '@/lib/supplier-timeline-ics';

/**
 * Per-vendor .ics feed of the shared day-of timeline — feature-access
 * program Phase 3 (§ 4). RLS is the gate: the booked-vendor read policy on
 * event_schedule_blocks returns rows only when the caller's org holds a live
 * booked relationship; anyone else gets an empty set → 404.
 *
 * ?mine=1 applies the category-relevance lens (data-link program ① — same
 * rule base as the Brief page): only primary + supporting blocks export.
 * Booked categories come from the Brief RPC (vendors can't read
 * event_vendors directly); a lens over already-authorized rows, never a
 * second data path.
 */

/** A real instant → an ICS UTC stamp (`…Z`). Only for values that genuinely
 *  ARE instants, like DTSTAMP. */
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The venue's zone, declared once so a calendar app anchors the times to the
 * WEDDING rather than to wherever the vendor happens to be standing. Philippine
 * Standard Time has no DST, so one fixed offset is the whole truth.
 */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${DEFAULT_EVENT_TZ}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0800',
  'TZOFFSETTO:+0800',
  'TZNAME:PST',
  'END:STANDARD',
  'END:VTIMEZONE',
];

type Params = { params: Promise<{ eventId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, label, block_type, start_at, end_at, location, time_tba')
    .eq('event_id', eventId)
    .not('start_at', 'is', null)
    .order('start_at', { ascending: true });
  // A refused or failed read is not "this event has no timeline" — say it, never the 404 an empty one gets.
  if (error) {
    return new NextResponse('The timeline could not be read just now, so no file was made. Please try again.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // `time_tba` travels so a Time-TBA chapter is written as an all-day item, never at 12:00 AM (lib/supplier-timeline-ics.ts).
  let blocks = (data ?? []) as (TimelineIcsBlock & { block_type: string })[];

  if (new URL(req.url).searchParams.get('mine') === '1' && blocks.length > 0) {
    const { data: brief } = await supabase.rpc('get_vendor_event_brief', {
      p_event_id: eventId,
    });
    const categories = ((brief as { booked_categories?: string[] } | null)?.booked_categories ??
      []) as string[];
    if (categories.length > 0) {
      const lensed = blocks.filter((b) => blockRelevance(b, categories) !== 'context');
      if (lensed.length > 0) blocks = lensed;
    }
  }

  if (blocks.length === 0) return new NextResponse('Not found', { status: 404 });

  const now = icsStamp(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Setnayan//Vendor Timeline//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE,
  ];
  lines.push(...timelineIcsEvents(blocks, now));
  lines.push('END:VCALENDAR');

  return new NextResponse(icsDocument(lines), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="setnayan-event-timeline.ics"',
    },
  });
}
