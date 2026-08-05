import Link from 'next/link';
import { MapPin, Sparkles, X } from 'lucide-react';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { formatEventDate } from '@/lib/events';
import { ROLE_LABELS } from '@/lib/guests';
import { resolveMonogram, type MonogramConfig } from '@/lib/monogram';
import { PapicGuestCapture } from '@/app/papic/guest/_components/papic-guest-capture';
import { PabatiPrompt } from './pabati-prompt';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import type { StudioAnim } from '@/app/_components/studio-reveal-player';
import { type MonogramMotionKey } from '@/lib/monogram-motion';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  removeMyTag,
  claimAccountAction,
  saveAttendedVendorAction,
} from '../actions';
import { DayOfFaceEnroll } from './day-of-face-enroll';
import { ScheduleWidget } from './schedule-widget';
import { TeaCeremonyCard } from './tea-ceremony-card';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { type ScheduleBlockRow } from '@/lib/schedule';
import { GuestGuidedTour } from '@/app/_components/guest-guided-tour';
import { PublicPageActions } from '@/app/_components/public-page-actions';
import { type DayOfPhase } from '@/lib/day-of-mode';
import { isGuestNowTriggerEnabled } from '@/lib/guest-now-trigger';
import { GuestPreload } from './guest-preload';
import { PublicEventDayBar } from './public-event-day-bar';
import { SiteMenuBar } from './site-menu-bar';
import { resolveSiteNav, type NavPhase } from '../_lib/site-nav';
import { siteMenuEnabled, browsableBodyRenders, SITE_MENU_ANCHORS } from '../_lib/site-menu';
import { VendorDoorway } from './vendor-doorway';
import { StdFilmHandoff } from './std-film-handoff';
import { StdViewBeacon } from './std-view-beacon';
import { BackgroundMusic } from './background-music';
import { EditorialContent } from './editorial/editorial-content';
import { SaveTheDateView } from './save-the-date';
import { type StdLockup } from './save-the-date-film';
import { RevealOverlayServer } from './reveal/reveal-overlay-server';
import { resolveRevealEffects } from '@/lib/std-reveal-effects';
import { type StdBackground } from '@/lib/std-backgrounds';
import { defaultInvitationLaunchIso } from '@/lib/save-the-date-content';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from '@/lib/reveal-config';
import { OurStory } from './our-story';

/**
 * `dayOfPhase` is the site's own three-state clock; `NavPhase` is the resolver's.
 * Same three moments, two vocabularies — mapped in ONE place so the bar and the
 * rules can never disagree about which moment it is (they did, twice, in two
 * days). 'live' is the wedding happening; 'post' is after it.
 */
function navPhaseOf(dayOfPhase: DayOfPhase | null | undefined): NavPhase {
  if (dayOfPhase === 'live') return 'day';
  if (dayOfPhase === 'post') return 'after';
  return 'before';
}

import { GuestColumnCard } from './guest-column-card';
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
import { LiveWallBlock } from './live-wall-block';
import { GuestHubCard } from './guest-hub-card';
import { YourSeatBlock } from './your-seat-block';
import {
  type InvitationWidgetRow,
  type LifecyclePhase,
} from '@/lib/invitation-widgets';
import { resolveSiteBodyPlan } from '@/lib/site-body-plan';
import { buildOwnerRibbon } from '@/lib/owner-ribbon';
import { buildAfterEventMemento } from '@/lib/pahina-memento';
import { OwnerRibbon } from './owner-ribbon';
import { DayOfAnnouncement } from './day-of-announcement';
import type {
  AnonymousSiteIdentity,
  GuestSiteIdentity,
  OwnerCapability,
  VendorCapability,
  SiteIdentity,
} from '../_lib/site-identity';
import type {
  EventRow,
  LiveWallData,
  StdVenues,
  WatchLiveData,
} from '../_lib/types';
import { DayOfBanner } from './day-of-banner';
import { FaceDataNotice } from './face-data-notice';
import { HeroBackgroundMedia } from './hero-background-media';
import { HideableWidgetRender } from './hideable-widget-render';
import { InvitationShell } from './invitation-shell';
import { PublicHideableWidget } from './public-hideable-widget';
import { RsvpWidget } from './rsvp-widget';
import { PahinaKeepsake } from './pahina-keepsake';
import { WatchLiveBlock } from './watch-live-block';
import { SpotlightCard } from './spotlight-card';
import {
  SectionEmptyPlate,
  FindModeCard,
  PublicEventDetails,
} from './empty-states';
import { EditorBridge } from './editor-bridge';
import { PahinaMasthead } from './pahina-masthead';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';

/**
 * SiteBody — the ONE body tree for the guest event website
 * (OPEN-BROWSE PR3 — council build plan §3 row 3).
 *
 * Before this PR the page's 3-way body (editorial | save-the-date | normal)
 * was written TWICE in page.tsx — once in PublicLanding (anonymous) and once
 * in InvitationSite (cookie-verified guest) — with the shared chrome
 * (InvitationShell · GuestPreload · PublicPageActions · StdViewBeacon ·
 * RevealOverlayServer · BackgroundMusic) and the editorial/STD computation
 * sites duplicated verbatim. Both trees now live here:
 *
 *   - The phase spine (which body renders, full-bleed, beacon, reveal,
 *     music, STD text-hero) is computed ONCE by `resolveSiteBodyPlan`
 *     (lib/site-body-plan.ts — pure, golden-tested).
 *   - `EditorialContent` and `SaveTheDateView` each have exactly ONE
 *     computation site (the `phasedBody` ternary below).
 *   - The per-identity "normal" bodies remain genuinely different surfaces
 *     and render as two verbatim-preserved branches inside this one tree.
 *
 * Identity is a discriminated union (`_lib/site-identity.ts`): the anonymous
 * variant is structurally unable to carry guest-derived data — the RA 10173
 * zero-guest-bytes firewall is the type + the `anonymousIdentity()` key-pick
 * + the allow-list fence in the plan, not reviewer discipline.
 */

