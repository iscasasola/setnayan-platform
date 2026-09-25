import { Fragment } from 'react';
import Link from 'next/link';
import { resolveArrivalAction, PASS_ANCHOR } from '@/lib/arrival-action';
import { guestPassFacts } from '@/lib/guest-pass';
import { manilaToday } from '@/lib/std-views';
import { ArrivalActionRow } from './arrival-action';
import { MapPin } from 'lucide-react';
import { resolveDayOfLead } from '@/lib/day-of-lead';
import { hasVenueContent } from '@/lib/website-section-content';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { formatEventDate } from '@/lib/events';
import type { ChapterOnThisDay } from '@/lib/chapters-on-this-day';
// The event hub's sanctioned column widths — a page-level column outside the
// four is a defect, and `measures.test.ts` counts them.
import { PLATE } from '../_lib/measures';
import { ROLE_LABELS } from '@/lib/guests';
import { resolveMonogram, type MonogramConfig } from '@/lib/monogram';
import { PapicGuestCapture } from '@/app/papic/guest/_components/papic-guest-capture';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import type { StudioAnim } from '@/app/_components/studio-reveal-player';
import { type MonogramMotionKey } from '@/lib/monogram-motion';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  claimAccountAction,
  saveAttendedVendorAction,
} from '../actions';
import { GuestCodeKeepers } from './guest-code-keepers';
import { ScheduleWidget } from './schedule-widget';
import { TeaCeremonyCard } from './tea-ceremony-card';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { formatBlockTimeRange, type ScheduleBlockRow } from '@/lib/schedule';
import { GuestGuidedTour } from '@/app/_components/guest-guided-tour';
import { type DayOfPhase } from '@/lib/day-of-mode';
import { isGuestNowTriggerEnabled } from '@/lib/guest-now-trigger';
import { GuestPreload } from './guest-preload';
import { PublicEventDayBar } from './public-event-day-bar';
import { SiteMenuBar } from './site-menu-bar';
import { EventWordsProvider } from './event-words-provider';
import { eventWordsFor } from '../_lib/event-words';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { resolveProfile } from '@/lib/event-type-profile';
import {
  resolveSiteNav,
  navPhaseFor,
  resolveGuestDoorways,
  showBroadcastNotice,
  type DoorwayFacts,
} from '../_lib/site-nav';
import { GuestDoorwayStrip } from './guest-doorway-strip';
import { EverythingElseSheet } from './everything-else-sheet';
import { resolveEverythingElseRows } from '../_lib/everything-else-rows';
import { loadEditorialData } from './editorial/data';
import { editorialPhotoBlocks, editorialShowsPhotos } from './editorial/gallery-anchor';
import { siteMenuEnabled, browsableBodyRenders, SITE_MENU_ANCHORS } from '../_lib/site-menu';
import { invitationCard, mastheadEyebrow } from '../_lib/invitation-card';
import { belongsToThisEvent } from '../_lib/belongs-to-this-event';
import { redactStoryLayers } from '@/lib/the-guests-layer-is-theirs-until-you-publish';
import { VendorDoorway } from './vendor-doorway';
import { SupplierRibbon } from './supplier-ribbon';
import type { SupplierDeskModel } from '../_lib/supplier-desk.server';
import { StdFilmHandoff } from './std-film-handoff';
import { StdViewBeacon } from './std-view-beacon';
import { BackgroundMusic } from './background-music';
import { EditorialContent } from './editorial/editorial-content';
import { SaveTheDateView } from './save-the-date';
import { type StdLockup } from './save-the-date-film';
import { RevealOverlayServer } from './reveal/reveal-overlay-server';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { revealMaterialsFor } from '@/lib/reveal-materials';
import {
  coerceRevealTemplate,
  revealMarkSvg,
  revealMonogram,
  revealSealConfig,
  revealVeilColor,
  revealWaxColor,
} from '../_lib/reveal-props';
import { resolveRevealEffects } from '@/lib/std-reveal-effects';
import { type StdBackground } from '@/lib/std-backgrounds';
import { defaultInvitationLaunchIso } from '@/lib/save-the-date-content';
import { OurStory } from './our-story';

/* The dayOfPhase → NavPhase mapping moved into `_lib/site-nav.ts` as
   `navPhaseFor`, because it needed a SECOND input (whether the page is showing
   the post-event recap) and because the rule it encodes is a nav ruling, not a
   layout detail — it belongs beside the rules it feeds and under their test.
   See that function's docblock for what the old one-input version got wrong. */

import { GuestColumnCard } from './guest-column-card';
import { resolveHubTheme } from '../_lib/hub-look';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { stdAccentFromPalette, paletteSwatches } from '@/lib/site-palette';
import { RED_GOLD_PALETTE } from '@/lib/feel-palettes';
import { fallbackSeedFromPublicId } from '@/lib/wax-seal/types';
import { LiveWallBlock } from './live-wall-block';
import { SongRequestCard } from './song-request-card';
import { songRequestCardShows, type SongRequestDoor } from '@/lib/guest-song-request-rule';
import { PhotosOfYouGallery } from './photos-of-you-gallery';
import { GuestHubCard } from './guest-hub-card';
import { YourSeatBlock } from './your-seat-block';
import {
  type InvitationWidgetRow,
  type LifecyclePhase,
} from '@/lib/invitation-widgets';
import { resolveSiteBodyPlan } from '@/lib/site-body-plan';
import { revealOnlyOnTheFirstPage } from '@/lib/reveal-stages';
import { guestListIsClosed } from '@/lib/guest-list-closed';
import { buildOwnerRibbon } from '@/lib/owner-ribbon';
import { buildAfterEventMemento } from '@/lib/pahina-memento';
import { OwnerRibbon } from './owner-ribbon';
import { viewerIsEventHost } from '../_lib/site-identity';
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
import { ScanTrailNotice } from './scan-trail-notice';
import { HeroBackgroundMedia } from './hero-background-media';
import { hubCanvasMediaRefs } from '@/lib/hub-canvas';
import { loveStoryMediaRefs, loveStoryScenes } from '@/lib/love-story-moments';
import { customSectionHasContent, isCustomSectionType } from '@/lib/custom-sections';
import { sanitizeMagicTraveller } from '@/lib/magic-move';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { HideableWidgetRender } from './hideable-widget-render';
import { InvitationShell } from './invitation-shell';
import { PublicHideableWidget } from './public-hideable-widget';
import { HubScenes } from './hub-scenes';
import { RsvpWidget } from './rsvp-widget';
import { RsvpSheet } from './rsvp-sheet';
import { rsvpSheetHeading, rsvpSheetTrigger } from './rsvp-sheet-state';
import { PahinaKeepsake } from './pahina-keepsake';
import { WatchLiveBlock } from './watch-live-block';
import { SpotlightCard } from './spotlight-card';
import {
  SectionEmptyPlate,
  FindModeCard,
  PublicEventDetails,
} from './empty-states';
import { EditorBridge } from './editor-bridge';
import { EDITOR_CANVAS_HIDES_APP_CHROME } from '../_lib/editor-canvas';
import { PahinaMasthead } from './pahina-masthead';
import { EntourageSection } from './entourage-section';
import { KeepOnHomeScreen } from './keep-on-home-screen';
import type { EntourageGroup } from '@/lib/entourage';
import { LIVE_WALL_UNREADABLE_LINE } from '@/lib/live-wall-read-state';

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
  /**
   * LAU-33 · TRUE when the wall read was attempted and failed. Distinct from
   * `liveWall == null`, which also means "not owned" and "mirror off" — those
   * three were one value, so a failure rendered as a setting.
   */
  liveWallUnreadable?: boolean;
  /** Panood Watch-Live — non-null only during the live window when a watch URL is staged (single-cam Panood live is free for every host). */
  watchLive?: WatchLiveData | null;
  /** Has the couple staged a broadcast worth ANNOUNCING before the day? The
   *  player above is live-window-only; this is the one fact the "we'll be
   *  streaming" notice needs, and the loader reads it in every phase that
   *  notice can appear in. */
  broadcastPlanned?: boolean;
  /** Facts for the two non-slot guest doorways (the 3D room · the money gift),
   *  each read the way the DESTINATION reads it. Absent → both doors stay shut,
   *  which is the honest default for a caller that did not resolve them. */
  doorwayFacts?: DoorwayFacts | null;
  /** Paid COUPLE_WEBSITE_PRO perk — drop the "Powered by Setnayan" footer
   *  watermark when the event owns the active upgrade. Resolved once at the
   *  top-level page (eventCoupleWebsiteProActive). */
  proWatermarkHidden: boolean;
  /** 🖼 THE MAKER'S CANVAS — TRUE only when the page resolved `?editor=1` AND
   *  server-verified host membership (page.tsx). Two jobs, both one-way:
   *  it mounts the click-to-edit bridge, and it HIDES every piece of app and
   *  host chrome so the canvas is only the page (owner 2026-09-25: *"editing
   *  should only be the page"*) — see `the-maker-canvas-is-only-the-page.test.ts`.
   *  FALSE for every guest/anonymous visitor (and absent → false), so their
   *  HTML is unchanged byte-for-byte. It never reveals anything. */
  isEditorCanvas?: boolean;
  /** The click-to-edit bridge — the Maker's iframe (`?editor=1`) only, never
   *  the "Preview the whole stage" tab. Implies `isEditorCanvas`. */
  editorBridge?: boolean;
  /** 🖼 The Maker's "Guest bars" switch (owner 2026-09-25: *"add a switch to
   *  show or hide"*). In the canvas, TRUE brings back the GUEST header and the
   *  guest tab bar so the couple can check nothing sits under them. Host chrome
   *  (the Host controls bar, "Manage", the Live hub pill) never returns. Inert
   *  outside the canvas. */
  canvasGuestBars?: boolean;
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
  /** Stories about THIS day, for the people of this day. Empty for anybody the
   *  event does not recognise — the page never decides that itself. */
  chaptersOnThisDay?: ChapterOnThisDay[];
  /** The entourage, already grouped and ordered by `lib/entourage.ts`. */
  entourage?: EntourageGroup[];
  vendorCapability?: VendorCapability | null;
  /** THE SUPPLIER'S DESK — built only on the day, only for a booked supplier,
   *  and only from reads made under that supplier's OWN session. Null on every
   *  other day and for everybody else, in which case the doorway stays the
   *  link-out it has always been. Resolved on the page, never here: this
   *  component takes an admin client and must not become the thing that reads a
   *  celebration's private cues with it. */
  supplierDesk?: SupplierDeskModel | null;
  /** Whether a booked act can read song requests on this event (and whether
   *  they have paused). Loaded only for this event's own guest in the live
   *  window; null everywhere else, which renders no card. See
   *  lib/guest-song-request.ts. */
  songRequestDoor?: SongRequestDoor;
};

