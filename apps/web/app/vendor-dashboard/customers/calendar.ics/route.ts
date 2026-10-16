import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorBlocksDetailed, fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { manilaTodayIso } from '@/lib/vendor-cashflow';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';

/**
 * PHONE CALENDAR — every booking as one .ics file (owner 2026-10-14 ✅ "APPROVE", prototype Dates › More settings
 * "Phone calendar · Every booking · .ics"; checklist 6.13 was MISSING for the shop as a whole — only one customer's
 * day-of timeline had a file, `clients/[eventId]/calendar.ics`).
 *
 * A DOWNLOAD, not a subscription: the couples' token feed was retired on the owner's call
 * (`20271157440480_retire_calendar_subscription_feed.sql`), so this answers the signed-in shop only, from its own
 * rows (RLS): the Setnayan bookings (all day, named by the event) and the bookings from outside (at their time when
 * one was given). From 30 days back, so last month's work is still there; never a couple's contact or note.
 */

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
const ymd = (d: string) => d.replace(/-/g, '');
const nextDay = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (day ?? 1) + 1)).toISOString().slice(0, 10);
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return new NextResponse('Not found', { status: 404 });

  const vendorProfileId = profile.vendor_profile_id;
  const today = manilaTodayIso();
  const [y, m, d] = today.split('-').map(Number);
  const from = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) - 30)).toISOString().slice(0, 10);
  const [bookings, blocksRead] = await Promise.all([
    fetchVendorPoolBookings(supabase, vendorProfileId),
    fetchVendorBlocksDetailed(supabase, vendorProfileId),
  ]);

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Setnayan//Supplier bookings//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Setnayan bookings',
    // Philippine time has no DST — one fixed offset anchors every timed booking to the shop, wherever the phone is.
    'BEGIN:VTIMEZONE', `TZID:${DEFAULT_EVENT_TZ}`, 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0800', 'TZOFFSETTO:+0800', 'TZNAME:PST', 'END:STANDARD', 'END:VTIMEZONE'];
  // One booking per event (a joined hall holds several seats for one wedding).
  const seen = new Set<string>();
  for (const b of bookings) {
    if (b.bookedDate < from || seen.has(`${b.eventId}@${b.bookedDate}`)) continue;
    seen.add(`${b.eventId}@${b.bookedDate}`);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.poolBookingId}@setnayan.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(b.bookedDate)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(b.bookedDate))}`,
      `SUMMARY:${icsEscape(`${b.eventName} · booked on Setnayan`)}`,
      'END:VEVENT',
    );
  }
  for (const k of blocksRead.blocks) {
    if (k.source !== 'external_client' || k.endDate < from) continue;
    const name = icsEscape(`${k.clientName?.trim() || 'Booking from outside'} · from outside`);
    if (k.clientTime && k.startDate === k.endDate) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${k.blockId}@setnayan.com`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${DEFAULT_EVENT_TZ}:${ymd(k.startDate)}T${k.clientTime.replace(':', '')}00`,
        `SUMMARY:${name}`,
        'END:VEVENT',
      );
    } else {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${k.blockId}@setnayan.com`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(k.startDate)}`,
        `DTEND;VALUE=DATE:${ymd(nextDay(k.endDate))}`,
        `SUMMARY:${name}`,
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');

  return new NextResponse(lines.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="setnayan-bookings.ics"',
      'Cache-Control': 'private, no-store',
    },
  });
}
