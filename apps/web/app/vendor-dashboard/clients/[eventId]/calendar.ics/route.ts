import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Per-vendor .ics feed of the shared day-of timeline — feature-access
 * program Phase 3 (§ 4). RLS is the gate: the booked-vendor read policy on
 * event_schedule_blocks returns rows only when the caller's org holds a live
 * booked relationship; anyone else gets an empty set → 404.
 */

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, label, start_at, end_at, location')
    .eq('event_id', eventId)
    .not('start_at', 'is', null)
    .order('start_at', { ascending: true });

  const blocks = (data ?? []) as {
    block_id: string;
    label: string;
    start_at: string;
    end_at: string | null;
    location: string | null;
  }[];
  if (blocks.length === 0) return new NextResponse('Not found', { status: 404 });

  const now = icsStamp(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Setnayan//Vendor Timeline//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const b of blocks) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.block_id}@setnayan.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsStamp(b.start_at)}`,
      ...(b.end_at ? [`DTEND:${icsStamp(b.end_at)}`] : []),
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
