import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  guestSelfJoinDoorIsThrottled,
  JOIN_DOOR_ERROR_KEY,
  JOIN_DOOR_THROTTLED_MESSAGE,
} from '@/lib/join-door-throttle';
import { isUuid } from '@/lib/is-uuid';
import { JoinFlow } from './_components/join-flow';
import { InvalidTokenScreen } from './_components/join-shell';

export const metadata = { title: 'Join event' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
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

  // Validate the token (admin client bypasses RLS).
  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from('event_join_tokens')
    .select('event_id, revoked_at, expires_at')
    .eq('event_id', eventId)
    .eq('token', token)
    .maybeSingle();

  const tokenValid =
    !!tokenRow &&
    !tokenRow.revoked_at &&
    (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date());

  if (!token || !tokenValid) {
    return <InvalidTokenScreen />;
  }

  const { data: event } = await admin
    .from('events')
    .select(
      // `event_date_precision` travels WITH `event_date` everywhere it is shown.
      // The column alone cannot say whether it is a decided day or a placeholder,
      // and this screen prints it to a stranger. See `doorMeta` in join-shell.tsx.
      'event_id, public_id, display_name, event_date, event_date_precision, venue_name, slug',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) {
    return <InvalidTokenScreen />;
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
      returnPath={`/join/${eventId}?token=${token}`}
    />
  );
}
