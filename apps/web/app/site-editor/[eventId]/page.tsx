import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
import { buildEventLandingUrl, renderEventLandingQrSvg } from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SiteEditor } from './_components/site-editor';

export const metadata = { title: 'Website editor' };

/**
 * /site-editor/[eventId] — full-screen, Reels-style wedding-website editor.
 *
 * WHY a TOP-LEVEL route (sibling of /dashboard, /vendors, /v) instead of a
 * child of /dashboard/[eventId]: the owner's spec (CLAUDE.md 2026-05-31
 * "Reels-style editor") requires a full-screen takeover that leaves all
 * dashboard chrome behind, with a ✕ top-left to return. Next.js nested
 * layouts COMPOSE — a route under dashboard/[eventId]/layout.tsx cannot
 * strip that layout's sidebar + bottom-nav. So the editor must live outside
 * EventLayout's subtree. The root app/layout.tsx still wraps this route, so
 * ThemeProvider + the FOUC theme script are intact — which is what lets the
 * editor's Theme card flip the whole app live.
 *
 * AUTHORIZATION: because this route is outside EventLayout, it does NOT
 * inherit EventLayout's membership guard — so it replicates it here verbatim
 * (couple-membership on event_members → notFound). Without this, any signed-in
 * user could open another couple's editor by URL.
 *
 * PILOT-SAFE: this is a NEW route. The existing /dashboard/[eventId]/website
 * journey page stays live and untouched, so pilot couples keep a working
 * surface. The Website tab is flipped to open this editor only once it's
 * complete (a later PR) — nothing breaks today.
 *
 * DATA: reuses the exact fetch shape from the website hub page (event, slug,
 * monogram, master QR svg, public landing URL, guest stats) so the editor and
 * the journey page stay in lockstep on what they show.
 */
export default async function SiteEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/site-editor/${eventId}`));

  const supabase = await createClient();

  // Couple-membership guard (replicated from EventLayout — see WHY above).
  const { data: membership, error: membershipError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membershipError) {
    logQueryError(
      'SiteEditorPage (event_members)',
      membershipError,
      { event_id: eventId, user_id: user.id },
      'graceful_degrade',
    );
  }
  if (!membership || membership.member_type !== 'couple') {
    notFound();
  }

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, event_date, slug, monogram_text, monogram_color')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // Cheap sync derivations the QR render needs — compute before the batch.
  const monogram = resolveMonogram(event);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const publicLandingUrl = event.slug
    ? buildEventLandingUrl({ appUrl, slug: event.slug })
    : null;
  const slugDisplay = publicLandingUrl
    ? publicLandingUrl.replace(/^https?:\/\//, '')
    : null;

  // Guest list, the master landing-page QR render, and the Pro-upgrade order
  // check are mutually independent (all key off the event) — one parallel batch
  // instead of three serial round-trips (owner perf pass 2026-06-03). Orders
  // graceful-degrades to empty (cards show their Upgrade CTA) on a pre-bootstrap
  // DB where the table is missing — never crash. The two upgrade SKUs match the
  // website hub's fetch so the editor and journey page agree on owned-state.
  const [guests, masterQrSvg, ordersRes] = await Promise.all([
    fetchGuestsByEvent(supabase, eventId),
    event.slug
      ? renderEventLandingQrSvg({ appUrl, slug: event.slug, monogram })
      : Promise.resolve(null),
    supabase
      .from('orders')
      .select('service_key, status')
      .eq('event_id', eventId)
      .in('service_key', ['monogram_hero_upgrade', 'pro_widget_schedule'])
      .not('status', 'in', '("cancelled","refunded","lapsed")'),
  ]);
  const stats = computeGuestStats(guests);
  if (ordersRes.error) {
    logQueryError(
      'SiteEditorPage (orders)',
      ordersRes.error,
      { event_id: eventId },
      'graceful_degrade',
    );
  }
  const ownedOrders = (ordersRes.data ?? []) as {
    service_key: string | null;
    status: string;
  }[];

  return (
    <SiteEditor
      eventId={eventId}
      slug={event.slug ?? null}
      publicLandingUrl={publicLandingUrl}
      slugDisplay={slugDisplay}
      masterQrSvg={masterQrSvg}
      stats={{ attending: stats.attending, pending: stats.pending, declined: stats.declined }}
      ownedOrders={ownedOrders}
    />
  );
}
