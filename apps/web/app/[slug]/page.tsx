import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Camera, CircleSlash, Lock, MapPin, Sparkles } from 'lucide-react';
import { Logo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { readGuestSession } from '@/lib/guest-session';
import { formatEventDate } from '@/lib/events';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { buildInvitationUrl, renderInvitationQrSvg } from '@/lib/qr';
import { resolveMonogram, type MonogramConfig } from '@/lib/monogram';
import { eventOwnsAnimatedMonogram } from '@/lib/animated-monogram';
import { eventOwnsPapicGuest } from '@/lib/papic-guest';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import { SubmitButton } from '@/app/_components/submit-button';
import { submitRsvp, withdrawFaceConsent } from './actions';
import { SelfieCapture } from './_components/selfie-capture';
import { CountdownWidget } from './_components/countdown';
import { ScheduleWidget } from './_components/schedule-widget';
import { fetchPublicScheduleBlocks, type ScheduleBlockRow } from '@/lib/schedule';
import { GuestGuidedTour } from '@/app/_components/guest-guided-tour';
import { NavLinksRow } from '@/app/_components/nav-links';
import { getDayOfPhase, type DayOfPhase } from '@/lib/day-of-mode';
import { GuestPreload } from './_components/guest-preload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { BackgroundMusic } from './_components/background-music';
import { EditorialContent } from './_components/editorial/editorial-content';
import {
  type InvitationWidgetRow,
  type WidgetType,
  type LifecyclePhase,
  isWidgetType,
  visibleHideableWidgets,
  widgetByType,
  widgetShouldRender,
  widgetInPhase,
  isWebsitePhasesEnabled,
  getLifecyclePhase,
} from '@/lib/invitation-widgets';

function displayNameOf(g: {
  first_name: string;
  last_name: string;
  display_name: string | null;
}): string {
  return g.display_name?.trim() || `${g.first_name} ${g.last_name}`.trim();
}

// Task #13 (Phase 1 day-of PWA fix, 2026-05-22) — swap `dynamic = 'force-dynamic'`
// for ISR so this surface can be CDN-cached AND served from SHELL_CACHE when a
// guest reloads at a venue with weak WiFi. 60s revalidate window is acceptable
// for V1 pilot — guest invitation content changes infrequently; RSVP submit is
// a server action that still revalidates fresh.
//
// V1.1 follow-up: per-guest table-assignment preload via guest-session-scoped
// Cache API write — see Task #9 audit findings (CLAUDE.md decision-log row
// 2026-05-22).
export const revalidate = 60;

const RESERVED_TOP_LEVEL = new Set([
  'admin',
  'api',
  'auth',
  'dashboard',
  'health',
  'help',
  'join',
  'legal',
  'login',
  'logout',
  'manifest.json',
  'privacy',
  'register',
  'settings',
  'signup',
  'support',
  'sw.js',
  'terms',
  'about',
  'contact',
  'vendor',
  'v',
  '_next',
]);

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string; invite_error?: string }>;
};