function displayNameOf(g: {
  first_name: string;
  last_name: string;
  display_name: string | null;
}): string {
  return g.display_name?.trim() || `${g.first_name} ${g.last_name}`.trim();
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
  // SEC-3: gated on read — events.monogram_* are host-writable via PostgREST.
  return resolveEventMonogramSvg(event);
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

type SiteBodyProps = {
  event: EventRow;
  /** WHO is looking — the discriminated per-tier delta. Anonymous carries the
   *  reason variants + public event-day chrome inputs; guest carries the full
   *  guest context. See _lib/site-identity.ts. */
  identity: SiteIdentity;
  // The couple's resolved mark (resolveMonogram) — feeds both heroes so the
  // highest-traffic shared-link open shows the SAME mark as the signed-in
  // guest hero (owner 2026-06-22 animated-logo rollout).
  monogram: MonogramConfig;
  // The chosen Motion Library signature when the event owns the paid
  // ANIMATED_MONOGRAM upgrade, or false → static hero circle. Threaded into
  // the hero monogram + the STD film's monogram beats. Required (every call
  // site passes it) so it can feed HeroMonogram, which needs a non-optional
  // value. Mirrors PrivateLanding's prop.
  animatedMonogram: MonogramMotionKey | false;
  /** The bespoke-mark reveal designed in the studio panel — fed to the STD film. */
  studioAnim: StudioAnim;
  /** Sanitized bespoke monogram SVG (uploaded ?? Cipher) — wins over the
   *  typographic circle in both hero branches when present; also feeds the STD
   *  film's monogram beats. null → text initials. */
  bespokeSvg: string | null;
  dayOfPhase: DayOfPhase;
  /** The host's Papic switch — the gate for the menu's camera slot, on ANY day. */
  hostCameraOpen?: boolean;
  /** The coordinator's latest announcement, live window only. Guests only. */
  dayOfBroadcast?: { body: string; createdAt: string } | null;
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
  /** Presigned URL of the couple's NSFW-approved closing video (stdVideoServeUrls
   *  — the verdict must still bind this media, SEC-6),
   *  or null → the gallery beat shows. Resolved once at the top-level page. */
  stdVideoUrl?: string | null;
  /** Poster still of that video — fills the full-screen letterbox bars with a
   *  blurred image, since iOS won't play a 2nd <video> for that backdrop. */
  stdVideoPosterUrl?: string | null;
  /** Auto-filled ceremony + reception venue names (finalized bookings ?? manual
   *  ?? event) + reception city, for the STD film's venue beats. */
  stdVenues?: StdVenues;
  // Presigned GET URL for the host's uploaded hero photo, or null when the
  // monogram-only fallback should render. See displayUrlForStoredAsset() in
  // lib/uploads.ts — caller resolves once at the top-level page so every
  // identity tier shares the result.
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
  // Widget visibility registry from migration 20260607030000. Drives which
  // widgets render + in what order. The guest tree renders always-on widgets
  // in fixed positions per the editor contract + hideable widgets in
  // display_order after RSVP; the anonymous tree renders only the
  // PUBLIC_WIDGET_ALLOWLIST types (see lib/site-body-plan.ts).
  widgets: readonly InvitationWidgetRow[];
  // Public schedule rows (host-marked-public only — safe for anonymous
  // visitors). Hoisted to the page level 2026-05-23 so both identity tiers
  // can render the Schedule widget.
  scheduleBlocks: ScheduleBlockRow[];
  /** Spatial backdrop node (or null) — rendered by InvitationShell behind the page. */
  backdrop?: React.ReactNode;
  /** Live Photo Wall mirror — non-null only during the live window when the event owns LIVE_WALL. */
  liveWall?: LiveWallData | null;
  /** Panood Watch-Live — non-null only during the live window when a watch URL is staged (single-cam Panood live is free for every host). */
  watchLive?: WatchLiveData | null;
  /** Paid COUPLE_WEBSITE_PRO perk — drop the "Powered by Setnayan" footer
   *  watermark when the event owns the active upgrade. Resolved once at the
   *  top-level page (eventCoupleWebsiteProActive). */
  proWatermarkHidden: boolean;
  /** Website Pro net-new manual site colours (Launch settings §4.4 · PR-C) —
   *  pre-gated --color-* overrides (null when inert). Layered over the Mood-Board
   *  palette in InvitationShell; null → no override → renders as today. */
  siteColorVars: Record<string, string> | null;
  /** Unified Website Editor (PR-1) — TRUE only when the page resolved
   *  `?editor=1` AND server-verified host membership. Mounts the click-to-edit
   *  bridge for the editor's preview iframe. FALSE for every guest/anonymous
   *  visitor (and absent → false), so their HTML is unchanged byte-for-byte. */
  editorMode?: boolean;
  /** OWNER LAYER · FOUNDATION (2026-07-26). Non-null ONLY when the page
   *  server-verified this viewer's host membership of THIS event via
   *  `loadHostMembership` (see the owner-layer block in page.tsx). It travels
   *  BESIDE `identity`, never on it — neither identity tier may carry owner
   *  keys (compile-time assertion in _lib/site-identity.ts).
   *
   *  DELIBERATELY NOT CONSUMED YET. This PR is the gate + its firewall only;
   *  nothing here reads it, so the rendered tree is byte-identical for every
   *  visitor including the owner. The PR that mounts owner controls consumes
   *  it — and must keep the gate here on the server, never by hiding UI. */
  ownerCapability?: OwnerCapability | null;
  /** A booked supplier's server-verified grant; drives the doorway strip. */
  vendorCapability?: VendorCapability | null;
};

export function SiteBody({
  event,
  identity,
  monogram,
  animatedMonogram,
  studioAnim,
  bespokeSvg,
  dayOfPhase,
  hostCameraOpen = false,
  dayOfBroadcast = null,
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
  ownsStdReveal,
  ourPhotoUrls,
  widgets,
  scheduleBlocks,
  backdrop,
  liveWall,
  watchLive,
  proWatermarkHidden,
  siteColorVars,
  editorMode = false,
  ownerCapability = null,
  vendorCapability = null,
}: SiteBodyProps) {
  const hasHeroMedia = Boolean(heroVideoUrl || heroPhotoUrl);

  // OWNER LAYER · surface 1 (2026-07-26). `null` for every guest and every
  // anonymous visitor — `buildOwnerRibbon` returns a model ONLY for the
  // server-verified capability, so `<OwnerRibbon>` renders nothing and their
  // DOM is byte-identical to before this PR. Read-only: links only.
  const ownerRibbon = buildOwnerRibbon({
    ownerCapability,
    eventId: event.event_id,
    slug: event.slug ?? null,
    phasesEnabled,
    // The phase the body is ACTUALLY being built from on this render — the
    // same value `plan` is computed with, so `?phase=` overrides are reflected.
    lifecyclePhase,
  });

  // Open-browse PR7 — per-widget content presence for the shared hasContent()
  // predicate. Only consulted when `event.website_open_browse` is TRUE; a
  // widget the couple kept visible but that has no content this event is
  // dropped from the widened list so the menu never points at an empty
  // section. Unmapped types fail OPEN (assumed present). Byte-inert on the
  // flag-off path (resolveSiteBodyPlan ignores `content` when openBrowse=false).
  const openBrowseContent = {
    schedule: scheduleBlocks.length > 0,
    venue_map: Boolean(event.venue_name || event.venue_address),
    our_love_story: Boolean(event.love_story),
    our_photos: ourPhotoUrls.length > 0,
    special_message: Boolean(event.special_message),
    what_to_bring: Boolean(event.what_to_bring),
    countdown: Boolean(event.event_date),
  };

  // THE phase spine — computed once, consumed by every gate below. See
  // lib/site-body-plan.ts for the verbatim old-condition mapping. `openBrowse`
  // (DEFAULT FALSE per-event) flips phases from gates to emphasis; when FALSE
  // the plan is byte-identical to the pre-PR7 computation (golden-locked).
  const plan = resolveSiteBodyPlan({
    identity: identity.kind,
    phasesEnabled,
    lifecyclePhase,
    stdFilm,
    isSample: Boolean(event.is_sample),
    hasHeroMedia,
    hasBgMusic: Boolean(bgMusicUrl),
    liveMediaPublic: Boolean(event.live_media_public),
    widgets,
    openBrowse: Boolean(event.website_open_browse),
    content: openBrowseContent,
  });

  /**
   * The 3-way phased body — the single computation site for the editorial
   * takeover and the Save-the-Date view (each was previously written twice).
   * Editorial stays date-gated + body-replacing for BOTH identity tiers.
   * `normalBody` is a thunk so the identity-specific normal branch is only
   * built when the lifecycle actually renders it (the old ternaries were
   * equally lazy).
   *
   * AFTER-EVENT MEMENTO (design §11 · Pahina tail). The second parameter is
   * the one guest-only node this shared helper accepts. It exists because the
   * memento belongs INSIDE the editorial takeover — that is the whole point of
   * it, the archive's object — and the takeover has exactly one computation
   * site, here, serving both identity tiers.
   *
   * The anonymous tier is protected in TWO independent ways, not one:
   *   1. `anonymousTree` calls this with one argument, so `memento` defaults to
   *      `null` and the branch below falls to the SAME single `EditorialContent`
   *      element it has always returned — the same expression, not a fragment
   *      that happens to render the same. The anonymous editorial DOM is
   *      byte-identical by construction, not by inspection.
   *   2. The node the guest tree passes is itself gated by
   *      `buildAfterEventMemento` (lib/pahina-memento.ts), which denies any
   *      tier that is not `guest` before it looks at anything else.
   */
  const phasedBody = (
    normalBody: () => React.ReactNode,
    memento: React.ReactNode = null,
  ): React.ReactNode =>
    plan.body === 'editorial' ? (
      // AFTER THE WEDDING: the editorial cover leads, then the site persists
      // BELOW it — so Story, Details, the gallery and the guest's own QR stay
      // reachable instead of the whole site being stripped.
      //
      // ⚠ WHY THIS IS NO LONGER GATED ON `openBrowse` (2026-08-05).
      // It was, and the comment that used to live here said the quiet part
      // plainly: "today's editorial phase strips the whole site." With the flag
      // FALSE — every real event — that stripping WAS the shipped behaviour,
      // and it silently disabled four things the couple had set up:
      //   · the guest's tagged-photo gallery, which the loader deliberately
      //     keeps alive after the day so they can save their pictures;
      //   · the notice warning an account-less guest that their photo access is
      //     about to close — it could NEVER render, because its only mount is
      //     here and its condition is exactly this phase;
      //   · five widget types the couple can switch on FOR after the wedding
      //     (your_photos · our_photos · special_message · our_love_story ·
      //     tier_comparison) — configurable, and shown to nobody;
      //   · a thank-you message written for the people who came.
      //
      // Same shape as the Save-the-Date wall fixed earlier today: one flag was
      // answering both "may this visitor browse the new open site?" and "does
      // this visitor get a site at all?". Only the first is what it decides.
      <>
        <EditorialContent eventId={event.event_id} />
        {memento}
        <div aria-hidden className="mx-auto my-12 h-px w-24 max-w-full bg-ink/15" />
        {normalBody()}
      </>
    ) : plan.body === 'save_the_date' ? (
      // The film stops being a wall — for EVERY event, not only open-browse ones.
      // It still plays first and in full (nothing bought is skipped), but once
      // its closing beat is reached the visitor can step into the site and step
      // back whenever they like.
      //
      // ⚠ WHY THIS IS NO LONGER GATED ON `openBrowse` (2026-08-05).
      // It was, and on the one real wedding site that meant the film was the
      // ENTIRE guest experience: `stdFilmView()` alone renders no RSVP, no
      // details, no seat — they were not covered by the film, they were never
      // mounted. Both exit controls were gated on the same flag, so the exit
      // shipped in #4096 could not reach a real event either. Verified live on
      // /cale-ice: the whole served page was film beats + "Add to calendar".
      //
      // The gate conflated two different questions — "may this visitor browse
      // the new open site?" and "may this visitor LEAVE a full-screen takeover?"
      // Only the first is what `openBrowse` decides. This is also what the owner
      // asked for on 2026-08-03, in this wrapper's own docblock: *"we want them
      // to navigate around right away"*.
      //
      // It does NOT reshape anyone's site and so does not touch the 2026-07-22
      // no-backfill verdict: `normalBody()` is that event's OWN body, the same
      // one it renders inside 90 days. The only change is that it now exists to
      // step into.
      <StdFilmHandoff film={stdFilmView()}>{normalBody()}</StdFilmHandoff>
    ) : (
      normalBody()
    );

  /** The Save-the-Date view, factored so the open-browse and flag-off branches
   *  above render the IDENTICAL film rather than two drifting copies. */
  const stdFilmView = () => (
      <SaveTheDateView
        displayName={event.display_name}
        dateIso={event.event_date}
        venueName={event.venue_name}
        venueAddress={event.venue_address}
        publicId={event.public_id}
        loveStory={event.love_story}
        // Anonymous with no hero media: the STD view carries the text hero
        // (that tree has no monogram hero fallback). Guest: the monogram hero
        // already renders above, so never here. (plan.stdShowTextHero)
        showTextHero={plan.stdShowTextHero}
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
        // Always escapable. See the handoff note above.
        canExit
      />
  );

  /** The anonymous tree — verbatim the old PublicLanding body. */
  const anonymousTree = (anon: AnonymousSiteIdentity) => {
    const { reason, publicCandidCameraActive, publicAlbumHref } = anon;
    // Open-browse MENU SHELL (PR6, flag-dark; always on for the sample event).
    // Present-flags gate each middle tab so it never anchors to a section that
    // did not render (the council's no-dead-anchors rule). Anchor ids below.
    const menuOn = siteMenuEnabled({
      flag: process.env.NEXT_PUBLIC_WEBSITE_MENU_ENABLED,
      isSample: Boolean(event.is_sample),
    });
    // Open-browse (PR8): the archive tense for post-event empty plates, and
    // whether Details/Story always render (they carry event-level facts + a
    // teaser plate under open-browse, so their menu tabs are never dead).
    const archiveTense = plan.body === 'editorial';
    // Details and Story anchor INSIDE `normalBody()`, which `phasedBody` skips
    // in the save-the-date phase — so both tabs must first ask whether that
    // body renders at all. Without this, open browse forced them on and the
    // taps went nowhere (the council's no-dead-anchors rule, broken by its own
    // open-browse branch).
    const bodyRenders = browsableBodyRenders(plan);
    const menuSections = {
      details: bodyRenders && (plan.openBrowse || plan.publicSafeWidgets.length > 0),
      story: bodyRenders && (plan.openBrowse || Boolean(event.love_story)),
      // "Gallery" = the live photo wall (the livestream is a separate concern).
      gallery: dayOfPhase === 'live' && plan.liveMediaVisible && Boolean(liveWall),
    };
    // The public widget nodes, factored so both the flag-off and open-browse
    // Details branches render the identical set (no duplication).
    const publicWidgetNodes = plan.publicSafeWidgets.map((widget) => (
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
    ));
    // Task #13 — day-of-mode badge surfaces to public-landing viewers too so a
    // guest at the venue without a session cookie still sees "happening now".
    const dayOfBadge =
      dayOfPhase === 'live' ? (
        <p className="inline-flex items-center gap-2 rounded-full border border-terracotta px-3 py-1 font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
          Happening now
        </p>
      ) : dayOfPhase === 'post' ? (
        <p className="inline-flex rounded-full bg-ink/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
          Thank you for celebrating
        </p>
      ) : null;

    return (
      <>
        {/* Menu-shell anchor targets (PR6). aria-hidden zero-height markers so
            the fixed SiteMenuBar's in-page links land on the right sections. */}
        <div id={SITE_MENU_ANCHORS.home} aria-hidden className="scroll-mt-6" />
        {/* Open-browse Home spotlight (PR7). Null (byte-inert) unless
            event.website_open_browse is TRUE; identity-aware. */}
        {plan.spotlight ? <SpotlightCard spotlight={plan.spotlight} /> : null}
        {/* When a hero photo/video is uploaded, render a full-bleed banner
            (normal body only — plan.anonymousHeroBanner). Otherwise fall back
            to the centered text-only treatment inside the normal branch. */}
        {plan.anonymousHeroBanner ? (
          /* Pahina masthead (wave A PR-2) — typographic hero; the photo/video is
             demoted to the cover plate below the type (STRUCTURAL: was a
             text-over-scrim banner). Monogram mount + personalization unchanged. */
          <PahinaMasthead
            displayName={event.display_name}
            eventDate={event.event_date}
            venueName={event.venue_name}
            badgeSlot={dayOfBadge}
            monogramSlot={
              <HeroMonogram
                event={event}
                monogram={monogram}
                animatedMonogram={animatedMonogram}
                bespokeSvg={bespokeSvg}
                shadow
              />
            }
            mediaSlot={<HeroBackgroundMedia videoUrl={heroVideoUrl} photoUrl={heroPhotoUrl} />}
            mediaCaption={event.venue_name}
          />
        ) : null}
        {phasedBody(() => (
          <>
            <div className="space-y-6 text-center">
              {!hasHeroMedia ? (
                /* Pahina masthead, text-only variant (wave A PR-2). */
                <PahinaMasthead
                  displayName={event.display_name}
                  eventDate={event.event_date}
                  venueName={event.venue_name}
                  badgeSlot={dayOfBadge}
                  monogramSlot={
                    <HeroMonogram
                      event={event}
                      monogram={monogram}
                      animatedMonogram={animatedMonogram}
                      bespokeSvg={bespokeSvg}
                    />
                  }
                />
              ) : null}
              {reason === 'invalid_invite' ? (
                <p className="mx-auto max-w-prose rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
                  That invite link doesn&rsquo;t look right — it may have been replaced with a new
                  one. Ask your host for your current QR or link; every guest has their own, and
                  an old one stops working the moment it&rsquo;s replaced.
                </p>
              ) : reason === 'wrong_event' ? (
                <p className="mx-auto max-w-prose rounded-md border-l-2 border-ink/30 bg-paper-deep px-4 py-3 text-sm text-ink/75">
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
            {/* The anonymous tree's own legacy bottom bar. Same retirement as
                GuestHubBar (PR11): it is `fixed bottom-0 z-40`, the menu is
                `z-30`, so wherever both render this one covers the menu whole.
                Its two bottom controls (camera · photos) are slots the menu
                resolves for every viewer, so they go. Its day-of "Live hub"
                chip is NOT — the resolver has no hub slot — and that chip is
                top-left chrome that never touches the bar, so it stays. */}
            <PublicEventDayBar
              candidCameraActive={publicCandidCameraActive}
              photosHref={publicAlbumHref}
              hubHref={
                dayOfPhase === 'live' || dayOfPhase === 'post'
                  ? `/${event.slug}/hub`
                  : null
              }
              menuOn={menuOn}
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
            {dayOfPhase === 'live' && plan.liveMediaVisible && watchLive ? (
              <section className="mt-10">
                <WatchLiveBlock watchLive={watchLive} />
              </section>
            ) : null}

            {/* Live Photo Wall mirror — anonymous visitors at the venue (master-QR
                scans without a guest cookie) get the live wall too during the
                celebration window. Same screened feed as the projector. The id is the
                anchor the event-day bar's "Photos" button scrolls to (publicAlbumHref
                above) — scroll-margin keeps it clear of the fixed bottom bar. */}
            {dayOfPhase === 'live' && plan.liveMediaVisible && liveWall ? (
              <section id="live-photo-wall" className="mt-10 scroll-mt-6">
                <span id={SITE_MENU_ANCHORS.gallery} aria-hidden className="sr-only" />
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
             *  via the widget editor at /dashboard/[eventId]/website. Only
             *  the PUBLIC_WIDGET_ALLOWLIST types pass the plan's fence —
             *  guest-personalized widgets (qr_card · rsvp · greeting ·
             *  event_details · your_photos) need a guest session to be
             *  meaningful and are excluded by construction. Each widget
             *  sub-component is reused from the guest tree — same visual
             *  treatment, just a thinner per-type dispatcher because the
             *  anonymous path doesn't have a guest object to pass. */}
            {plan.openBrowse ? (
              // Open-browse Details — always present so the tab is never dead:
              // event-level facts (the anonymous event_details variant — §5.10),
              // the public widgets, then a teaser plate when nothing is filled.
              <section id={SITE_MENU_ANCHORS.details} className="mt-12 space-y-8 scroll-mt-6">
                <PublicEventDetails
                  dateLabel={event.event_date ? formatEventDate(event.event_date) : null}
                  venueName={event.venue_name}
                  venueAddress={event.venue_address}
                />
                {publicWidgetNodes}
                {plan.publicSafeWidgets.length === 0 ? (
                  <SectionEmptyPlate kind="details" pastTense={archiveTense} />
                ) : null}
              </section>
            ) : plan.publicSafeWidgets.length > 0 ? (
              <section id={SITE_MENU_ANCHORS.details} className="mt-12 space-y-8 scroll-mt-6">
                {publicWidgetNodes}
              </section>
            ) : null}

            {/* Our Story — the couple's love story on the run-up paths (rsvp/event).
                The normal body only renders pre-event (STD + editorial are separate
                branches), so this naturally stays off the post-event Editorial.
                Under open-browse a teaser plate stands in when there's no story so
                the Story tab never lands on nothing. */}
            <div id={SITE_MENU_ANCHORS.story} className="scroll-mt-6">
              {event.love_story ? (
                <OurStory loveStory={event.love_story} variant="full" />
              ) : plan.openBrowse ? (
                <SectionEmptyPlate kind="story" pastTense={archiveTense} />
              ) : (
                <OurStory loveStory={event.love_story} variant="full" />
              )}
            </div>
          </>
        ))}
        {/* Me tab — under open-browse a cookie-less visitor gets designed
            find-mode (§1.1); otherwise the account/claim affordance lives in the
            fixed PublicEventDayBar and this marker just gives the tab a landing. */}
        {plan.openBrowse ? (
          <section id={SITE_MENU_ANCHORS.me} className="mt-12 scroll-mt-6">
            <FindModeCard slug={event.slug} reason={reason} pastTense={archiveTense} />
          </section>
        ) : (
          <div id={SITE_MENU_ANCHORS.me} aria-hidden className="scroll-mt-6" />
        )}
        {/* Open-browse menu shell (PR6) — fixed bottom tab bar of in-page
            anchors. Flag-dark (NEXT_PUBLIC_WEBSITE_MENU_ENABLED) + always on for
            the sample event. Coexists with PublicEventDayBar until PR11 retires
            the old bars. */}
        {/* The bar renders what the RULES resolved — it settles nothing itself.
            Papic's gate is the host's switch (owner 2026-08-03: "the papic service
            will always run but the host of the event has the power to allow use and
            not allow use"); closed ⇒ DRAWN AND LOCKED, never absent, because the
            camera is part of what the invitation promises. */}
        {menuOn ? (
          <SiteMenuBar
            slots={resolveSiteNav({
              viewer: { kind: 'public' },
              phase: navPhaseOf(dayOfPhase),
              hostAllowsCamera: hostCameraOpen,
              anyChapterPublic: menuSections.gallery,
              hasStory: menuSections.story,
              hasDetails: menuSections.details,
              liveBroadcast: Boolean(plan.liveMediaVisible && watchLive),
              destinations: {
                camera: hostCameraOpen ? '/papic/guest' : null,
                watch: `/${event.slug}/hub`,
                join: `/${event.slug}/invite`,
              },
            })}
          />
        ) : null}
      </>
    );
  };

  /** The guest tree — verbatim the old InvitationSite body. */
  const guestTree = (g: GuestSiteIdentity) => {
    const {
      guest,
      qrSvg,
      invitationUrl,
      guestLiveGallery,
      seatPassActive,
      needsFaceEnroll,
      guestHubData,
      seatMap,
      papicGuest,
      pabati,
      showClaimAccountCta,
      accountlessPhotosClosed,
      eventVendorCredits,
      saveFlash,
      rsvpFlash,
      faceMode,
    } = g;

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

    // Open-browse MENU SHELL (PR6, flag-dark; always on for the sample event).
    // Mirrors anonymousTree, so a guest gets the SAME five-tab structure (§1.1).
    // The markers + the fixed bar render ONLY when the menu is enabled, so a
    // flag-off real event keeps its exact DOM (the PR7 flag-off goldens stay
    // byte-stable). Present-flags gate each middle tab to a section that
    // actually rendered on THIS guest page (no dead anchors — the council rule).
    const menuOn = siteMenuEnabled({
      flag: process.env.NEXT_PUBLIC_WEBSITE_MENU_ENABLED,
      isSample: Boolean(event.is_sample),
    });
    // Same guard as the anonymous tree: the guest's Details/Story anchors are
    // sr-only spans inside the normal body, so they are absent in the phases
    // `phasedBody` does not reach.
    const guestBodyRenders = browsableBodyRenders(plan);
    const menuSections = {
      details: guestBodyRenders && plan.hideableInOrder.length > 0,
      story: guestBodyRenders && Boolean(event.love_story),
      // "Gallery" = the live photo wall (mirrors the LiveWallBlock gate below).
      gallery: isLive && Boolean(liveWall),
    };

    // AFTER-EVENT MEMENTO (design §11). The RSVPed keepsake returns as proof of
    // presence — "YOU WERE THERE" — once the wedding is behind them. Null for
    // every other body, and structurally unreachable for anonymous visitors
    // (this is inside `guestTree`, and the helper denies a non-guest tier
    // anyway). See lib/pahina-memento.ts for the two proof signals.
    const memento = buildAfterEventMemento({
      identityKind: identity.kind,
      body: plan.body,
      rsvpStatus: guest.rsvp_status,
      arrived: guestHubData.arrived,
    });

    return (
      <>
        {/* THE COORDINATOR'S ANNOUNCEMENT — first thing a guest sees during the
            live window, above the couple's own page. Guests only: an
            announcement is for the people in the room, and a stranger with the
            link has no business knowing the ceremony is running late. Null
            outside the live window, so nothing stale survives the day. */}
        {dayOfBroadcast ? <DayOfAnnouncement body={dayOfBroadcast.body} /> : null}
        {/* data-pahina-chapters: the ONE opt-in target for the §6 scroll
            reveal. Deliberately an explicit marker rather than a bare
            `article > *` selector — `article` is used liberally in this tree
            (guest columns, the editorial takeover, the hub), and a broad
            selector would hide THEIR children too, with no observer scoped to
            reveal them. */}
        <article data-pahina-chapters className="space-y-12">
          {/* Menu-shell anchor target (PR6) — top-of-page "Home" landing. Gated
              on menuOn so the flag-off DOM is untouched. */}
          {menuOn ? (
            <div id={SITE_MENU_ANCHORS.home} aria-hidden className="scroll-mt-6" />
          ) : null}
          {/* Open-browse Home spotlight (PR7). Null (byte-inert) unless
              event.website_open_browse is TRUE; identity-aware (guest → RSVP /
              event → Watch Live). */}
          {plan.spotlight ? <SpotlightCard spotlight={plan.spotlight} /> : null}
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
              exhibitions / private weddings drop the hero entirely if needed.
              (plan.body === 'normal' ≡ the old !showEditorialPlaceholder &&
              !showSaveTheDate pair.) */}
          {plan.body === 'normal' && plan.heroShouldRender && hasHeroMedia ? (
            /* Pahina masthead (wave A PR-2) — typographic hero + cover plate
               (STRUCTURAL: was text-over-scrim). HeroMonogram mount unchanged. */
            <PahinaMasthead
              displayName={event.display_name}
              eventDate={event.event_date}
              venueName={event.venue_name}
              monogramSlot={
                <HeroMonogram
                  event={event}
                  monogram={monogram}
                  animatedMonogram={animatedMonogram}
                  bespokeSvg={bespokeSvg}
                  shadow
                />
              }
              mediaSlot={<HeroBackgroundMedia videoUrl={heroVideoUrl} photoUrl={heroPhotoUrl} />}
              mediaCaption={event.venue_name}
            />
          ) : plan.body === 'normal' && plan.heroShouldRender ? (
            <PahinaMasthead
              displayName={event.display_name}
              eventDate={event.event_date}
              venueName={event.venue_name}
              monogramSlot={
                <HeroMonogram
                  event={event}
                  monogram={monogram}
                  animatedMonogram={animatedMonogram}
                  bespokeSvg={bespokeSvg}
                />
              }
            />
          ) : null}

          {/* Increment C (flag-dark): after the wedding, the body below the
              hero is replaced by the editorial stand-in. The hero (above) +
              footer sign-out (below) stay. Bypassed when the flag is off.
              The second argument is the After-Event memento — `null` on every
              body but the editorial one, and never passed by `anonymousTree`. */}
          {phasedBody(() => (
            <>
              {/* Greeting — always-on per the editor contract; gated here so V1.1
                  can decouple if a host wants the wedding page to skip the
                  personalized welcome. */}
              {plan.greetingShouldRender ? (
                /* Pahina §7: the greeting becomes a left-aligned SALUTATION in
                   the display face with the guest's name in gild — the
                   personalization (nobody else in the market has it) is
                   unchanged, only its setting. */
                <section className="space-y-3">
                  <p className="font-pahina text-3xl font-light italic leading-tight text-ink">
                    Hi, <span className="text-gild">{guest.first_name}</span>.
                  </p>
                  <p className="max-w-prose text-base leading-relaxed text-ink/70">
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

              {/* Pahina §7 · functional-color exile STARTS HERE: the day-of
                  promotion used to wrap the whole widget in an app-green box.
                  The emphasis now lives inside the programme rail — the live
                  row carries an accent left rule + veil wash + "Happening now"
                  tag. Same promotion, same gating, no green on a wedding page. */}
              {isLive && scheduleBlocks.length > 0 ? (
                <section aria-label="Day-of schedule">
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
                <>
                  {/* Menu-shell "Gallery" anchor (PR6) — lands on the live wall. */}
                  {menuOn ? (
                    <span id={SITE_MENU_ANCHORS.gallery} aria-hidden className="sr-only" />
                  ) : null}
                  <LiveWallBlock
                    slug={event.slug}
                    initialTiles={liveWall.tiles}
                    initialCount={liveWall.count}
                    initialCaption={liveWall.caption}
                  />
                </>
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
              {/* THE SECTION RENDERS FOR THE WHOLE WINDOW NOW (2026-08-05).
                  It used to be gated on `guestLiveGallery` being truthy, and
                  the loader returned the SAME null for "nobody has tagged you
                  yet" and "the read broke" — so a guest photographed all
                  evening opened her page and found no "Photos of you" area at
                  all. Not an empty one, not an error: nothing, where it should
                  have been. She has no way to tell whether the photographers
                  missed her or the page did.

                  An empty list is now a real result and null means only that
                  the read failed, so the three states can finally be told
                  apart. */}
              {isLive || isPost ? (
                <section
                  aria-label="Photos of you"
                  className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
                      {isLive ? (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
                      ) : null}
                      Photos of you{isLive ? ' — so far' : ''}
                    </p>
                    <p className="text-sm text-ink/70">
                      {(guestLiveGallery?.total ?? 0).toLocaleString()}
                      {isLive ? ' so far' : ''}
                    </p>
                  </div>
                  {/* Post-event grace (Invite/Join v2): a no-login guest can still save
                      their photos for ~24h after the wedding, then it closes — an
                      account keeps them forever. The claim-account box already sits near
                      the top of the page for accountless viewers. */}
                  {isPost && showClaimAccountCta ? (
                    <p className="mt-3 rounded-lg border-l-2 border-gild bg-veil/60 px-3 py-2 text-sm text-ink/80">
                      These close about a day after the wedding. Save the ones you want now —
                      or make a free account (the box near the top) to keep them forever.
                    </p>
                  ) : null}
                  {/* 3-up (not 4-up) so the photos — and the readable "Not me" control —
                      are big enough for an older guest (Guest Legibility Floor). */}
                  {!guestLiveGallery ? (
                    // The read failed. Say so — and say whose fault it is.
                    <p className="mt-4 rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm text-ink/70">
                      We couldn&rsquo;t load your photos just now. Nothing is lost — pull
                      down to refresh in a moment.
                    </p>
                  ) : guestLiveGallery.photos.length === 0 ? (
                    // Genuinely none yet. The commonest state early in a day, and
                    // the one a guest most needs reassurance about.
                    <p className="mt-4 rounded-lg border border-ink/10 bg-white px-3 py-3 text-sm text-ink/70">
                      {isLive
                        ? 'No one has tagged you yet — your photos appear here as they’re taken.'
                        : 'No photos of you were tagged at this celebration.'}
                    </p>
                  ) : null}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(guestLiveGallery?.photos ?? []).map((p) => (
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
                  {guestLiveGallery && guestLiveGallery.photos.length > 0 ? (
                    <p className="mt-3 text-sm text-ink/70">
                      {isLive
                        ? 'More arrive as the day unfolds — and every photo of you is yours to keep after the celebration.'
                        : 'Tap any photo to open it full size and save it.'}{' '}
                      Tap <span className="font-medium">Not me</span> on any photo that isn&rsquo;t you.
                    </p>
                  ) : null}
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
              {plan.qrCardShouldRender ? (
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
                  below is the runtime enforcement point.

                  RSVPed FORK (design §11 · build plan §4): once THIS guest has
                  replied "attending", the ask stops shouting and the keepsake
                  ticket takes its place. This is a per-GUEST render fork inside
                  the existing `rsvp` phase — NOT a new LifecyclePhase, and
                  `plan.rsvpShouldRender` (the golden-locked plan) is untouched.
                  Anonymous visitors have no guest identity, so the fork is
                  structurally unreachable for them.

                  ⚠ The design says the ask is "gone" once answered. Taken
                  literally that would DROP the guest's ability to change their
                  reply, meal preference or dietary notes — a functional
                  regression the reskin-never-drop rule forbids. So the form
                  stays, demoted into a quiet disclosure beneath the keepsake:
                  the ask no longer competes with the reward, but nothing the
                  guest could do before is lost. */}
              {plan.rsvpShouldRender ? (
                guest.rsvp_status === 'attending' || guest.rsvp_status === 'declined' ? (
                  <>
                    {guest.rsvp_status === 'attending' ? (
                      <PahinaKeepsake
                        variant="accepted"
                        displayName={guestHubData.displayName}
                        guestId={guest.guest_id}
                        tableLabel={guestHubData.tableLabel}
                        venueName={event.venue_name}
                        eventDate={event.event_date}
                      />
                    ) : (
                      /* Declined: a quiet line, never a keepsake — the ticket is
                         for people who are coming (design §11). */
                      <section className="border-l-2 border-ink/25 bg-paper-deep px-5 py-4">
                        <p className="font-pahina text-xl font-light italic leading-snug text-ink/80">
                          We&rsquo;ll miss you.
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink/60">
                          Thank you for letting us know.
                        </p>
                      </section>
                    )}
                    <details className="group">
                      <summary className="cursor-pointer list-none font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/50 hover:text-ink/70">
                        Need to change your reply?
                      </summary>
                      <div className="mt-4">
                        <RsvpWidget
                          guest={guest}
                          eventId={event.event_id}
                          eventPublicId={event.public_id}
                          limited={isLimitedPlusOne}
                          faceMode={faceMode}
                          flash={rsvpFlash}
                        />
                      </div>
                    </details>
                  </>
                ) : (
                  /* pending + maybe: the ask stays exactly as it is. "Maybe"
                     deliberately keeps the full card visible (design §11) — an
                     undecided guest still has a question to answer. */
                  <RsvpWidget
                    guest={guest}
                    eventId={event.event_id}
                    eventPublicId={event.public_id}
                    limited={isLimitedPlusOne}
                    faceMode={faceMode}
                    flash={rsvpFlash}
                  />
                )
              ) : null}

              {guest.photo_source === 'selfie' ? (
                <FaceDataNotice eventId={event.event_id} guestId={guest.guest_id} />
              ) : null}

              {/* Hideable widgets render here in display_order. The host
                  controls visibility + order via the widget editor at
                  /dashboard/[eventId]/website/widgets — invitation_widgets
                  table column display_order governs the order; is_visible
                  governs which widgets render at all. */}
              {/* Menu-shell "Details" anchor (PR6) — the couple's detail widgets
                  (schedule · dress code · FAQ · registry · …). Present only when
                  at least one such widget rendered, matching menuSections.details. */}
              {menuOn && plan.hideableInOrder.length > 0 ? (
                <span id={SITE_MENU_ANCHORS.details} aria-hidden className="sr-only" />
              ) : null}
              {plan.hideableInOrder.map((widget) => (
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
                <section className="rounded-xl border-l-2 border-ink/30 bg-paper-deep p-5 text-sm text-ink/75">
                  You&rsquo;re joining as a +1. Photos taken of you will appear in your inviter&rsquo;s
                  gallery — ask them to share. In-app features like Shutter
                  require a full Setnayan account, which the couple hasn&rsquo;t enabled for +1s on
                  this wedding.
                </section>
              ) : null}

              {/* Our Story — the couple's love story on the run-up paths (rsvp/event).
                  The normal body only renders pre-event (STD + editorial are separate
                  branches), so this naturally stays off the post-event Editorial. */}
              {/* Menu-shell "Story" anchor (PR6) — present only when a love story
                  exists (OurStory renders nothing otherwise), matching
                  menuSections.story. */}
              {menuOn && event.love_story ? (
                <span id={SITE_MENU_ANCHORS.story} aria-hidden className="sr-only" />
              ) : null}
              <OurStory loveStory={event.love_story} variant="full" />
              {/* Guest Columns (BUILD ① · GUEST_COLUMNS_ENABLED, default OFF) — the
                  guest's one column for the couple's paper + the approved columns.
                  Guest-session tree only (cookie holders); flag off → renders null. */}
              <GuestColumnCard eventId={event.event_id} guestId={guest.guest_id} eventDate={event.event_date} />
            </>
          ), memento ? (
            /* Design §11, After Event column: the reply-card ticket returns as
               the memento — the stamp reads "You were there", and its copy
               points the guest at the gallery on this same page. Same component,
               same stock, same Nº as the ticket they screenshotted while the
               wedding was still ahead of them; only `variant` differs. */
            <PahinaKeepsake
              variant={memento.variant}
              displayName={guestHubData.displayName}
              guestId={guest.guest_id}
              tableLabel={guestHubData.tableLabel}
              venueName={event.venue_name}
              eventDate={event.event_date}
            />
          ) : null)}

          {/* Menu-shell "Me" anchor (PR6) — used to be an EMPTY div, so a guest
              who tapped Me scrolled to nothing and the real affordance (their
              personal QR) sat on the GuestHubBar that was covering the menu.
              PR11: GuestHubBar renders the real `#site-me` section under the
              same `menuOn` condition, so this marker would now be a second
              element with the same id — and the first one wins. Removed. */}
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
        {/* Open-browse menu shell (PR6) — fixed bottom tab bar of in-page
            anchors, SAME structure as anonymousTree. Flag-dark
            (NEXT_PUBLIC_WEBSITE_MENU_ENABLED) + always on for the sample event.
            Coexists with the GuestHubBar (page.tsx) until PR11 retires the old
            bars. */}
        {/* Same resolver, guest viewer. The camera destination keeps the shipped
            precedence — a guest's OWN roll first, then the couple's shared camera,
            the same order GuestHubBar already uses; neither open ⇒ the resolver
            LOCKS the slot rather than hiding it. */}
        {menuOn ? (
          <SiteMenuBar
            slots={resolveSiteNav({
              viewer: { kind: 'guest' },
              phase: navPhaseOf(dayOfPhase),
              // `papicGuest` is the guest's own roll (an object), not a flag —
              // coerce it, or the resolver receives a truthy non-boolean.
              hostAllowsCamera: Boolean(papicGuest) || hostCameraOpen,
              anyChapterPublic: menuSections.gallery,
              hasStory: menuSections.story,
              hasDetails: menuSections.details,
              liveBroadcast: Boolean(plan.liveMediaVisible && watchLive),
              destinations: {
                camera: papicGuest
                  ? `/papic/me/${guest.qr_token}`
                  : hostCameraOpen
                    ? '/papic/guest'
                    : null,
                watch: `/${event.slug}/hub`,
                join: `/${event.slug}/invite`,
              },
            })}
          />
        ) : null}
      </>
    );
  };

  return (
    <InvitationShell
      monogramText={event.monogram_text}
      artDirection={event.site_art_direction ?? null}
      backdrop={backdrop}
      rolePalette={event.role_palette}
      fullBleed={plan.fullBleed}
      hideWatermark={proWatermarkHidden}
      customColorVars={siteColorVars}
    >
      <GuestPreload eventSlug={event.slug} />
      {/* OWNER LAYER · surface 1 — mounted HERE, as a sibling ABOVE both
          identity trees, for three reasons: (1) it is chrome, not a chapter,
          so it must not be a direct child of `<article data-pahina-chapters>`
          where the §6 scroll observer would keep it hidden until scrolled to;
          (2) one mount point serves the guest tree, the anonymous tree and
          every lifecycle phase (including the full-bleed Save-the-Date film);
          (3) it renders `null` for a null model, so a guest's DOM is unchanged
          byte-for-byte. */}
      <OwnerRibbon model={ownerRibbon} />
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
          aboveMenuBar={siteMenuEnabled({
            flag: process.env.NEXT_PUBLIC_WEBSITE_MENU_ENABLED,
            isSample: Boolean(event.is_sample),
          })}
        />
      )}
      {plan.stdViewBeacon ? <StdViewBeacon slug={event.slug} /> : null}
      <RevealOverlayServer
        enabled={plan.revealEnabled}
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
      {plan.backgroundMusic && bgMusicUrl ? <BackgroundMusic src={bgMusicUrl} /> : null}
      {/* THE SUPPLIER DOORWAY. Rendered here, above the tier fork, because a
          booked supplier can arrive as EITHER tier — as a guest if the couple
          also invited them, or anonymously with just the link. Gating it inside
          one tree would hide it from the other half of real suppliers.
          `vendorCapability` is null for everyone else, so nothing renders. */}
      {vendorCapability ? <VendorDoorway capability={vendorCapability} /> : null}
      {identity.kind === 'anonymous' ? anonymousTree(identity) : guestTree(identity)}
      {/* Unified Website Editor (PR-1) — the click-to-edit bridge for the
          editor's preview iframe. `editorMode` is TRUE only for a verified host
          who passed `?editor=1`; for every guest/anonymous visitor this renders
          nothing, so their HTML is byte-identical to before. */}
      {editorMode ? <EditorBridge /> : null}
    </InvitationShell>
  );
}
