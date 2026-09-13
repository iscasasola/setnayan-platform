import { notFound } from 'next/navigation';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { createAdminClient } from '@/lib/supabase/admin';
import { JoinFlow } from '@/app/join/[eventId]/_components/join-flow';
import { InvalidTokenScreen } from '@/app/join/[eventId]/_components/join-shell';
import { INVITE_LOOK_COLUMNS, loadInviteLook } from './_lib/load-invite-look';
import { RevealOverlayServer } from '../_components/reveal/reveal-overlay-server';
import {
  coerceRevealTemplate,
  revealMarkSvg,
  revealMonogram,
  revealSealConfig,
  revealVeilColor,
  revealWaxColor,
} from '../_lib/reveal-props';
import { fallbackSeedFromPublicId } from '@/lib/wax-seal/types';
import { resolveRevealEffects } from '@/lib/std-reveal-effects';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { inviteRevealPlays } from '@/lib/invite-reveal';
import { resolveProfile } from '@/lib/event-type-profile';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';

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
    .select(
      `event_id, public_id, display_name, event_date, event_date_precision, venue_name, slug, landing_page_visibility, scheduled_launch_at, std_launched_at, ${INVITE_LOOK_COLUMNS}, role_palette, monogram_uploaded_svg, monogram_custom_svg, wax_seal_config, std_reveal_template, std_reveal_effects, event_end_date, venue_latitude, venue_longitude`,
    )
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

  // 🔒 A PRIVATE EVENT IS PRIVATE HERE TOO (added 2026-08-06).
  //
  // This door had NO visibility check at all. `/[slug]` correctly showed a
  // stranger the lock screen — "This wedding's page is private" — while
  // `/[slug]/invite` let that same stranger type any name, join the guest list,
  // and receive a guest session that then OPENS the lock screen. Confirmed on
  // two live private events. The couple could not close it either: re-issuing
  // the join QR mints a new token but does not make the door refuse anyone.
  //
  // Two owner decisions were colliding — "private until we launch" and "anyone
  // can add themselves with just a name". Private wins: an event the couple has
  // not launched should not be joinable by a stranger who guessed the address.
  //
  // notFound(), matching the branch above — a private event must be
  // indistinguishable from an event that does not exist. Anything softer
  // confirms the wedding is real to someone who should not know.
  //
  // ⚠ REVERSIBLE AND DELIBERATE: if self-join should work on private events,
  // delete this block. Nothing else depends on it.
  if (resolveEffectiveVisibility(event) === 'private') {
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

  // The couple's invite theme (lib/invite-themes.ts) — House unless they saved
  // one, and a Pro theme only while the event holds Event Hub Pro.
  const look = await loadInviteLook(event);

  // THE REVEAL OPENS THE INVITE (owner 2026-09-10: "our cinematic reveal is also
  // integrated as one whole concept design"). Only for a Pro theme — House is the
  // free door, with "nothing to edit" and no opening. The props are the SAME
  // composition the Event Hub uses (../_lib/reveal-props), and the couple's own
  // chosen opening wins over the theme's default — including "No Reveal".
  // WHEN it may play is the Event Hub's own rule too (lib/invite-reveal.ts): the
  // save-the-date and invitation stages only, never the day itself, never a wake.
  // The overlay still resolves its own Event Hub Pro ownership
  // (RevealOverlayServer), so a lapsed unlock shows no reveal.
  const revealPlays =
    look.theme !== 'house' &&
    inviteRevealPlays({
      profile: await resolveProfile(event.event_type as string),
      eventDate: event.event_date as string | null,
      eventEndDate: (event.event_end_date as string | null) ?? null,
      venueTz: eventTimezoneFromCoords(
        event.venue_latitude as number | null,
        event.venue_longitude as number | null,
      ),
    });
  const reveal =
    look.theme === 'house' ? null : (
      <RevealOverlayServer
        enabled={revealPlays}
        monogram={revealMonogram((event.display_name as string | null) ?? '')}
        markSvg={revealMarkSvg(event)}
        waxColor={revealWaxColor(event.role_palette)}
        sealConfig={revealSealConfig(event)}
        sealFallbackSeed={fallbackSeedFromPublicId(event.public_id as string)}
        veilColor={revealVeilColor(event.role_palette)}
        eventTemplate={coerceRevealTemplate(event.std_reveal_template) ?? INVITE_THEMES[look.theme].opening}
        eventEffects={resolveRevealEffects(event.std_reveal_effects)}
        eventId={event.event_id as string}
        /* ONE REVEAL ON THE WAY IN (owner Q6 = B, 2026-09-11). This door is the
           FIRST half: when this opening actually plays, it records "seen" for
           this event in sessionStorage, and the Event Hub the guest is handed
           into two doors later stands aside rather than dropping the same veil
           again. A House invite passes none of this — it plays no reveal, so
           that guest's first reveal is still the Event Hub's, which is the
           behaviour the owner's answer preserves. */
        oncePerVisit="record"
      />
    );

  return (
    <>
      {reveal}
      <JoinFlow
        event={event}
        token={token}
        errorKey={search.error ?? null}
        returnPath={`/${slug}/invite`}
        skin={look.skin}
      />
    </>
  );
}
