import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { blockRelevance } from '@/lib/vendor-timeline';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';

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

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** A real instant → an ICS UTC stamp (`…Z`). Only for values that genuinely
 *  ARE instants, like DTSTAMP. */
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * A schedule time → an ICS **local** stamp, no `Z`, paired with `TZID=` below.
 *
 * `event_schedule_blocks.start_at` holds the venue's WALL CLOCK in a UTC
 * column. Emitting it as `…Z` told every calendar app the 2 PM ceremony was at
 * 2 PM UTC — so the photographer's phone put the wedding in their diary at
 * **10 PM**, eight hours after everyone else arrived.
 */
function icsLocalStamp(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return `${y}${mo}${d}T${h}${mi}00`;
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

  const { data } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, label, block_type, start_at, end_at, location')
    .eq('event_id', eventId)
    .not('start_at', 'is', null)
    .order('start_at', { ascending: true });

  let blocks = (data ?? []) as {
    block_id: string;
    label: string;
    block_type: string;
    start_at: string;
    end_at: string | null;
    location: string | null;
  }[];

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
  for (const b of blocks) {
    const dtstart = icsLocalStamp(b.start_at);
    if (!dtstart) continue;
    const dtend = b.end_at ? icsLocalStamp(b.end_at) : null;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.block_id}@setnayan.com`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${DEFAULT_EVENT_TZ}:${dtstart}`,
      ...(dtend ? [`DTEND;TZID=${DEFAULT_EVENT_TZ}:${dtend}`] : []),
      `SUMMARY:${icsEscape(b.label)}`,
      ...(b.location ? [`LOCATION:${icsEscape(b.location)}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');

  return new NextResponse(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="setnayan-event-timeline.ics"',
    },
  });
}