export default async function PublicInvitationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const invite = (search.invite ?? '').trim();
  const inviteError = search.invite_error ?? null;

  if (!slug || RESERVED_TOP_LEVEL.has(slug)) notFound();

  // If an invite token is in the URL, hand off to the redeem route handler
  // which can write the session cookie (Server Components in Next 15 can't).
  if (invite) {
    redirect(
      `/${slug}/redeem?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(invite)}`,
    );
  }

  const admin = createAdminClient();

  const { data: event } = await admin
    .from('events')
    .select(
      'event_id, public_id, display_name, event_date, venue_name, venue_address, venue_latitude, venue_longitude, event_type, slug, monogram_text, monogram_color, photo_moments_config, landing_page_visibility, dress_code_config, landing_page_hero_image_url, special_message, what_to_bring, our_photos, landing_page_hero_video_r2_key, site_bg_music_enabled, site_bg_music_r2_key',
    )
    .ilike('slug', slug)
    .maybeSingle();

  if (!event) notFound();
  if (event.event_type !== 'wedding') notFound();

  const monogram = resolveMonogram(event);

  // Paid ANIMATED_MONOGRAM upgrade (₱2,499 · "Your initials, drawn live").
  // When the event owns it, the monogram hero circle DRAWS ITSELF IN with an
  // SVG stroke-trace reveal on load instead of rendering static. Resolved once
  // here via the admin client (this page renders for anonymous visitors with
  // no RLS session) + threaded into the hero render branches below. Degrades
  // to `false` (static monogram) on any orders-table shape error — see
  // lib/animated-monogram.ts. Binds the V2 catalog SKU that v2-catalog.ts
  // marked 'partial'; the separate 0004 monogram_hero_upgrade widget path is
  // untouched.
  const animatedMonogram = await eventOwnsAnimatedMonogram(admin, event.event_id);

  // Resolve the hero photo's display URL up-front so it's available to both
  // PublicLanding (anonymous browsers) and InvitationSite (guest-cookie
  // visitors). Resolves to a presigned 24h GET URL when the host has uploaded
  // a photo via /dashboard/[eventId]/website/hero-photo (migration
  // 20260605020000); otherwise returns null and both renderers fall back to
  // the monogram-only hero.
  const heroPhotoUrl = await displayUrlForStoredAsset(
    event.landing_page_hero_image_url,
  );

  // Hero video + background music chrome (Increment B · §6.2). The video, when
  // present, plays full-bleed behind the monogram instead of the still photo
  // (the photo becomes its poster). Music resolves only when the couple has
  // both enabled it AND set a track. Both resolve to presigned 24h URLs here
  // and thread into the render paths like heroPhotoUrl.
  const heroVideoUrl = await displayUrlForStoredAsset(
    event.landing_page_hero_video_r2_key,
  );
  const bgMusicUrl =
    event.site_bg_music_enabled && event.site_bg_music_r2_key
      ? await displayUrlForStoredAsset(event.site_bg_music_r2_key)
      : null;

  // Resolve the couple-curated "Our photos" gallery (Increment A.4) to display
  // URLs up-front so both render paths share the result. events.our_photos is a
  // JSONB array of asset refs; empty/absent → empty array → OurPhotosWidget
  // renders nothing. Each ref goes through displayUrlForStoredAsset, which
  // presigns `r2://` refs AND passes plain http(s)/relative URLs through
  // unchanged — so seeded/legacy URLs (e.g. /demo/...) render too, matching how
  // the hero photo already tolerates legacy URLs.
  const ourPhotoRefs = Array.isArray(event.our_photos)
    ? event.our_photos.filter(
        (r): r is string => typeof r === 'string' && r.trim().length > 0,
      )
    : [];
  const ourPhotoUrls = (
    await Promise.all(ourPhotoRefs.map((ref) => displayUrlForStoredAsset(ref)))
  ).filter((u): u is string => Boolean(u));

  // Per-event widget registry from migration 20260607030000_invitation_widgets.sql.
  // Drives which widgets render on this page and in what order. Every event
  // has 12 rows after the backfill; pre-backfill events fall back to "render
  // everything" via widgetShouldRender() returning true for missing rows
  // through the always-on path. See lib/invitation-widgets.ts for the
  // canonical widget catalog + sort/filter helpers.
  //
  // Read via the admin client (same as the events SELECT above) — this page
  // is rendered for anonymous public visitors too, who have no RLS session.
  // The admin client is fine here: invitation_widgets rows carry no PII +
  // the only data the renderer cares about is is_visible + display_order
  // + widget_type. No row-level filter is applied on read — we render this
  // event's widgets only because we already constrained event_id below.
  const { data: widgetsRaw } = await admin
    .from('invitation_widgets')
    .select(
      'widget_id, event_id, widget_type, display_order, is_visible, is_always_on, tier, config_json, created_at, updated_at',
    )
    .eq('event_id', event.event_id);

  const widgets: InvitationWidgetRow[] = ((widgetsRaw ?? []) as Array<
    Omit<InvitationWidgetRow, 'widget_type'> & { widget_type: string }
  >)
    .filter((row): row is InvitationWidgetRow => isWidgetType(row.widget_type))
    .map((row) => row as InvitationWidgetRow);

  // Read the guest-session cookie up-front so the private-gate below can
  // accept a session-cookie-bearing guest without re-fetching guests
  // unnecessarily. The same `session` reference is consumed by the
  // existing guest-vs-public branch a few lines down — no extra DB call.
  const session = await readGuestSession();

  // Private-mode gate (CLAUDE.md 2026-05-22 owner directive).
  //
  // 'public' + 'unlisted' render identically on this page — the difference
  // is search-engine indexing + future "browse weddings" surfaces (V1.1).
  // 'private' restricts the page to:
  //   (a) signed-in hosts in event_members / event_moderators, OR
  //   (b) signed-in guests with a valid guest-session cookie for this event.
  //
  // The `?invite=<token>` route fires above this block (redirects to the
  // redeem handler that writes the cookie), so a guest landing with their
  // personal link is automatically allowed even on a private event — they
  // come back through here without `?invite=` and the cookie matches.
  const visibility = (event.landing_page_visibility ?? 'public') as
    | 'public'
    | 'unlisted'
    | 'private';

  if (visibility === 'private') {
    // Path A — guest cookie session for this exact event. Legitimate
    // invited guest already redeemed their personal link.
    const guestSessionMatches = session?.event_id === event.event_id;

    // Path B — signed-in host. event_members (V1 couple membership) OR
    // event_moderators (iteration 0048 multi-host invite path).
    let isAuthedHost = false;
    if (!guestSessionMatches) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const [{ data: memberRow }, { data: moderatorRow }] = await Promise.all([
          admin
            .from('event_members')
            .select('member_type')
            .eq('event_id', event.event_id)
            .eq('user_id', user.id)
            .maybeSingle(),
          admin
            .from('event_moderators')
            .select('moderator_id')
            .eq('event_id', event.event_id)
            .eq('user_id', user.id)
            .not('accepted_at', 'is', null)
            .is('removed_at', null)
            .maybeSingle(),
        ]);
        isAuthedHost = Boolean(memberRow) || Boolean(moderatorRow);
      }
    }

    if (!guestSessionMatches && !isAuthedHost) {
      return (
        <PrivateLanding
          event={event}
          monogram={monogram}
          animatedMonogram={animatedMonogram}
        />
      );
    }
    // Otherwise fall through — public / unlisted rendering path below
    // handles the rest of the page exactly as it would for a public event.
  }

  // Task #13 — compute day-of phase server-side so each branch ships as plain
  // server-rendered HTML the CDN can cache and the SW can offline-fallback.
  // Falls through to `inactive` for events without dates (very early planning).
  const dayOfPhase: DayOfPhase = event.event_date
    ? getDayOfPhase(event.event_date)
    : 'inactive';

  // Website lifecycle-phase engine (Increment C · flag-dark). `phasesEnabled`
  // is OFF by default (WEBSITE_PHASES_ENABLED !== 'true'); when off, every
  // new phase-gated behavior below is bypassed and the page renders exactly
  // as it does today. `lifecyclePhase` is computed unconditionally (cheap,
  // pure) but only consumed when `phasesEnabled` is true. Both thread into
  // PublicLanding + InvitationSite like heroPhotoUrl.
  const phasesEnabled = isWebsitePhasesEnabled();
  const lifecyclePhase: LifecyclePhase = getLifecyclePhase(event.event_date);

  // (Note: guest-session cookie was already read above for the private-gate
  // check — reuse the same `session` reference rather than re-fetching.)

  // Schedule blocks fetched here (hoisted from the InvitationSite-only
  // branch as of 2026-05-23) so PublicLanding can also render the
  // Schedule widget. fetchPublicScheduleBlocks already takes the admin
  // client + event_id and returns only the rows the host has marked
  // public — safe to show to anonymous visitors.
  const scheduleBlocks = await fetchPublicScheduleBlocks(admin, event.event_id);

  if (!session) {
    return (
      <PublicLanding
        event={event}
        reason={inviteError === 'invalid_token' ? 'invalid_invite' : null}
        dayOfPhase={dayOfPhase}
        phasesEnabled={phasesEnabled}
        lifecyclePhase={lifecyclePhase}
        heroPhotoUrl={heroPhotoUrl}
        heroVideoUrl={heroVideoUrl}
        bgMusicUrl={bgMusicUrl}
        ourPhotoUrls={ourPhotoUrls}
        widgets={widgets}
        scheduleBlocks={scheduleBlocks}
      />
    );
  }

  // Cookie session is for a different event → bail to public landing.
  // (Sign-out from the footer is how a guest swaps between events.)
  if (session.event_id !== event.event_id) {
    return (
      <PublicLanding
        event={event}
        reason="wrong_event"
        dayOfPhase={dayOfPhase}
        phasesEnabled={phasesEnabled}
        lifecyclePhase={lifecyclePhase}
        heroPhotoUrl={heroPhotoUrl}
        heroVideoUrl={heroVideoUrl}
        bgMusicUrl={bgMusicUrl}
        ourPhotoUrls={ourPhotoUrls}
        widgets={widgets}
        scheduleBlocks={scheduleBlocks}
      />
    );
  }

  const { data: guest } = await admin
    .from('guests')
    .select(
      'guest_id, first_name, last_name, display_name, role, side, group_category, plus_one_of_guest_id, plus_one_mode, plus_one_name_confirmed_at, rsvp_status, meal_preference, dietary_restrictions, notes, custom_tags, qr_token, photo_url, photo_source',
    )
    .eq('guest_id', session.guest_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!guest) {
    return (
      <PublicLanding
        event={event}
        reason="invalid_invite"
        dayOfPhase={dayOfPhase}
        phasesEnabled={phasesEnabled}
        lifecyclePhase={lifecyclePhase}
        heroPhotoUrl={heroPhotoUrl}
        heroVideoUrl={heroVideoUrl}
        bgMusicUrl={bgMusicUrl}
        ourPhotoUrls={ourPhotoUrls}
        widgets={widgets}
        scheduleBlocks={scheduleBlocks}
      />
    );
  }

  // TBA +1 still hasn't confirmed their name — re-route them to onboarding.
  const isUnconfirmedTba =
    guest.plus_one_of_guest_id !== null &&
    !guest.plus_one_name_confirmed_at &&
    (!guest.first_name || guest.first_name.toLowerCase() === 'tba');
  if (isUnconfirmedTba) {
    redirect(`/${slug}/welcome`);
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const qrSvg = await renderInvitationQrSvg({
    appUrl,
    slug,
    qrToken: guest.qr_token,
    monogram,
  });
  const invitationUrl = buildInvitationUrl({ appUrl, slug, qrToken: guest.qr_token });
  // scheduleBlocks already fetched above (hoisted 2026-05-23 so the
  // anonymous PublicLanding path could also render the Schedule
  // widget). Pass the same array through unchanged.

  // Papic guest camera (PAPIC_GUEST) — when the couple owns the pack, give the
  // cookie-bearing guest a floating "be a candid camera" CTA into /papic/guest.
  // Gated, admin read, graceful-degrade so the anonymous public path is untouched.
  const papicGuestActive = await eventOwnsPapicGuest(admin, event.event_id);

  return (
    <>
      <InvitationSite
        event={event}
        guest={guest}
        qrSvg={qrSvg}
        invitationUrl={invitationUrl}
        monogram={monogram}
        animatedMonogram={animatedMonogram}
        scheduleBlocks={scheduleBlocks}
        dayOfPhase={dayOfPhase}
        phasesEnabled={phasesEnabled}
        lifecyclePhase={lifecyclePhase}
        heroPhotoUrl={heroPhotoUrl}
        heroVideoUrl={heroVideoUrl}
        bgMusicUrl={bgMusicUrl}
        ourPhotoUrls={ourPhotoUrls}
        widgets={widgets}
      />
      {papicGuestActive && (
        <Link
          href="/papic/guest"
          className="fixed bottom-5 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-mulberry px-5 py-3 text-sm font-semibold text-cream shadow-lg transition hover:bg-mulberry-600"
        >
          <Camera aria-hidden className="h-4 w-4" strokeWidth={2} />
          Be a candid camera
        </Link>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type EventRow = {
  event_id: string;
  public_id: string;
  display_name: string;
  event_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  slug: string;
  // JSONB column populated by the host via /dashboard/[eventId]/website/photo-moments.
  // Shape: { intro_copy: string, moments: [{ time_label, title, note, mode }] }.
  // Unknown / empty shapes degrade gracefully in PhotoMomentsWidget — the
  // widget renders polite fallback copy when no moments are curated.
  photo_moments_config: unknown;
  // Host-curated dress code (CLAUDE.md 2026-05-22 PR #382). Stored as JSONB so a
  // brand-new event gets `{}` and the renderer's empty-state branch fires.
  // Editor at /dashboard/[eventId]/website/dress-code stamps this shape.
  dress_code_config?: {
    title?: string;
    description?: string;
    dos?: string[];
    donts?: string[];
    palette?: { name: string; hex: string }[];
  } | null;
  // Landing page visibility lever from PR #381 — ‹public, unlisted, private›.
  // Private renders <PrivateLanding> for non-guest visitors.
  landing_page_visibility?: 'public' | 'unlisted' | 'private' | null;
  // r2://-tagged ref to the hero photo uploaded via
  // /dashboard/[eventId]/website/hero-photo (migration 20260605020000).
  // Null = render the monogram-only hero (legacy/default behavior).
  // Display URL resolved via displayUrlForStoredAsset() before render.
  landing_page_hero_image_url?: string | null;
  // Host-curated note to guests (Increment A.1). TEXT column shipped
  // 20260912000000; edited at /dashboard/[eventId]/website/special-message.
  // Blank → SpecialMessageWidget renders nothing (section hides).
  special_message?: string | null;
  // Host-curated gift / registry note (Increment A.3). TEXT column shipped
  // 20260918000000; edited at /dashboard/[eventId]/website/what-to-bring.
  // Blank → WhatToBringWidget renders nothing (section hides).
  what_to_bring?: string | null;
  // Couple-curated photo gallery (Increment A.4). JSONB array of r2:// refs
  // shipped 20260919000000; edited at /dashboard/[eventId]/website/our-photos.
  // Refs resolved to presigned display URLs (ourPhotoUrls) before render;
  // empty → OurPhotosWidget renders nothing (section hides). Distinct from the
  // guest-tagged your_photos widget.
  our_photos?: string[] | null;
  // Looping hero video + background music chrome (Increment B). r2:// refs
  // shipped in the lifecycle foundation (20260912000000); edited at
  // /dashboard/[eventId]/website/site-chrome. The hero video, when present,
  // replaces the still hero photo; bg music plays only when enabled + a track
  // is set (resolved to presigned URLs before render).
  landing_page_hero_video_r2_key?: string | null;
  site_bg_music_enabled?: boolean | null;
  site_bg_music_r2_key?: string | null;
};

type GuestRow = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  role: GuestRole;
  side: 'bride' | 'groom' | 'both';
  group_category: string;
  plus_one_of_guest_id: string | null;
  plus_one_mode: 'full' | 'limited' | null;
  rsvp_status: 'pending' | 'attending' | 'declined' | 'maybe';
  meal_preference: string | null;
  dietary_restrictions: string | null;
  notes: string | null;
  custom_tags: string[];
  qr_token: string;
  photo_url: string | null;
  photo_source: 'oauth_google' | 'selfie' | 'couple_upload' | null;
};

function InvitationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-ink">
            <Logo height={28} />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
              Setnayan
            </span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
            Invitation
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
      {/* Quiet footer signature — structural addition from v2.1 guest-microsite
          template's "See you on the 12th." closing line. Italic serif treatment
          gives the page an editorial sign-off without competing with the
          functional widgets above. Couple palette tokens (terracotta · ink)
          untouched. */}
      <footer className="border-t border-ink/10 px-4 py-8 text-center">
        <p className="font-serif text-lg italic text-terracotta">See you soon.</p>
        <p className="mt-3 text-xs text-ink/50">
          Powered by Setnayan · setnayan.com
        </p>
      </footer>
    </main>
  );
}

/**
 * Full-bleed hero background — a looping video when the couple uploaded one
 * (Increment B · §6.2 "scrub-video hero"), otherwise the still photo. The
 * video autoplays muted + looped + inline (browser-allowed), with the photo as
 * its poster so there's no black flash before the first frame. Raw <video>/<img>
 * because the URLs are presigned (24h) — next/image's optimizer would cache an
 * expired URL.
 */
function HeroBackgroundMedia({
  videoUrl,
  photoUrl,
}: {
  videoUrl?: string | null;
  photoUrl?: string | null;
}) {
  if (videoUrl) {
    return (
      // Decorative, muted, looping background — no captions needed.
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        autoPlay
        muted
        loop
        playsInline
        poster={photoUrl ?? undefined}
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={videoUrl} />
      </video>
    );
  }
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }
  return null;
}

