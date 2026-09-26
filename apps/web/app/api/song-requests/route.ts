import { NextResponse } from 'next/server';
import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { moderateKwentoText } from '@/lib/kwento-moderation';
import { getDayOfPhase } from '@/lib/day-of-mode';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { eventSongRequestDoor } from '@/lib/guest-song-request';
import { resolveRsvpAsk } from '@/lib/rsvp-ask';
import {
  SONG_ARTIST_MAX,
  SONG_REQUESTER_NAME_MAX,
  SONG_TITLE_MAX,
  songRequestErrorFor,
  songRequestOutcomeFor,
} from '@/lib/guest-song-request-rule';

// POST /api/song-requests — a wedding guest asks the band for a song (SUP-52).
//
// The guest lane of the July song-request machinery, finally with a door:
//   * Auth = the setnayan_guest_session JWT cookie (zero-account canon), exactly
//     like /api/guest-columns — guests have no auth.uid(), so the write goes
//     through the service-role-only `guest_submit_song_request` RPC, which owns
//     the integrity rules (band pause, block lever, 5/hr cap, one row per song).
//   * The door is re-checked HERE, not trusted from the page: the live window
//     (the same `getDayOfPhase` the page renders from) and a booked act who can
//     actually read the inbox (`eventSongRequestDoor`). Without the second, a
//     hand-rolled POST on a band-less wedding would land a request nobody sees.
//   * Tier-1 moderation over what the band will read, before the RPC.
//
// The open (walk-in / master-QR) lane is NOT served here — it has no guest-
// facing surface yet, and nothing in this route touches it.

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await readGuestSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { title?: unknown; artist?: unknown; name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const artist = typeof body.artist === 'string' ? body.artist.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (title.length < 1 || title.length > SONG_TITLE_MAX) {
    return NextResponse.json({ error: 'bad_title' }, { status: 400 });
  }
  if (artist.length > SONG_ARTIST_MAX) {
    return NextResponse.json({ error: 'bad_artist' }, { status: 400 });
  }
  if (name.length > SONG_REQUESTER_NAME_MAX) {
    return NextResponse.json({ error: 'bad_name' }, { status: 400 });
  }

  if (moderateKwentoText(`${title}\n${artist}\n${name}`).state === 'blocked') {
    return NextResponse.json({ error: 'keep_it_sweet' }, { status: 422 });
  }

  const admin = createAdminClient();

  const { data: event, error: eventError } = await admin
    .from('events')
    .select('event_date, venue_latitude, venue_longitude, rsvp_ask_config')
    .eq('event_id', session.event_id)
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  const e = event as
    | { event_date: string | null; venue_latitude: number | null; venue_longitude: number | null; rsvp_ask_config: unknown }
    | null;
  if (!e?.event_date) return NextResponse.json({ error: 'not_live' }, { status: 409 });
  // ⚙ WHAT DO YOU WANT TO ASK YOUR GUESTS? (owner 2026-09-25) — re-read here,
  // never trusted from the client: the card's own render is only a courtesy.
  if (!resolveRsvpAsk(e.rsvp_ask_config).song_request) {
    return NextResponse.json({ error: 'song_requests_off' }, { status: 409 });
  }
  const phase = getDayOfPhase(
    e.event_date,
    eventTimezoneFromCoords(e.venue_latitude, e.venue_longitude),
  );
  if (phase !== 'live') return NextResponse.json({ error: 'not_live' }, { status: 409 });

  const door = await eventSongRequestDoor(admin, session.event_id);
  if (door === null) return NextResponse.json({ error: 'no_band' }, { status: 409 });
  // A 'paused' door still goes to the RPC: it raises `songreq:closed` from the
  // same predicate, so the refusal has exactly one author.

  const { data, error } = await admin.rpc('guest_submit_song_request', {
    p_guest_id: session.guest_id,
    p_title: title,
    p_artist: artist,
    p_requester_name: name || null,
  });
  if (error) {
    const mapped = songRequestErrorFor(error.message);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  return NextResponse.json({ ok: true, outcome: songRequestOutcomeFor(data) });
}
