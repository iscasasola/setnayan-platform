import { createAdminClient } from '@/lib/supabase/admin';
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

  return (
    <JoinFlow
      event={event}
      token={token}
      errorKey={search.error ?? null}
      returnPath={`/join/${eventId}?token=${token}`}
    />
  );
}