function PublicLanding({
  event,
  reason,
  dayOfPhase,
  phasesEnabled,
  lifecyclePhase,
  heroPhotoUrl,
  heroVideoUrl,
  bgMusicUrl,
  ourPhotoUrls,
  widgets,
  scheduleBlocks,
}: {
  event: EventRow;
  reason?: 'invalid_invite' | 'wrong_event' | null;
  dayOfPhase: DayOfPhase;
  // Website lifecycle-phase engine (Increment C · flag-dark). When
  // `phasesEnabled` is false (the default), NONE of the phase gating below
  // changes — the page renders exactly as today. `lifecyclePhase` is only
  // consulted when `phasesEnabled` is true. See lib/invitation-widgets.ts.
  phasesEnabled: boolean;
  lifecyclePhase: LifecyclePhase;
  // Presigned GET URL for the host's uploaded hero photo, or null when the
  // monogram-only fallback should render. See displayUrlForStoredAsset() in
  // lib/uploads.ts — caller resolves once at the top-level page.
  heroPhotoUrl?: string | null;
  // Hero video + background music chrome (Increment B). Presigned URLs (or
  // null). Video replaces the still hero; music mounts the tap-to-play player.
  heroVideoUrl?: string | null;
  bgMusicUrl?: string | null;
  // Presigned GET URLs for the couple's "Our photos" gallery (Increment A.4),
  // in display order. Resolved once at the top-level page; empty → the
  // OurPhotosWidget hides itself. Couple-curated, no PII → safe for anonymous.
  ourPhotoUrls: string[];
  // Widget visibility registry — owner directive 2026-05-23 flipped this
  // path from "render hero only + discard widgets" to "render hero + all
  // public-safe hideable widgets in display order". Guest-personalized
  // widgets (qr_card · rsvp · greeting · event_details · your_photos)
  // still get skipped here because they need a guest session to be
  // meaningful — the page renderer in InvitationSite handles those.
  widgets: readonly InvitationWidgetRow[];
  // Hoisted from InvitationSite-only 2026-05-23 so this anonymous path
  // can also render the Schedule widget. `fetchPublicScheduleBlocks`
  // already returns host-marked-public rows only — safe for anonymous
  // visitors to see.
  scheduleBlocks: ScheduleBlockRow[];
}) {
  // Public-safe hideable widgets in the host's display order. The 6
  // types below all carry event-level data (no per-guest fields) so
  // they render correctly for anonymous visitors. Other hideable types
  // (event_details · your_photos) need a guest object + are silently
  // skipped here. The 4 always-on widgets (hero · greeting · qr_card ·
  // rsvp) are NOT in visibleHideableWidgets() output.
  const publicSafeWidgets = visibleHideableWidgets(widgets).filter(
    (w) =>
      (
        [
          'countdown',
          'schedule',
          'venue_map',
          'dress_code',
          'photo_moments',
          'tier_comparison',
          'special_message',
          'what_to_bring',
          'our_photos',
        ] as WidgetType[]
      ).includes(w.widget_type) &&
      // Increment C (flag-dark): also require the widget to belong to the
      // current lifecycle phase. No-op when the flag is off — the && short-
      // circuits to the original allow-list-only behavior.
      (!phasesEnabled || widgetInPhase(w.widget_type, lifecyclePhase)),
  );

  // Increment C (flag-dark): after the wedding, the anonymous public path
  // shows a small editorial stand-in instead of the normal widget body. The
  // hero (monogram/photo, all-phase) stays above it. A parallel task builds
  // the real editorial module. Entirely bypassed when the flag is off.
  const showEditorialPlaceholder =
    phasesEnabled && lifecyclePhase === 'editorial';
  // Task #13 — day-of-mode badge surfaces to public-landing viewers too so a
  // guest at the venue without a session cookie still sees "happening now".
  const dayOfBadge =
    dayOfPhase === 'live' ? (
      <p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
        Happening now
      </p>
    ) : dayOfPhase === 'post' ? (
      <p className="inline-flex rounded-full bg-ink/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
        Thank you for celebrating
      </p>
    ) : null;

  const hasHeroMedia = Boolean(heroVideoUrl || heroPhotoUrl);
  return (
    <InvitationShell>
      <GuestPreload eventSlug={event.slug} />
      {bgMusicUrl ? <BackgroundMusic src={bgMusicUrl} /> : null}
      {/* When a hero photo/video is uploaded, render a full-bleed banner.
          Otherwise fall back to the centered text-only treatment. */}
      {hasHeroMedia && !showEditorialPlaceholder ? (
        <div className="relative -mx-4 mb-8 overflow-hidden rounded-2xl text-center sm:-mx-0">
          <HeroBackgroundMedia videoUrl={heroVideoUrl} photoUrl={heroPhotoUrl} />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-cream/40 via-cream/60 to-cream/90"
          />
          <div className="relative space-y-3 px-6 py-12 sm:py-16">
            {dayOfBadge}
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              You&rsquo;re invited
            </p>
            {/* Italic serif treatment for the couple's display name —
                structural typography enhancement from v2.1 guest-microsite
                template (CLAUDE.md 2026-05-28 row 11 guest-microsite port,
                couple-palette respected per globals.css guardrail). The
                italic emphasis carries the editorial, intimate feel of the
                template without touching color tokens. */}
            <h1 className="font-display text-5xl font-medium italic tracking-tight text-ink sm:text-6xl">
              {event.display_name}
            </h1>
            <p className="text-base text-ink/70">
              {[formatEventDate(event.event_date), event.venue_name]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      ) : null}
      {showEditorialPlaceholder ? (
        <EditorialContent eventId={event.event_id} />
      ) : (
        <>
      <div className="space-y-6 text-center">
        {!hasHeroMedia ? dayOfBadge : null}
        {!hasHeroMedia ? (
          <>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              You&rsquo;re invited
            </p>
            {/* Italic serif treatment — see comment on the heroPhotoUrl
                branch above. Same structural typography enhancement from
                v2.1 template; couple palette tokens unchanged. */}
            <h1 className="font-display text-5xl font-medium italic tracking-tight sm:text-6xl">
              {event.display_name}
            </h1>
            <p className="text-base text-ink/60">
              {[formatEventDate(event.event_date), event.venue_name]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </>
        ) : null}
        {reason === 'invalid_invite' ? (
          <p className="mx-auto max-w-prose rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
            That invite link doesn&rsquo;t look right. Ask the couple to send you a fresh
            one — every guest has their own personal link.
          </p>
        ) : reason === 'wrong_event' ? (
          <p className="mx-auto max-w-prose rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You&rsquo;re signed in to a different event&rsquo;s invitation. Open your own
            QR or invite link to switch.
          </p>
        ) : (
          <p className="mx-auto max-w-prose text-sm text-ink/70">
            This is a Setnayan invitation page. Scan your personal QR or open the link
            the couple sent you to see your invitation.
          </p>
        )}
      </div>

      {/* Public widgets — owner directive 2026-05-23. Renders the
       *  host-configured hideable widgets that carry event-level data
       *  only (no guest-personalized fields), in the display order set
       *  via the widget editor at /dashboard/[eventId]/website. Each
       *  widget sub-component is reused from InvitationSite — same
       *  visual treatment, just a thinner per-type dispatcher because
       *  the anonymous path doesn't have a guest object to pass. */}
      {publicSafeWidgets.length > 0 ? (
        <section className="mt-12 space-y-8">
          {publicSafeWidgets.map((widget) => (
            <PublicHideableWidget
              key={widget.widget_id}
              widget={widget}
              event={event}
              scheduleBlocks={scheduleBlocks}
              isLive={dayOfPhase === 'live'}
              ourPhotoUrls={ourPhotoUrls}
            />
          ))}
        </section>
      ) : null}
        </>
      )}
    </InvitationShell>
  );
}

/**
 * Per-widget renderer for the anonymous public landing path. Mirrors the
 * `HideableWidgetRender` dispatcher used by InvitationSite but only
 * handles the 6 widget types that don't need a guest object. The 4
 * always-on widgets (hero · greeting · qr_card · rsvp) plus the 2
 * guest-personalized hideable widgets (event_details · your_photos)
 * fall through to `null` because they require a guest session to be
 * meaningful.
 */
function PublicHideableWidget({
  widget,
  event,
  scheduleBlocks,
  isLive,
  ourPhotoUrls,
}: {
  widget: InvitationWidgetRow;
  event: EventRow;
  scheduleBlocks: ScheduleBlockRow[];
  isLive: boolean;
  ourPhotoUrls: string[];
}) {
  switch (widget.widget_type) {
    case 'countdown':
      // Match InvitationSite's per-widget skip — no event date, no
      // countdown. The widget row stays "visible" in the editor; the
      // renderer just skips when the data isn't available.
      return event.event_date ? <CountdownWidget targetIso={event.event_date} /> : null;

    case 'schedule':
      // Match InvitationSite — no double-render during day-of mode (the
      // pinned schedule block already lives at the top of the article
      // on the authed path; the anonymous path doesn't have that pin,
      // but we still skip the standalone widget when isLive to match
      // the editor's "always-on pin replaces hideable" contract).
      return !isLive && scheduleBlocks.length > 0 ? (
        <ScheduleWidget blocks={scheduleBlocks} />
      ) : null;

    case 'venue_map':
      return <VenueWidget event={event} />;

    case 'dress_code':
      return <DressCodeWidget config={event.dress_code_config ?? null} />;

    case 'photo_moments':
      return <PhotoMomentsWidget config={event.photo_moments_config} />;

    case 'special_message':
      return <SpecialMessageWidget text={event.special_message ?? null} />;

    case 'what_to_bring':
      return <WhatToBringWidget text={event.what_to_bring ?? null} />;

    case 'our_photos':
      // Couple-curated gallery (Increment A.4) — event-level, no PII, so it
      // renders on the anonymous path too. Resolved display URLs threaded in.
      return <OurPhotosWidget urls={ourPhotoUrls} />;

    case 'tier_comparison':
      // limited=false on the anonymous path — anonymous visitors are
      // never a "limited +1" by definition.
      return <TierComparisonWidget limited={false} />;

    // Always-on + guest-personalized types are intentionally skipped
    // on the anonymous path. event_details needs guest.role + side;
    // your_photos needs the guest's tagged photos. Any future widget
    // type added to the catalog needs an explicit case here OR a
    // dedicated InvitationSite-only render.
    case 'hero':
    case 'greeting':
    case 'qr_card':
    case 'rsvp':
    case 'event_details':
    case 'your_photos':
      return null;
  }
}

/**
 * Locked screen for landing-page-visibility='private' (CLAUDE.md 2026-05-22).
 *
 * Rendered when an unauthenticated visitor (or a signed-in visitor with no
 * host membership / no guest cookie for this event) opens the URL of a
 * private wedding. Polite — not severe. Monogram + couple name + date stay
 * visible so the visitor can confirm they have the right wedding and reach
 * out to the hosts if they should have access.
 */
function PrivateLanding({
  event,
  monogram,
  animatedMonogram,
}: {
  event: EventRow;
  monogram: MonogramConfig;
  // True when the event owns the paid ANIMATED_MONOGRAM upgrade — the monogram
  // circle draws itself in instead of rendering static. See [slug]/page.tsx
  // resolution + lib/animated-monogram.ts.
  animatedMonogram: boolean;
}) {
  return (
    <InvitationShell>
      <div className="space-y-8 text-center">
        {animatedMonogram ? (
          <div className="flex justify-center">
            <AnimatedMonogramHero
              text={monogram.text}
              color={monogram.color}
              size="md"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 bg-cream font-serif text-2xl italic"
            style={{ borderColor: monogram.color, color: monogram.color }}
          >
            {monogram.text}
          </div>
        )}
        <div className="space-y-3">
          <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
            {event.display_name}
          </h1>
          {event.event_date ? (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              {formatEventDate(event.event_date)}
            </p>
          ) : null}
        </div>

        <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-ink/10 bg-cream/60 p-6 sm:p-8">
          <Lock
            aria-hidden
            className="mx-auto h-7 w-7 text-terracotta"
            strokeWidth={1.5}
          />
          <h2 className="font-serif text-2xl italic tracking-tight">
            This wedding&rsquo;s page is private
          </h2>
          <p className="text-sm text-ink/70">
            Only the couple&rsquo;s guests and moderators can view it. If you should
            have access, please ask your hosts to add you to the guest list.
          </p>
        </div>

        <p className="text-xs text-ink/45">
          Already invited? Open the personal link the couple sent you, or scan your
          invitation QR.
        </p>
      </div>
    </InvitationShell>
  );
}

function InvitationSite({
  event,
  guest,
  qrSvg,
  invitationUrl,
  monogram,
  animatedMonogram,
  scheduleBlocks,
  dayOfPhase,
  phasesEnabled,
  lifecyclePhase,
  heroPhotoUrl,
  heroVideoUrl,
  bgMusicUrl,
  ourPhotoUrls,
  widgets,
}: {
  event: EventRow;
  guest: GuestRow;
  qrSvg: string;
  invitationUrl: string;
  monogram: MonogramConfig;
  // True when the event owns the paid ANIMATED_MONOGRAM upgrade — the hero
  // monogram circle draws itself in instead of rendering static. See
  // [slug]/page.tsx resolution + lib/animated-monogram.ts.
  animatedMonogram: boolean;
  scheduleBlocks: ScheduleBlockRow[];
  dayOfPhase: DayOfPhase;
  // Website lifecycle-phase engine (Increment C · flag-dark). When
  // `phasesEnabled` is false (the default), every phase gate below is a
  // no-op and this guest path renders exactly as today. `lifecyclePhase`
  // is only consulted when `phasesEnabled` is true.
  phasesEnabled: boolean;
  lifecyclePhase: LifecyclePhase;
  // Presigned GET URL for the host's uploaded hero photo, or null when the
  // monogram-only fallback should render. Caller resolves once at the
  // top-level page so PublicLanding + InvitationSite share the result.
  heroPhotoUrl?: string | null;
  // Hero video + background music chrome (Increment B). Presigned URLs (or
  // null). Video replaces the still hero; music mounts the tap-to-play player.
  heroVideoUrl?: string | null;
  bgMusicUrl?: string | null;
  // Presigned GET URLs for the couple's "Our photos" gallery (Increment A.4),
  // in display order. Resolved once at the top-level page; empty → the widget
  // hides itself.
  ourPhotoUrls: string[];
  // Widget visibility registry from migration 20260607030000. Drives
  // which widgets render here + in what order. Always-on widgets (hero,
  // greeting, qr_card, rsvp) render in fixed positions per the editor
  // contract; hideable widgets render in display_order after RSVP.
  widgets: readonly InvitationWidgetRow[];
}) {
  const sideLabel =
    guest.side === 'both'
      ? 'Both sides'
      : guest.side === 'bride'
        ? "Bride's side"
        : "Groom's side";

  const isLimitedPlusOne =
    guest.plus_one_of_guest_id !== null && guest.plus_one_mode === 'limited';

  // Task #13 — when the wedding is live (T-1h .. T+8h), surface the schedule +
  // QR card prominently at the top so a guest at the venue with weak WiFi sees
  // the load-bearing information first; the rest of the page (RSVP, dress code,
  // photo moments) stays available below for offline-cached reads.
  const isLive = dayOfPhase === 'live';
  const isPost = dayOfPhase === 'post';

  // Widget visibility lookup. Always-on widgets render in fixed positions
  // (hero, greeting, qr_card before RSVP) regardless of display_order +
  // regardless of is_visible (the editor blocks hiding them). Hideable
  // widgets render in display_order after RSVP — only the ones with
  // is_visible = TRUE appear.
  //
  // Defensive: when a widget row is missing entirely (pre-backfill event
  // during the deploy window), widgetByType returns null + widgetShouldRender
  // returns FALSE, so the widget is hidden. The backfill in migration
  // 20260607030000_invitation_widgets.sql ensures every event has all 12
  // rows AFTER the migration applies — so this is a brief deploy-window
  // safeguard, not a permanent behavior.
  //
  // Special-case: day-of pinned schedule (Task #13) is a SYSTEM-level
  // surface — it shows the wedding's live schedule at T-1h to T+8h
  // regardless of whether the host has hidden the Schedule widget. This
  // mirrors the spec lock for 0031 day-of guest mode: the venue-WiFi
  // safety belt is non-negotiable.
  // Increment C (flag-dark): the fixed-position always-on widgets are
  // additionally gated by lifecycle phase per the element×phase matrix
  // (hero=all phases · greeting=rsvp-only · qr_card=rsvp+event ·
  // rsvp=rsvp-only). The `!phasesEnabled ||` short-circuit means when the
  // flag is off (the default) these collapse to the original
  // widgetShouldRender-only behavior — the page is unchanged.
  const heroShouldRender =
    widgetShouldRender(widgetByType(widgets, 'hero')) &&
    (!phasesEnabled || widgetInPhase('hero', lifecyclePhase));
  const greetingShouldRender =
    widgetShouldRender(widgetByType(widgets, 'greeting')) &&
    (!phasesEnabled || widgetInPhase('greeting', lifecyclePhase));
  const qrCardShouldRender =
    widgetShouldRender(widgetByType(widgets, 'qr_card')) &&
    (!phasesEnabled || widgetInPhase('qr_card', lifecyclePhase));
  const rsvpShouldRender =
    widgetShouldRender(widgetByType(widgets, 'rsvp')) &&
    (!phasesEnabled || widgetInPhase('rsvp', lifecyclePhase));

  // Hideable widgets in display order — when the phase flag is on, also
  // filter by the current lifecycle phase. No-op when the flag is off.
  const hideableInOrder = visibleHideableWidgets(widgets).filter(
    (w) => !phasesEnabled || widgetInPhase(w.widget_type, lifecyclePhase),
  );

  // Increment C (flag-dark): after the wedding, the guest path shows the
  // editorial stand-in instead of the normal widget body. The hero still
  // renders above it (hero shows in all phases). Bypassed when the flag is off.
  const showEditorialPlaceholder =
    phasesEnabled && lifecyclePhase === 'editorial';

  const hasHeroMedia = Boolean(heroVideoUrl || heroPhotoUrl);
  return (
    <InvitationShell>
      <GuestPreload eventSlug={event.slug} />
      {bgMusicUrl ? <BackgroundMusic src={bgMusicUrl} /> : null}
      <article className="space-y-12">
        {isLive ? (
          <DayOfBanner kind="live" />
        ) : isPost ? (
          <DayOfBanner kind="post" />
        ) : null}

        {/* Hero. When the host uploads a banner photo/video via
            /dashboard/[eventId]/website/hero-photo + /site-chrome, render
            full-bleed with a soft overlay so the monogram + display name + date
            stay legible. Default falls back to the cream-on-cream monogram-only
            treatment. Gated on hero widget visibility — always-on by default
            (editor blocks hiding), but the gate exists so V1.1 can let
            exhibitions / private weddings drop the hero entirely if needed. */}
        {!showEditorialPlaceholder && heroShouldRender && hasHeroMedia ? (
          <section className="relative -mx-4 overflow-hidden rounded-2xl text-center sm:-mx-0">
            {/* Full-bleed video (Increment B) or photo. */}
            <HeroBackgroundMedia videoUrl={heroVideoUrl} photoUrl={heroPhotoUrl} />
            {/* Cream overlay for text contrast — gradient bottom is stronger so
                the date + monogram circle read cleanly on busy photo backgrounds. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-cream/40 via-cream/60 to-cream/85"
            />
            <div className="relative px-6 py-12 sm:py-16">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
                You are invited
              </p>
              {animatedMonogram ? (
                <div className="mt-6 flex justify-center">
                  <AnimatedMonogramHero
                    text={monogram.text}
                    color={monogram.color}
                    size="md"
                    shadow
                  />
                </div>
              ) : (
                <div
                  aria-hidden
                  className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full border-2 bg-cream font-serif text-2xl italic shadow-sm"
                  style={{ borderColor: monogram.color, color: monogram.color }}
                >
                  {monogram.text}
                </div>
              )}
              {/* Italic serif display name — structural typography from v2.1
                  guest-microsite template (CLAUDE.md 2026-05-28 row 11).
                  Couple palette tokens (monogram.color · cream · ink ·
                  terracotta) untouched per globals.css wedding-landing
                  guardrail. */}
              <h1 className="mt-6 font-display text-5xl font-medium italic tracking-tight text-ink sm:text-6xl">
                {event.display_name}
              </h1>
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-ink/65">
                {formatEventDate(event.event_date)}
              </p>
              <hr className="mx-auto mt-6 w-24 border-t border-ink/30" />
            </div>
          </section>
        ) : !showEditorialPlaceholder && heroShouldRender ? (
          <section className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              You are invited
            </p>
            {animatedMonogram ? (
              <div className="mt-6 flex justify-center">
                <AnimatedMonogramHero
                  text={monogram.text}
                  color={monogram.color}
                  size="md"
                />
              </div>
            ) : (
              <div
                aria-hidden
                className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full border-2 bg-cream font-serif text-2xl italic"
                style={{ borderColor: monogram.color, color: monogram.color }}
              >
                {monogram.text}
              </div>
            )}
            {/* Italic serif treatment — see comment on the heroPhotoUrl
                branch above. Same structural enhancement from v2.1
                template; couple palette untouched. */}
            <h1 className="mt-6 font-display text-5xl font-medium italic tracking-tight sm:text-6xl">
              {event.display_name}
            </h1>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
              {formatEventDate(event.event_date)}
            </p>
            <hr className="mx-auto mt-6 w-24 border-t border-ink/20" />
          </section>
        ) : null}

        {/* Increment C (flag-dark): after the wedding, the body below the
            hero is replaced by the editorial stand-in. The hero (above) +
            footer sign-out (below) stay. Bypassed when the flag is off. */}
        {showEditorialPlaceholder ? (
          <EditorialContent eventId={event.event_id} />
        ) : (
          <>
        {/* Greeting — always-on per the editor contract; gated here so V1.1
            can decouple if a host wants the wedding page to skip the
            personalized welcome. */}
        {greetingShouldRender ? (
          <section className="space-y-4 text-center">
            <p className="text-2xl italic text-ink">Hi, {guest.first_name}.</p>
            <p className="mx-auto max-w-prose text-base text-ink/70">
              We&rsquo;d love to celebrate with you on{' '}
              <span className="font-medium text-ink">{formatEventDate(event.event_date)}</span>
              {event.venue_name ? (
                <>
                  {' '}
                  — at <span className="font-medium text-ink">{event.venue_name}</span>
                </>
              ) : null}
              . You&rsquo;re joining us as{' '}
              <span className="font-medium text-ink">{ROLE_LABELS[guest.role]}</span> ·{' '}
              <span className="text-ink/80">{sideLabel}</span>.
            </p>
          </section>
        ) : null}

        {/* Task #13 — day-of-mode promotes the schedule block to the top of
            the article so a guest at the venue sees "happening now" before
            scrolling past hero / greeting / QR. The same ScheduleWidget renders
            in its default position below for non-live phases. */}
        {isLive && scheduleBlocks.length > 0 ? (
          <section
            aria-label="Day-of schedule"
            className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 p-2"
          >
            <ScheduleWidget blocks={scheduleBlocks} />
          </section>
        ) : null}

        {/* QR card — always-on per the editor contract. Gated so V1.1 can
            decouple if the host wants QR off (e.g., a couple who doesn't
            want their wedding photographed). */}
        {qrCardShouldRender ? (
          <section className="rounded-2xl border border-ink/10 bg-cream p-6 text-center shadow-sm sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              Your invitation QR
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">For tagging &amp; pickup</h2>
            <p className="mx-auto mt-2 max-w-prose text-sm text-ink/60">
              Save this to your phone. Wedding-day photographers will scan it to tag the
              photos they take of you — and you&rsquo;ll be able to grab those photos here
              after the event.
            </p>
            <div
              aria-label={`QR code for ${displayNameOf(guest)}`}
              className="mx-auto mt-6 inline-block rounded-xl bg-white p-3 shadow-sm"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="mt-4 break-all font-mono text-[10px] uppercase tracking-[0.1em] text-ink/40">
              {invitationUrl}
            </p>
            {/* Indoor Blueprint entry point — pure navigation (no DB query on
                this always-rendered landing). The /find-my-table route does its
                own SKU gating: it shows a friendly "ask the couple" prompt when
                the event hasn't bought Indoor Blueprint, so this link is safe to
                always render. */}
            <Link
              href={`/${event.slug}/find-my-table`}
              className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-terracotta hover:text-terracotta"
            >
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Find my table
            </Link>
          </section>
        ) : null}

        {/* RSVP — always-on per the editor contract. The wedding's
            load-bearing form: the editor blocks hiding it, but the gate
            below is the runtime enforcement point. */}
        {rsvpShouldRender ? (
          <RsvpWidget guest={guest} eventId={event.event_id} limited={isLimitedPlusOne} />
        ) : null}

        {guest.photo_source === 'selfie' ? (
          <FaceDataNotice eventId={event.event_id} guestId={guest.guest_id} />
        ) : null}

        {/* Hideable widgets render here in display_order. The host
            controls visibility + order via the widget editor at
            /dashboard/[eventId]/website/widgets — invitation_widgets
            table column display_order governs the order; is_visible
            governs which widgets render at all. */}
        {hideableInOrder.map((widget) => (
          <HideableWidgetRender
            key={widget.widget_id}
            widget={widget}
            event={event}
            guest={guest}
            sideLabel={sideLabel}
            scheduleBlocks={scheduleBlocks}
            isLive={isLive}
            isLimitedPlusOne={isLimitedPlusOne}
            ourPhotoUrls={ourPhotoUrls}
          />
        ))}

        {isLimitedPlusOne ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            You&rsquo;re joining as a +1. Photos taken of you will appear in your inviter&rsquo;s
            gallery — ask them to share. In-app features like Shutter and Photo Challenges
            require a full Setnayan account, which the couple hasn&rsquo;t enabled for +1s on
            this wedding.
          </section>
        ) : null}
          </>
        )}

        {/* Footer with sign-out */}
        <section className="border-t border-ink/10 pt-6 text-center text-xs text-ink/50">
          <form action={`/${event.slug}/sign-out`} method="post">
            <button type="submit" className="underline-offset-4 hover:underline">
              Sign out of this invitation
            </button>
          </form>
        </section>
      </article>
      <GuestGuidedTour tourKey="guest_welcome_v1" />
    </InvitationShell>
  );
}

/**
 * Dispatch on widget_type to render the right widget. Owns the per-widget
 * conditional skips (Countdown hides itself when event has no date;
 * Schedule hides when no public blocks AND not live, etc.) so the
 * call-site stays a clean .map() over the editor's display_order.
 *
 * Widgets that are show/hide-only (no field-level config) get their
 * content from existing events.* columns or from the guest record. The
 * widget editor's job is the layer ABOVE this — which widgets render
 * + in what order — NOT the per-widget content (which lives in
 * sibling editors at /website/dress-code, /website/photo-moments, etc.).
 */
function HideableWidgetRender({
  widget,
  event,
  guest,
  sideLabel,
  scheduleBlocks,
  isLive,
  isLimitedPlusOne,
  ourPhotoUrls,
}: {
  widget: InvitationWidgetRow;
  event: EventRow;
  guest: GuestRow;
  sideLabel: string;
  scheduleBlocks: ScheduleBlockRow[];
  isLive: boolean;
  isLimitedPlusOne: boolean;
  ourPhotoUrls: string[];
}) {
  // The is_always_on widgets render in fixed positions in the parent
  // function. This dispatcher only renders hideable widgets; receiving
  // an always-on widget here is a defensive no-op (would only happen
  // via a DB-side row that bypassed the editor's is_always_on flag).
  if (widget.is_always_on) return null;

  switch (widget.widget_type) {
    case 'event_details':
      return (
        <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Event details
          </p>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detail label="Date" value={formatEventDate(event.event_date) || '—'} />
            <Detail label="Venue" value={event.venue_name ?? '—'} />
            {event.venue_address ? (
              <Detail label="Address" value={event.venue_address} className="sm:col-span-2" />
            ) : null}
            <Detail label="Your role" value={ROLE_LABELS[guest.role]} />
            <Detail label="Side" value={sideLabel} />
          </dl>
        </section>
      );

    case 'countdown':
      // Per-widget skip: no event date → no countdown. The widget row
      // is still "visible" in the editor; the renderer just skips when
      // the data isn't available yet.
      return event.event_date ? <CountdownWidget targetIso={event.event_date} /> : null;

    case 'schedule':
      // Per-widget skip: when live, the schedule is already pinned at
      // the top of the article (Task #13 day-of-mode safety belt).
      // Don't render the same blocks twice. When NOT live, render the
      // standard widget only when there are public blocks to show.
      return !isLive && scheduleBlocks.length > 0 ? (
        <ScheduleWidget blocks={scheduleBlocks} />
      ) : null;

    case 'venue_map':
      return <VenueWidget event={event} />;

    case 'dress_code':
      return <DressCodeWidget config={event.dress_code_config ?? null} />;

    case 'photo_moments':
      return <PhotoMomentsWidget config={event.photo_moments_config} />;

    case 'your_photos':
      return <YourPhotosWidget limited={isLimitedPlusOne} />;

    case 'special_message':
      return <SpecialMessageWidget text={event.special_message ?? null} />;

    case 'what_to_bring':
      return <WhatToBringWidget text={event.what_to_bring ?? null} />;

    case 'our_photos':
      return <OurPhotosWidget urls={ourPhotoUrls} />;

    case 'tier_comparison':
      return <TierComparisonWidget limited={isLimitedPlusOne} />;

    // Always-on widgets (hero, greeting, qr_card, rsvp) are not reachable
    // here — they render in fixed positions in the parent function. The
    // `widget.is_always_on` guard above also short-circuits these. Any
    // future widget_type added to the catalog needs a branch here OR a
    // dedicated fixed-position render in the parent.
    case 'hero':
    case 'greeting':
    case 'qr_card':
    case 'rsvp':
      return null;
  }
}

/**
 * Special Message — the couple's note to guests (Increment A.1). Reads
 * events.special_message; renders nothing when blank so the section hides.
 */
function SpecialMessageWidget({ text }: { text: string | null }) {
  const msg = (text ?? '').trim();
  if (!msg) return null;
  return (
    <section className="rounded-xl border border-ink/10 bg-cream p-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        A note from us
      </p>
      <p className="mx-auto mt-3 max-w-prose whitespace-pre-line font-serif text-xl italic leading-relaxed text-ink">
        {msg}
      </p>
    </section>
  );
}

/**
 * What to Bring — the couple's gift / registry / no-gift note (Increment
 * A.3). Reads events.what_to_bring; renders nothing when blank so the
 * section hides.
 */
function WhatToBringWidget({ text }: { text: string | null }) {
  const msg = (text ?? '').trim();
  if (!msg) return null;
  return (
    <section className="rounded-xl border border-ink/10 bg-cream p-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        What to bring
      </p>
      <p className="mx-auto mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink/80">
        {msg}
      </p>
    </section>
  );
}

/**
 * Our Photos — the couple's own curated gallery (Increment A.4). Reads the
 * presigned display URLs resolved from events.our_photos (JSONB array of
 * r2:// refs) up at the page level. Renders a responsive grid; returns nothing
 * when the gallery is empty so the section hides. Distinct from YourPhotosWidget
 * (the guest's tagged photos). Raw <img> because the URLs are presigned (24h)
 * — next/image's optimizer would cache an expired URL.
 */
function OurPhotosWidget({ urls }: { urls: string[] }) {
  const photos = (urls ?? []).filter((u) => typeof u === 'string' && u.length > 0);
  if (photos.length === 0) return null;
  return (
    <section className="rounded-xl border border-ink/10 bg-cream p-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        Our photos
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((url, i) => (
          <div
            key={`${i}-${url.slice(0, 24)}`}
            className="relative aspect-square overflow-hidden rounded-lg bg-ink/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </dt>
      <dd className="mt-0.5 text-base text-ink">{value}</dd>
    </div>
  );
}

function RsvpWidget({
  guest,
  eventId,
  limited,
}: {
  guest: GuestRow;
  eventId: string;
  limited: boolean;
}) {
  const action = submitRsvp.bind(null, eventId, guest.guest_id);

  return (
    <form
      action={action}
      className="rsvp-form space-y-5 rounded-2xl border border-terracotta/30 bg-gradient-to-b from-terracotta/5 to-cream p-6 sm:p-8"
    >
      {/* The selfie step reveals once the guest picks "I'll be there" — pure
          CSS :has(), the same pattern as the has-[:checked] ring on the radios
          below, so this stays a server component with no client state. */}
      <style>{`.rsvp-form .selfie-reveal{display:none}.rsvp-form:has(input[name="rsvp_status"][value="attending"]:checked) .selfie-reveal{display:block}`}</style>
      <header className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          RSVP
        </p>
        <RsvpPill status={guest.rsvp_status} />
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(
          [
            { key: 'attending', label: "I'll be there", tone: 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' },
            { key: 'maybe', label: 'Maybe', tone: 'bg-cream text-ink border-ink/20 hover:border-ink/40' },
            { key: 'declined', label: "Can't make it", tone: 'bg-cream text-ink border-ink/20 hover:border-ink/40' },
          ] as const
        ).map((option) => (
          <label
            key={option.key}
            className={`flex h-16 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors has-[:checked]:ring-2 has-[:checked]:ring-offset-2 has-[:checked]:ring-offset-cream ${
              guest.rsvp_status === option.key
                ? 'border-terracotta bg-terracotta text-cream ring-2 ring-terracotta'
                : option.tone
            }`}
          >
            <input
              type="radio"
              name="rsvp_status"
              value={option.key}
              defaultChecked={guest.rsvp_status === option.key}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className="selfie-reveal">
        <SelfieCapture />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          id="meal_preference"
          label="Meal preference"
          defaultValue={guest.meal_preference ?? 'no_preference'}
          options={[
            ['no_preference', 'No preference'],
            ['beef', 'Beef'],
            ['chicken', 'Chicken'],
            ['fish', 'Fish'],
            ['vegetarian', 'Vegetarian'],
            ['vegan', 'Vegan'],
            ['kids', 'Kids'],
          ]}
        />
        <Field
          id="dietary_restrictions"
          label="Dietary notes"
          defaultValue={guest.dietary_restrictions ?? ''}
          placeholder="halal · nut allergy · …"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="block text-sm font-medium text-ink">
          A note to the couple (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={guest.notes ?? ''}
          className="input-field min-h-[88px] resize-y py-2"
          placeholder="Anything you'd like Maria &amp; Juan to know."
        />
      </div>

      {limited ? null : (
        <p className="text-xs text-ink/50">
          You&rsquo;ll be able to add a song request, dance style, and Photo Challenge
          opt-in when you sign up for a free Setnayan account.
        </p>
      )}

      <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Saving RSVP…">
        Save RSVP
      </SubmitButton>
    </form>
  );
}

// Guest-facing face-data withdrawal (RA 10173). Shown under the RSVP once the
// guest has a stored selfie; a separate form so it never nests in the RSVP form.
function FaceDataNotice({
  eventId,
  guestId,
}: {
  eventId: string;
  guestId: string;
}) {
  const action = withdrawFaceConsent.bind(null, eventId, guestId);
  return (
    <form
      action={action}
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-cream px-4 py-3 text-xs text-ink/60"
    >
      <span className="min-w-0">
        Your photo is set up for face recognition at this wedding, so the
        couple&rsquo;s photographers can find your candid shots.
      </span>
      <SubmitButton
        className="shrink-0 font-medium text-terracotta underline-offset-2 hover:underline"
        pendingLabel="Removing…"
      >
        Remove my photo &amp; face data
      </SubmitButton>
    </form>
  );
}

function RsvpPill({ status }: { status: GuestRow['rsvp_status'] }) {
  const tone: Record<GuestRow['rsvp_status'], string> = {
    attending: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    declined: 'bg-rose-100 text-rose-800',
    maybe: 'bg-ink/10 text-ink/70',
  };
  const label =
    status === 'attending'
      ? 'Going'
      : status === 'pending'
        ? 'Pending'
        : status === 'declined'
          ? 'Declined'
          : 'Maybe';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone[status]}`}>
      {label}
    </span>
  );
}

function Field({
  id,
  label,
  defaultValue,
  placeholder,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={id}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

function Select({
  id,
  label,
  options,
  defaultValue,
}: {
  id: string;
  label: string;
  options: [string, string][];
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="input-field appearance-none bg-cream pr-8"
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Additional widgets (closing 0002 deferrals)
// ---------------------------------------------------------------------------

function VenueWidget({ event }: { event: EventRow }) {
  // 2026-05-21 — coords-based deep links (Google Maps · Waze · Apple Maps)
  // when the event has a geocoded venue. Falls back to a text-search
  // Google Maps link when only venue_address is set. Hidden entirely if
  // both are missing.
  return (
    <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Venue</p>
      <div className="overflow-hidden rounded-lg border border-ink/10">
        <div className="h-32 bg-gradient-to-br from-terracotta/30 via-amber-100 to-emerald-100" />
        <div className="space-y-3 bg-cream p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
            Ceremony &amp; Reception
          </p>
          <h3 className="text-xl font-semibold tracking-tight">
            {event.venue_name ?? 'Venue to be confirmed'}
          </h3>
          {event.venue_address ? (
            <p className="text-sm text-ink/65">{event.venue_address}</p>
          ) : null}
          <NavLinksRow
            latitude={event.venue_latitude ?? null}
            longitude={event.venue_longitude ?? null}
            addressFallback={event.venue_address ?? event.venue_name ?? null}
            label="Get directions"
            compact
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Dress code section on the public landing page (CLAUDE.md 2026-05-22).
 *
 * Reads `events.dress_code_config` (migration 20260605030000) — host edits
 * via /dashboard/[eventId]/website/dress-code. When every field is empty
 * (brand-new event, host hasn't set anything yet), renders a polite
 * brand-voice fallback so guests know the section is intentional and to
 * check back closer to the day.
 */
function DressCodeWidget({
  config,
}: {
  config: EventRow['dress_code_config'];
}) {
  // Defensive read — JSONB column defaults to `{}` so every field may be
  // absent. Skip rows in palette that aren't valid #RRGGBB to avoid CSS
  // injection via the inline style attribute.
  const title = typeof config?.title === 'string' ? config.title : '';
  const description = typeof config?.description === 'string' ? config.description : '';
  const dos = Array.isArray(config?.dos)
    ? config.dos.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  const donts = Array.isArray(config?.donts)
    ? config.donts.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  const palette = Array.isArray(config?.palette)
    ? config.palette.filter(
        (p): p is { name: string; hex: string } =>
          !!p &&
          typeof p.name === 'string' &&
          typeof p.hex === 'string' &&
          /^#[0-9a-fA-F]{6}$/.test(p.hex),
      )
    : [];

  const hasAnything =
    title.length > 0 ||
    description.length > 0 ||
    dos.length > 0 ||
    donts.length > 0 ||
    palette.length > 0;

  // Empty state — section stays visible (so guests know to expect it) but
  // reads as an intentional "coming soon" note in the host's brand voice.
  if (!hasAnything) {
    return (
      <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Dress code
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">
            Coming together
          </h3>
        </header>
        <p className="text-sm text-ink/65">
          Your hosts haven&rsquo;t shared the dress code yet — check back closer to
          the wedding.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Dress code</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">
          {title || 'Dress with us'}
        </h3>
      </header>
      {description ? <p className="text-sm text-ink/70">{description}</p> : null}
      {palette.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {palette.map((p, i) => (
            <div
              key={`${p.hex}-${i}`}
              className="flex items-center gap-2 text-xs text-ink/70"
            >
              <span
                aria-hidden
                className="inline-block h-6 w-6 rounded-full ring-1 ring-ink/10"
                style={{ backgroundColor: p.hex }}
              />
              {p.name}
            </div>
          ))}
        </div>
      ) : null}
      {dos.length > 0 || donts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {dos.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em]">Do</p>
              <ul className="space-y-1">
                {dos.map((row, i) => (
                  <li key={i}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {donts.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em]">
                Don&rsquo;t
              </p>
              <ul className="space-y-1">
                {donts.map((row, i) => (
                  <li key={i}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// Mode enum matches the server-side validator at
// /dashboard/[eventId]/website/photo-moments/actions.ts. Three values
// each get a distinct visual treatment on the landing page:
//   • camera_ok   — emerald Camera icon, "cameras welcome"
//   • phone_down  — quiet ink CircleSlash, "stay present"
//   • papic_only  — terracotta Sparkles, "our paparazzo will capture"
type PhotoMomentMode = 'camera_ok' | 'phone_down' | 'papic_only';
type PhotoMoment = {
  time_label: string;
  title: string;
  note: string;
  mode: PhotoMomentMode;
};

function parsePhotoMomentsConfig(
  raw: unknown,
): { intro_copy: string; moments: PhotoMoment[] } {
  if (!raw || typeof raw !== 'object') return { intro_copy: '', moments: [] };
  const obj = raw as Record<string, unknown>;
  const intro = typeof obj.intro_copy === 'string' ? obj.intro_copy : '';
  const momentsRaw = Array.isArray(obj.moments) ? obj.moments : [];
  const moments: PhotoMoment[] = [];
  for (const m of momentsRaw) {
    if (!m || typeof m !== 'object') continue;
    const item = m as Record<string, unknown>;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (title.length === 0) continue;
    const timeLabel = typeof item.time_label === 'string' ? item.time_label : '';
    const note = typeof item.note === 'string' ? item.note : '';
    const modeStr = typeof item.mode === 'string' ? item.mode : 'phone_down';
    const mode: PhotoMomentMode =
      modeStr === 'camera_ok' || modeStr === 'papic_only' ? modeStr : 'phone_down';
    moments.push({ time_label: timeLabel, title, note, mode });
    if (moments.length >= 8) break;
  }
  return { intro_copy: intro, moments };
}

function PhotoMomentsWidget({ config }: { config: unknown }) {
  const { intro_copy, moments } = parsePhotoMomentsConfig(config);

  // No host-curated moments yet — render polite brand-voice fallback
  // instead of the prior hardcoded sample list. Per the no-dev-text rule,
  // this reads as a calm "coming soon" not a developer placeholder.
  if (moments.length === 0) {
    return (
      <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Savour the moments
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">
            Photo moments
          </h3>
        </header>
        <p className="rounded-lg border border-dashed border-ink/20 bg-cream p-5 text-center text-sm italic text-ink/60">
          Your hosts will share their photo guidance closer to the wedding.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
          Savour the moments
        </p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">Photo moments</h3>
      </header>
      {intro_copy.trim().length > 0 ? (
        <p className="text-sm text-ink/70">{intro_copy}</p>
      ) : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {moments.map((m, i) => (
          <li
            key={`${m.title}-${i}`}
            className="space-y-2 rounded-lg border border-ink/10 bg-cream p-4 text-sm"
          >
            <PhotoMomentModeBadge mode={m.mode} />
            {m.time_label.trim().length > 0 ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
                {m.time_label}
              </p>
            ) : null}
            <p className="font-medium text-ink">{m.title}</p>
            {m.note.trim().length > 0 ? (
              <p className="text-xs text-ink/60">{m.note}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PhotoMomentModeBadge({ mode }: { mode: PhotoMomentMode }) {
  if (mode === 'camera_ok') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
        <Camera aria-hidden className="h-3 w-3" strokeWidth={2} />
        Cameras welcome
      </span>
    );
  }
  if (mode === 'papic_only') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
        <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
        Our paparazzo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
      <CircleSlash aria-hidden className="h-3 w-3" strokeWidth={2} />
      Phone-down
    </span>
  );
}

function YourPhotosWidget({ limited }: { limited: boolean }) {
  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Your photos</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">All curated for you</h3>
      </header>

      <div className="rounded-lg border border-dashed border-ink/20 bg-cream p-5 text-center text-sm text-ink/60">
        All your photos will appear here after the event.
      </div>

      <div className="rounded-lg border border-ink/10 bg-cream p-5 text-sm">
        <p className="font-medium text-ink">Make sure a shutterbug snaps you on the wedding day</p>
        <p className="mt-1 text-ink/60">
          Your first tagged photo automatically becomes your profile picture in the gallery.
        </p>
      </div>

      {limited ? (
        <p className="text-xs text-ink/55">
          Your photos will be visible in your inviter&rsquo;s gallery.
        </p>
      ) : (
        <div className="rounded-lg border border-terracotta/30 bg-gradient-to-br from-terracotta/10 to-cream p-5 text-sm">
          <p className="font-medium text-ink">Add more via Shutter</p>
          <p className="mt-1 text-ink/65">
            You can also add your own photos and videos through Shutter, our in-app camera.
            Tag up to 5 guests per post — the couple is tagged for you automatically.
          </p>
          <p className="mt-3 text-xs italic text-ink/45">
            Shutter ships with the Setnayan native app (Phase 2).
          </p>
        </div>
      )}
    </section>
  );
}

// Task #13 — day-of lifecycle banner. `live` = T-1h..T+8h (per
// lib/day-of-mode.ts), `post` = T+8h..T+24h. Renders server-side so the
// surface is offline-cacheable; no client effect needed.
function DayOfBanner({ kind }: { kind: 'live' | 'post' }) {
  if (kind === 'live') {
    return (
      <section
        aria-label="Live event mode"
        className="flex items-center gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 sm:p-5"
      >
        <span
          aria-hidden
          className="inline-flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-600"
        />
        <div className="flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
            Live now
          </p>
          <p className="text-sm text-emerald-900">
            The wedding is happening. Your schedule, QR, and venue info are pinned
            below — they work offline if WiFi cuts out.
          </p>
        </div>
      </section>
    );
  }

  // post
  return (
    <section
      aria-label="Post-event mode"
      className="rounded-xl border border-ink/10 bg-cream p-4 sm:p-5"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        Thank you for celebrating
      </p>
      <p className="mt-1 text-sm text-ink/70">
        The wedding wrapped up. Your tagged photos will land here as the couple
        releases them — check back over the next few days.
      </p>
    </section>
  );
}

function TierComparisonWidget({ limited }: { limited: boolean }) {
  if (limited) {
    return (
      <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Your access
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">Two ways to celebrate</h3>
        </header>
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&rsquo;re a +1 to your inviter. Your photos will appear in their gallery —
          ask them to show you. Want full access? You can register your own Setnayan account
          anytime — but for this wedding, you&rsquo;re invited as their +1.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-dashed border-ink/15 bg-cream p-5 opacity-55">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
              Public
            </p>
            <p className="text-sm text-ink/60">View invitation · RSVP · 3-day photo window</p>
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-terracotta/30 bg-cream p-5 opacity-55">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
              Registered (locked for +1s)
            </p>
            <p className="text-sm text-ink/60">
              Shutter · Selfie Camera · Photo Challenges · Saved Forever · Reel builder
            </p>
          </div>
        </div>
        <a
          href="https://setnayan.com"
          className="button-secondary inline-flex"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn more about Setnayan
        </a>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Your access</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">Two ways to celebrate</h3>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-ink/15 bg-cream p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
            Public · As you are now
          </p>
          <p className="font-medium text-ink">Free · No sign-up needed</p>
          <ul className="space-y-1 text-sm text-ink/70">
            <li>· View this invitation</li>
            <li>· RSVP for the wedding</li>
            <li>· See your tagged photos for <strong>3 days</strong></li>
            <li>· Save your QR to your phone</li>
          </ul>
          <p className="text-xs italic text-ink/50">
            Photos delete from your view after 3 days unless you sign up.
          </p>
        </div>
        <div className="space-y-3 rounded-lg border border-terracotta/40 bg-gradient-to-br from-terracotta/10 to-cream p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
            With Setnayan account
          </p>
          <p className="font-medium text-ink">Free · One-tap sign-up</p>
          <ul className="space-y-1 text-sm text-ink/75">
            <li>· Everything in Public</li>
            <li>· <strong>Shutter</strong> — capture &amp; tag photos as a guest</li>
            <li>· <strong>Selfie Camera</strong> — branded wedding selfie cam</li>
            <li>· <strong>Photo &amp; Video Challenges</strong> — fun mini-quests</li>
            <li>· <strong>Saved Forever</strong> — photos kept permanently</li>
            <li>· Build your own souvenir reel</li>
          </ul>
          <Link href="/signup" className="button-primary inline-flex">
            Sign up free →
          </Link>
        </div>
      </div>
    </section>
  );
}
