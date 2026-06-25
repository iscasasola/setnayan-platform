import { createAdminClient } from '@/lib/supabase/admin';
import { JoinFlow } from '@/app/join/[eventId]/_components/join-flow';
import { InvalidTokenScreen } from '@/app/join/[eventId]/_components/join-shell';

export const metadata = { title: 'Join event' };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Branded invite entry: `/{slug}/invite` (e.g. `/cale-ice/invite`) — the link
 * couples actually share. Resolves the slug → event → its current join token
 * (kept server-side, never in the URL), validates it, and renders the SAME
 * <JoinFlow> as `/join/[eventId]`. A rotated / revoked / expired token still
 * shows the invalid screen, so the couple keeps that control.
 */
export default async function SlugInvitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;

  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    .select('event_id, public_id, display_name, event_date, venue_name, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!event) {
    return <InvalidTokenScreen />;
  }

  // Resolve the event's current join token server-side (it never appears in the
  // branded URL). Honors revoked_at / expires_at so rotation still closes the link.
  const { data: tokenRow } = await admin
    .from('event_join_tokens')
    .select('token, revoked_at, expires_at')
    .eq('event_id', event.event_id)
    .maybeSingle();

  const token = tokenRow?.token as string | undefined;
  const tokenValid =
    !!token &&
    !tokenRow?.revoked_at &&
    (!tokenRow?.expires_at || new Date(tokenRow.expires_at) > new Date());

  if (!token || !tokenValid) {
    return <InvalidTokenScreen />;
  }

  return (
    <JoinFlow
      event={event}
      token={token}
      errorKey={search.error ?? null}
      returnPath={`/${slug}/invite`}
    />
  );
}
