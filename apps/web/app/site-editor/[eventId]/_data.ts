import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { registerGatesEnabled } from '@/lib/register-gates';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { computeGuestStats, fetchGuestsByEvent } from '@/lib/guests';
import { buildEventLandingUrl, renderEventLandingQrSvg } from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { parseRsvpBackdropConfig } from '@/lib/spatial-backdrop';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { SiteEditorProps } from './_components/site-editor';

/**
 * Shared data loader for every site-editor surface — the combined editor
 * (/site-editor/[eventId]) AND the three standalone phase editors
 * (/site-editor/[eventId]/{rsvp,event,editorial}). One loader so all four agree
 * on names / slug / QR / guest stats / owned-state, and so the couple-membership
 * gate + the register-to-use gate are enforced identically on each.
 *
 * `returnPath` is the calling surface's own URL — threaded into the login /
 * register redirects so the couple lands back where they were after signing in.
 *
 * AUTHORIZATION: these routes live OUTSIDE EventLayout (full-screen takeover —
 * see the page docstrings), so they do NOT inherit EventLayout's membership
 * guard. This loader replicates it: couple-membership on event_members, else
 * notFound(). Without it, any signed-in user could open another couple's editor
 * by URL. RLS still scopes every row to the caller, so reading before the
 * couple-check leaks nothing.
 *
 * Throws (redirect / notFound) on gate failures exactly as the page did inline;
 * returns the resolved SiteEditorProps on success.
 */
export async function loadSiteEditorData(
  eventId: string,
  returnPath: string,
): Promise<SiteEditorProps> {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(returnPath));
  // Register-to-use gate (flag-gated · owner 2026-06-21): the website is a
  // public-identity surface — an anonymous couple must secure a free account to
  // build / publish it. OFF → no gate.
  if (registerGatesEnabled() && user.is_anonymous) {
    redirect(`/signup?next=${encodeURIComponent(returnPath)}`);
  }

  const supabase = await createClient();

  // Five independent reads fire CONCURRENTLY (membership · event · guests ·
  // pro-upgrade orders · spatial backdrop). The couple-membership gate is
  // applied AFTER the batch resolves; RLS already scopes every row to the
  // caller. Only the QR render — which needs the resolved slug — stays
  // sequential.
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
    // Pro-upgrade ownership — Monogram Hero (₱1,999) + Live Schedule (₱999), the
    // two inline-buy widget upgrades the Event part surfaces. Scoped to those
    // SKUs so the editor agrees with the website hub on owned-state.
    supabase
      .from('orders')
      .select('service_key, status')
      .eq('event_id', eventId)
      .in('service_key', ['monogram_hero_upgrade', 'pro_widget_schedule'])
      .not('status', 'in', '("cancelled","refunded","lapsed")'),
    // Spatial backdrop pick — SEPARATE tolerant select (not a column on the main
    // events read) so a DB where migration 20261105000000 hasn't applied
    // degrades to "backdrop off" instead of erroring the whole fetch.
    supabase
      .from('events')
      .select('rsvp_backdrop')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  const { data: membership, error: membershipError } = membershipRes;
  if (membershipError) {
    logQueryError(
      'loadSiteEditorData (event_members)',
      membershipError,
      { event_id: eventId, user_id: user.id },
      'graceful_degrade',
    );
  }
  if (!membership || membership.member_type !== 'couple') notFound();

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

  // Hero photo — resolve the stored r2:// ref to a presigned 24h GET URL so the
  // editor shows the current photo + the preview reflects it. Null =
  // monogram-only fallback. Mirrors the resolution in app/[slug]/page.tsx.
  const heroPhotoUrl = await displayUrlForStoredAsset(
    event.landing_page_hero_image_url ?? null,
  );

  // Graceful-degrade to empty (cards show their Upgrade CTA) on a pre-bootstrap
  // DB where the orders table is missing — never crash.
  if (ordersRes.error) {
    logQueryError('loadSiteEditorData (orders)', ordersRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const ownedOrders = (ordersRes.data ?? []) as {
    service_key: string | null;
    status: string;
  }[];

  // Pre-migration DBs (or any read error) → null = "backdrop off", mirroring the
  // public page's graceful degrade.
  const rsvpBackdrop = backdropRes.error
    ? null
    : parseRsvpBackdropConfig(
        (backdropRes.data as { rsvp_backdrop?: unknown } | null)?.rsvp_backdrop,
      );

  return {
    eventId,
    slug: event.slug ?? null,
    publicLandingUrl,
    slugDisplay,
    masterQrSvg,
    stats: {
      attending: stats.attending,
      pending: stats.pending,
      declined: stats.declined,
    },
    ownedOrders,
    heroPhotoUrl,
    rsvpBackdrop,
  };
}
