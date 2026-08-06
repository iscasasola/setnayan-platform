import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  guestSelfJoinDoorIsThrottled,
  JOIN_DOOR_ERROR_KEY,
  JOIN_DOOR_THROTTLED_MESSAGE,
} from '@/lib/join-door-throttle';
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
    .select('event_id, public_id, display_name, event_date, venue_name, slug')
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
