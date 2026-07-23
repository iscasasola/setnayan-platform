import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { MapPin, Sparkles, X } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import { isSetnayanHost, isLocalOrPreviewHost } from '@/lib/custom-domain-resolve';
import {
  isUserNestingCutoverEnabled,
  publicEventPath,
  publicEventUrl,
  resolveEventOwnerSlug,
  resolveRenamedEventPath,
} from '@/lib/public-event-url';
// Bare-root dispatch: a slug that isn't a renderable event may be a vendor
// (setnayan.com/{vendor-slug}). Reuse the vendor route's render + metadata.
import { renderVendorBySlug, vendorMetadataBySlug } from '@/app/v/[slug]/page';
import { readGuestSession } from '@/lib/guest-session';
import {
  resolveEffectiveVisibility,
  isScheduledLaunchDue,
  publishSaveTheDate,
} from '@/lib/launch-save-the-date';
import { fanOutSaveTheDateEmails } from '@/lib/save-the-date-emails';
import { formatEventDate } from '@/lib/events';
import { ROLE_LABELS } from '@/lib/guests';
import { resolveMonogram, type MonogramConfig } from '@/lib/monogram';
import { PapicGuestCapture } from '@/app/papic/guest/_components/papic-guest-capture';
import { PabatiPrompt } from './_components/pabati-prompt';
import type { PapicStyle } from '@/lib/papic-photo-styles';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import type { StudioAnim } from '@/app/_components/studio-reveal-player';
import { type MonogramMotionKey } from '@/lib/monogram-motion';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  removeMyTag,
  claimAccountAction,
  saveAttendedVendorAction,
} from './actions';
import { DayOfFaceEnroll } from './_components/day-of-face-enroll';
import { ScheduleWidget } from './_components/schedule-widget';
import { TeaCeremonyCard } from './_components/tea-ceremony-card';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { type ScheduleBlockRow } from '@/lib/schedule';
import { GuestGuidedTour } from '@/app/_components/guest-guided-tour';
import { PublicPageActions } from '@/app/_components/public-page-actions';
import { getDayOfPhase, type DayOfPhase } from '@/lib/day-of-mode';
import { isGuestNowTriggerEnabled } from '@/lib/guest-now-trigger';
import { GuestPreload } from './_components/guest-preload';
import { GuestHubBar } from './_components/guest-hub-bar';
import { PublicEventDayBar } from './_components/public-event-day-bar';
import { StdViewBeacon } from './_components/std-view-beacon';
import { BackgroundMusic } from './_components/background-music';
import { EditorialContent } from './_components/editorial/editorial-content';
import { SaveTheDateView } from './_components/save-the-date';
import { type StdLockup } from './_components/save-the-date-film';
import { RevealOverlayServer } from './_components/reveal/reveal-overlay-server';
import { resolveRevealEffects } from '@/lib/std-reveal-effects';
import { type StdBackground } from '@/lib/std-backgrounds';
import { defaultInvitationLaunchIso } from '@/lib/save-the-date-content';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from '@/lib/reveal-config';
import { OurStory } from './_components/our-story';
import { GuestColumnCard } from './_components/guest-column-card';
import { sanitizeRolePalette } from '@/lib/mood-board';
import {
  sealColorFromPalette,
  veilColorFromPalette,
  stdAccentFromPalette,
  paletteSwatches,
} from '@/lib/site-palette';
import { RED_GOLD_PALETTE } from '@/lib/feel-palettes';
import {
  fallbackSeedFromPublicId,
  sanitizeWaxSealConfig,
  type WaxSealConfig,
} from '@/lib/wax-seal/types';
import { SpatialBackdrop } from '@/app/_components/spatial-backdrop';
import { LiveWallBlock } from './_components/live-wall-block';
import { type GuestLiveGallery } from '@/lib/guest-live-gallery';
import type { VendorCard } from '@/lib/vendor-cards';
import { GuestHubCard, type GuestHubData } from './_components/guest-hub-card';
import { type EntrancePos } from '@/lib/indoor-blueprint';
import { type EventTableRow } from '@/lib/seating';
import { YourSeatBlock } from './_components/your-seat-block';

import {
  type InvitationWidgetRow,
  type LifecyclePhase,
  visibleHideableWidgets,
  widgetByType,
  widgetShouldRender,
  widgetInPhase,
  isWebsitePhasesEnabled,
  getLifecyclePhase,
} from '@/lib/invitation-widgets';
import { PUBLIC_WIDGET_ALLOWLIST } from '@/lib/public-widget-allowlist';
import { eventNounOf } from './_lib/event-noun';
import {
  loadEventShell,
  loadGuestContext,
  loadHostMembership,
  loadLiveLayer,
  loadMedia,
  loadWidgets,
} from './_lib/loaders';
import type {
  EventRow,
  GuestRow,
  LiveWallData,
  WatchLiveData,
} from './_lib/types';
import { DayOfBanner } from './_components/day-of-banner';
import { FaceDataNotice } from './_components/face-data-notice';
import { HeroBackgroundMedia } from './_components/hero-background-media';
import { HideableWidgetRender } from './_components/hideable-widget-render';
import { InvitationShell } from './_components/invitation-shell';
import { PrivateLanding } from './_components/private-landing';
import { PublicHideableWidget } from './_components/public-hideable-widget';
import { RsvpWidget } from './_components/rsvp-widget';
import { WatchLiveBlock } from './_components/watch-live-block';

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

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    invite?: string;
    invite_error?: string;
    phase?: string;
    // PR4 P1 — per-visit preview of the auto-playing STD film while it bakes.
    film?: string;
    // Invite/Join v2 — guest "save a vendor" result flash (ok/needs_account/error).
    save?: string;
  }>;
};

// The event-by-slug read (with its soft-404 rationale) lives in
// `_lib/loaders.ts` as `loadEventShell` (OPEN-BROWSE PR2) — still React.cache'd
// on the slug alone, so generateMetadata and the page body keep sharing one DB
// roundtrip exactly as before.

export async function generateMetadata({ params }: Pick<Props, 'params'>) {
  const { slug } = await params;
  if (!slug || RESERVED_SLUGS.has(slug)) notFound();

  const event = await loadEventShell(slug);
  // Bare-root dispatch (PR5): not a renderable event → use the vendor metadata
  // (vendorMetadataBySlug returns a generic title if it isn't a vendor either).
  if (!event) return vendorMetadataBySlug(slug);
  // Iteration 0053: the public couple website is the 'website' profile surface.
  // Generic (non-wedding) profiles don't enable it → fall through to vendor
  // metadata (config-driven; was a notFound() before PR5).
  if (!surfaceEnabled(await resolveProfile(event.event_type), 'website')) return vendorMetadataBySlug(slug);

  // Private by default (owner 2026-06-20): a wedding page is private until the
  // couple LAUNCHES their Save-the-Date (which flips this to 'public'). NULL /
  // legacy rows coalesce to 'private' so they fail safe, not open. A SCHEDULED
  // launch (owner 2026-06-28) reads as 'public' once its time has passed, so the
  // page is indexable from the scheduled instant — same resolver as the body.
  const visibility = resolveEffectiveVisibility(event);

  // Unlisted = reachable by link but not discoverable; private = lock screen
  // for strangers. Neither should be in a search index, and neither should
  // leak the couple's names into SERP snippets via metadata.
  if (visibility !== 'public') {
    return {
      title: eventNounOf(event) === 'wedding' ? 'Wedding invitation' : 'Event invitation',
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
  ).replace(/\/$/, '');
  // PR6 cutover: canonical + OG URL point at the nested /u/{owner}/{slug} once
  // the flag is ON (self-noops to the bare slug while OFF). Keeps the crawler's
  // canonical in lockstep with the redirect the page body issues for bare hits.
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), event.event_id);
  const canonicalUrl = publicEventUrl(siteUrl, event.slug, ownerSlug);
  const description = `You're invited — ${event.display_name}${
    event.event_date ? `, ${formatEventDate(event.event_date)}` : ''
  }. RSVP on Setnayan.`;
  return {
    title: event.display_name,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title: `${event.display_name} · Setnayan`,
      description,
      siteName: 'Setnayan',
      locale: 'en_PH',
      // Share card: the editorial card (couple's hero photo + scrim) once their
      // story is published, else the couple's monogram card (their mark + names +
      // date, mirroring the page hero) — so a shared link always previews as the
      // couple; only a missing event / render failure falls back to the brand
      // image. See app/api/og/realstory-slug/[slug]/route.ts.
      images: [
        {
          url: `${siteUrl}/api/og/realstory-slug/${event.slug}`,
          width: 1200,
          height: 630,
          alt: `${event.display_name} · Setnayan`,
        },
      ],
    },
    twitter: { card: 'summary_large_image' as const },
  };
}

/** Derive a short couple monogram for the reveal seal, e.g. "A & J". */
function revealMonogram(name: string): string {
  const parts = name
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const a = parts[0] ?? '';
  const b = parts[1] ?? '';
  if (a && b) return `${a.charAt(0)} & ${b.charAt(0)}`.toUpperCase();
  return (name.trim().charAt(0) || '✦').toUpperCase();
}

