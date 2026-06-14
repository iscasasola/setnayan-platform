import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
import { buildEventLandingUrl, renderEventLandingQrSvg } from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { parseRsvpBackdropConfig } from '@/lib/spatial-backdrop';
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

  // The four independent reads (membership · event · guests · pro-upgrade
  // orders) fire CONCURRENTLY — collapsing four sequential Singapore round
  // trips (~50-200ms each) into one. The couple-membership gate (replicated
  // from EventLayout — see WHY above) is applied AFTER the batch resolves;
  // RLS already scopes every row to the caller, so reading before the
  // couple-check leaks nothing. Only the QR render — which needs the resolved
  // event slug — stays sequential. Net: 6 sequential awaits → 2 phases, so the
  // Website tab (this route, outside the dashboard layout) reaches its editor
  // faster behind PR #892's BoardPageSkeleton loading shell.
  const [membershipRes, eventRes, guests, ordersRes, backdropRes] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('events')
      .select(
        'event_id, display_name, event_date, slug, monogram_text, monogram_color, monogram_style, monogram_font_key, monogram_frame_key, landing_page_hero_image_url',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchGuestsByEvent(supabase, eventId),
    // Pro-upgrade ownership — Monogram Hero (₱1,999) + Live Schedule (₱999),
    // the two inline-buy widget upgrades the Event tab surfaces. Scoped to just
    // those SKUs, matching the website hub's fetch so the editor and the
    // journey page agree on owned-state.
    supabase
      .from('orders')
      .select('service_key, status')
      .eq('event_id', eventId)
      .in('service_key', ['monogram_hero_upgrade', 'pro_widget_schedule'])
      .not('status', 'in', '("cancelled","refunded","lapsed")'),
    // Spatial backdrop pick — SEPARATE tolerant select (not a column on the
    // main events read) so a DB where migration 20261105000000 hasn't applied
    // degrades to "backdrop off" instead of erroring the whole editor fetch.
    supabase
      .from('events')
      .select('rsvp_backdrop')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  const { data: membership, error: membershipError } = membershipRes;
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

  const event = eventRes.data;
  if (!event) notFound();

  const stats = computeGuestStats(guests);

  const monogram = resolveMonogram(event);
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';

  const publicLandingUrl = event.slug
    ? buildEventLandingUrl({ appUrl, slug: event.slug })
    : null;

  const masterQrSvg = event.slug
    ? await renderEventLandingQrSvg({ appUrl, slug: event.slug, monogram })
    : null;

  const slugDisplay = publicLandingUrl
    ? publicLandingUrl.replace(/^https?:\/\//, '')
    : null;

  // Hero photo (Increment: inline Hero editing, PR #1 of the "edit on the page"
  // rebuild). Resolve the stored r2:// ref to a presigned 24h GET URL so the
  // editor can show the current photo + the live preview reflects it. Null =
  // monogram-only fallback. Mirrors the resolution in app/[slug]/page.tsx.
  const heroPhotoUrl = await displayUrlForStoredAsset(
    event.landing_page_hero_image_url ?? null,
  );

  // Graceful-degrade to empty (cards show their Upgrade CTA) on a pre-bootstrap
  // DB where the orders table is missing — never crash.
  if (ordersRes.error) {
    logQueryError('SiteEditorPage (orders)', ordersRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const ownedOrders = (ordersRes.data ?? []) as {
    service_key: string | null;
    status: string;
  }[];

  // Pre-migration DBs (or any read error) → null = "backdrop off" in the
  // editor, mirroring the public page's graceful degrade.
  const rsvpBackdrop = backdropRes.error
    ? null
    : parseRsvpBackdropConfig(
        (backdropRes.data as { rsvp_backdrop?: unknown } | null)?.rsvp_backdrop,
      );

  return (
    <SiteEditor
      eventId={eventId}
      slug={event.slug ?? null}
      publicLandingUrl={publicLandingUrl}
      slugDisplay={slugDisplay}
      masterQrSvg={masterQrSvg}
      stats={{ attending: stats.attending, pending: stats.pending, declined: stats.declined }}
      ownedOrders={ownedOrders}
      heroPhotoUrl={heroPhotoUrl}
      rsvpBackdrop={rsvpBackdrop}
    />
  );
}
