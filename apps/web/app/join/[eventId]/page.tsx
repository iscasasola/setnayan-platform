import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  guestSelfJoinDoorIsThrottled,
  JOIN_DOOR_ERROR_KEY,
  JOIN_DOOR_THROTTLED_MESSAGE,
} from '@/lib/join-door-throttle';
import { isUuid } from '@/lib/is-uuid';
import { JoinFlow, RequestSentScreen } from './_components/join-flow';
import { anyoneMayAskToJoin } from '@/lib/rsvp-ask';
import { redirect } from 'next/navigation';
import { DoorShell } from '@/app/_components/door/door-shell';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';
import { INVITATION_ONLY_LINE } from '@/lib/invite-arrival';
import { InvalidTokenScreen } from './_components/join-shell';

export const metadata = { title: 'Join event' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ token?: string; error?: string; sent?: string }>;
};

/**
 * Canonical (opaque) join entry: `/join/[eventId]?token=…`. Resolves + validates
 * the event + token, then renders the shared <JoinFlow>. The branded
 * `/[slug]/invite` route renders the same flow from a slug.
 */
export default async function JoinPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const token = search.token ?? '';

  /*
    🔑 A URL SEGMENT IS WHATEVER A STRANGER TYPED, AND `event_id` IS A `uuid`.
    Handed something that is not one, PostgREST does not return an empty
    result — it rejects the whole query with `22P02 invalid input syntax for
    type uuid`, which this repo's detector files as a production fault. That is
    what `/join/zzzbad` did on 2026-08-15. The visitor's outcome was already
    correct ("this link isn't valid"), so nothing ever looked wrong; the cost
    was a red 400 in the log a REAL fault has to be spotted in, mintable by
    anyone who can type a URL.

    Refusing here is the same answer one step earlier, with no round trip.
  */
  if (!isUuid(eventId)) {
    return <InvalidTokenScreen />;
  }

  // 🔑 THE POSTER TOKEN NO LONGER DECIDES ANYTHING HERE. This page only ever
  // offers ONE thing — the ask-to-join request — and whether it does is the
  // couple's "Who can RSVP?" (below), never whether a poster was scanned. The
  // `token` is still carried through so a sign-in comes back to the same URL.
  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select(
      // `event_date_precision` travels WITH `event_date` everywhere it is shown.
      // The column alone cannot say whether it is a decided day or a placeholder,
      // and this screen prints it to a stranger. See `doorMeta` in join-shell.tsx.
      'event_id, public_id, display_name, event_date, event_date_precision, venue_name, slug, rsvp_ask_config',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) {
    return <InvalidTokenScreen />;
  }

  // "Request sent" (prototype 7c) — where both join actions land a request.
  // It says nothing about anybody's request; it only thanks whoever sent one.
  if (search.sent === '1') {
    const w = await eventWordsForEvent(eventId);
    return (
      <RequestSentScreen
        event={{
          display_name: event.display_name ?? '',
          event_date: event.event_date,
          event_date_precision: event.event_date_precision,
          venue_name: event.venue_name,
        }}
        organizer={w.theOrganizer.charAt(0).toUpperCase() + w.theOrganizer.slice(1)}
        slug={event.slug}
      />
    );
  }

  // 🚪 "ONLY MY GUEST LIST" HAS NO ASK-TO-JOIN ANYWHERE (owner ruling,
  // 2026-09-27). Not on the Event Hub, and not here either — the couple's poster
  // QR included: it goes to the EVENT, whose one door is Sign in or Upload your
  // QR (Builder A's `/{slug}/invite` follows the same rule). A valid poster
  // token therefore opens NOTHING extra on such an event; only "Anyone, I
  // approve" puts the request form on this page.
  if (!anyoneMayAskToJoin(event.rsvp_ask_config)) {
    if (event.slug) redirect(`/${event.slug}`);
    // No public page yet: not a broken link, so it is not told it is one.
    return (
      <DoorShell
        tone="dead_end"
        eyebrow="Guest list"
        title={event.display_name ?? 'This celebration'}
        sub={INVITATION_ONLY_LINE}
      />
    );
  }

  // Explain a self-join throttle instead of leaving the guest to guess why the
  // form keeps bouncing. READ-ONLY on purpose: this render must never spend the
  // guest's own budget, or reloading the page could lock them out of it.
  //
  // Two ways to land here: the throttle already denied this connection and
  // redirected back with `?error=join_throttled`, or the connection's budget is
  // visibly spent on this instance. Either way the form stays on screen — the
  // consuming check on the write path is the authority, this is only the copy.
  //
  // ⚠ Nothing consumes that budget yet: the mint lives in actions.ts, which PR
  // #4157 owns, so `allowGuestSelfJoinAttempt` is dark until it is adopted there
  // (a three-line change documented on the helper). Until then this branch is
  // wired and tested but will not fire in production.
  const throttled =
    search.error === JOIN_DOOR_ERROR_KEY ||
    guestSelfJoinDoorIsThrottled(eventId, await headers());

  // JoinFlow renders an unrecognized key verbatim, so hand it the sentence —
  // that is what lets this ship without touching the shared flow component.
  const errorKey = throttled ? JOIN_DOOR_THROTTLED_MESSAGE : (search.error ?? null);

  return (
    <JoinFlow
      event={event}
      token={token}
      errorKey={errorKey}
      returnPath={token ? `/join/${eventId}?token=${token}` : `/join/${eventId}`}
    />
  );
}