/** Wax-seal colour for the reveal — the moodboard deep accent (§4). */
function revealWaxColor(palette: unknown): string {
  return sealColorFromPalette(sanitizeRolePalette(palette));
}

/** Veil tulle colour for the reveal — a sheer moodboard tint (§4). */
function revealVeilColor(palette: unknown): string {
  return veilColorFromPalette(sanitizeRolePalette(palette));
}

/** Save-the-Date film accent (button + accent marks): the couple's manual
 *  override (events.std_film_accent_hex) when set, else their Mood-Board accent
 *  (deep, button-legible), else brand mulberry. Mirrors revealWaxColor.
 *
 *  Chinese-wedding default: when there's no manual override AND the Mood Board is
 *  empty (yields no swatch), a Chinese (Tsinoy) event falls back to the auspicious
 *  red/gold deep red instead of brand mulberry — so the PUBLISHED page matches the
 *  builder's suggested default. This is a pure FALLBACK only: a manual override or
 *  any real palette swatch always wins, and nothing is written to the DB. */
function stdAccentColor(event: EventRow): string {
  if (event.std_film_accent_hex) return event.std_film_accent_hex;
  const palette = sanitizeRolePalette(event.role_palette);
  if (isChineseWedding(event) && paletteSwatches(palette).length === 0) {
    return RED_GOLD_PALETTE[0]!; // #7A1F2B — auspicious deep red
  }
  return stdAccentFromPalette(palette);
}

/**
 * The couple's monogram mark for the wax seal — their own upload outranks the
 * AI/Cipher mark (owner rule 2026-06-15); null → lettered seal fallback.
 */
function revealMarkSvg(event: EventRow): string | null {
  const uploaded =
    typeof event.monogram_uploaded_svg === 'string' && event.monogram_uploaded_svg.trim()
      ? event.monogram_uploaded_svg
      : null;
  const custom =
    typeof event.monogram_custom_svg === 'string' && event.monogram_custom_svg.trim()
      ? event.monogram_custom_svg
      : null;
  return uploaded ?? custom;
}

/**
 * The couple's ONBOARDING lockup for the Save-the-Date film — their chosen
 * monogram design (bar/duo/script/infinity/framed/circle). The film shows THIS
 * when they have no uploaded/lab SVG (owner 2026-06-19 logo precedence: upload /
 * monogram-lab bypass the onboarding logo). Reuses resolveMonogram → HeroMonogram
 * so the film's mark matches the hero/chrome exactly.
 */
function stdLockupFor(event: EventRow): StdLockup {
  return {
    design: {
      monogram_style: event.monogram_style,
      monogram_font_key: event.monogram_font_key,
      monogram_frame_key: event.monogram_frame_key,
    },
    monogram: resolveMonogram({
      display_name: event.display_name,
      monogram_text: event.monogram_text ?? null,
      monogram_color: event.monogram_color ?? null,
      monogram_font_key: event.monogram_font_key,
      monogram_style: event.monogram_style,
      monogram_frame_key: event.monogram_frame_key,
    }),
  };
}

/** The couple's minted wax-seal recipe for the reveal (null → default levers). */
function revealSealConfig(event: EventRow): WaxSealConfig | null {
  return sanitizeWaxSealConfig(event.wax_seal_config);
}

/** The couple's chosen opening (events.std_reveal_template) validated to a known
 *  id, 'none' (No Reveal — the free, no-opening choice), or null → the admin
 *  house default. Validated server-side because the client RevealOverlay can't
 *  import reveal-config (it pulls the admin client). */
function coerceRevealTemplate(v: unknown): RevealTemplateId | 'none' | null {
  if (v === 'none') return 'none'; // NO_REVEAL — honoured even with the premium unlock
  return typeof v === 'string' &&
    (REVEAL_TEMPLATE_IDS as readonly string[]).includes(v)
    ? (v as RevealTemplateId)
    : null;
}

