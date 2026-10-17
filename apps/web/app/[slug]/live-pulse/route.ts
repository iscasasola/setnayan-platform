import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { GUEST_SESSION_COOKIE_NAME, verifyGuestSessionToken } from '@/lib/guest-session';
import { eventPulse } from '@/lib/event-pulse.server';
import { canViewSlugEvent } from '@/lib/slug-access';
import { liveEdgeHeaders, NOT_HELD } from '@/lib/live-day-cache';

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
 * not open to strangers the viewer must hold this event's guest pass (signature-checked — see `holdsThisEventsPass`)
 * or pass `canViewSlugEvent` (the gate every /[slug] sub-route applies), and the answer is then private to them. The remembered answer is still the event's — only the door is per viewer.
 *
 * Refused read → 503, never "nothing changed"; no event / not admitted → 404. Neither is cached.
 */

export const dynamic = 'force-dynamic';

const EDGE = liveEdgeHeaders(5);

/**
 * The guest's own pass for THIS event, checked by its SIGNATURE only (`verifyGuestSessionToken`, the middleware's
 * check). ⚖ Deliberately lighter than `readGuestSession`'s database re-check: what this door guards is a change stamp
 * — no name, no content — and the full check is one database read per phone per poll, the very cost this route
 * exists to remove. Anyone else (a host, a signed-in seat-holder) goes through `canViewSlugEvent`, unchanged.
 */
async function holdsThisEventsPass(eventId: string): Promise<boolean> {
  const token = (await cookies()).get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const verified = await verifyGuestSessionToken(token);
  return verified?.payload.event_id === eventId && verified.expiresAtSeconds > Date.now() / 1000;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NOT_HELD });

  let pulse: Awaited<ReturnType<typeof eventPulse>>;
  try {
    pulse = await eventPulse(slug);
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NOT_HELD });
  }
  if (!pulse) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NOT_HELD });

  if (!pulse.openToStrangers && !(await holdsThisEventsPass(pulse.eventId)) && !(await canViewSlugEvent(pulse.eventId, pulse.visibility))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NOT_HELD });
  }
  return NextResponse.json(
    { v: pulse.v, g: pulse.g },
    { headers: pulse.openToStrangers ? EDGE : NOT_HELD },
  );
}
