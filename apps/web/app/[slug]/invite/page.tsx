import { notFound } from 'next/navigation';
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
  const { data: event, error: eventError } = await admin
    .from('events')
    .select('event_id, public_id, display_name, event_date, venue_name, slug')
    // `.ilike`, NOT `.eq` — the main invitation page matches the slug
    // case-insensitively, and 8 of the 10 guest sub-routes follow it. This one
    // and the 3D venue did not, so `/Cale-Ice` opened fine while
    // `/Cale-Ice/invite` said the link was invalid. This route is where the
    // menu's "Join" tab sends a visitor with no invitation — the one door
    // offered to a relative who wants to add themselves — so a capital letter
    // in a forwarded link closed it.
    .ilike('slug', slug)
    .maybeSingle();

  if (eventError) {
    // A failed read is not a bad link. Saying "invalid" because a query
    // stumbled sends someone to ask the couple for a new one.
    throw new Error(`invite: could not read the event for "${slug}": ${eventError.message}`);
  }
  if (!event) {
    // NO SUCH EVENT IS NOT A STALE LINK (2026-08-05, found by walking the live
    // site rather than by any test).
    //
    // This returned `<InvalidTokenScreen />` — an HTTP **200** telling someone
    // who mistyped an address that their invitation link had expired and to ask
    // for a fresh one. They would go back to whoever sent it and ask them to
    // re-send a link that was never broken.
    //
    // It is also a soft-404: a 200 on every junk `/anything/invite` URL, which
    // is indexable, and exactly the bug `04c03063d` fixed at the route root.
    //
    // The screen is still right for its real case — the event EXISTS and its
    // join token is missing, revoked or expired, which is checked below.
    notFound();
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