export default async function PublicInvitationPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  const invite = (search.invite ?? '').trim();
  const inviteError = search.invite_error ?? null;

  if (!slug || RESERVED_SLUGS.has(slug)) notFound();

  // If an invite token is in the URL, hand off to the redeem route handler
  // which can write the session cookie (Server Components in Next 15 can't).
  if (invite) {
    redirect(
      `/${slug}/redeem?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(invite)}`,
    );
  }

  const admin = createAdminClient();

  const event = await loadEventShell(slug);

  // Bare-root dispatch (PR5): not a renderable event → it might be a renamed
  // event's prior slug, else a vendor at this slug.
  if (!event) {
    // Renamed-event redirect (wires the long-dormant slug_change_log read): a
    // bare slug mapping to no current event may be a PRIOR slug of one — send it
    // to that event's CURRENT canonical /u/ URL. Flag-gated (resolveRenamedEventPath
    // self-noops when OFF), so this — like the rest of the cutover — is fully
    // inert until the flip; the old-QR-after-rename 404 gets fixed as part of it.
    const renamedTo = await resolveRenamedEventPath(admin, slug);
    if (renamedTo) redirect(renamedTo);
    // Not a renamed event → try a vendor at this slug. renderVendorBySlug
    // notFound()s itself if there's no vendor either.
    return renderVendorBySlug({ slug, searchParams });
  }
  // Iteration 0053: the whole public couple website is the 'website' profile
  // surface. Non-wedding (generic) profiles don't enable it → fall through to
  // the vendor check (config-driven; was a notFound() before PR5). The resolved
  // profile is reused for the phase engine below.
  const eventTypeProfile = await resolveProfile(event.event_type);
  if (!surfaceEnabled(eventTypeProfile, 'website')) return renderVendorBySlug({ slug, searchParams });

  // PR6 — three-tier URL cutover (slug-routing program), flag-gated (default
  // OFF). The canonical public URL for an event is now /u/{ownerSlug}/{slug}; a
  // hit on the legacy bare root (printed QRs, old shares) 307-redirects to the
  // nested URL. 307 (not 308) keeps the cutover REVERSIBLE — flipping the flag
  // back never leaves a permanently-cached redirect. Suppressed when:
  //   (a) the request already arrived via the /u/ middleware rewrite (the
  //       x-sn-u-nesting header) — that IS the nested render; redirecting it
  //       would loop /u/a/b → /b → /u/a/b forever;
  //   (b) the Host is a custom BYO domain — there the bare URL is canonical
  //       (sny.theirdomain.com/{slug}); bouncing to /u/ would be wrong.
  if (isUserNestingCutoverEnabled()) {
    const reqHeaders = await headers();
    const viaNesting = reqHeaders.get('x-sn-u-nesting') === '1';
    const host = (reqHeaders.get('host') ?? '').toLowerCase();
    const firstPartyHost =
      !host || isSetnayanHost(host) || isLocalOrPreviewHost(host);
    if (!viaNesting && firstPartyHost) {
      const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id);
      if (ownerSlug && event.slug) {
        // Carry the incoming query through the canonicalization redirect — the
        // bare `/{slug}` URL is where server actions + the redeem route land
        // their one-shot params (?save=, ?invite_error=, ?phase=, ?film=) and
        // where inbound UTM/ref attribution arrives; dropping it would silently
        // kill save-confirmation flashes, invalid-invite messaging, host phase
        // previews, and analytics. (The `?invite=` redeem hand-off already fired
        // above, so it's never in this query.)
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(search)) {
          if (typeof v === 'string') qs.set(k, v);
        }
        const q = qs.toString();
        redirect(`${publicEventPath(event.slug, ownerSlug)}${q ? `?${q}` : ''}`);
      }
    }
  }

  // Hero / photos / monogram / Save-the-Date media resolution — moved verbatim
  // to `loadMedia` (_lib/loaders.ts · OPEN-BROWSE PR2). Runs BEFORE the private
  // gate exactly as the inline block did (PrivateLanding consumes the monogram
  // quartet); destructured so every render branch below reads the same names.
  const {
    monogram,
    animatedMonogram,
    proWatermarkHidden,
    bespokeSvg,
    studioAnim,
    heroPhotoUrl,
    heroVideoUrl,
    bgMusicUrl,
    stdBackground,
    stdBackgroundUrl,
    stdVideoUrl,
    stdVideoPosterUrl,
    stdVenues,
    ourPhotoUrls,
    ownsStdReveal,
  } = await loadMedia(admin, event);

  // Per-event widget registry — moved verbatim to `loadWidgets`
  // (_lib/loaders.ts), which carries the registry's full doc block.
  const widgets = await loadWidgets(admin, event.event_id);

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
  // Private by default (owner 2026-06-20): a wedding page is private until the
  // couple LAUNCHES their Save-the-Date (which flips this to 'public'). NULL /
  // legacy rows coalesce to 'private' so they fail safe, not open.
  //
  // SCHEDULED launch (owner 2026-06-28): if the couple set a future go-live and
  // that moment has passed, the page reads as 'public' right now — visibility is
  // exact at the scheduled instant. Cron-free (no timer flips the row): we
  // persist the flip + push Save-the-Date emails AFTER the response, on this
  // first load past the schedule. Idempotent — once visibility is 'public' the
  // branch never re-fires, and per-guest guests.std_sent_at guards the emails.
  if (isScheduledLaunchDue(event)) {
    after(async () => {
      try {
        const published = await publishSaveTheDate(admin, event.event_id);
        if (published?.slug) revalidatePath(`/${published.slug}`);
        await fanOutSaveTheDateEmails(event.event_id);
      } catch {
        /* best-effort — the page already renders public this request */
      }
    });
  }
  const visibility = resolveEffectiveVisibility(event);

  if (visibility === 'private') {
    // Path A — guest cookie session for this exact event. Legitimate
    // invited guest already redeemed their personal link.
    const guestSessionMatches = session?.event_id === event.event_id;

    // Path B — signed-in host. event_members (V1 couple membership) OR
    // event_moderators (iteration 0048 multi-host invite path). The query pair
    // lives in `loadHostMembership` (_lib/loaders.ts) — React.cache'd, so the
    // `?phase=` preview gate below reuses this result instead of re-querying.
    // The cookie-scoped auth read stays HERE (never inside a cached loader).
    let isAuthedHost = false;
    if (!guestSessionMatches) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        isAuthedHost = await loadHostMembership(admin, event.event_id, user.id);
      }
    }

    if (!guestSessionMatches && !isAuthedHost) {
      return (
        <PrivateLanding
          event={event}
          monogram={monogram}
          animatedMonogram={animatedMonogram}
          bespokeSvg={bespokeSvg}
          proWatermarkHidden={proWatermarkHidden}
        />
      );
    }
    // Otherwise fall through — public / unlisted rendering path below
    // handles the rest of the page exactly as it would for a public event.
  }

  // Website lifecycle-phase engine. The 4-path lifecycle (save_the_date →
  // rsvp → event → editorial) ships ON for weddings — this whole surface is
  // wedding-only (non-weddings notFound() above), so the lifecycle is the
  // wedding website. The WEBSITE_PHASES_ENABLED env flag stays as an override
  // for any future non-wedding event types.
  const phasesEnabled = isWebsitePhasesEnabled() || surfaceEnabled(eventTypeProfile, 'website');

  // Date-driven phase by default. PREVIEW override: `?phase=rsvp|event|
  // editorial` shows any phase regardless of date (the live "event" phase is
  // otherwise only a T-1h..T+8h window, so it can't be previewed otherwise).
  // Honored for TWO viewers only:
  //   (a) demo events (slug `test-*` or `[TEST]` name) — anyone, for demos;
  //   (b) the event's own signed-in HOSTS (owner ask 2026-06-11 "can you
  //       always preview that?") — a couple/moderator can preview their
  //       on-the-day page and editorial ANY time; this also powers the
  //       site-editor's per-phase preview tabs.
  // A crafted link still can't force a phase on a real couple's wedding for
  // guests/anonymous visitors — the host check runs against the VIEWER's own
  // session. Host lookups fire only when a phase param is present, so the
  // normal guest path pays zero extra queries.
  const isDemoEvent =
    event.slug?.toLowerCase().startsWith('test-') === true ||
    (event.display_name ?? '').toUpperCase().includes('[TEST]');
  const phaseParam = typeof search.phase === 'string' ? search.phase.toLowerCase() : '';
  const isValidPhaseParam =
    phaseParam === 'save_the_date' ||
    phaseParam === 'rsvp' ||
    phaseParam === 'event' ||
    phaseParam === 'editorial';
  let phasePreviewAllowed = isDemoEvent;
  if (phasesEnabled && isValidPhaseParam && !phasePreviewAllowed) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Same host-membership pair as the private gate above — served from the
      // React.cache'd `loadHostMembership`, so a host previewing a private
      // event's phases costs ONE pair of queries where it used to cost two.
      phasePreviewAllowed = await loadHostMembership(admin, event.event_id, user.id);
    }
  }
  const phaseOverride: LifecyclePhase | null =
    phasesEnabled && isValidPhaseParam && phasePreviewAllowed
      ? (phaseParam as LifecyclePhase)
      : null;

  // Task #13 — day-of phase (drives the live badge + pinned schedule). Real,
  // unless the demo override forces a phase (event→live so the day-of UI shows).
  const dayOfPhase: DayOfPhase = phaseOverride
    ? phaseOverride === 'event'
      ? 'live'
      : phaseOverride === 'editorial'
        ? 'post'
        : 'pre'
    : event.event_date
      ? getDayOfPhase(event.event_date)
      : 'inactive';

  // `lifecyclePhase` is only consumed when `phasesEnabled`; threads into
  // PublicLanding + InvitationSite like heroPhotoUrl.
  const lifecyclePhase: LifecyclePhase = phaseOverride ?? getLifecyclePhase(event.event_date);

  // PR4 P1 — flag-gate the auto-playing Save-the-Date "film". The bare film is
  // the free base (the static STD view is the fallback); the cinematic openings
  // (RevealOverlay) layer ON TOP and become the ₱999 premium (P5 gate). Env
  // for a global rollout, ?film=1 for a per-visit preview while it bakes.
  // Film is on by default for the STD phase; ?film=0 disables it for a
  // plain-countdown fallback (useful for testing the static path).
  const stdFilm = search.film !== '0';

  // (Note: guest-session cookie was already read above for the private-gate
  // check — reuse the same `session` reference rather than re-fetching.)

  // Day-of layer — public schedule + RSVP-era backdrop + live-window Watch-Live
  // / Live Photo Wall + the anonymous event-day chrome. Moved verbatim to
  // `loadLiveLayer` (_lib/loaders.ts), branching on the same dayOfPhase.
  const {
    scheduleBlocks,
    backdropConfig,
    liveWall,
    watchLive,
    publicCandidCameraActive,
    publicAlbumHref,
  } = await loadLiveLayer(admin, event, dayOfPhase);
  // The loader returns the parsed CONFIG; the JSX wrap stays here (same
  // truthiness guard the inline block applied).
  const backdrop: React.ReactNode = backdropConfig ? (
    <SpatialBackdrop config={backdropConfig} />
  ) : null;

  if (!session) {
    return (
      <PublicLanding
        event={event}
        monogram={monogram}
        animatedMonogram={animatedMonogram}
        studioAnim={studioAnim}
        publicCandidCameraActive={publicCandidCameraActive}
        publicAlbumHref={publicAlbumHref}
        reason={inviteError === 'invalid_token' ? 'invalid_invite' : null}
        dayOfPhase={dayOfPhase}
        phasesEnabled={phasesEnabled}
        lifecyclePhase={lifecyclePhase}
        stdFilm={stdFilm}
        stdBackground={stdBackground}
        stdBackgroundUrl={stdBackgroundUrl}
        stdVideoUrl={stdVideoUrl}
        stdVideoPosterUrl={stdVideoPosterUrl}
        stdVenues={stdVenues}
        heroPhotoUrl={heroPhotoUrl}
        heroVideoUrl={heroVideoUrl}
        bgMusicUrl={bgMusicUrl}
        ownsStdReveal={ownsStdReveal}
        ourPhotoUrls={ourPhotoUrls}
        widgets={widgets}
        scheduleBlocks={scheduleBlocks}
        backdrop={backdrop}
        liveWall={liveWall}
        watchLive={watchLive}
        bespokeSvg={bespokeSvg}
        proWatermarkHidden={proWatermarkHidden}
      />
    );
  }

  // Cookie session is for a different event → bail to public landing.
  // (Sign-out from the footer is how a guest swaps between events.)
  if (session.event_id !== event.event_id) {
    return (
      <PublicLanding
        event={event}
        monogram={monogram}
        animatedMonogram={animatedMonogram}
        studioAnim={studioAnim}
        publicCandidCameraActive={publicCandidCameraActive}
        publicAlbumHref={publicAlbumHref}
        reason="wrong_event"
        dayOfPhase={dayOfPhase}
        phasesEnabled={phasesEnabled}
        lifecyclePhase={lifecyclePhase}
        stdFilm={stdFilm}
        stdBackground={stdBackground}
        stdBackgroundUrl={stdBackgroundUrl}
        stdVideoUrl={stdVideoUrl}
        stdVideoPosterUrl={stdVideoPosterUrl}
        stdVenues={stdVenues}
        heroPhotoUrl={heroPhotoUrl}
        heroVideoUrl={heroVideoUrl}
        bgMusicUrl={bgMusicUrl}
        ownsStdReveal={ownsStdReveal}
        ourPhotoUrls={ourPhotoUrls}
        widgets={widgets}
        scheduleBlocks={scheduleBlocks}
        backdrop={backdrop}
        liveWall={liveWall}
        watchLive={watchLive}
        bespokeSvg={bespokeSvg}
        proWatermarkHidden={proWatermarkHidden}
      />
    );
  }

  // Guest-scoped context — moved verbatim to `loadGuestContext`
  // (_lib/loaders.ts), THE ONLY loader that selects guest columns. Reached only
  // past the `!session` / wrong-event branches above, so the session argument
  // is always verified for THIS event (the loader never reads cookies itself).
  // Control flow — the invalid-invite landing and the /welcome redirect — stays
  // here, keyed off the loader's discriminated result.
  const guestContext = await loadGuestContext(
    admin,
    event,
    session,
    dayOfPhase,
    slug,
    scheduleBlocks,
    monogram,
  );

  if (guestContext.kind === 'not_found') {
    return (
      <PublicLanding
        event={event}
        monogram={monogram}
        animatedMonogram={animatedMonogram}
        studioAnim={studioAnim}
        publicCandidCameraActive={publicCandidCameraActive}
        publicAlbumHref={publicAlbumHref}
        reason="invalid_invite"
        dayOfPhase={dayOfPhase}
        phasesEnabled={phasesEnabled}
        lifecyclePhase={lifecyclePhase}
        stdFilm={stdFilm}
        stdBackground={stdBackground}
        stdBackgroundUrl={stdBackgroundUrl}
        stdVideoUrl={stdVideoUrl}
        stdVideoPosterUrl={stdVideoPosterUrl}
        stdVenues={stdVenues}
        heroPhotoUrl={heroPhotoUrl}
        heroVideoUrl={heroVideoUrl}
        bgMusicUrl={bgMusicUrl}
        ownsStdReveal={ownsStdReveal}
        ourPhotoUrls={ourPhotoUrls}
        widgets={widgets}
        scheduleBlocks={scheduleBlocks}
        backdrop={backdrop}
        liveWall={liveWall}
        watchLive={watchLive}
        bespokeSvg={bespokeSvg}
        proWatermarkHidden={proWatermarkHidden}
      />
    );
  }

  // TBA +1 still hasn't confirmed their name — re-route them to onboarding.
  // (The check runs inside loadGuestContext, before any further guest reads,
  // exactly where it ran inline — only the redirect() throw stays out here,
  // since a thrown redirect must never be cached.)
  if (guestContext.kind === 'unconfirmed_tba') {
    redirect(`/${slug}/welcome`);
  }

  const {
    guest,
    qrSvg,
    invitationUrl,
    papicGuestActive,
    guestRollCameraReady,
    seatPassActive,
    guestLiveGallery,
    needsFaceEnroll,
    papicGuest,
    pabati,
    guestHubData,
    seatMap,
    rsvpFaceMode,
    eventVendorCredits,
  } = guestContext;

  // Invite/Join v2: offer an accountless guest a "claim your account by email"
  // prompt on the lifecycle site (RSVP/Event/Editorial). A signed-in account-
  // holder doesn't need it, so gate on the absence of a Supabase auth session.
  const cookieScopedClient = await createClient();
  const {
    data: { user: viewerAccount },
  } = await cookieScopedClient.auth.getUser();

  // Invite/Join v2 — a no-login guest's photo access closes once the post-event
  // grace ends (dayOfPhase leaves live/post, ~24h after the wedding). Past that,
  // their gallery is closed and we nudge an account (the files persist on R2, so
  // syncing restores them). eventIsPast disambiguates a post-event 'inactive'
  // from the far-pre-event 'inactive'. Account-holders are never closed.
  const eventIsPast = event.event_date
    ? new Date(event.event_date).getTime() < Date.now()
    : false;
  const accountlessPhotosClosed =
    !viewerAccount && eventIsPast && dayOfPhase !== 'live' && dayOfPhase !== 'post';

  // (eventVendorCredits — "vendors who made this day" — now resolves inside
  // loadGuestContext, destructured above.)
  const saveFlash =
    search.save === 'ok'
      ? 'Saved to your account — find it in your Library for your own plans.'
      : search.save === 'needs_account'
        ? 'Make a free account (the box above) to save vendors for your future plans.'
        : search.save === 'error'
          ? 'Couldn’t save that just now — please try again.'
          : null;

  // (rsvpFaceMode — the effective face-tag mode for the RSVP selfie + day-of
  // enroll surfaces — now resolves inside loadGuestContext, destructured above.)

  return (
    <>
      <InvitationSite
        faceMode={rsvpFaceMode}
        event={event}
        guest={guest}
        qrSvg={qrSvg}
        invitationUrl={invitationUrl}
        monogram={monogram}
        animatedMonogram={animatedMonogram}
        studioAnim={studioAnim}
        bespokeSvg={bespokeSvg}
        scheduleBlocks={scheduleBlocks}
        dayOfPhase={dayOfPhase}
        phasesEnabled={phasesEnabled}
        lifecyclePhase={lifecyclePhase}
        stdFilm={stdFilm}
        stdBackground={stdBackground}
        stdBackgroundUrl={stdBackgroundUrl}
        stdVideoUrl={stdVideoUrl}
        stdVideoPosterUrl={stdVideoPosterUrl}
        stdVenues={stdVenues}
        heroPhotoUrl={heroPhotoUrl}
        heroVideoUrl={heroVideoUrl}
        bgMusicUrl={bgMusicUrl}
        ownsStdReveal={ownsStdReveal}
        ourPhotoUrls={ourPhotoUrls}
        widgets={widgets}
        backdrop={backdrop}
        liveWall={liveWall}
        watchLive={watchLive}
        guestLiveGallery={guestLiveGallery}
        seatPassActive={seatPassActive}
        needsFaceEnroll={needsFaceEnroll}
        guestHubData={guestHubData}
        seatMap={seatMap}
        papicGuest={papicGuest}
        pabati={pabati}
        proWatermarkHidden={proWatermarkHidden}
        showClaimAccountCta={!viewerAccount}
        accountlessPhotosClosed={accountlessPhotosClosed}
        eventVendorCredits={eventVendorCredits}
        saveFlash={saveFlash}
      />
      {/* Guest event-page hub bar (owner 2026-06-26) — fixed bottom control bar
          (My QR · Camera · Photos) + top-right account affordance. Replaces the
          two lone floating Papic CTAs that used to sit here; everything it needs
          is already computed above (no new DB reads). The #claim-account anchor
          only exists when the claim section renders (no account + not STD). */}
      <GuestHubBar
        qrToken={guest.qr_token}
        invitationUrl={invitationUrl}
        qrSvg={qrSvg}
        cameraReady={guestRollCameraReady}
        papicGuestActive={papicGuestActive}
        hasAccount={Boolean(viewerAccount)}
        galleryCount={guestLiveGallery?.total ?? 0}
        showClaimAnchor={!viewerAccount && lifecyclePhase !== 'save_the_date'}
        hubHref={
          dayOfPhase === 'live' || dayOfPhase === 'post'
            ? `/${event.slug}/hub`
            : null
        }
        selfRotateEnabled={process.env.GUEST_QR_SELF_ROTATE === 'true'}
        dayOfLive={dayOfPhase === 'live'}
        slug={event.slug ?? slug}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function PublicLanding({
  event,
  monogram,
  animatedMonogram,
  studioAnim,
  reason,
  dayOfPhase,
  phasesEnabled,
  lifecyclePhase,
  stdFilm,
  stdBackground,
  stdBackgroundUrl,
  stdVideoUrl,
  stdVideoPosterUrl,
  stdVenues,
  heroPhotoUrl,
  heroVideoUrl,
  bgMusicUrl,
  ourPhotoUrls,
  ownsStdReveal,
  widgets,
  scheduleBlocks,
  backdrop,
  liveWall,
  watchLive,
  bespokeSvg,
  proWatermarkHidden,
  publicCandidCameraActive,
  publicAlbumHref,
}: {
  event: EventRow;
  // The couple's resolved mark (resolveMonogram) — feeds the anonymous hero's
  // HeroMonogram so the highest-traffic shared-link open shows the SAME mark as
  // the signed-in InvitationSite / PrivateLanding hero (owner 2026-06-22
  // animated-logo rollout — this path showed plain initials with no mark).
  monogram: MonogramConfig;
  // The chosen Motion Library signature when the event owns the paid
  // ANIMATED_MONOGRAM upgrade, or false → static hero circle. Threaded into
  // the hero monogram + the STD film's monogram beats. Required (all 3 call
  // sites pass it) so it can feed HeroMonogram, which needs a non-optional
  // value. Mirrors InvitationSite's / PrivateLanding's prop.
  animatedMonogram: MonogramMotionKey | false;
  /** The bespoke-mark reveal designed in the studio panel — fed to the STD film. */
  studioAnim: StudioAnim;
  reason?: 'invalid_invite' | 'wrong_event' | null;
  dayOfPhase: DayOfPhase;
  // Website lifecycle-phase engine (Increment C · flag-dark). When
  // `phasesEnabled` is false (the default), NONE of the phase gating below
  // changes — the page renders exactly as today. `lifecyclePhase` is only
  // consulted when `phasesEnabled` is true. See lib/invitation-widgets.ts.
  phasesEnabled: boolean;
  lifecyclePhase: LifecyclePhase;
  /** PR4 P1 — render the auto-playing STD film instead of the static section. */
  stdFilm: boolean;
  stdBackground?: StdBackground;
  stdBackgroundUrl?: string | null;
  /** Presigned URL of the couple's NSFW-approved closing video (stdVideoIsLive),
   *  or null → the gallery beat shows. Resolved once at the top-level page. */
  stdVideoUrl?: string | null;
  /** Poster still of that video — fills the full-screen letterbox bars with a
   *  blurred image, since iOS won't play a 2nd <video> for that backdrop. */
  stdVideoPosterUrl?: string | null;
  /** Auto-filled ceremony + reception venue names (finalized bookings ?? manual
   *  ?? event) + reception city, for the STD film's venue beats. */
  stdVenues?: { ceremony: string | null; reception: string | null; receptionCity: string | null };
  // Presigned GET URL for the host's uploaded hero photo, or null when the
  // monogram-only fallback should render. See displayUrlForStoredAsset() in
  // lib/uploads.ts — caller resolves once at the top-level page.
  heroPhotoUrl?: string | null;
  // Hero video + background music chrome (Increment B). Presigned URLs (or
  // null). Video replaces the still hero; music mounts the tap-to-play player.
  heroVideoUrl?: string | null;
  bgMusicUrl?: string | null;
  /** Whether the couple owns the Cinematic Reveal (STD_PREMIUM_OPENINGS) — gates
   *  the Save-the-Date film's own media beats (music, video, photos). */
  ownsStdReveal: boolean;
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
  /** Spatial backdrop node (or null) — rendered by InvitationShell behind the page. */
  backdrop?: React.ReactNode;
  /** Live Photo Wall mirror — non-null only during the live window when the event owns LIVE_WALL. */
  liveWall?: LiveWallData | null;
  /** Panood Watch-Live — non-null only during the live window when a watch URL is staged (single-cam Panood live is free for every host). */
  watchLive?: WatchLiveData | null;
  /** Sanitized bespoke monogram SVG (uploaded ?? Cipher) — feeds the anonymous
   *  hero's HeroMonogram + the STD film's monogram beats. Required (all call
   *  sites pass it) so HeroMonogram, which needs a non-optional value, can
   *  consume it. null → text initials. Mirrors InvitationSite / PrivateLanding. */
  bespokeSvg: string | null;
  /** Paid COUPLE_WEBSITE_PRO perk — drop the "Powered by Setnayan" footer
   *  watermark when the event owns the active upgrade. Resolved once at the
   *  top-level page (eventCoupleWebsiteProActive). */
  proWatermarkHidden: boolean;
  /** Couple's PAPIC_GUEST candid camera is open (live window) — drives the
   *  public event-day bar's center Camera action. */
  publicCandidCameraActive: boolean;
  /** Public album destination (Live Wall / recap), or null — drives the public
   *  event-day bar's Photos action. */
  publicAlbumHref: string | null;
}) {
  // Public-safe hideable widgets in the host's display order. The 6
  // types below all carry event-level data (no per-guest fields) so
  // they render correctly for anonymous visitors. Other hideable types
  // (event_details · your_photos) need a guest object + are silently
  // skipped here. The 4 always-on widgets (hero · greeting · qr_card ·
  // rsvp) are NOT in visibleHideableWidgets() output.
  const publicSafeWidgets = visibleHideableWidgets(widgets).filter(
    (w) =>
      PUBLIC_WIDGET_ALLOWLIST.includes(w.widget_type) &&
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
  // 4-path lifecycle: far before the wedding, the body is the minimal Save the
  // Date (announcement) — countdown + add-to-calendar, no RSVP/widgets. Hero
  // (media) stays above; the text hero is carried by the STD view when there's
  // no hero media (anonymous path has no monogram hero fallback).
  const showSaveTheDate = phasesEnabled && lifecyclePhase === 'save_the_date';
  // Task #13 — day-of-mode badge surfaces to public-landing viewers too so a
  // guest at the venue without a session cookie still sees "happening now".
  const dayOfBadge =
    dayOfPhase === 'live' ? (
      <p className="inline-flex items-center gap-2 rounded-full bg-success-100 px-3 py-1 font-mono text-xs uppercase tracking-[0.15em] text-success-800">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-600" />
        Happening now
      </p>
    ) : dayOfPhase === 'post' ? (
      <p className="inline-flex rounded-full bg-ink/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
        Thank you for celebrating
      </p>
    ) : null;

  const hasHeroMedia = Boolean(heroVideoUrl || heroPhotoUrl);
  return (
    <InvitationShell
      backdrop={backdrop}
      rolePalette={event.role_palette}
      fullBleed={showSaveTheDate && stdFilm}
      hideWatermark={proWatermarkHidden}
    >
      <GuestPreload eventSlug={event.slug} />
      {/* Item #8 — discreet floating share/report chrome. Share shows ONLY when
          the event is effectively public (couple launched their Save-the-Date);
          the abuse-report entry (target_type='event') is present on any listed
          page. Never rendered on a private page (this whole component is behind
          the not-private gate). */}
      {resolveEffectiveVisibility(event) !== 'private' && (
        <PublicPageActions
          canShare={resolveEffectiveVisibility(event) === 'public'}
          reportTargetId={event.event_id}
          shareTitle={event.display_name}
        />
      )}
      {showSaveTheDate && !event.is_sample ? <StdViewBeacon slug={event.slug} /> : null}
      <RevealOverlayServer
        enabled={showSaveTheDate}
        monogram={revealMonogram(event.display_name)}
        markSvg={revealMarkSvg(event)}
        waxColor={revealWaxColor(event.role_palette)}
        sealConfig={revealSealConfig(event)}
        sealFallbackSeed={fallbackSeedFromPublicId(event.public_id)}
        veilColor={revealVeilColor(event.role_palette)}
        eventTemplate={coerceRevealTemplate(event.std_reveal_template)}
        eventEffects={resolveRevealEffects(event.std_reveal_effects)}
        eventId={event.event_id}
      />
      {/* Couple's opt-in background-music player — NOT during the Save-the-Date
          phase: the STD film owns audio there, and this floating speaker control
          would otherwise bleed through / over the veil reveal. (owner 2026-06-19) */}
      {bgMusicUrl && !showSaveTheDate ? <BackgroundMusic src={bgMusicUrl} /> : null}
      {/* When a hero photo/video is uploaded, render a full-bleed banner.
          Otherwise fall back to the centered text-only treatment. */}
      {hasHeroMedia && !showEditorialPlaceholder && !showSaveTheDate ? (
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
            {/* The couple's mark — mirrors InvitationSite's hero so the anonymous
                shared-link open shows the SAME monogram (animated when the paid
                upgrade is owned), not just plain initials. */}
            <div className="flex justify-center">
              <HeroMonogram
                event={event}
                monogram={monogram}
                animatedMonogram={animatedMonogram}
                bespokeSvg={bespokeSvg}
                shadow
              />
            </div>
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
      ) : showSaveTheDate ? (
        <SaveTheDateView
          displayName={event.display_name}
          dateIso={event.event_date}
          venueName={event.venue_name}
          venueAddress={event.venue_address}
          publicId={event.public_id}
          loveStory={event.love_story}
          showTextHero={!hasHeroMedia}
          animatedMonogram={animatedMonogram}
          studioAnim={studioAnim}
          film={stdFilm}
          background={stdBackground}
          backgroundImageUrl={stdBackgroundUrl}
          monogramText={event.monogram_text}
          monogramSvg={bespokeSvg}
          lockup={stdLockupFor(event)}
          musicUrl={ownsStdReveal ? bgMusicUrl : null}
          videoUrl={ownsStdReveal ? stdVideoUrl : null}
          videoPosterUrl={ownsStdReveal ? stdVideoPosterUrl : null}
          ceremonyVenue={stdVenues?.ceremony ?? null}
          receptionVenue={stdVenues?.reception ?? null}
          receptionCity={stdVenues?.receptionCity ?? null}
          galleryUrls={
            ownsStdReveal
              ? ourPhotoUrls.length
                ? ourPhotoUrls
                : heroPhotoUrl
                  ? [heroPhotoUrl]
                  : []
              : []
          }
          launchDateIso={event.std_invitation_launch_date ?? defaultInvitationLaunchIso(event.event_date)}
          themeId={event.std_theme}
          accentHex={stdAccentColor(event)}
        />
      ) : (
        <>
      <div className="space-y-6 text-center">
        {!hasHeroMedia ? dayOfBadge : null}
        {!hasHeroMedia ? (
          <>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              You&rsquo;re invited
            </p>
            {/* The couple's mark — mirrors InvitationSite's cream-on-cream hero so
                the anonymous shared-link open shows the SAME monogram (animated
                when the paid upgrade is owned), not just plain initials. */}
            <div className="flex justify-center">
              <HeroMonogram
                event={event}
                monogram={monogram}
                animatedMonogram={animatedMonogram}
                bespokeSvg={bespokeSvg}
              />
            </div>
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
            That invite link doesn&rsquo;t look right — it may have been replaced with a new
            one. Ask your host for your current QR or link; every guest has their own, and
            an old one stops working the moment it&rsquo;s replaced.
          </p>
        ) : reason === 'wrong_event' ? (
          <p className="mx-auto max-w-prose rounded-md border border-warn-300 bg-warn-50 px-4 py-3 text-sm text-warn-900">
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

      {/* Public event-day bar (owner 2026-06-28) — gives the no-guest /
          host-preview view the same bottom chrome a real guest sees, so the
          three event-day views stop looking like different pages. Fixed-position
          and self-hiding: renders nothing outside the live/post window (both
          inputs fall to false/null). */}
      <PublicEventDayBar
        candidCameraActive={publicCandidCameraActive}
        photosHref={publicAlbumHref}
        hubHref={
          dayOfPhase === 'live' || dayOfPhase === 'post'
            ? `/${event.slug}/hub`
            : null
        }
      />

      {/* Find your seat — the FREE guest finder (seat-finding PR 1). Pure
          navigation on this always-rendered public landing: the /find-seat
          route resolves the published plan itself and shows a friendly
          "not posted yet" state when there's nothing to search, so this link
          is safe to always render (mirrors the find-my-table CTA pattern). A
          guest who scanned the shared venue QR taps this, types their name,
          and sees their table — no app, no login, no paid SKU. */}
      <div className="mt-8 text-center">
        <Link
          href={`/${event.slug}/find-seat`}
          className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/75 shadow-sm hover:border-terracotta hover:text-terracotta"
        >
          <MapPin aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Find your seat
        </Link>
      </div>

      {/* Panood Watch-Live — anonymous path FIRST: the remote relatives
          clicking the shared link from Messenger are exactly the cookie-less
          viewers this exists for. */}
      {dayOfPhase === 'live' && watchLive ? (
        <section className="mt-10">
          <WatchLiveBlock watchLive={watchLive} />
        </section>
      ) : null}

      {/* Live Photo Wall mirror — anonymous visitors at the venue (master-QR
          scans without a guest cookie) get the live wall too during the
          celebration window. Same screened feed as the projector. The id is the
          anchor the event-day bar's "Photos" button scrolls to (publicAlbumHref
          above) — scroll-margin keeps it clear of the fixed bottom bar. */}
      {dayOfPhase === 'live' && liveWall ? (
        <section id="live-photo-wall" className="mt-10 scroll-mt-6">
          <LiveWallBlock
            slug={event.slug}
            initialTiles={liveWall.tiles}
            initialCount={liveWall.count}
            initialCaption={liveWall.caption}
          />
        </section>
      ) : null}

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
              scheduleEstimated={
                isGuestNowTriggerEnabled() &&
                (dayOfPhase === 'pre' || dayOfPhase === 'inactive')
              }
              ourPhotoUrls={ourPhotoUrls}
            />
          ))}
        </section>
      ) : null}

      {/* Our Story — the couple's love story on the run-up paths (rsvp/event).
          The normal body only renders pre-event (STD + editorial are separate
          branches), so this naturally stays off the post-event Editorial. */}
      <OurStory loveStory={event.love_story} variant="full" />
        </>
      )}
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
  studioAnim,
  bespokeSvg,
  scheduleBlocks,
  dayOfPhase,
  phasesEnabled,
  lifecyclePhase,
  stdFilm,
  stdBackground,
  stdBackgroundUrl,
  stdVideoUrl,
  stdVideoPosterUrl,
  stdVenues,
  heroPhotoUrl,
  heroVideoUrl,
  bgMusicUrl,
  ourPhotoUrls,
  ownsStdReveal,
  widgets,
  backdrop,
  liveWall,
  watchLive,
  guestLiveGallery,
  seatPassActive,
  needsFaceEnroll,
  guestHubData,
  seatMap,
  papicGuest,
  pabati,
  proWatermarkHidden,
  showClaimAccountCta,
  accountlessPhotosClosed,
  eventVendorCredits,
  saveFlash,
  faceMode,
}: {
  event: EventRow;
  guest: GuestRow;
  qrSvg: string;
  invitationUrl: string;
  monogram: MonogramConfig;
  // The chosen Motion Library signature when the event owns the paid
  // ANIMATED_MONOGRAM upgrade, or false → static hero circle. See
  // [slug]/page.tsx resolution + lib/animated-monogram.ts +
  // lib/monogram-motion.ts.
  animatedMonogram: MonogramMotionKey | false;
  /** The bespoke-mark reveal designed in the studio panel — fed to the STD film. */
  studioAnim: StudioAnim;
  // The applied Setnayan-AI bespoke mark (sanitized SVG) — wins over the
  // typographic circle in both hero branches when present.
  bespokeSvg: string | null;
  scheduleBlocks: ScheduleBlockRow[];
  dayOfPhase: DayOfPhase;
  // Website lifecycle-phase engine (Increment C · flag-dark). When
  // `phasesEnabled` is false (the default), every phase gate below is a
  // no-op and this guest path renders exactly as today. `lifecyclePhase`
  // is only consulted when `phasesEnabled` is true.
  phasesEnabled: boolean;
  lifecyclePhase: LifecyclePhase;
  /** PR4 P1 — render the auto-playing STD film instead of the static section. */
  stdFilm: boolean;
  stdBackground?: StdBackground;
  stdBackgroundUrl?: string | null;
  /** Presigned URL of the couple's NSFW-approved closing video (stdVideoIsLive),
   *  or null → the gallery beat shows. Resolved once at the top-level page. */
  stdVideoUrl?: string | null;
  /** Poster still of that video — fills the full-screen letterbox bars with a
   *  blurred image, since iOS won't play a 2nd <video> for that backdrop. */
  stdVideoPosterUrl?: string | null;
  /** Auto-filled ceremony + reception venue names (finalized bookings ?? manual
   *  ?? event) + reception city, for the STD film's venue beats. */
  stdVenues?: { ceremony: string | null; reception: string | null; receptionCity: string | null };
  // Presigned GET URL for the host's uploaded hero photo, or null when the
  // monogram-only fallback should render. Caller resolves once at the
  // top-level page so PublicLanding + InvitationSite share the result.
  heroPhotoUrl?: string | null;
  // Hero video + background music chrome (Increment B). Presigned URLs (or
  // null). Video replaces the still hero; music mounts the tap-to-play player.
  heroVideoUrl?: string | null;
  bgMusicUrl?: string | null;
  /** Whether the couple owns the Cinematic Reveal (STD_PREMIUM_OPENINGS) — gates
   *  the Save-the-Date film's own media beats (music, video, photos). */
  ownsStdReveal: boolean;
  // Presigned GET URLs for the couple's "Our photos" gallery (Increment A.4),
  // in display order. Resolved once at the top-level page; empty → the widget
  // hides itself.
  ourPhotoUrls: string[];
  // Widget visibility registry from migration 20260607030000. Drives
  // which widgets render here + in what order. Always-on widgets (hero,
  // greeting, qr_card, rsvp) render in fixed positions per the editor
  // contract; hideable widgets render in display_order after RSVP.
  widgets: readonly InvitationWidgetRow[];
  /** Spatial backdrop node (or null) — rendered by InvitationShell behind the page. */
  backdrop?: React.ReactNode;
  /** Live Photo Wall mirror — non-null only during the live window when the event owns LIVE_WALL. */
  liveWall?: LiveWallData | null;
  /** Panood Watch-Live — non-null only during the live window when a watch URL is staged (single-cam Panood live is free for every host). */
  watchLive?: WatchLiveData | null;
  /** This guest's tagged photos so far — live window only, clean-screened. */
  guestLiveGallery?: GuestLiveGallery | null;
  /** Event owns CUSTOM_QR_GUEST → advertise the personalized seat pass link
   *  (seat-finding PR4). Additive; the find-my-table link is unaffected. */
  seatPassActive?: boolean;
  /** True in the live window when the guest has no active face enrollment —
   *  drives the day-of "add your face" prompt so their photos auto-find them. */
  needsFaceEnroll?: boolean;
  /** Pre-assembled data bundle for the persistent GuestHubCard. */
  guestHubData: GuestHubData;
  seatMap: {
    tables: EventTableRow[];
    entrance: EntrancePos;
    targetTableId: string;
  } | null;
  /** Inline Papic guest camera (PAPIC_GUEST) — non-null only when the event owns
   *  the active (admin-approved) pack and this guest isn't blocked. Mounts the
   *  same capture surface as the standalone /papic/guest route, in-context. */
  papicGuest: {
    initialRemaining: number;
    total: number;
    termsAccepted: boolean;
    guestUnlimited: boolean;
    eventStyle: PapicStyle;
    faceMode: PapicFaceMode;
  } | null;
  /** Inline Pabati video-greeting recorder (PABATI) — non-null only when the
   *  event owns the active (admin-approved) pack. Mounts the guest recorder
   *  in-context on this guest's landing page. */
  pabati: {
    initialRemaining: number;
    total: number;
  } | null;
  /** Paid COUPLE_WEBSITE_PRO perk — drop the "Powered by Setnayan" footer
   *  watermark when the event owns the active upgrade. Resolved once at the
   *  top-level page (eventCoupleWebsiteProActive). */
  proWatermarkHidden: boolean;
  /** Invite/Join v2: show the accountless guest a "claim your account by email"
   *  prompt (RSVP / Event / Editorial phases — never Save the Date). Computed at
   *  the page level: true only when there's no signed-in account for this viewer. */
  showClaimAccountCta: boolean;
  /** Invite/Join v2: the no-login photo grace has ended (>~24h after the wedding)
   *  for this accountless viewer — show the "photos closed, make an account to get
   *  them back" state instead of the gallery. */
  accountlessPhotosClosed: boolean;
  /** Invite/Join v2: the couple's booked marketplace vendors ("vendors who made
   *  this day"), each savable to the guest's own account for future planning. */
  eventVendorCredits: VendorCard[];
  /** Invite/Join v2: flash after a guest saves a vendor (ok / needs_account / error). */
  saveFlash: string | null;
  /** Server-resolved effective face-tag mode (One-Pool spec §3.4) for the RSVP
   *  selfie + day-of enroll surfaces. mode_b ⇒ no descriptor computed. */
  faceMode: PapicFaceMode;
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
  // 4-path lifecycle: far before the wedding, the body is the minimal Save the
  // Date (announcement). The monogram hero already renders above for the guest
  // path, so the STD view doesn't carry the text hero (showTextHero={false}).
  const showSaveTheDate = phasesEnabled && lifecyclePhase === 'save_the_date';

  const hasHeroMedia = Boolean(heroVideoUrl || heroPhotoUrl);
  return (
    <InvitationShell
      backdrop={backdrop}
      rolePalette={event.role_palette}
      fullBleed={showSaveTheDate && stdFilm}
      hideWatermark={proWatermarkHidden}
    >
      <GuestPreload eventSlug={event.slug} />
      {/* Item #8 — discreet floating share/report chrome. Share shows ONLY when
          the event is effectively public (couple launched their Save-the-Date);
          the abuse-report entry (target_type='event') is present on any listed
          page. Never rendered on a private page (this whole component is behind
          the not-private gate). */}
      {resolveEffectiveVisibility(event) !== 'private' && (
        <PublicPageActions
          canShare={resolveEffectiveVisibility(event) === 'public'}
          reportTargetId={event.event_id}
          shareTitle={event.display_name}
        />
      )}
      {showSaveTheDate && !event.is_sample ? <StdViewBeacon slug={event.slug} /> : null}
      <RevealOverlayServer
        enabled={showSaveTheDate}
        monogram={revealMonogram(event.display_name)}
        markSvg={revealMarkSvg(event)}
        waxColor={revealWaxColor(event.role_palette)}
        sealConfig={revealSealConfig(event)}
        sealFallbackSeed={fallbackSeedFromPublicId(event.public_id)}
        veilColor={revealVeilColor(event.role_palette)}
        eventTemplate={coerceRevealTemplate(event.std_reveal_template)}
        eventEffects={resolveRevealEffects(event.std_reveal_effects)}
        eventId={event.event_id}
      />
      {/* Couple's opt-in background-music player — NOT during the Save-the-Date
          phase: the STD film owns audio there, and this floating speaker control
          would otherwise bleed through / over the veil reveal. (owner 2026-06-19) */}
      {bgMusicUrl && !showSaveTheDate ? <BackgroundMusic src={bgMusicUrl} /> : null}
      <article className="space-y-12">
        {/* Guest Hub Card — persistent status summary for identified returning
            guests. Shows RSVP status, seat, meal, and next schedule item at
            a glance on every return visit. Hidden from anonymous visitors
            (this branch only runs when a guest session is present). */}
        <GuestHubCard data={guestHubData} />

        {/* Invite/Join v2 — accountless guest's "claim your account" prompt.
            Per the lifecycle table: RSVP / Event / Editorial only (never Save the
            Date), and only when there's no signed-in account (showClaimAccountCta).
            Posts the email to claimAccountAction → emails a passwordless sign-in
            link that connects this event to a real account. */}
        {showClaimAccountCta && lifecyclePhase !== 'save_the_date' ? (
          <section
            id="claim-account"
            className="scroll-mt-24 rounded-2xl border border-terracotta/20 bg-terracotta/[0.04] p-5"
          >
            <h2 className="text-base font-semibold text-ink">Keep this on your phone</h2>
            <p className="mt-1 text-sm text-ink/70">
              Get a sign-in link by email and your own Setnayan account — reopen this event
              (your RSVP, your table, your photos) on any device, no password needed.
            </p>
            <form
              action={claimAccountAction.bind(null, event.event_id, event.slug ?? '')}
              className="mt-3 flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="you@email.com"
                autoComplete="email"
                aria-label="Your email"
                className="input-field flex-1"
              />
              <SubmitButton className="button-primary whitespace-nowrap" pendingLabel="Sending…">
                Email me a link
              </SubmitButton>
            </form>
          </section>
        ) : null}

        {seatMap ? (
          <YourSeatBlock
            tableLabel={guestHubData.tableLabel ?? 'your table'}
            venueName={event.venue_name}
            tables={seatMap.tables}
            entrance={seatMap.entrance}
            targetTableId={seatMap.targetTableId}
            firstName={guestHubData.firstName}
            arrived={guestHubData.arrived}
          />
        ) : null}

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
        {!showEditorialPlaceholder && heroShouldRender && hasHeroMedia && !showSaveTheDate ? (
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
              <div className="mt-6 flex justify-center">
                <HeroMonogram
                  event={event}
                  monogram={monogram}
                  animatedMonogram={animatedMonogram}
                  bespokeSvg={bespokeSvg}
                  shadow
                />
              </div>
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
        ) : !showEditorialPlaceholder && heroShouldRender && !showSaveTheDate ? (
          <section className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              You are invited
            </p>
            <div className="mt-6 flex justify-center">
              <HeroMonogram
                event={event}
                monogram={monogram}
                animatedMonogram={animatedMonogram}
                bespokeSvg={bespokeSvg}
              />
            </div>
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
        ) : showSaveTheDate ? (
          <SaveTheDateView
            displayName={event.display_name}
            dateIso={event.event_date}
            venueName={event.venue_name}
            venueAddress={event.venue_address}
            publicId={event.public_id}
            loveStory={event.love_story}
            showTextHero={false}
            animatedMonogram={animatedMonogram}
            studioAnim={studioAnim}
            film={stdFilm}
            background={stdBackground}
            backgroundImageUrl={stdBackgroundUrl}
            monogramText={event.monogram_text}
            monogramSvg={bespokeSvg}
            lockup={stdLockupFor(event)}
            musicUrl={ownsStdReveal ? bgMusicUrl : null}
            videoUrl={ownsStdReveal ? stdVideoUrl : null}
            videoPosterUrl={ownsStdReveal ? stdVideoPosterUrl : null}
            ceremonyVenue={stdVenues?.ceremony ?? null}
            receptionVenue={stdVenues?.reception ?? null}
            receptionCity={stdVenues?.receptionCity ?? null}
            galleryUrls={
              ownsStdReveal
                ? ourPhotoUrls.length
                  ? ourPhotoUrls
                  : heroPhotoUrl
                    ? [heroPhotoUrl]
                    : []
                : []
            }
            launchDateIso={event.std_invitation_launch_date ?? defaultInvitationLaunchIso(event.event_date)}
            themeId={event.std_theme}
            accentHex={stdAccentColor(event)}
          />
        ) : (
          <>
        {/* Greeting — always-on per the editor contract; gated here so V1.1
            can decouple if a host wants the wedding page to skip the
            personalized welcome. */}
        {greetingShouldRender ? (
          <section className="space-y-4 text-center">
            <p className="font-serif text-3xl italic leading-tight text-ink">Hi, {guest.first_name}.</p>
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
        {/* Panood Watch-Live — leads the live page: the loved ones who
            couldn't fly home open the same link and watch the ceremony.
            Spec §7.5: remote guests first. */}
        {isLive && watchLive ? <WatchLiveBlock watchLive={watchLive} /> : null}

        {isLive && scheduleBlocks.length > 0 ? (
          <section
            aria-label="Day-of schedule"
            className="rounded-2xl border-2 border-success-300 bg-success-50/50 p-2"
          >
            <ScheduleWidget
              blocks={scheduleBlocks}
              eventTz={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
              nowTrigger={isGuestNowTriggerEnabled()}
            />
          </section>
        ) : null}

        {/* Chinese (Tsinoy) tea-ceremony card — static, guest-safe tradition copy
            (no roster / no PII). Mirrors the public + identified-guest paths for
            parity; gates on isChineseWedding (primary OR secondary rite). */}
        {isChineseWedding(event) ? <TeaCeremonyCard event={event} /> : null}

        {/* Live Photo Wall mirror — the venue wall on the guest's own phone
            while the celebration runs (owner 2026-06-12: the wall + live
            gallery belong ON the on-the-day page). Renders only when the
            event owns LIVE_WALL and the live window is on; polls for fresh
            tiles while the tab is visible. */}
        {isLive && liveWall ? (
          <LiveWallBlock
            slug={event.slug}
            initialTiles={liveWall.tiles}
            initialCount={liveWall.count}
            initialCaption={liveWall.caption}
          />
        ) : null}

        {/* "Add your face" — shown across the whole pre-event window (gated in
            needsFaceEnroll: Papic event · not declined · not yet enrolled) so
            guests enroll early, plus a day-of catch for anyone who skipped the
            RSVP selfie. One tap enrolls them so their candid photos auto-find
            them. Self-hides once enrolled; QR-scan tagging is the fallback. */}
        {needsFaceEnroll ? (
          <DayOfFaceEnroll context={isLive ? 'day_of' : 'pre_event'} faceMode={faceMode} />
        ) : null}

        {/* Inline Papic guest camera — auto-shown in-context when the couple owns
            the active (admin-approved) PAPIC_GUEST pack, so an identified guest
            can shoot candids without leaving their landing page. Same surface as
            the standalone /papic/guest route (still live as the QR-scan fallback +
            the floating CTA). papicGuest is non-null only behind the active gate +
            an unblocked guest, resolved on the page. */}
        {papicGuest ? (
          <PapicGuestCapture
            guestName={guest.first_name}
            eventName={event.display_name}
            eventId={event.event_id}
            initialRemaining={papicGuest.initialRemaining}
            total={papicGuest.total}
            termsAccepted={papicGuest.termsAccepted}
            needsFaceEnroll={needsFaceEnroll}
            guestUnlimited={papicGuest.guestUnlimited}
            eventStyle={papicGuest.eventStyle}
            faceMode={papicGuest.faceMode}
          />
        ) : null}

        {/* Inline Pabati recorder — auto-shown in-context when the couple owns
            the active (admin-approved) PABATI pack, so this guest can leave a
            5-second video greeting without leaving their landing page. Same
            collector as the standalone /pabati/[eventId] share-link entry. The
            per-EVENT 300-clip quota drives the "N left" display; the RPC is the
            real gate. pabati is non-null only behind the active gate. */}
        {pabati ? (
          <PabatiPrompt
            guestName={guest.first_name}
            eventName={event.display_name}
            initialRemaining={pabati.initialRemaining}
            total={pabati.total}
          />
        ) : null}

        {/* Per-guest LIVE gallery — "photos of you, so far". The personalized
            half of the on-the-day gallery pair (the wall mirror above is the
            shared half): this guest's clean-screened tagged photos, arriving
            through the day. Personalization no competitor has. */}
        {(isLive || isPost) && guestLiveGallery ? (
          <section
            aria-label="Photos of you"
            className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
                {isLive ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-500" />
                ) : null}
                Photos of you{isLive ? ' — so far' : ''}
              </p>
              <p className="text-sm text-ink/70">
                {guestLiveGallery.total.toLocaleString()}
                {isLive ? ' so far' : ''}
              </p>
            </div>
            {/* Post-event grace (Invite/Join v2): a no-login guest can still save
                their photos for ~24h after the wedding, then it closes — an
                account keeps them forever. The claim-account box already sits near
                the top of the page for accountless viewers. */}
            {isPost && showClaimAccountCta ? (
              <p className="mt-3 rounded-lg border border-warn-900/15 bg-warn-100 px-3 py-2 text-sm text-warn-900">
                These close about a day after the wedding. Save the ones you want now —
                or make a free account (the box near the top) to keep them forever.
              </p>
            ) : null}
            {/* 3-up (not 4-up) so the photos — and the readable "Not me" control —
                are big enough for an older guest (Guest Legibility Floor). */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {guestLiveGallery.photos.map((p) => (
                <figure
                  key={p.id}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-ink/5"
                >
                  {/* Presigned URL — raw <img> (optimizer would cache expiry).
                      Wrapped in a link so a tap opens the full-size image to save
                      — the no-login download path during the grace window. */}
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open full size to save"
                    className="block h-full w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </a>
                  {/* "Not me" — drop a wrong auto-face guess of yourself on this
                      one shot (you stay enrolled for the rest). Auto-tags only;
                      a photographer's QR tag can't be removed here. A real
                      ≥44px labelled control, legible over the photo. */}
                  <form
                    action={removeMyTag.bind(null, event.event_id, p.sourceTable, p.id)}
                    className="absolute right-1.5 top-1.5"
                  >
                    <SubmitButton
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-ink/65 px-3 text-sm font-semibold text-cream shadow-sm backdrop-blur-sm transition hover:bg-ink/80 focus-visible:bg-ink/80"
                      pendingLabel="Removing…"
                    >
                      <X aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                      Not me
                    </SubmitButton>
                  </form>
                </figure>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink/70">
              {isLive
                ? 'More arrive as the day unfolds — and every photo of you is yours to keep after the celebration.'
                : 'Tap any photo to open it full size and save it.'}{' '}
              Tap <span className="font-medium">Not me</span> on any photo that isn&rsquo;t you.
            </p>
          </section>
        ) : null}

        {/* Invite/Join v2 — the no-login photo grace has ended for this accountless
            guest (>~24h after the wedding). Accurate regardless of how many photos
            they had: the guest view is winding down; an account keeps everything. */}
        {accountlessPhotosClosed ? (
          <section
            aria-label="Keep this event"
            className="rounded-2xl border border-ink/10 bg-cream p-5 text-sm text-ink/70 shadow-sm sm:p-6"
          >
            <p className="font-medium text-ink">Keep this event for good</p>
            <p className="mt-1">
              The guest view winds down about a day after the wedding. Make a free
              Setnayan account to keep your invite and your photos — on any device. Use the
              &ldquo;Keep this on your phone&rdquo; box above to get a sign-in link.
            </p>
          </section>
        ) : null}

        {/* Invite/Join v2 — "vendors who made this day": the couple's booked
            marketplace vendors, savable to a guest's OWN account so they carry to
            the guest's future planning (the growth loop). RSVP / Event / Editorial
            only (never Save the Date), and only when there are credited vendors. */}
        {lifecyclePhase !== 'save_the_date' && eventVendorCredits.length > 0 ? (
          <section
            aria-label="Vendors who made this day"
            className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6"
          >
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              Vendors who made this day
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Loved a vendor? Keep them.</h2>
            <p className="mt-1 text-sm text-ink/70">
              Save any vendor here to your Setnayan account — they&rsquo;ll be waiting when you
              plan your own celebration.
            </p>
            {saveFlash ? (
              <p className="mt-3 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink/80">
                {saveFlash}
              </p>
            ) : null}
            <ul className="mt-4 space-y-2">
              {eventVendorCredits.map((v) => (
                <li
                  key={v.vendorProfileId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {v.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.logoUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-sm font-semibold text-terracotta">
                        {v.displayName.trim().charAt(0).toUpperCase() || 'V'}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">
                        {v.businessSlug ? (
                          <Link href={`/v/${v.businessSlug}`} className="hover:text-terracotta">
                            {v.displayName}
                          </Link>
                        ) : (
                          v.displayName
                        )}
                      </p>
                      {v.categoryLabel ? (
                        <p className="truncate text-sm text-ink/60">{v.categoryLabel}</p>
                      ) : null}
                    </div>
                  </div>
                  {showClaimAccountCta ? (
                    <span className="shrink-0 text-xs text-ink/45">Account needed</span>
                  ) : (
                    <form
                      action={saveAttendedVendorAction.bind(
                        null,
                        event.event_id,
                        event.slug ?? '',
                        v.vendorProfileId,
                      )}
                      className="shrink-0"
                    >
                      <SubmitButton className="button-secondary text-sm" pendingLabel="Saving…">
                        Save
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {showClaimAccountCta ? (
              <p className="mt-3 text-sm text-ink/60">
                Make a free account (the box near the top) to save these for your own plans.
              </p>
            ) : null}
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
            <p className="mt-4 break-all font-mono text-xs tracking-[0.05em] text-ink/55">
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
            {/* Personalized seat pass (CUSTOM_QR_GUEST · seat-finding PR4) —
                ADDITIVE, separately gated, and only when the couple bought the
                branded-QR SKU. Routes through /seat/claim so the cookie is set
                before landing on the pass (their exact seat + arrival bloom).
                The find-my-table link above (a separate INDOOR_BLUEPRINT
                surface) is untouched — both can show. */}
            {seatPassActive && guest.qr_token ? (
              <Link
                href={`/${event.slug}/seat/claim?t=${guest.qr_token}`}
                className="ml-2 mt-5 inline-flex items-center gap-1.5 rounded-md border border-terracotta/40 bg-terracotta/5 px-3 py-1.5 text-xs font-medium text-terracotta hover:border-terracotta hover:bg-terracotta/10"
              >
                <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Your seat pass
              </Link>
            ) : null}
          </section>
        ) : null}

        {/* RSVP — always-on per the editor contract. The wedding's
            load-bearing form: the editor blocks hiding it, but the gate
            below is the runtime enforcement point. */}
        {rsvpShouldRender ? (
          <RsvpWidget
            guest={guest}
            eventId={event.event_id}
            eventPublicId={event.public_id}
            limited={isLimitedPlusOne}
            faceMode={faceMode}
          />
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
            scheduleEstimated={
              isGuestNowTriggerEnabled() &&
              (dayOfPhase === 'pre' || dayOfPhase === 'inactive')
            }
            isLimitedPlusOne={isLimitedPlusOne}
            ourPhotoUrls={ourPhotoUrls}
          />
        ))}

        {isLimitedPlusOne ? (
          <section className="rounded-xl border border-warn-200 bg-warn-50 p-5 text-sm text-warn-900">
            You&rsquo;re joining as a +1. Photos taken of you will appear in your inviter&rsquo;s
            gallery — ask them to share. In-app features like Shutter
            require a full Setnayan account, which the couple hasn&rsquo;t enabled for +1s on
            this wedding.
          </section>
        ) : null}

        {/* Our Story — the couple's love story on the run-up paths (rsvp/event).
            The normal body only renders pre-event (STD + editorial are separate
            branches), so this naturally stays off the post-event Editorial. */}
        <OurStory loveStory={event.love_story} variant="full" />
        {/* Guest Columns (BUILD ① · GUEST_COLUMNS_ENABLED, default OFF) — the
            guest's one column for the couple's paper + the approved columns.
            Guest-session tree only (cookie holders); flag off → renders null. */}
        <GuestColumnCard eventId={event.event_id} guestId={guest.guest_id} eventDate={event.event_date} />
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