export async function SiteBody({
  event,
  identity,
  monogram,
  animatedMonogram,
  studioAnim,
  bespokeSvg,
  dayOfPhase,
  hostCameraOpen = false,
  songRequestDoor = null,
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
  liveWallUnreadable = false,
  watchLive,
  broadcastPlanned = false,
  doorwayFacts = null,
  proWatermarkHidden,
  isEditorCanvas = false,
  editorBridge = false,
  canvasGuestBars = false,
  ownerCapability = null,
  vendorCapability = null,
  supplierDesk = null,
  chaptersOnThisDay = [],
  entourage = [],
}: SiteBodyProps) {
  // 🎨 SECTION BACKGROUNDS — signed ONCE for the whole page.
  // Every arranged section's `config_json.canvas.media` is an `r2://` ref, held
  // to the public bucket by `siteMediaServeRef` on the way in. They are
  // collected, deduped and signed in a single parallel pass here and handed to
  // both widget dispatchers. A frame that signed its own would make one AWS
  // round trip per section — the failure `displayUrlForStoredAsset` warns list
  // surfaces about by name.
  // ⛔ A ref that fails to sign is simply ABSENT from this map, and the frame
  // then draws the section with no background rather than an empty dark plate
  // waiting for a picture that is not coming.
  //
  // 🪤 LINE COMMENTS, NOT A BLOCK COMMENT, AND THAT IS NOT A STYLE CHOICE.
  // This sits immediately after the function's opening brace. A block comment
  // in that position is byte-identical to the opening of a JSX comment, and
  // `the-wake-never-celebrates.test.ts` strips those with a regex that then
  // runs on to the next closer anywhere in the file. Measured 2026-09-23: it
  // swallowed 7,500 characters of real code, including the tone literals on
  // line 873, and the guard reported that this file had "lost the celebratory
  // arm" — true of what it could see, false of the file.
  //
  // ⚠ The first fix said so IN A BLOCK COMMENT and reproduced the bug, because
  // writing the offending two-character pair is enough to trip the same regex.
  // Hence the prose: never open a brace body with a block comment here, and
  // never spell the sequence out when explaining why.
  /* ✈ MAGIC MOVE — READ ONCE, HERE, FOR BOTH ENDS.
     The shell owns the berth in the sticky header; `EditorialContent` owns the
     mark that flies into it, and the two are hundreds of lines apart in this
     one function. Two separate reads of one column is two chances for one end
     to be armed and the other not — and both failures are quiet: a traveller
     with no berth gives up and writes a console line, a berth with no traveller
     is a gap in the header nobody can explain.
     🪤 IT ALSO HAS TO BE DECLARED ABOVE ITS FIRST USE, not beside the shell it
     reads most obviously for. `const` is not hoisted, and the editorial call
     sits ~1,500 lines earlier — a declaration next to `<InvitationShell>` looks
     right and throws a ReferenceError on every render.
     ⛔ Sanitized, never repaired: a value this product did not write came from
     somewhere else, and a guess at what it meant would put motion on a wedding
     page nobody asked for. Cast inline like `site_font_key` — the PostgREST row
     type does not declare the column. */
  const magicTraveller = sanitizeMagicTraveller(
    (event as { site_magic_traveller?: unknown }).site_magic_traveller,
  );
  // The Love Story's photos (Event Hub Pro) ride the SAME one signing pass as
  // the section backgrounds — one Promise.all per page, one allow-list.
  const canvasMediaRefs = [
    ...new Set([...hubCanvasMediaRefs(widgets), ...loveStoryMediaRefs(event.love_story)]),
  ];
  const canvasMediaUrls: Record<string, string> = {};
  if (canvasMediaRefs.length > 0) {
    await Promise.all(
      canvasMediaRefs.map(async (ref) => {
        // 🔒 HELD AT THE SIGNER TOO, not only on the way in. `hubMediaRef`
        // already refused everything but the public bucket when the ref was
        // stored, and `every-render-read-is-pinned.test.ts` requires the check
        // to be visible HERE as well — because the next person to add a call
        // beside this one will copy what they see, and a stored value can
        // always predate a rule. One allow-list, asked twice.
        // (Line comments for the same reason given above: this opens a brace
        //  body, where a block comment is indistinguishable from a JSX one.)
        const url = await displayUrlForStoredAsset(siteMediaServeRef(ref));
        if (url) canvasMediaUrls[ref] = url;
      }),
    );
  }

  // 🔤 The live theme, for the scenes' readable ink over their own grounds
  // (free — `lib/scene-legibility.ts`). Its one I/O, the Pro gate, is
  // `cache()`d, so the shell's own call further down costs nothing extra.
  const sceneTheme = (await resolveHubTheme(event)).theme;

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

  /**
   * Is the viewer a verified HOST of this event?
   *
   * 🔴 WHY THE BODY NEEDS TO KNOW. A signed-in couple with no guest cookie —
   * the ordinary case, since hosts are never sent an invitation QR — falls
   * through `if (!session) return renderAnonymous(...)` in page.tsx and gets
   * the STRANGER'S body: "This is a Setnayan invitation page. Scan your
   * personal QR or open the link the couple sent you." That sentence is
   * addressed to the couple, about their own wedding, telling them to go and
   * find a link they are the ones who send. The read-only ribbon sat on top of
   * it saying "your event", so the page contradicted itself.
   *
   * ⚖ READ-ONLY STAYS READ-ONLY. This changes only what the host is TOLD. Every
   * real control (guest list, seating, budget, schedule, vendors) stays in
   * /dashboard/[eventId] and nothing here links anywhere the ribbon does not
   * already link. It is the same server-verified capability the ribbon uses —
   * no new gate. The rule now lives in ONE place — `viewerIsEventHost` in
   * _lib/site-identity.ts, shared with `buildOwnerRibbon` — rather than being
   * restated here, which is how the ribbon and the body would drift apart.
   * (Still NOT derived from `ownerRibbon !== null`: that is also null for a
   * missing slug, which would silently drop the body variant.)
   */
  const viewerIsHost = viewerIsEventHost(ownerCapability, event.event_id);

  // 🖼 The guest's own bars (header + tab bar): everywhere but the Maker's
  // canvas, and in the canvas only when its "Guest bars" switch is on. In the
  // canvas they are drawn as a GUEST sees them — the host's "Manage" slot is
  // editor noise, not something a guest could ever sit under.
  const showGuestBars = !isEditorCanvas || canvasGuestBars;

  // 🧭 THE NAVIGATOR'S HANDLES — in the Maker's canvas only. A hidden, empty
  // marker sits immediately BEFORE each section the navigator lists
  // (`lib/maker-scene-list.ts` keys: `f:hero`, `w:<widget_type>`, …), so the
  // bridge can scroll to a section and tell the Maker which one was tapped
  // without any section growing editor attributes. `hidden` keeps it out of
  // the `space-y` rhythm and out of layout; for every guest it is not rendered.
  const makerMark = (key: string) =>
    isEditorCanvas && editorBridge ? <span hidden data-maker-section={key} /> : null;

  /*
    WHO IS ASKING — resolved ONCE, here, from the same facts this page already
    established for its lock screen and its ribbon.

    ⚠ IT USED TO BE BUILT AT THE `<EditorialContent>` CALL, AND ONE READER GOT
    THERE FIRST. The gallery-anchor probe below asks the story loader how many
    photos an edition has, ~120 lines earlier, and that answer decides whether a
    **Gallery tab appears in the menu** — so a stranger before publish was told
    the guests had been shooting by a tab that only exists when they have. The
    photos were correctly withheld and the SHAPE of them was not, which is the
    exact finding this build closes. One viewer, resolved before its first
    reader, is what stops a second reader appearing above the definition again.
  */
  const storyViewer = {
    isHost: viewerIsHost,
    // ⚖ THROUGH THE ONE SHARED RULE (`_lib/belongs-to-this-event.ts`), because
    // the print keepsake at /{slug}/print asks the same question and once
    // answered it with a hardcoded `true`.
    belongsToEvent: belongsToThisEvent({
      holdsGuestPass: identity.kind === 'guest',
      isBookedSupplier: vendorCapability !== null,
    }),
  };

  // Open-browse PR7 — per-widget content presence for the shared hasContent()
  // predicate. Only consulted when `event.website_open_browse` is TRUE; a
  // widget the couple kept visible but that has no content this event is
  // dropped from the widened list so the menu never points at an empty
  // section. Unmapped types fail OPEN (assumed present). Byte-inert on the
  // flag-off path (resolveSiteBodyPlan ignores `content` when openBrowse=false).
  const openBrowseContent = {
    schedule: scheduleBlocks.length > 0,
    venue_map: hasVenueContent(event),
    our_love_story: loveStoryScenes(event.love_story).length > 0,
    our_photos: ourPhotoUrls.length > 0,
    special_message: Boolean(event.special_message),
    what_to_bring: Boolean(event.what_to_bring),
    countdown: Boolean(event.event_date),
    // The couple's own sections: their words are on their own rows, not on the
    // event. A slot that exists but is empty is dropped from the widened list;
    // one that was never added contributes no key, and `hasContent` fails open.
    ...Object.fromEntries(
      widgets
        .filter((w) => isCustomSectionType(w.widget_type))
        .map((w) => [w.widget_type, customSectionHasContent(w.config_json)]),
    ),
  };

  // THE phase spine — computed once, consumed by every gate below. See
  // lib/site-body-plan.ts for the verbatim old-condition mapping. `openBrowse`
  // (DEFAULT FALSE per-event) flips phases from gates to emphasis; when FALSE
  // the plan is byte-identical to the pre-PR7 computation (golden-locked).
  // The event type's own word for whoever is throwing it, resolved ONCE on the
  // server and handed to the client half through the provider below. Wedding →
  // 'the couple', so every sentence downstream is byte-identical for a wedding.
  const clientWords = await eventWordsFor(event.event_type);
  // 🎴 The invitation card's words (canvas "1 · Arrival"), resolved once for
  // both the stranger's and the guest's first screen. Null for the solemn
  // register, which keeps its quiet masthead. See _lib/invitation-card.ts.
  const inviteCard = invitationCard({
    words: clientWords,
    firstStartAt: scheduleBlocks[0]?.start_at ?? null,
  });
  // Which wedding-only parts this event TYPE may show. The words half of the
  // owner's ruling is done; this is the other half — a seven-year-old does not
  // need a neutrally-worded love story, he needs no love story.
  const weddingOnly = resolveWeddingOnlyParts(
    await resolveProfile(event.event_type ?? 'wedding'),
  );

  const plan = resolveSiteBodyPlan({
    weddingOnlyParts: weddingOnly,
    // 🎭 Where the couple has the reveal play (2026-09-25 · lib/reveal-stages.ts).
    revealStages: event.reveal_stages,
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
    // Is the invitation still open? The couple's guest-list deadline decides
    // (owner 2026-08-20). Read, never written — a public page load must not
    // stamp anything, so this asks the DEADLINE rather than waiting for the
    // lazy finalize write on the couple's own roster.
    guestListClosed: guestListIsClosed({
      lockedAt: event.guest_count_locked_at,
      editDeadline: event.guest_list_edit_deadline,
      eventDate: event.event_date,
    }),
    content: openBrowseContent,
  });

  // ── THE GALLERY, AFTER THE WEDDING ────────────────────────────────────────
  //
  // On the day the Gallery tab lands on the Live Photo Wall. The wall is a
  // live-window surface and the guest's own "photos of you" strip closes with
  // the post-event grace — so a week later neither exists, and the tab used to
  // simply stop coming back. What DOES exist by then is the recap, and the
  // recap is where the photographs are.
  //
  // 🔑 THE TAB IS DRAWN ONLY IF THE RECAP ACTUALLY DREW PHOTOGRAPHS. A recap
  // with prose and no pictures is an ordinary outcome (nothing uploaded, no
  // Papic captures, or the couple switched the photo blocks off), and pointing
  // a tab at it would both dead-end the tap and ANNOUNCE that pictures exist —
  // the exact thing the resolver's rule 3 says never to do.
  //
  // The recap answers for itself: same loader, same pure block resolver the
  // recap uses to decide what to render, memoised per request so asking costs
  // nothing. Best-effort — the recap's own contract is that it never throws,
  // and a failed read here must cost a tab, never the page.
  const recapBody = plan.body === 'editorial';
  let recapHasPhotos = false;
  if (recapBody) {
    try {
      // Redacted with the SAME viewer the story itself is rendered for: this
      // probe counts photo blocks, and a count of a layer is the layer.
      const recap = redactStoryLayers(
        await loadEditorialData(event.event_id),
        storyViewer,
      );
      recapHasPhotos = recap
        ? editorialShowsPhotos(
            editorialPhotoBlocks({
              sections: recap.sections,
              dayChapters: recap.dayChapters.length,
              essayPhotos: recap.essayPhotos.length,
              galleryPhotos: recap.galleryPhotos.length,
              photoWallActive: recap.photoWallActive,
              photoWallPhotos: recap.photoWallPhotos.length,
            }),
          )
        : false;
    } catch {
      recapHasPhotos = false;
    }
  }
  // The id the recap stamps on its first photo block. Null unless the bar is
  // there to aim at it, so a menu-less page keeps its markup unchanged.
  const recapGalleryAnchorId =
    recapHasPhotos &&
    siteMenuEnabled({
      flag: process.env.NEXT_PUBLIC_WEBSITE_MENU_ENABLED,
      isSample: Boolean(event.is_sample),
    })
      ? SITE_MENU_ANCHORS.gallery
      : null;
  /** Which moment the bar is in. Both trees resolve it from the same pair. */
  const navPhase = navPhaseFor({ dayOfPhase, isRecapBody: recapBody });

  // ── THE DOORWAY STRIP — resolved ONCE, above the identity fork. ────────────
  //
  // Two finished guest pages and one sentence about the broadcast, all three of
  // which belong to the invited cousin AND the cookie-less relative who opened
  // a shared link. Resolving them here rather than inside a tree is what makes
  // "both tiers get the same answer" a fact rather than a promise — the only
  // thing that differs is the personal token, which is what makes the 3D room
  // light up THIS guest's seat instead of an anonymised one.
  //
  // Every rule lives in `_lib/site-nav.ts`; nothing is decided here.
  const guestToken = identity.kind === 'guest' ? identity.guest.qr_token : null;

  /* ── ONE ACTION UNDER THE MARK, AND ITS LABEL IS THE STATUS (arrival design
     slice 2 · lib/arrival-action.ts). Null for an anonymous reader, who keeps
     the page's existing public call to action.

     🕐 Manila decides the day. `manilaToday()` formats now in Asia/Manila;
     `new Date('YYYY-MM-DD')` would be midnight UTC — the previous day here —
     and would flip the day-of branch eight hours early. */
  const arrivalAction =
    identity.kind === 'guest'
      ? resolveArrivalAction({
          slug: event.slug ?? '',
          rsvpStatus: identity.guest.rsvp_status,
          eventDate: event.event_date,
          today: manilaToday(),
          hasPass: Boolean(guestToken),
        })
      : null;
  const doorways = doorwayFacts
    ? resolveGuestDoorways({ slug: event.slug, guestToken, ...doorwayFacts })
    : { venueWalk: null, pabuya: null };
  // Is the real player already on this page? The player follows the broadcast,
  // not the calendar (owner-ruled 2026-09-02) — both trees mount it whenever the
  // links resolve, regardless of dayOfPhase — so one expression covers both.
  const broadcastNotice = showBroadcastNotice({
    broadcastPlanned,
    liveMediaVisible: plan.liveMediaVisible,
    dayOfPhase,
    playerOnPage: plan.liveMediaVisible && Boolean(watchLive),
    // `inactive` is BOTH "months before" and "the week after" — see the note on
    // the field. Without the date this notice comes back after the wedding.
    eventDate: event.event_date,
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
        {makerMark('f:editorial')}
        <EditorialContent
          eventId={event.event_id}
          galleryAnchorId={recapGalleryAnchorId}
          /*
            WHO IS ASKING — resolved ONCE here, from the same three facts this
            page already established for its lock screen and its ribbon, rather
            than re-derived inside the story where it could disagree with them.
            "The people of this celebration" is exactly who the page already
            recognises: a host, a guest with a seat or a redeemed invitation, and
            a supplier who worked the day.
          */
          viewer={storyViewer}
          /* ✈ The other end of the same column the shell reads above. */
          magicTraveller={magicTraveller}
        />
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
      <>
        {makerMark('f:film')}
        <StdFilmHandoff film={stdFilmView()}>{normalBody()}</StdFilmHandoff>
      </>
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
      // 🔴 THE OWNER SAW THIS ONE: a Story tab on a seven-year-old's birthday.
      // The love story is wedding-by-nature — it asks how the two of them met,
      // and a type with no two people has no answer.
      story:
        weddingOnly.love_story &&
        bodyRenders &&
        (plan.openBrowse || Boolean(event.love_story)),
      // "Gallery" = the live photo wall ON THE DAY (the livestream is a separate
      // concern) and the recap's own photo run AFTER it. Two different sections
      // in two different phases, one tab — which is what a guest coming back the
      // week after is looking for.
      gallery:
        dayOfPhase === 'live'
          ? plan.liveMediaVisible && Boolean(liveWall)
          : recapHasPhotos,
    };
    // The public widget nodes, factored so both the flag-off and open-browse
    // Details branches render the identical set (no duplication).
    // 🎬 Scroll · Scrub per section — the same scenes as the guest tree, so a
    // stranger following the link sees the page the couple arranged.
    const publicWidgetNodes = (
      <HubScenes widgets={plan.publicSafeWidgets} scrubAllowed={proWatermarkHidden}>
      {plan.publicSafeWidgets.map((widget) => (
      /* One node per widget still (HubScenes pairs by position): the marker
         and the section travel together in one fragment. */
      <Fragment key={widget.widget_id}>
      {makerMark(`w:${widget.widget_type}`)}
      <PublicHideableWidget
        widget={widget}
        canvasMediaUrls={canvasMediaUrls}
        hubTheme={sceneTheme}
        event={event}
        words={clientWords}
        scheduleBlocks={scheduleBlocks}
        isLive={dayOfPhase === 'live'}
        scheduleEstimated={
          isGuestNowTriggerEnabled() &&
          (dayOfPhase === 'pre' || dayOfPhase === 'inactive')
        }
        ourPhotoUrls={ourPhotoUrls}
      />
      </Fragment>
      ))}
      </HubScenes>
    );
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
          {clientWords.solemn ? 'Thank you for being here' : 'Thank you for celebrating'}
        </p>
      ) : null;

    return (
      <>
        {/* ══ THE PAGE MOVES AS YOU READ IT ══════════════════════════════════
            `data-pahina-chapters` is the §6 scroll choreography's ONE opt-in
            marker (design 2026-07-25; mechanism in `pahina-motion.tsx`, rules in
            globals.css). Each direct child fades up 22px as the reader reaches
            it.

            🔴 WHY THIS IS HERE NOW: the marker existed on the GUEST tree only.
            So a guest opening their personal link got the choreography and the
            page everyone else sees — the anonymous one, which is what a shared
            link, a QR scan and the couple's own preview all render — got none of
            it. Same page, two behaviours, decided by whether the reader happened
            to hold a cookie.

            ⛔ IT WRAPS THE CONTENT, NOT THE CHROME. The fixed `SiteMenuBar`
            below stays OUTSIDE: it is pinned to the viewport, never scrolls into
            view, and an IntersectionObserver that never fires for it would leave
            the whole bottom bar at opacity 0 — the navigation gone, on a page
            that still looked fine above the fold.

            🔒 NO NEW SAFETY TO GET WRONG, deliberately: this adds a marker and
            nothing else, so it inherits `pahina-motion.tsx`'s fail-visible
            contract verbatim — no IntersectionObserver, reduced motion, or the
            2s self-heal each drop `.pahina-js` and every section is instantly
            visible and static. */}
        <article data-pahina-chapters>
        {/* Menu-shell anchor targets (PR6). aria-hidden zero-height markers so
            the fixed SiteMenuBar's in-page links land on the right sections. */}
        <div id={SITE_MENU_ANCHORS.home} aria-hidden className="scroll-mt-6" />
        {/* Open-browse Home spotlight (PR7). Null (byte-inert) unless
            event.website_open_browse is TRUE; identity-aware. */}
        {plan.spotlight ? <SpotlightCard spotlight={plan.spotlight} occasion={clientWords.occasion} /> : null}
        {/* When a hero photo/video is uploaded, render a full-bleed banner
            (normal body only — plan.anonymousHeroBanner). Otherwise fall back
            to the centered text-only treatment inside the normal branch. */}
        {plan.anonymousHeroBanner ? makerMark('f:hero') : null}
        {plan.anonymousHeroBanner ? (
          /* Pahina masthead (wave A PR-2) — typographic hero; the photo/video is
             demoted to the cover plate below the type (STRUCTURAL: was a
             text-over-scrim banner). Monogram mount + personalization unchanged. */
          <PahinaMasthead
            eyebrow={mastheadEyebrow(clientWords)}
            displayName={event.display_name}
            twoPeople={clientWords.twoPeople}
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
              {!hasHeroMedia ? makerMark('f:hero') : null}
              {!hasHeroMedia ? (
                /* Pahina masthead, text-only variant (wave A PR-2). */
                <PahinaMasthead
                  eyebrow={mastheadEyebrow(clientWords)}
                  displayName={event.display_name}
                  card={inviteCard ?? undefined}
                  twoPeople={clientWords.twoPeople}
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
              {viewerIsHost ? (
                /* THE HOST'S OWN PAGE. Wins over every `reason` variant below:
                   a stale or absent guest cookie says nothing about somebody
                   whose host membership the database just confirmed, and the
                   invite-error wording would be actively wrong for them. */
                <p className="mx-auto max-w-prose text-sm text-ink/70">
                  This is your event page — the view your guests get. Invited guests see
                  their own name, seat and RSVP here when they open their personal link.
                </p>
              ) : reason === 'invalid_invite' ? (
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
                  This is a Setnayan invitation page. Scan your personal QR or open the link{' '}
                  {clientWords.theOrganizer} sent you to see your invitation.
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
            {isEditorCanvas ? null : (
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
            )}

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
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/75 shadow-sm hover:border-terracotta hover:text-terracotta-700"
              >
                <MapPin aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Find your seat
              </Link>
            </div>

            {/* Panood Watch-Live — anonymous path FIRST: the remote relatives
                clicking the shared link from Messenger are exactly the cookie-less
                viewers this exists for. Follows the broadcast, not the calendar
                (owner-ruled 2026-09-02): `watchLive` is only ever set when the
                couple's links resolve, so no dayOfPhase gate is needed here. */}
            {plan.liveMediaVisible && watchLive ? (
              <section className="mt-10">
                <WatchLiveBlock watchLive={watchLive} slug={event.slug ?? ''} occasion={clientWords.occasion} />
              </section>
            ) : null}

            {/* Live Photo Wall mirror — anonymous visitors at the venue (master-QR
                scans without a guest cookie) get the live wall too during the
                celebration window. Same screened feed as the projector. The id is the
                anchor the event-day bar's "Photos" button scrolls to (publicAlbumHref
                above) — scroll-margin keeps it clear of the fixed bottom bar. */}
            {/* 🔑 LAU-33 · THE MEASUREMENT REACHES THE RENDER. When the wall read
                was attempted and FAILED, say so. Without this the section simply
                was not there, which is byte-identical to "this couple does not
                own LIVE_WALL" and to "they turned the guest mirror off" — so a
                broken wall looked exactly like a setting, and nobody asked.
                Same anchor id, so the event-day bar's "Photos" button still
                lands somewhere that explains itself. */}
            {dayOfPhase === 'live' && plan.liveMediaVisible && !liveWall && liveWallUnreadable ? (
              <section id="live-photo-wall" className="mt-10 scroll-mt-6">
                <p className="rounded-lg bg-ink/5 px-4 py-3 text-center text-sm text-ink/60">
                  {LIVE_WALL_UNREADABLE_LINE}
                </p>
              </section>
            ) : null}

            {dayOfPhase === 'live' && plan.liveMediaVisible && liveWall ? (
              <section id="live-photo-wall" className="mt-10 scroll-mt-6">
                <span id={SITE_MENU_ANCHORS.gallery} aria-hidden className="sr-only" />
                <LiveWallBlock
                  slug={event.slug}
                  initialTiles={liveWall.tiles}
                  initialCount={liveWall.count}
                  initialCaption={liveWall.caption}
                  initialChallenge={liveWall.challenge}
                  initialChallengeMeasured={liveWall.challengeMeasured}
                  timeZone={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
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
                <div className="sn-hub-cards space-y-4">{publicWidgetNodes}</div>
                {plan.publicSafeWidgets.length === 0 ? (
                  <SectionEmptyPlate kind="details" pastTense={archiveTense} occasion={clientWords.occasion} />
                ) : null}
              </section>
            ) : plan.publicSafeWidgets.length > 0 ? (
              <section id={SITE_MENU_ANCHORS.details} className="mt-12 space-y-8 scroll-mt-6">
                <div className="sn-hub-cards space-y-4">{publicWidgetNodes}</div>
              </section>
            ) : null}

            {/* THE ENTOURAGE — under Details, never a sixth tab (owner ruling
                2026-09-14). Its own anchor so the couple can link straight at
                it; no slot, so `_lib/site-nav.ts`'s five-slot budget is
                untouched. Draws nothing when nobody holds a role. */}
            <EntourageSection groups={entourage} id="site-entourage" previewHref={`/${event.slug}/everyone`} />

            {/* Our Story — the couple's love story on the run-up paths (rsvp/event).
                The normal body only renders pre-event (STD + editorial are separate
                branches), so this naturally stays off the post-event Editorial.
                Under open-browse a teaser plate stands in when there's no story so
                the Story tab never lands on nothing. */}
            <div id={SITE_MENU_ANCHORS.story} className="scroll-mt-6">
              {event.love_story ? (
                <OurStory loveStory={event.love_story} variant="full" />
              ) : plan.openBrowse ? (
                <SectionEmptyPlate kind="story" pastTense={archiveTense} occasion={clientWords.occasion} />
              ) : (
                <OurStory loveStory={event.love_story} variant="full" />
              )}
            </div>
          </>
        ))}
        {/* Me tab — under open-browse a cookie-less visitor gets designed
            find-mode (§1.1); otherwise the account/claim affordance lives in the
            fixed PublicEventDayBar and this marker just gives the tab a landing. */}
        {plan.openBrowse && viewerIsHost ? (
          /* The host half of the Me tab. `FindModeCard` asks "Have an
             invitation?" and offers "Open my invitation" — a dead end for the
             person who ISSUES the invitations, and the tab must still land
             somewhere, so it says what this page is instead of pointing them
             at a door that is not theirs. Copy only; no control moves here. */
          <section id={SITE_MENU_ANCHORS.me} className="mt-12 scroll-mt-6">
            <div className="rounded-2xl border border-ink/10 bg-white/70 px-6 py-8 text-center shadow-sm">
              <p className="font-serif text-lg text-ink">You&rsquo;re the host</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">
                You don&rsquo;t need an invitation to your own {clientWords.occasion}. Guests
                who open their personal link see their greeting, seat and RSVP in this spot.
              </p>
            </div>
          </section>
        ) : plan.openBrowse ? (
          <section id={SITE_MENU_ANCHORS.me} className="mt-12 scroll-mt-6">
            <FindModeCard slug={event.slug} reason={reason} pastTense={archiveTense} occasion={clientWords.occasion} />
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
        </article>
        {menuOn && showGuestBars ? (
          <SiteMenuBar
            slots={resolveSiteNav({
              /*
                🔴 WHO IS ACTUALLY LOOKING — this was the literal `{ kind: 'public' }`.

                The owner opened his own wedding page while signed in and the
                bar's last tab said **"Join"** — a stranger's invitation to add
                themselves to the guest list — while the owner ribbon two
                hundred lines above said "YOUR LIVE SITE". Two mechanisms on one
                screen, at one moment, disagreeing about who the reader is. He
                asked: *"story and join seems incorrect. is that correct?"* It
                was not.

                🔑 AND `resolveSiteNav` HAD THE ANSWER ALL ALONG. It carries a
                whole `isCouple` arm — "Manage", and the camera unconditionally
                because it is their wedding — that NO CALL SITE COULD EVER
                REACH: the only two callers passed these literals. Unreachable
                code that reads as shipped behaviour, which is this page's
                recurring disease in one line.

                ⚠ THE VENDOR ARM IS STILL UNREACHABLE AND I HAVE NOT FAKED IT.
                `{ kind: 'vendor' }` needs `kits`, and nothing on this page
                resolves them — `VendorCapability` carries the booking, not the
                specialisations. Passing `kits: []` would hand every booked
                supplier the label "Tools" on no evidence. A supplier still gets
                the public bar here; that is a known, stated gap, not a silent
                one, and it belongs to the supplier lane.
              */
              viewer: ownerCapability && !isEditorCanvas ? { kind: 'couple' } : { kind: 'public' },
              phase: navPhase,
              hostAllowsCamera: hostCameraOpen,
              anyChapterPublic: menuSections.gallery,
              hasStory: menuSections.story,
              hasDetails: menuSections.details,
              liveBroadcast: Boolean(plan.liveMediaVisible && watchLive),
              destinations: {
                // Carries the event so the guest camera's refusal screen can
                // send an unrecognised visitor BACK TO THIS INVITATION instead
                // of to Setnayan's homepage — which was the only way off it.
                camera: hostCameraOpen ? `/papic/guest?from=${event.slug}` : null,
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
      showClaimAccountCta,
      accountlessPhotosClosed,
      profileDetails,
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

    /*
      ── ON THE DAY, THE INVITATION LEADS WITH THE ROOM (arrival board
         "5 · On the day"). What is happening now, the pass, the camera; the
         planning rows step back behind them.

      🕐 MANILA DECIDES THE DAY, and this is the slice most likely to be wrong
         by eight hours. `manilaToday()` and `event_date` are both Manila-local
         `YYYY-MM-DD` and are compared as STRINGS — `new Date(event_date)` is
         midnight UTC, the previous day here, and would rearrange the page on
         the evening before the wedding.

      🔒 NARROWER THAN `isLive` ON PURPOSE. The live window runs T−12h..T+36h so
         an evening reception is covered; this is the calendar day alone, which
         for a Manila venue sits strictly inside it. That keeps the lead in step
         with the arrival action's "Show your pass", which flips on exactly this
         boundary. See lib/day-of-lead.ts.
    */
    const dayOfLead = resolveDayOfLead({
      eventDate: event.event_date,
      today: manilaToday(),
      rsvpStatus: guest.rsvp_status,
      hasPass: plan.qrCardShouldRender,
      hasSchedule: scheduleBlocks.length > 0,
      hasCamera: Boolean(papicGuest) || needsFaceEnroll,
    });

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
      // "Gallery" = the live photo wall on the day (mirrors the LiveWallBlock
      // gate below), the recap's photo run after it. A guest's own "photos of
      // you" strip is deliberately NOT a third answer: it closes with the
      // post-event grace (~a day after the wedding, by design — an account
      // keeps them forever in the Collection hub), so it cannot be what the tab
      // promises a week later.
      gallery: isLive ? Boolean(liveWall) : recapHasPhotos,
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

    /* ── THE TWO BLOCKS THE DAY REORDERS (arrival board "5 · On the day").
       Each is written ONCE here and mounted in one of two slots below, so the
       reorder is a move rather than a copy: a duplicated block would render
       the QR twice and give the page two elements with one id. */
    /* When the doors open — the FIRST block of the day, not the next one.
       A pass is read on arrival, and "next up" on a card in someone's pocket
       at 9pm would tell them to arrive at the send-off. Formatted in the
       event's own timezone, which the venue's coordinates resolve. */
    const firstScheduleBlock = scheduleBlocks[0] ?? null;
    // 🔴 THE SCHEDULE STORES THE EVENT'S OWN WALL-CLOCK, NOT AN INSTANT.
    // `start_at` for a 1:30 PM arrival is `…T13:30:00+00` — the clock the
    // couple typed, parked in UTC. The programme reads it back with
    // `timeZone: 'UTC'` (`formatBlockTimeRange`, lib/schedule.ts). This line
    // used to format it in Asia/Manila, adding eight hours a second time, and
    // the pass told a real guest to "ARRIVE 9:30 PM" for a 1:30 PM arrival
    // (seen live 2026-09-21 as a test guest on /cale-ice). One formatter, the
    // programme's, so the pass and the run of show can never disagree.
    const firstScheduleTimeLabel = firstScheduleBlock?.start_at
      ? formatBlockTimeRange(firstScheduleBlock.start_at, null) || null
      : null;

    /* The pass's own facts, resolved once so the card and its guard read the
       same list. BOTH are required for the "Bringing" line: `plus_one_allowed`
       is the couple's permission and `plus_one_name` is an actual person. The
       allowance alone is not a companion, and a pass must not announce a seat
       nobody claimed. */
    const passFacts = guestPassFacts({
      displayName: displayNameOf(guest),
      tableLabel: guestHubData.tableLabel,
      arriveLabel: firstScheduleTimeLabel,
      plusOneName: guest.plus_one_allowed ? guest.plus_one_name : null,
    });

    const passCard = plan.qrCardShouldRender ? (
      <section
        id={PASS_ANCHOR}
        data-motion="pass"
        className="mx-auto max-w-md scroll-mt-6 overflow-hidden rounded-2xl border border-ink/10 bg-cream text-center shadow-lg"
      >
        {/* The anchor the arrival action's day-of label points at. A fragment
            link to a missing id fails SILENTLY — the first version of that
            action invented `#your-qr`, which existed nowhere, so "Show your
            pass" scrolled a guest nowhere at the door. Pinned by
            `one-action-says-where-you-stand` (#5783).

            ⚠ THE ANCHOR TRAVELS WITH THE CARD. This card now renders in one of
            two slots — on the day it leads, directly under the programme — so
            the id moves with it and the action's link keeps resolving, to a
            shorter scroll. It renders in exactly ONE slot per render, so there
            is never a second element with this id.

            🎫 IT LOOKS LIKE A PASS NOW (owner 2026-09-21, on this card: "so many
            text. we want the event hub to be minimalist" — canvas "4 · The
            pass"). Gone from the face: the "YOUR INVITATION QR · For tagging &
            pickup" heading, the paragraph about photographers, and the raw
            invitation URL in mono. What is left is what a door reads: whose
            celebration, who you are, where you sit, when to arrive, and one
            large code. Colours are the site palette's (mulberry = the moodboard
            wine), never hard-coded. */}
        <div className="bg-mulberry px-5 py-4 text-left text-cream">
          <p className="font-pahina text-xl leading-tight">{event.display_name}</p>
          {event.event_date ? (
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-cream/80">
              {formatEventDate(event.event_date)}
            </p>
          ) : null}
        </div>
        {/* ── THE FOUR FACTS A DOOR NEEDS (arrival board "4 · the pass").
            🔑 EVERY FACT IS OMITTED WHEN IT DOES NOT EXIST — no "Table TBA".
            A pass that states a table the couple never assigned is worse than
            one that stays quiet: the guest believes it and is moved in front
            of other people. See lib/guest-pass.ts. */}
        {passFacts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 pt-5 text-left">
            {passFacts.map((fact) => (
              <div key={fact.label}>
                <dt className="font-mono text-xs uppercase tracking-[0.18em] text-ink/55">
                  {fact.label}
                </dt>
                <dd className="mt-0.5 text-base font-medium text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {/* The tear line — where a paper pass would be torn at the door. */}
        <div aria-hidden className="mx-5 mt-5 border-t border-dashed border-ink/20" />
        <div
          aria-label={`QR code for ${displayNameOf(guest)}`}
          className="mx-auto mt-5 inline-block rounded-xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-56"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mx-auto mt-3 max-w-prose px-5 text-sm text-ink/60">
          Show this at the door. It finds your table too.
        </p>
        {/* Save it or copy it — the code is drawn as an inline SVG, so a
            long-press offers nothing and a screenshot was the only answer. */}
        <GuestCodeKeepers invitationUrl={invitationUrl} className="mt-4 px-5" />
        {/* 🔑 ONE SEAT LINK (owner 2026-09-21). This card used to carry TWO —
            "Find my table" (the Indoor Blueprint map) and "Your seat pass"
            (this guest's exact seat, the same map, their tablemates and the
            arrival bloom). Both are free now, and the pass does everything the
            map does, so they were two doors to one question. The pass is the
            one: it goes through /seat/claim so the guest-session cookie is set
            before it lands. `seatPassActive` already asks whether this kind of
            event seats people and whether the seating is published, so the
            link never opens a notFound() or an empty plan.
            The Indoor Blueprint map stays reachable from the everything-else
            sheet's own "Find my table" row. */}
        {seatPassActive && guest.qr_token ? (
          <Link
            href={`/${event.slug}/seat/claim?t=${guest.qr_token}`}
            className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-sm font-medium text-ink/75 hover:border-terracotta hover:text-terracotta-700"
          >
            <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Find my seat
          </Link>
        ) : null}
        <div aria-hidden className="h-6" />
      </section>
    ) : null;

    const greetingBlock = plan.greetingShouldRender ? (
      /* Pahina §7: the greeting becomes a left-aligned SALUTATION in
         the display face with the guest's name in gild — the
         personalization (nobody else in the market has it) is
         unchanged, only its setting. */
      <section className="space-y-3">
        <p className="font-pahina text-3xl font-light italic leading-tight text-ink">
          Hi, <span className="text-gild">{guest.first_name}</span>.
        </p>
        <p className="max-w-prose text-base leading-relaxed text-ink/70">
          {clientWords.solemn
            ? 'We hope you can be with us on'
            : 'We’d love to celebrate with you on'}{' '}
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
    ) : null;

    return (
      <>
        {/* THE COORDINATOR'S ANNOUNCEMENT — first thing a guest sees during the
            live window, above the couple's own page. Guests only: an
            announcement is for the people in the room, and a stranger with the
            link has no business knowing the ceremony is running late. Null
            outside the live window, so nothing stale survives the day. */}
        {/* ⛔ THE ANNOUNCEMENT IS NOT MOUNTED HERE ANY MORE (2026-09-22).
            It lived here, and `SiteBody` is rendered by ONE of the guest
            tree's twelve pages — so eleven of them never showed the
            coordinator's words. It now mounts once in `[slug]/layout.tsx`,
            which wraps all twelve. Do NOT re-add it here: two mounts would
            double it on this page, and the layout's copy is the one that
            reaches a guest reading their seat card. */}
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

          {isLive ? (
            <DayOfBanner words={clientWords} kind="live" />
          ) : isPost ? (
            <DayOfBanner words={clientWords} kind="post" />
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
              eyebrow={mastheadEyebrow(clientWords)}
              displayName={event.display_name}
              twoPeople={clientWords.twoPeople}
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
              eyebrow={mastheadEyebrow(clientWords)}
              displayName={event.display_name}
              card={inviteCard ?? undefined}
              twoPeople={clientWords.twoPeople}
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

          <ArrivalActionRow
            action={arrivalAction}
            landed={Boolean(rsvpFlash && rsvpFlash.tone !== 'error')}
          />

          {/* ── THE PAGE OPENS ON THE MARK (owner 2026-09-20).
              Until now an identified guest met a box about THEMSELVES — "Hi
              again, <name>" — and the couple's monogram sat a screen and a half
              below it. The owner, seeing his own invitation: "it starts with
              the logo like when you enter a place you see their logo on their
              building."
              So the hero runs FIRST and everything personal — the spotlight,
              the status card, the home-screen offer, the account prompt — moves
              below it. Nothing here is new or removed; only the order changed.
              A shared phone also stops announcing whose invitation it is before
              it says whose wedding it is.
              Guarded by `the-invitation-opens-on-the-mark.test.ts`. */}
          {plan.spotlight ? <SpotlightCard spotlight={plan.spotlight} occasion={clientWords.occasion} /> : null}
          {/* Guest Hub Card — persistent status summary for identified returning
              guests. Shows RSVP status, seat, meal, and next schedule item at
              a glance on every return visit. Hidden from anonymous visitors
              (this branch only runs when a guest session is present). */}
          <GuestHubCard
            words={clientWords}
            data={guestHubData}
            guestListClosed={plan.guestListClosed}
            detailsCardOnPage={plan.rsvpShouldRender}
          />

          {/* Invite/Join v2 — accountless guest's "claim your account" prompt.
              Per the lifecycle table: RSVP / Event / Editorial only (never Save the
              Date), and only when there's no signed-in account (showClaimAccountCta).
              Posts the email to claimAccountAction → emails a passwordless sign-in
              link that connects this event to a real account. */}
          {/* ── KEEP IT ON YOUR HOME SCREEN (owner 2026-09-20). Sits directly
              above the email sign-in box because they answer the same question
              — "how do I find this again?" — and this is the answer that needs
              no account. It renders nothing on a desktop, and nothing at all
              for a guest already reading inside the installed app. */}
          <KeepOnHomeScreen coupleName={event.display_name ?? 'this celebration'} />
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
              {dayOfLead.greetingStepsBack ? null : greetingBlock}

              {/* Task #13 — day-of-mode promotes the schedule block to the top of
                  the article so a guest at the venue sees "happening now" before
                  scrolling past hero / greeting / QR. The same ScheduleWidget renders
                  in its default position below for non-live phases. */}
              {/* Panood Watch-Live — leads the live page: the loved ones who
                  couldn't fly home open the same link and watch the ceremony.
                  Spec §7.5: remote guests first. Follows the broadcast, not the
                  calendar (owner-ruled 2026-09-02) — `watchLive` is only ever set
                  when the couple's links resolve, so no `isLive` gate here. */}
              {watchLive ? <WatchLiveBlock watchLive={watchLive} slug={event.slug ?? ''} occasion={clientWords.occasion} /> : null}

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
                    eventType={event.event_type}
                  />
                </section>
              ) : null}

              {/* ── THE PASS LEADS (arrival board "5 · On the day"). On the day the
                  QR climbs from far below the vendor pitch to directly under the
                  programme: a guest at a door is holding a phone to be let in,
                  not to read. Withheld from someone who declined — see
                  lib/day-of-lead.ts. Guarded by
                  lib/the-day-rearranges-the-invitation.test.ts. */}
              {dayOfLead.passLeads ? passCard : null}

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
                    timeZone={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
                  />
                </>
              ) : null}

              {/* Ask the band for a song (SUP-52) — the guest's end of the song
                  desk. Live window only, and only when a booked act can READ
                  the requests (the inbox is paid): a card on a band-less night
                  would say "sent" to nobody. */}
              {songRequestCardShows({ isLive, door: songRequestDoor }) ? (
                <SongRequestCard paused={songRequestDoor === 'paused'} />
              ) : null}

              {/* ⛔ NO STATIC "ADD YOUR FACE" CARD ON THE EVENT HUB — owner,
                  2026-09-21: "so many text. we want the event hub to be
                  minimalist" … "should be a pop up on their first click on the
                  camera" … "not a static widget on event hub".
                  The face step now opens INSIDE the camera, once, straight after
                  the guest accepts its terms (papic-guest-capture.tsx), and stays
                  skippable there — biometric consent under RA 10173 must be freely
                  given, so it is never a condition of using the camera. The RSVP
                  sheet's optional selfie is unchanged. Pinned by
                  `the-face-step-waits-for-the-camera.test.ts`. */}

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
                  capApplies={papicGuest.capApplies}
                  poolLow={papicGuest.poolLow}
                  sponsorShare={papicGuest.sponsorShare}
                  eventStyle={papicGuest.eventStyle}
                  faceMode={papicGuest.faceMode}
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
              {/* ── THE SALUTATION, STEPPED BACK (arrival board "5 · On the day").
                  On the day it renders HERE, behind what the guest needs in the
                  room. Off the day it renders in its ordinary place above.
                  One block, two slots — never both. */}
              {dayOfLead.greetingStepsBack ? greetingBlock : null}

              {isLive || isPost ? (
                <PhotosOfYouGallery
                  gallery={guestLiveGallery}
                  eventId={event.event_id}
                  isLive={isLive}
                  isPost={isPost}
                  showClaimAccountCta={showClaimAccountCta}
                  occasion={clientWords.occasion}
                  eventWord={clientWords.eventWord}
                  timeZone={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
                />
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
                    The guest view winds down about a day after the {clientWords.eventWord}. Make a free
                    Setnayan account to keep your invite and your photos — on any device. Use the
                    &ldquo;Keep this on your phone&rdquo; box above to get a sign-in link.
                  </p>
                </section>
              ) : null}

              {/* Invite/Join v2 — "vendors who made this day": the couple's booked
                  marketplace vendors, savable to a guest's OWN account so they carry to
                  the guest's future planning (the growth loop). RSVP / Event / Editorial
                  only (never Save the Date), and only when there are credited vendors. */}
              {/* A solemn event renders no vendor-save pitch: "Loved a vendor?
                  Keep them… when you plan your own celebration" is marketing on
                  a memorial page. The suppliers who served are still reachable
                  through the marketplace; only the pitch is withheld. */}
              {!clientWords.solemn &&
              lifecyclePhase !== 'save_the_date' &&
              eventVendorCredits.length > 0 ? (
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
              {/* The pass in its ordinary place — on the day it leads instead,
                  directly under the programme rail above. */}
              {dayOfLead.passLeads ? null : passCard}

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

                  ── THE REPLY IS A SHEET NOW (canvas board 2, 2026-09-20) ────
                  What stays HERE, in the page's flow, is what a guest READS:
                  the keepsake they earned, or the line that says they were
                  heard, and one quiet control. The FORM moved into
                  `<RsvpSheet>`, rendered further down as a SIBLING of this
                  <article> — it cannot live inside these chapters, because the
                  §6 reveal both transforms and hides them (the whole reason is
                  written out on rsvp-sheet.tsx).

                  The `<details>` drawer this replaces is gone: the sheet IS the
                  disclosure now, and its control carries the same words for the
                  same #4683 reason — a drawer whose label advertises only the
                  reply gives a guest wanting to fix a phone number no reason to
                  open it.

                  ⚠ The design says the ask is "gone" once answered. Taken
                  literally that would DROP the guest's ability to change their
                  reply, meal preference or dietary notes — a functional
                  regression the reskin-never-drop rule forbids. Nothing they
                  could do before is lost; it is one tap away instead of one
                  scroll away. */}
              {plan.rsvpShouldRender ? (
                <section className="space-y-4">
                  {guest.rsvp_status === 'attending' ? (
                    <PahinaKeepsake
                      variant="accepted"
                      displayName={guestHubData.displayName}
                      guestId={guest.guest_id}
                      tableLabel={guestHubData.tableLabel}
                      venueName={event.venue_name}
                      eventDate={event.event_date}
                    />
                  ) : guest.rsvp_status === 'declined' ? (
                    /* Declined: a quiet line, never a keepsake — the ticket is
                       for people who are coming (design §11). */
                    <div className="border-l-2 border-ink/25 bg-paper-deep px-5 py-4">
                      <p className="font-pahina text-xl font-light italic leading-snug text-ink/80">
                        We&rsquo;ll miss you.
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink/60">
                        Thank you for letting us know.
                      </p>
                    </div>
                  ) : null}

                  {/* 🔴 AN "OK" OUTCOME IS SHOWN HERE, WHERE THE GUEST IS. The
                      flash renders at the TOP OF THE FORM, and the form now
                      sits behind a sheet that starts closed — so without this
                      line a guest who had just saved would land on a page that
                      said nothing at all about it. An ERROR outcome reopens the
                      sheet instead (`sheetOpensOnLoad`), because the form is
                      where it is fixed. Every outcome reaches a pixel. */}
                  {rsvpFlash ? (
                    <p
                      role={rsvpFlash.tone === 'error' ? 'alert' : 'status'}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        rsvpFlash.tone === 'error'
                          ? 'border-terracotta/40 bg-terracotta/10 text-terracotta-700'
                          : 'border-success-700/30 bg-success-50 text-success-800'
                      }`}
                    >
                      {rsvpFlash.text}
                    </p>
                  ) : null}

                  {/* THE ONE CONTROL THAT OPENS THE SHEET — and the reason it is
                      a plain fragment link rather than a button: with the bundle
                      dead it scrolls to the panel, which renders as the ordinary
                      section it has always been. Quiet on purpose; the accented
                      control on this screen is the arrival action under the
                      mark, and one accent per screen is the point of that slice. */}
                  <a
                    href="#your-details"
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 border border-ink/20 bg-paper px-4 text-sm text-ink/80 transition-colors hover:border-ink/40 hover:text-ink"
                  >
                    {
                      rsvpSheetTrigger({
                        status: guest.rsvp_status,
                        guestListClosed: plan.guestListClosed,
                      }).label
                    }
                    <span aria-hidden className="shrink-0 text-ink/40">
                      &rarr;
                    </span>
                  </a>
                </section>
              ) : null}

              {guest.photo_source === 'selfie' ? (
                <FaceDataNotice eventId={event.event_id} guestId={guest.guest_id} />
              ) : null}

              {/* The scan-trail switch — UNGATED on purpose. Every recognised
                  guest leaves a scan trail whether or not they ever gave a
                  selfie, so this cannot hide behind the selfie test above.
                  See scan-trail-notice.tsx. */}
              <ScanTrailNotice eventId={event.event_id} guestId={guest.guest_id} />

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
              {/* 🎬 Scroll · Scrub per section (owner 2026-09-24). Byte-identical
                  children unless a section scrubs AND the event owns Event Hub
                  Pro (`proWatermarkHidden` is that read). See hub-scenes.tsx. */}
              <div className="sn-hub-cards space-y-4">
              <HubScenes widgets={plan.hideableInOrder} scrubAllowed={proWatermarkHidden}>
              {plan.hideableInOrder.map((widget) => (
                <HideableWidgetRender
                  key={widget.widget_id}
                  widget={widget}
                  canvasMediaUrls={canvasMediaUrls}
                  hubTheme={sceneTheme}
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
                  words={clientWords}
                />
              ))}
              </HubScenes>
              </div>

              {/* The same entourage, for the guest tree. TWO MOUNTS, ONE
                  SECTION: the anonymous and guest trees are separate subtrees
                  and a single mount above the fork would land outside Details
                  in one of them. `the-entourage-is-mounted-in-both-trees.test.ts`
                  fails if either disappears. */}
              <EntourageSection groups={entourage} id="site-entourage" previewHref={`/${event.slug}/everyone`} />

              {isLimitedPlusOne ? (
                <section className="rounded-xl border-l-2 border-ink/30 bg-paper-deep p-5 text-sm text-ink/75">
                  You&rsquo;re joining as a +1. Photos taken of you will appear in your inviter&rsquo;s
                  gallery — ask them to share. In-app features like Shutter
                  require a full Setnayan account, which {clientWords.theOrganizer} hasn&rsquo;t
                  enabled for +1s on this {clientWords.eventWord}.
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
              <GuestColumnCard
                eventId={event.event_id}
                guestId={guest.guest_id}
                eventDate={event.event_date}
                eventTz={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
                eventEndDate={(event as { event_end_date?: string | null }).event_end_date ?? null}
              />
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
        {/* ── THE REPLY SHEET (canvas board 2 · rsvp-sheet.tsx) ─────────────
            🪤 A SIBLING OF THE ARTICLE, NEVER A CHILD OF IT — measured in a
            browser, not reasoned. The §6 reveal puts a `transform` on every
            direct child of `[data-pahina-chapters]`, and a transform (identity
            included) is the containing block for any `position: fixed`
            descendant. One 812px viewport, same panel:
              · sibling of the article → bottom = 812, flush to the viewport
              · inside the article     → bottom = 853, 41px below the fold
            The bottom 41px of this sheet is its Save button, and nothing throws.
            The full reasoning, including the `opacity: 0` half, is on
            rsvp-sheet.tsx.

            Gated on the SAME `plan.rsvpShouldRender` as the control above, so
            the trigger and its destination can never disagree about existing —
            which is the whole of `the-reply-card-can-be-reached.test.ts`. */}
        {plan.rsvpShouldRender ? (
          <RsvpSheet
            heading={rsvpSheetHeading({
              status: guest.rsvp_status,
              guestListClosed: plan.guestListClosed,
              solemn: clientWords.solemn,
            })}
            privacyLine={`Only ${clientWords.theOrganizer} sees your reply.`}
            flash={rsvpFlash}
          >
            {/* ONE MOUNT, ONE MECHANISM. This used to be two — the ask, and the
                same card again inside the "change your reply" drawer — with
                byte-identical props, which is a drift hazard that only ever
                cost. The sheet serves both readings, so there is now exactly one
                reply card in the guest tree and `<div data-rsvp-form>` is what
                pins it: a condition wrapped around this mount would hide the
                meal, the allergy box and the selfie along with the answer, which
                is the defect `only-the-answer-freezes.test.ts` was written for. */}
            <div data-rsvp-form>
              <RsvpWidget
                words={clientWords}
                guest={guest}
                eventId={event.event_id}
                eventPublicId={event.public_id}
                faceMode={faceMode}
                flash={rsvpFlash}
                replyLocked={plan.guestListClosed}
                profileDetails={profileDetails}
              />
            </div>
          </RsvpSheet>
        ) : null}
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
        {menuOn && showGuestBars ? (
          <SiteMenuBar
            slots={resolveSiteNav({
              viewer: { kind: 'guest' },
              phase: navPhase,
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
                    ? // Same reason as the anonymous tree: carry the event so a
                      // refusal can hand them back their invitation.
                      `/papic/guest?from=${event.slug}`
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

  /*
    THE EVENT HUB'S THEME — the one the couple already chose for their invite
    door (owner 2026-09-22). `resolveHubTheme` owns the gating, so this is the
    only opinion on the page about which theme is live; a Pro theme whose unlock
    lapsed comes back as House here exactly as it does on the door.

    ⚠ ONLY THE THEME'S NAME TRAVELS. The palette, the art direction, the Pro
    colours and face, and the theme's attribute are worn ONCE by
    `[slug]/layout.tsx` for every page of the tree (owner 2026-09-25) — the
    shell needs the name only to leave its paper off a themed ground. The Pro
    gate inside is `cache()`d, so this costs no second order lookup.
  */
  const hubLook = await resolveHubTheme(event);

  return (
    <InvitationShell
      monogramText={event.monogram_text}
      hubTheme={hubLook.theme}
      backdrop={backdrop}
      fullBleed={plan.fullBleed}
      editorCanvas={!showGuestBars}
      hideWatermark={proWatermarkHidden}
      magicTraveller={magicTraveller}
    >
      {/* THE EVENT'S OWN WORDS — mounted once, wrapping every child of the
          shell, which is both identity trees and every lifecycle phase.
          Five surfaces below are client components (the video greeting, the
          selfie capture, the face opt-in, the photo wall, the guest column
          form) and several sit layers under the component that knows the event
          type, so they read the noun from here rather than having one string
          threaded through files with nothing else to do with it.
          ⚠ INSIDE the shell, not outside it, and that is not cosmetic:
          `doorways-before-the-day.test.ts` anchors on the exact text
          `return (\n    <InvitationShell` to prove the doorway strip sits
          outside both trees. Wrapping the shell broke that anchor and the
          guard said so — "the shell return moved, this scan is now blind".
          It was right, so the mount moved rather than its anchor. */}
      <EventWordsProvider words={clientWords}>
      {/* 🖼 The root layout's own floating notices (cookie consent, a stale
          tab) are client components this page cannot un-mount, so in the
          Maker's canvas they are hidden by the one attribute they carry. */}
      {isEditorCanvas ? <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style> : null}
      <GuestPreload eventSlug={event.slug} />
      {/* OWNER LAYER · surface 1 — mounted HERE, as a sibling ABOVE both
          identity trees, for three reasons: (1) it is chrome, not a chapter,
          so it must not be a direct child of `<article data-pahina-chapters>`
          where the §6 scroll observer would keep it hidden until scrolled to;
          (2) one mount point serves the guest tree, the anonymous tree and
          every lifecycle phase (including the full-bleed Save-the-Date film);
          (3) it renders `null` for a null model, so a guest's DOM is unchanged
          byte-for-byte. */}
      {/* 🖼 Never in the Maker's canvas: its "Edit this site" link, tapped
          inside the canvas, loaded the Maker into itself. */}
      <OwnerRibbon model={isEditorCanvas ? null : ownerRibbon} />
      {/* THE SUPPLIER'S RIBBON — mounted here for reason (2) above, and for one
          of its own: in the Save-the-Date phase the film covers the viewport at
          z-50 with the veil at z-60, and the supplier's strip renders in
          ordinary flow underneath both. A booked supplier signing in to check
          the address got a wedding film and no visible way to their call sheet,
          for every one of the ~9 months a booking spends more than 90 days out.
          The design puts the door above the film for exactly this. It renders
          in no other phase: everywhere else the strip below IS the top of the
          page for a supplier. */}
      {vendorCapability && !isEditorCanvas && plan.body === 'save_the_date' ? (
        <SupplierRibbon
          businessName={vendorCapability.businessName}
          when={supplierDesk?.countdown ?? supplierDesk?.eventDateLabel ?? null}
          hasDesk={supplierDesk != null}
        />
      ) : null}
      {/* Share and Report live in a footer at the very END of the page now —
          mounted by page.tsx, after the guest's own section, because this
          component is not the last thing on a guest's page. */}
      {plan.stdViewBeacon ? <StdViewBeacon slug={event.slug} /> : null}
      <RevealOverlayServer
        enabled={plan.revealEnabled}
        monogram={revealMonogram(event.display_name)}
        markSvg={revealMarkSvg(event)}
        waxColor={revealWaxColor(event.role_palette)}
        sealConfig={revealSealConfig(event)}
        sealFallbackSeed={fallbackSeedFromPublicId(event.public_id)}
        veilColor={revealVeilColor(event.role_palette)}
        /* 🎭 THE THEME'S OPENING (Maker Phase 6): the couple's own choice wins
           (incl. "No reveal"); with none, the theme's default opening — the
           invite door already reads it this way — dressed in the theme's
           materials. Pro gating is unchanged: `revealAllowedFor` downstream. */
        eventTemplate={
          coerceRevealTemplate(event.std_reveal_template) ??
          (hubLook.theme === 'house' ? null : coerceRevealTemplate(INVITE_THEMES[hubLook.theme].opening))
        }
        materials={revealMaterialsFor(hubLook.theme)}
        /* The host's own Maker preview plays a drafted opening before Pro is
           bought (try then pay) — the canvas and the ▶ preview tab; a guest render
           is never `isEditorCanvas`. */
        hostTrial={isEditorCanvas}
        /* 🎭 Off the Save the Date the opening belongs to the hero scene — the
           first page — and is gone after it (owner 2026-09-25). */
        firstPageOnly={revealOnlyOnTheFirstPage(lifecyclePhase)}
        eventEffects={resolveRevealEffects(event.std_reveal_effects)}
        eventId={event.event_id}
        /* ONE REVEAL ON THE WAY IN (owner Q6 = B, 2026-09-11). The SECOND half:
           a guest who has just lifted this couple's veil on the invite door does
           not meet it again on this visit. A later visit is a new session and
           plays as usual — and standing aside still starts the Save-the-Date
           film, because a deferred overlay never sets `__stdRevealActive` and
           the film's own 700 ms grace start takes over. See
           lib/reveal-once-per-visit.ts. */
        oncePerVisit="defer"
      />
      {/* Couple's opt-in background-music player — NOT during the Save-the-Date
          phase: the STD film owns audio there, and this floating speaker control
          would otherwise bleed through / over the veil reveal. (owner 2026-06-19)
          ⚠ Since 2026-08-29 the reveal ALSO plays over the invitation, and this
          is deliberately NOT widened to match. That ruling is about the FILM
          owning audio in its own phase, not about the veil: over the invitation
          the veil (z-60) sits above this control (z-50), so it is hidden until
          the veil lifts, and the music never autoplays — it starts only on a
          tap. Suppressing it here would silence a paid Event Hub PRO feature
          for the whole invitation phase to solve a clash that cannot happen. */}
      {/* 🖼 Not in the Maker's canvas — the song is set in the inspector. */}
      {plan.backgroundMusic && bgMusicUrl && !isEditorCanvas ? <BackgroundMusic src={bgMusicUrl} /> : null}
      {/* THE SUPPLIER DOORWAY. Rendered here, above the tier fork, because a
          booked supplier can arrive as EITHER tier — as a guest if the couple
          also invited them, or anonymously with just the link. Gating it inside
          one tree would hide it from the other half of real suppliers.
          `vendorCapability` is null for everyone else, so nothing renders. */}
      {vendorCapability && !isEditorCanvas ? (
        <VendorDoorway
          capability={vendorCapability}
          desk={supplierDesk ?? null}
          words={clientWords}
        />
      ) : null}
      {identity.kind === 'anonymous' ? anonymousTree(identity) : guestTree(identity)}
      {/* THE GUEST DOORWAY STRIP — two finished pages and one sentence about the
          broadcast, on the page every guest already has.

          ── WHY IT IS OUTSIDE BOTH TREES ────────────────────────────────────
          The relative watching from abroad almost always arrives with a SHARED
          link and no cookie, so they render through the anonymous tree; the
          invited cousin renders through the guest tree. All three of these
          belong to both, and gating inside one tree would hide them from half
          the people who need them. Same reasoning as `VendorDoorway`.

          ── WHY BELOW THE BODY AND NOT ABOVE IT ─────────────────────────────
          The supplier doorway sits ABOVE the fork, before the hero, because it
          is addressed to someone who is not a guest and is not here for the
          invitation. These are for guests, and an invitation has to open with
          the invitation — a stack of utility cards before the couple's names
          would be the first thing every visitor saw on every wedding page. At
          the foot they land where a reader has finished the invitation and the
          practical part of the page begins, right where the bottom bar already
          is. They clear the fixed bar: the shell's sign-off footer renders
          below them and is taller than the bar it stands in.

          ⛔ NOT on the full-bleed Save-the-Date film, which owns the whole
          screen. Cards under it would be debris, and the film runs months
          ahead — the seating plan is not published and nothing here is what a
          guest came for at that moment. */}
      {plan.fullBleed || isEditorCanvas ? null : (
        <GuestDoorwayStrip words={clientWords}
          venueWalk={doorways.venueWalk}
          pabuya={doorways.pabuya}
          broadcast={broadcastNotice}
          personalised={identity.kind === 'guest'}
          dateLabel={event.event_date ? formatEventDate(event.event_date) : null}
        />
      )}
      {/* ARRIVAL S6 — "everything else". Same mount reasoning as the doorway
          strip above it (outside both trees, not on the full-bleed STD film):
          every input below is a value this render already resolved for its
          own use, never a new question asked of the database. See
          `_lib/everything-else-rows.ts` for what each row is gated on. */}
      {plan.fullBleed || isEditorCanvas ? null : (
        <EverythingElseSheet
          rows={resolveEverythingElseRows({
            slug: event.slug,
            viewerKind: identity.kind,
            isLive: dayOfPhase === 'live',
            eventDateLabel: event.event_date ? formatEventDate(event.event_date) : '',
            cameraFeatureOn: hostCameraOpen,
            broadcastConfigured: plan.liveMediaVisible && Boolean(watchLive),
            venueWalkHref: doorways.venueWalk,
            /* The album door, resolved ONCE by `resolveAlbumDoor` in
               `_lib/loaders.ts` and carried on the anonymous identity. The rows
               module used to build `/recap` itself, which is a second place
               deciding where the album lives — `the-album-door-is-one-decision`
               caught it. A guest branch with no resolved door passes null, and
               the row falls back to its dated "after" badge instead of a link
               that may not open. */
            keepsakeHref: identity.kind === 'anonymous' ? identity.publicAlbumHref : null,
            recapBodyReady: recapBody,
            recapHasPhotos,
            canShare: resolveEffectiveVisibility(event) === 'public',
          })}
        />
      )}
      {/* STORIES ABOUT THIS DAY — the surface the middle privacy answer needed.
          Owner 2026-08-20: a chapter can be shared with "all in that event
          only", and until now there was nowhere for such a chapter to be read.

          🔒 The page does NOT decide who may see this. `chaptersOnThisDay`
          arrives EMPTY for anybody the event does not recognise, decided in
          page.tsx against the database — host, booked supplier, guest with a
          pass, or a signed-in seat-holder. On a public event a passer-by gets
          an empty array and this renders nothing at all.

          ── WHY OUTSIDE BOTH TIER TREES ─────────────────────────────────────
          Same reason as the supplier doorway and the guest strip: a host and a
          supplier both render through the ANONYMOUS tree (identity comes from a
          guest cookie they do not carry), so gating this inside the guest tree
          would hide it from most of the people it is for. */}
      {chaptersOnThisDay.length > 0 && !isEditorCanvas ? (
        <section className={`mx-auto mt-10 w-full ${PLATE} px-4`}>
          <h2 className="m-serif text-lg text-ink">Stories about this day</h2>
          <p className="mt-1 text-[13px] text-ink/60">
            Written by the people who were here.
          </p>
          <ul className="mt-4 space-y-3">
            {chaptersOnThisDay.map((c) => (
              <li key={c.publicId} className="rounded-tile border border-ink/10 p-3">
                <p className="text-sm font-semibold text-ink">
                  {/* A link ONLY when the chapter's own page would really open —
                      an event-only piece has no public page, and offering one
                      would be a dead end dressed as a story. */}
                  {c.href ? (
                    <a href={c.href} className="hover:underline">
                      {c.title}
                    </a>
                  ) : (
                    c.title
                  )}
                </p>
                <p className="mt-0.5 text-[12px] text-ink/60">
                  by {c.authorName}
                  {c.day ? ` · ${c.day}` : ''}
                  {c.isPublic ? '' : ' · shared with the people of this day'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {/* Unified Website Editor (PR-1) — the click-to-edit bridge for the
          editor's preview iframe. `editorMode` is TRUE only for a verified host
          who passed `?editor=1`; for every guest/anonymous visitor this renders
          nothing, so their HTML is byte-identical to before. */}
      {isEditorCanvas && editorBridge ? <EditorBridge /> : null}
      </EventWordsProvider>
    </InvitationShell>
  );
}
