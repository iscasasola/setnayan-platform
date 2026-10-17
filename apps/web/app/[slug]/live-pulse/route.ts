import { NextResponse } from 'next/server';
import { eventPulse } from '@/lib/event-pulse.server';
import { canViewSlugEvent } from '@/lib/slug-access';

/**
 * GET /[slug]/live-pulse — "has anything on this event's day-of pages changed?" (2026-10-18, live-day polling).
 *
 * Asked every ~15 s by each visible guest phone on the day (`lib/use-event-pulse.ts`) in place of a full server
 * render every 45 s. Answers `{ v, g }` (`lib/event-pulse.ts`): a stamp, and per-guest one-way keys with a time. No
 * name, no id, no content — the phone compares and decides.
 *
 * 🔑 ONE ANSWER PER EVENT. `eventPulse` is remembered per event (lib/live-day-cache.ts), so however many phones ask,
 * the database sees one set of reads per event per window. For an event open to strangers (public / unlisted) the
 * answer is the same for everyone and is also handed to the CDN for a few seconds.
 *
 * 🔒 A CLOSED EVENT ASKS THE SAME DOOR ITS PAGES ASK. Even a stamp says WHEN a private event changed; for one that is
 * not open to strangers the viewer must pass `canViewSlugEvent` (the gate every /[slug] sub-route applies), and the
 * answer is then private to them (`no-store`). The remembered answer is still the event's — only the door is per viewer.
 *
 * Refused read → 503, never "nothing changed"; no event / not admitted → 404. Neither is cached.
 */

export const dynamic = 'force-dynamic';

const EDGE_CACHE = 'public, max-age=0, s-maxage=5';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  let pulse: Awaited<ReturnType<typeof eventPulse>>;
  try {
    pulse = await eventPulse(slug);
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!pulse) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  if (!pulse.openToStrangers && !(await canViewSlugEvent(pulse.eventId, pulse.visibility))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(
    { v: pulse.v, g: pulse.g },
    { headers: { 'Cache-Control': pulse.openToStrangers ? EDGE_CACHE : 'private, no-store' } },
  );
}
