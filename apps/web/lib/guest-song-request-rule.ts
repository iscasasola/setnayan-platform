/**
 * GUEST SONG REQUEST — the pure half (SUP-52).
 *
 * Every other stage of a guest asking the band for a song shipped months ago:
 * the table and both submit lanes with their caps (`guest_submit_song_request`,
 * migration 20271014090000 → 20271014100000), always-on requests with a band
 * pause (20271020224218), and the band's paid inbox
 * (`vendor-dashboard/on-the-day/live/[eventId]/_components/song-desk/requests-inbox.tsx`,
 * read through `fetchActSongRequests`). What was missing was the GUEST: nothing
 * on `/[slug]` could post. This file holds the parts of that join a test can
 * execute — the render decision and what each server answer means to a guest.
 * The server half is `lib/guest-song-request.ts`; the door is
 * `app/api/song-requests/route.ts`.
 *
 * ⚠ NOT `event_day_requests`. That is the coordinator's floor-ops inbox, and
 * its component is ALSO called `RequestsInbox`
 * (`vendor-dashboard/on-the-day/_components/requests-inbox.tsx`). Same name,
 * different table, different audience — nothing here touches it.
 */

/** Mirrors `resolve_song_id`'s own bounds (1..200) — the RPC is the backstop. */
export const SONG_TITLE_MAX = 200;
export const SONG_ARTIST_MAX = 200;
/** Mirrors the `requester_name` CHECK (1..40 after trim). */
export const SONG_REQUESTER_NAME_MAX = 40;

/**
 * Where the band's door stands for this event, as the guest page needs it.
 *
 *   'open'   — a booked act holds the song desk and has not paused.
 *   'paused' — a booked act holds the song desk and has paused the room.
 *   null     — no booked act can READ requests on this event.
 *
 * 🔑 NULL IS THE WHOLE POINT. `song_requests_open_for_event` answers "open" for
 * EVERY event with no pause row — including a wedding with no band at all, or
 * a band on the free tier that cannot open its inbox (seeing requests is the
 * paid part, owner 2026-07-30). A button shown there would take a guest's
 * request, say "sent", and deliver it to nobody — a failure that renders
 * exactly like success. So the button is shown only when somebody can read.
 */
export type SongRequestDoor = 'open' | 'paused' | null;

/** The card renders only in the live window, only for a door that exists. */
export function songRequestCardShows(input: {
  isLive: boolean;
  door: SongRequestDoor;
}): boolean {
  return input.isLive && input.door !== null;
}

/** RPC exception tags → the route's error codes. Anything else is a 500. */
export const SONG_REQUEST_RPC_ERRORS: Record<string, { status: number; error: SongRequestError }> = {
  'songreq:closed': { status: 409, error: 'paused' },
  'songreq:blocked': { status: 403, error: 'not_available_for_you' },
  'songreq:rate_limited': { status: 429, error: 'too_many' },
  'songreq:invalid_title': { status: 400, error: 'bad_title' },
  'songreq:invalid_artist': { status: 400, error: 'bad_artist' },
  'songreq:unknown_guest': { status: 401, error: 'unauthorized' },
};

export type SongRequestError =
  | 'paused'
  | 'not_available_for_you'
  | 'too_many'
  | 'bad_title'
  | 'bad_artist'
  | 'bad_name'
  | 'keep_it_sweet'
  | 'no_band'
  | 'not_live'
  | 'unauthorized'
  | 'bad_request'
  | 'save_failed';

export function songRequestErrorFor(message: string): { status: number; error: SongRequestError } {
  const tag = Object.keys(SONG_REQUEST_RPC_ERRORS).find((k) => message.includes(k));
  return tag ? SONG_REQUEST_RPC_ERRORS[tag]! : { status: 500, error: 'save_failed' };
}

/**
 * What the guest reads after a request. Two SUCCESS shapes, deliberately:
 * `UNIQUE (event_id, song_id)` makes a repeat ask a silent no-op in the RPC
 * (`ON CONFLICT DO NOTHING` returns zero rows). Telling that guest "sent" would
 * be true in effect and false in fact — their name is not on it. So a zero-row
 * answer says the song is already on the band's list.
 */
export type SongRequestOutcome = 'sent' | 'already_asked';

export function songRequestOutcomeFor(rows: unknown): SongRequestOutcome {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  return list.length > 0 ? 'sent' : 'already_asked';
}

export const SONG_REQUEST_COPY: Record<SongRequestOutcome | SongRequestError, string> = {
  sent: 'Sent to the band. If they know it, it’s yours.',
  already_asked: 'Someone already asked for this one — it’s on the band’s list.',
  paused: 'The band has paused requests for now. Try again in a bit.',
  not_available_for_you: 'Song requests aren’t available on your invitation.',
  too_many: 'You’ve sent a few already — give the band a little while, then ask again.',
  bad_title: 'Please type the song’s title.',
  bad_artist: 'That artist name is a little long — try a shorter one.',
  bad_name: 'Your name can be up to 40 characters.',
  keep_it_sweet: 'Let’s keep it sweet — please rephrase and try again.',
  no_band: 'There’s no band taking requests at this celebration.',
  not_live: 'Requests open on the day, while the celebration is on.',
  unauthorized: 'Please open your invitation link again to ask for a song.',
  bad_request: 'Something hiccuped — please try again.',
  save_failed: 'Something hiccuped — please try again.',
};
