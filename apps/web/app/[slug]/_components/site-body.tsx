import { Fragment, isValidElement } from 'react';
import Link from 'next/link';
import { watchLiveOccasion } from '@/lib/watch-live-occasion';
import { daysToGo } from '@/lib/countdown-target';
import { actionOpensReply, meLeadsWithReply, REPLY_SHEET_ANCHOR, resolveArrivalAction } from '@/lib/arrival-action';
import { PASS_CARD_ROUTE } from '@/lib/pass-card';
import { manilaToday } from '@/lib/std-views';
import { ArrivalActionRow } from './arrival-action';
import { GuestMeParts, ReplyCardRow } from './guest-me-parts';
import { guestMeFacts, guestMePartsShown, readerIsListed, replyCardOf } from '@/lib/guest-me-parts';
import { readGuestsGetIn } from '@/lib/who-can-reply';
import { MapPin } from 'lucide-react';
import { resolveDayOfLead } from '@/lib/day-of-lead';
import { hasVenueContent } from '@/lib/website-section-content';
import { firstVenue, receptionVenue, venueNamesLine } from '@/lib/event-venues';
import { stdFilmPlaceLine } from '@/lib/venue-disclosure';
import { formatEventDate, formatEventDateWithPrecision } from '@/lib/events';
import type { ChapterOnThisDay } from '@/lib/chapters-on-this-day';
// The event hub's sanctioned column widths — a page-level column outside the
// four is a defect, and `measures.test.ts` counts them.
import { PLATE } from '../_lib/measures';
import { guestRoleLabel, plusOneSeats } from '@/lib/guests';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadEventNameStyle, loadEventRoleNames } from '../_lib/loaders';
import { DEFAULT_NAME_STYLE } from '@/lib/name-style';
import { resolveMonogram, type MonogramConfig } from '@/lib/monogram';
import { PapicGuestCapture } from '@/app/papic/guest/_components/papic-guest-capture';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import type { StudioAnim } from '@/app/_components/studio-reveal-player';
import { type MonogramMotionKey } from '@/lib/monogram-motion';
import { SubmitButton } from '@/app/_components/submit-button';
import { saveAttendedVendorAction, submitRsvp } from '../actions';
import { joinEventAction } from '@/app/join/[eventId]/actions';
import { GuestChecklist } from './guest-checklist';
import { guestChecklistItems } from '../_lib/guest-checklist-facts';
import { ScheduleWidget } from './schedule-widget';
import { TeaCeremonyCard } from './tea-ceremony-card';
import { dressRiteOf, isChineseWedding } from '@/lib/chinese-wedding';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { formatBlockTimeRange, type ScheduleBlockRow } from '@/lib/schedule';
import { GuestGuidedTour } from '@/app/_components/guest-guided-tour';
import { guidedTourView } from '@/app/_components/guided-tour';
import { type DayOfPhase } from '@/lib/day-of-mode';
import { isGuestNowTriggerEnabled } from '@/lib/guest-now-trigger';
import { anyoneMayAskToJoin, guestReplyBy, oneQrLetsYouIn, readRsvpWords, resolveRsvpAsk, todayYmd } from '@/lib/rsvp-ask';
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
import { STAGE_BAR, pageStageFor, makerBarItems } from '../_lib/stage-bar';
import { loadEditorialData } from './editorial/data';
import { editorialPhotoBlocks, editorialShowsPhotos } from './editorial/gallery-anchor';
import {
  POST_EVENT_SUPPLIERS_ANCHOR,
  postEventFilmDrawn,
  postEventSuppliersAnchorKey,
} from './editorial/post-event-bar-facts';
import { resolveSectionOrder, shippedSections } from './editorial/editorial-order';
import { openUpHash } from '@/lib/post-event-scenes';
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
import type { PostEventDraft } from '@/lib/post-event-draft';
import { POST_EVENT_STYLE_HOME } from '@/lib/post-event-styles';
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
import { OurStory, storyTabHasChapter } from './our-story';
import { HubShell } from './hub/hub-shell';
import { DayDirections } from './day-directions';
import {
  HUB_TAB_ATTR,
  activeHubTab,
  directionsLead,
  hubTabFor,
  hubTabHref,
  hubTabsOn,
  inPageTabs,
} from '../_lib/hub-tabs';
import type { NavSlot } from '../_lib/site-nav';
import { SITE_WELCOME_ANCHOR } from '../_lib/site-menu';
import { venueNowMs } from '@/lib/schedule';
import { dayVenuesNow } from '@/lib/day-venue-now';
import { widgetByType, widgetShouldRender } from '@/lib/invitation-widgets';
import { welcomePartsOnTheDay } from '@/lib/invitation-welcome';
import { PUBLIC_WIDGET_ALLOWLIST } from '@/lib/public-widget-allowlist';

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
import { SELFIE_LIFETIME_LINE, SIGN_OUT_ERASES_SELFIE } from '@/lib/face-selfie-lifetime';
import { PhotosOfYouGallery } from './photos-of-you-gallery';
import { YourShotsGallery } from './your-shots-gallery';
import { YourSeatBlock } from './your-seat-block';
import { SeatDoorLine } from './seat-door-line';
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
import { hubCanvasMediaRefs, hubSlotClipStillRefs, sanitizeHubCanvas } from '@/lib/hub-canvas';
import { HUB_ELEMENT_EXCLUDED_WIDGETS, hubElementInlineStyle, hubSceneRunsAttr } from '@/lib/element-style';
import { placeCardName } from '@/lib/formal-name';
import { HubSceneRuns } from './hub-scene-runs';
import { heroDesignOf } from '@/lib/hero-design';
import { heroCanvasOf } from '../_lib/hero-design-of';
import { makerDayPartsOn, makerDrawsEmpty, widgetsGuestsMeet, type MakerDayPartPlace } from '@/lib/maker-scene-list';
import { splitAroundEntourage, stageShowsEntourage } from '@/lib/stage-scenes';
import { sceneBoundTextOf } from '@/lib/details-bound';
import { MakerGuestScenes } from './maker-guest-scenes';
import { GuestWelcome } from './guest-welcome';
import { scenesLeftForDetails, welcomeCarriesGifts, welcomeParts } from '@/lib/invitation-welcome';
import { mainGroundLayerFor } from '../_lib/main-ground-layer';
import { loveStoryMediaRefs, loveStoryScenes } from '@/lib/love-story-moments';
import { customSectionHasContent, isCustomSectionType } from '@/lib/custom-sections';
import { sanitizeMagicTraveller } from '@/lib/magic-move';
import { isOmbreValue } from '@/lib/ombre';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { HideableWidgetRender } from './hideable-widget-render';
import { InvitationShell } from './invitation-shell';
import { PublicHideableWidget } from './public-hideable-widget';
import { HubScenes } from './hub-scenes';
import { RsvpWidget } from './rsvp-widget';
import { sceneStyleOfRow, paletteLookOfRow } from '@/lib/scene-style-of-row';
import type { FixedStyleScene, StyledScene } from '@/lib/fixed-scene-styles';
import { HERO_PART_LOOK, partLookAttr } from '@/lib/scene-styles-parts';
import { fixedSceneStyleOf } from '@/lib/fixed-scene-style-of';
import { LiveHubArrangement } from './live-hub-styles';
import { MakerDayPartStandIn } from './maker-fixed-parts';
import { sceneStylesOn } from '@/lib/scene-styles';
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
import { SampleViewerInert } from './sample-viewer-inert';
import type { SeeAs } from '@/lib/see-as';
import { EDITOR_CANVAS_HIDES_APP_CHROME, canvasOnlyCss, type CanvasOnlyScene, type CanvasStylePreview } from '../_lib/editor-canvas';
import { withStylePreview } from '../_lib/style-preview';
import { PreviewWayBack } from './preview-way-back';
import { PahinaMasthead } from './pahina-masthead';
import { EntourageSection } from './entourage-section';
import { GetInside } from './get-inside';
import { GetTickets } from './get-tickets';
import { askOneAtATime } from '@/lib/rsvp-one-at-a-time';
import { hostPitchShows } from '@/lib/guest-one-path';
import type { EntourageGroup } from '@/lib/entourage';
import { marchPlaceOf } from '@/lib/march-place';
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
  /**
   * 💾 POST EVENT'S DRAFTED SCENES — the host's draft of the story's order,
   * switches and each scene's look (`HubDraft.editorial`), laid over the story
   * ONLY in the host's preview. Null / absent for every guest, so their HTML is
   * unchanged.
   */
  editorialDraft?: PostEventDraft | null;
  /** The click-to-edit bridge — the Maker's iframe (`?editor=1`) only, never
   *  the "Preview the whole stage" tab. Implies `isEditorCanvas`. */
  editorBridge?: boolean;
  /** 🖼 The Maker's "Guest bars" switch (owner 2026-09-25: *"add a switch to
   *  show or hide"*). In the canvas, TRUE brings back the GUEST header and the
   *  guest tab bar so the couple can check nothing sits under them. Host chrome
   *  (the Host controls bar, "Manage", the Live hub pill) never returns. Inert
   *  outside the canvas. */
  canvasGuestBars?: boolean;
  /** 🎟 "Get tickets" — `publicTicketUrl(...)` (lib/ticket-url.ts): the
   *  organizer's own ticket page, or null unless the event is Public. */
  ticketUrl?: string | null;
  /** 🖼 The Maker's made-once Hero page (`?only=hero`) — draw that ONE scene.
   *  Resolved by `canvasOnlyScene`, which is null off the host canvas. */
  canvasOnly?: CanvasOnlyScene | null;
  /** 🖼 A style's true miniature (`?style=<type>:<id>`, `canvasStylePreview`) — the
   *  page drawn with that one scene or part in that style. Null off the host canvas.
   *  Like a theme tile, it never mounts the click-to-edit bridge. */
  stylePreview?: CanvasStylePreview | null;
  /** 🎨 A theme TILE on the Maker's Details page (`canvasTriedTheme`): drawn as
   *  the canvas, but the click-to-edit bridge is NEVER mounted — the tile's
   *  parent is the Maker, which would hear its `ready` / `edit` as the canvas's
   *  (`browsing-themes-never-moves-the-canvas.test.ts`). */
  themeTile?: boolean;
  /** ↩ "Back to the Maker" — the Maker's address, or null. Non-null ONLY for a
   *  verified host's "Preview the whole stage" tab (`previewWayBackHref`,
   *  `_lib/editor-canvas.ts`); null for every guest, the canvas and its tiles. */
  makerWayBack?: string | null;
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
  /**
   * 📱 EACH TAB ITS OWN PAGE (owner 2026-09-30) — the address's `?tab=`, raw.
   * On the Invitation and The Day the page draws every tab's content once and
   * shows this one (`_lib/hub-tabs.ts`); an unknown or absent value is the first
   * tab. Inert on every page that is still one scroll.
   */
  activeTab?: string | null;
  /** 📸 Back from the Papic camera, the shots that landed this visit (`addedShots`), or null. */
  shotsAdded?: number | null;
  /**
   * 👤 THE GUEST'S ME, handed in by page.tsx when the page is tabs — the same
   * section GuestHubBar draws below the page otherwise (`GuestMeSection`). On a
   * tabbed page it is a tab like the others, so it sits INSIDE the page's column
   * rather than under its closing footer. Null everywhere else.
   *
   * ✉ A FUNCTION when page.tsx needs the page's answer to "does Me lead with
   * the reply?" (`meLeadsWithReply`) — the reply sheet's gate is the plan this
   * body resolves, so the body asks once and hands the answer down rather than
   * page.tsx re-deriving the plan.
   */
  meSection?: React.ReactNode | ((me: { replyHref: string | null }) => React.ReactNode);
  /**
   * 👁 SEE AS ▾ (PR-10, owner 2026-10-04) — the Maker's canvas drawn as a SAMPLE
   * viewer (page.tsx `resolveSampleViewer`, verified host + `?editor=1` only):
   * the guest tree for a sample guest who hasn't replied / replied Yes /
   * declined, or the stranger's page with its door for Signed out. Null
   * everywhere else — every real guest's and stranger's bytes are unchanged.
   * While set, `SampleViewerInert` swallows every submit and press, and Me is
   * drawn on the canvas (`meSection`).
   */
  sampleViewer?: SeeAs | null;
  /** 👁 The host's capability for the RIBBON alone while the body is drawn for a See as sample (page.tsx). Null: `ownerCapability`. */
  ribbonCapability?: OwnerCapability | null;
  /**
   * 🧭 THE NEW MAKER'S GUEST SIDE is on for this event (`guestStagesOn`,
   * page.tsx — the Maker's own switch, or an internal host's event). On: the
   * Reply card under the names and at the top of Me, and the four
   * for-each-guest parts on Invitation › Me. Off (every real couple today):
   * the page exactly as it was.
   */
  guestStages?: boolean;
  /** 👤 The named companions on this guest's own seats ("Coming with you") — page.tsx's `yourGuestsFor` read. */
  comingWith?: readonly string[];
};

export async function SiteBody({
  event: eventIn,
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
  widgets: widgetsIn,
  scheduleBlocks,
  backdrop,
  liveWall,
  liveWallUnreadable = false,
  watchLive,
  broadcastPlanned = false,
  doorwayFacts = null,
  proWatermarkHidden,
  isEditorCanvas = false,
  editorialDraft = null,
  editorBridge = false,
  canvasGuestBars = false,
  ticketUrl = null,
  canvasOnly = null,
  stylePreview = null,
  themeTile = false,
  makerWayBack = null,
  ownerCapability = null,
  vendorCapability = null,
  supplierDesk = null,
  chaptersOnThisDay = [],
  entourage = [],
  activeTab = null,
  shotsAdded = null,
  meSection = null,
  sampleViewer = null,
  ribbonCapability = null,
  guestStages = false,
  comingWith = [],
}: SiteBodyProps) {
  /* 🖼 A style's true miniature lays its one style over the rows (`_lib/style-preview.ts`);
     for every guest `stylePreview` is null and both come back exactly as read. */
  const { event, widgets } = withStylePreview(eventIn, widgetsIn, isEditorCanvas ? stylePreview : null);
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
  // 🏷 THE COUPLE'S WORDS FOR ROLES (owner 2026-09-30 — Bridesmaid → "Bride's
  // Crew"). Read once per request (cached loader), graceful: an unreadable
  // value is the usual words. Handed to every widget that names a reader's role.
  const roleNames = await loadEventRoleNames(createAdminClient(), event.event_id);
  // 🔤 THE EVENT'S NAME STYLE (owner 2026-09-30) — the Place card prints the
  // guest's name in it. Read only where a guest's own page is drawn (the one
  // tree with a Place card); graceful: unreadable is Full.
  const eventNameStyle =
    identity.kind === 'anonymous' ? DEFAULT_NAME_STYLE : await loadEventNameStyle(createAdminClient(), event.event_id);
  // ⚙ WHAT DO YOU WANT TO ASK YOUR GUESTS? (owner 2026-09-25, Event Hub Maker
  // Details panel) — read once here for both mounts below (the reply card and
  // the song-request card). An absent key is ON, so an event that never opens
  // the panel renders byte-identically to before this existed.
  const rsvpAsk = resolveRsvpAsk(event.rsvp_ask_config);
  // The Love Story's photos (Event Hub Pro) ride the SAME one signing pass as
  // the section backgrounds — one Promise.all per page, one allow-list.
  const canvasMediaRefs = [
    ...new Set([
      ...hubCanvasMediaRefs(widgets),
      ...loveStoryMediaRefs(event.love_story),
      // 🎞 A template slot's clip that may not play shows the hero photo instead.
      ...hubSlotClipStillRefs(widgets, siteMediaServeRef(event.landing_page_hero_image_url)),
    ]),
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
    // 👁 A See as sample keeps the HOST's ribbon (its Preview ▾ switches back) while the body is drawn as a guest.
    ownerCapability: ribbonCapability ?? ownerCapability,
    eventId: event.event_id,
    slug: event.slug ?? null,
    phasesEnabled,
    // The phase the body is ACTUALLY being built from on this render — the
    // same value `plan` is computed with, so `?phase=` overrides are reflected.
    lifecyclePhase,
    seeAs: sampleViewer,
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

  // 🎞 THE MAIN BACKGROUND (Maker Phase 10) — the hero (or the couple's own
  // clip or photo) laid over the page, on a Pro theme only. Resolved by ONE
  // helper shared with the RSVP page, whose background follows this one (owner
  // 2026-09-28): see `_lib/main-ground-layer.tsx` for the whole rule. The hero
  // row is draft-overlaid for the host's preview like every other canvas.
  const heroRow = widgets.find((w) => w.widget_type === 'hero');
  const mainGroundLayer = await mainGroundLayerFor({
    theme: sceneTheme,
    heroConfig: heroRow?.config_json,
    event,
    viewerIsHost,
    signed: canvasMediaUrls,
    // 🎞 A moving background tried in the draft shows on the host's own canvas (verified host only).
    tryOn: isEditorCanvas,
  });
  // 🖼 The guest's own bars (header + tab bar): everywhere but the Maker's
  // canvas, and in the canvas only when its "Guest bars" switch is on. In the
  // canvas they are drawn as a GUEST sees them — the host's "Manage" slot is
  // editor noise, not something a guest could ever sit under.
  //
  // 🎬 "PREVIEW THE WHOLE STAGE" IS THE WHOLE GUEST EXPERIENCE (owner
  // 2026-09-26, verbatim: *"guest bars should only show on the slide and not
  // the actual whole stage openning. that role is for the preview stage"*).
  // Two host doors, two jobs:
  //   · the Maker's canvas (`?editor=1`, `isMakerCanvas`) is the scenes, one
  //     after another, to edit — no opening, no film takeover; its "Guest
  //     bars" switch frames whichever slide is in view;
  //   · the preview tab (`?preview=draft`, `isStagePreview`) plays the stage as
  //     a guest meets it — opening, film, hand-over and the guest's bars.
  const isMakerCanvas = isEditorCanvas && editorBridge;
  const isStagePreview = isEditorCanvas && !editorBridge;
  const showGuestBars = !isEditorCanvas || canvasGuestBars || isStagePreview;

  // 🧭 THE NAVIGATOR'S HANDLES — in the Maker's canvas only. A hidden, empty
  // marker sits immediately BEFORE each section the navigator lists
  // (`lib/maker-scene-list.ts` keys: `f:hero`, `w:<widget_type>`, …), so the
  // bridge can scroll to a section and tell the Maker which one was tapped
  // without any section growing editor attributes. `hidden` keeps it out of
  // the `space-y` rhythm and out of layout; for every guest it is not rendered.
  const makerMark = (key: string) =>
    isEditorCanvas && editorBridge ? <span hidden data-maker-section={key} /> : null;
  // 🔤 The hero's parts in the couple's own font · colour · size · animation
  // (`lib/element-style.ts`, on the hero row's canvas), and — in the Maker's
  // canvas only — the `data-el` keys that tell the Maker which part was tapped.
  // 🎴 …and which of the four designs arranges them (`lib/hero-design.ts`, on
  // the same canvas) — every masthead mount below spreads this ONE object, so
  // the design and the edits can never reach one mount and not another.
  // 🪞 `heroCanvasOf` is the ONE hero-canvas read the loading screen shares
  // (`_lib/hero-design-of.ts`), so the skeleton loads in this same design.
  const heroCanvas = heroCanvasOf(widgets);
  const heroElements = {
    elements: heroCanvas.elements ?? null,
    stampElements: isMakerCanvas,
    design: heroDesignOf(heroCanvas),
    /* 🎨 The hero parts' own styles — set below, once the page's stage is known. */
    looks: null as Partial<Record<keyof typeof HERO_PART_LOOK, string>> | null,
  };
  /* ✍ Does any scene carry a run (one letter, one word in its own look)? Only
     then is the small script that lays them mounted (`HubSceneRuns`) — the
     same test `HubCanvasFrame` puts the runs on the page by. */
  const sceneRunsOnPage = widgets.some(
    (w) =>
      !HUB_ELEMENT_EXCLUDED_WIDGETS.includes(w.widget_type) &&
      hubSceneRunsAttr(sanitizeHubCanvas(w.config_json).elements) !== null,
  );

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
  // 🏛💒 WHERE, ONCE (2026-09-27 · lib/event-venues.ts). Every line below that
  // names the venue reads it from here, so the greeting, the masthead, the
  // keepsake, the checklist and the calendar cannot name different places. All
  // three read the already-withheld `event` — never an address the viewer may
  // not have yet.
  const venueLine = venueNamesLine(event);
  const firstPlace = firstVenue(event);
  const receptionPlace = receptionVenue(event);
  const openBrowseContent = {
    schedule: scheduleBlocks.length > 0,
    venue_map: hasVenueContent(event),
    our_love_story: loveStoryScenes(event.love_story).length > 0,
    our_photos: ourPhotoUrls.length > 0,
    // 🔗 Bound to Details — a scene's own version counts too (`lib/details-bound.ts`).
    special_message: Boolean(
      sceneBoundTextOf(
        'message',
        widgets.find((w) => w.widget_type === 'special_message')?.config_json,
        event.special_message,
      ).text,
    ),
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
    firstLabel: scheduleBlocks[0]?.label ?? null,
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
    /* 🧾 "TWO WAYS TO CELEBRATE" LEAVES THE INVITATION AND THE DAY (owner
       2026-09-26: *"plan it properly … when linking to an account"* — the pitch
       is REPLACED by the post-RSVP "Save to my account" step). Filtered before
       the plan so every list the plan derives (the scenes, the Details tab's
       presence) agrees. Post Event is untouched.
       🪞 THE MAKER SHOWS WHAT GUESTS SEE (owner review 2026-09-27): its canvas
       and its navigator omit it too, through the ONE rule `widgetsGuestsMeet`. */
    widgets: widgetsGuestsMeet(widgets, lifecyclePhase),
    openBrowse: Boolean(event.website_open_browse),
    // Is the invitation still open? The couple's guest-list deadline decides
    // (owner 2026-08-20). Read, never written — a public page load must not
    // stamp anything, so this asks the DEADLINE rather than waiting for the
    // lazy finalize write on the couple's own roster.
    guestListClosed: guestListIsClosed({
      lockedAt: event.guest_count_locked_at,
    }),
    /* 🧩 In the Maker an EMPTY scene keeps its place (owner 2026-09-27): the
       plan fails open on content there, and the dispatcher draws the scene's
       placeholder (`makerEmpty` below). Guests: unchanged. */
    content: isMakerCanvas ? {} : openBrowseContent,
  });

  // 🎬 THE STAGE'S AUTO — the Save the Date walks itself (film → names →
  // every scene, `lib/stage-autoplay.ts`) for guests and the preview tab, and
  // NEVER in the Maker's canvas, where the couple is editing and a page that
  // scrolled itself away would take the scene out from under them. It stamps
  // the scenes the runner walks (`HubScenes stageMarks`); the runner itself is
  // mounted by `StdFilmHandoff autoplay={!isMakerCanvas}` inside this same
  // `save_the_date` branch — the same condition, so the two cannot disagree.
  const stageAutoplayOn = plan.body === 'save_the_date' && !isMakerCanvas;

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
  /* 📖 THE POST EVENT BAR'S FILM AND SUPPLIERS (owner 2026-09-25, E1) — asked of
     the SAME redacted recap, through the SAME predicates the recap draws those
     scenes with (`post-event-bar-facts.ts`), so neither slot can point at a
     scene the page did not draw. */
  let recapBar = { film: false, suppliers: false };
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
      if (recap) {
        // In the Maker's canvas the bar follows the couple's DRAFT, like the story does.
        const drafted = isEditorCanvas ? editorialDraft : null;
        const barInput = {
          sections: drafted?.sections ?? recap.sections,
          broadcast: Boolean(recap.watchFilmEmbedUrl),
          films: recap.films?.length ?? 0,
          teamVendors: recap.vendors.length,
          vendorMedia: recap.vendorMedia.length,
          vendorsWeLoved: recap.vendorsWeLoved.length,
        };
        recapBar = {
          film: postEventFilmDrawn(barInput),
          suppliers:
            postEventSuppliersAnchorKey(
              barInput,
              shippedSections(resolveSectionOrder(drafted?.sectionOrder !== undefined ? drafted.sectionOrder : recap.sectionOrder)),
            ) !== null,
        };
      }
    } catch {
      recapHasPhotos = false;
      recapBar = { film: false, suppliers: false };
    }
  }
  /** 🎞 The Recap's "Your keepsake reel" door: the album door `resolveAlbumDoor`
   *  already resolved (anonymous identity only), on a composed recap that has
   *  photos, never in the Maker's canvas — the gates the retired "Everything
   *  else" row carried, unchanged. */
  const recapKeepsakeHref =
    recapBody && recapHasPhotos && !isEditorCanvas && identity.kind === 'anonymous' ? identity.publicAlbumHref : null;
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
  // 🧭 The stage this page is showing (a host's `?phase=` preview included) —
  // its Event Bar (`STAGE_BAR`) names the header and filters the tab bar.
  const pageStage = pageStageFor({ phasesEnabled, lifecyclePhase, dayOfPhase });
  /* 🎨 THE FIVE FIXED PARTS' STYLES (owner 2026-09-29) — the couple's pick from
     `events.style_preferences.scene_styles` (the host's canvas: with the draft
     laid on), resolved for this stage by the one registry. No pick = style A,
     the page exactly as before. */
  const fixedStyle = (scene: FixedStyleScene) =>
    fixedSceneStyleOf((event as { style_preferences?: unknown }).style_preferences, scene, pageStage, event.event_type);
  /* 🎨 THE PARTS' OWN STYLES (owner 2026-10-07, `lib/scene-styles-parts.ts`): each picked
     part's `data-part-look`, null for the shipped look — so a page nobody styled is unchanged. */
  const partLook = (type: StyledScene) =>
    partLookAttr(type, fixedSceneStyleOf((event as { style_preferences?: unknown }).style_preferences, type, pageStage, event.event_type));
  {
    const looks: Partial<Record<keyof typeof HERO_PART_LOOK, string>> = {};
    for (const [part, type] of Object.entries(HERO_PART_LOOK) as Array<[keyof typeof HERO_PART_LOOK, StyledScene]>) {
      const v = partLook(type);
      if (v) looks[part] = v;
    }
    heroElements.looks = Object.keys(looks).length > 0 ? looks : null;
  }
  /** E-Gifts and the guest's look on Welcome, and the four for-each-guest parts on Me. */
  const welcomeLooks = { gifts: partLook('gifts'), wear: partLook('my_wear') };
  const meLooks = { role: partLook('my_role'), wear: partLook('my_wear'), arrive: partLook('my_arrive'), guests: partLook('my_guests') };
  const entourageStyle = fixedStyle('entourage');
  const liveHubStyle = fixedStyle('live_hub');
  /** A live hub arranged by the couple (not style A): player and wall drawn together. */
  const liveHubArranged = liveHubStyle === 'theatre' || liveHubStyle === 'wall-first';

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

  /* ── 📱 EACH MENU TAB IS ITS OWN FULL PAGE (owner 2026-09-30, verbatim: *"so
     this is not a 1 page scroll jumping to different marks. this is each menu
     gets their own full page scroll"*). DECISION_LOG "EACH MENU TAB IS ITS OWN
     FULL PAGE", "THE GUEST MENUS, NAMED", "THE DAY'S MENU HAS FIVE".

     On the Invitation (Welcome · Details · Our Love Story · Me) and The Day
     (Live · Welcome · Camera · Gallery · Me) every tab's content is drawn ONCE,
     here, in a group marked `data-hub-tab`; all but the tab in the address are
     `hidden`, and the hub shell's page frame (`hub/hub-shell.tsx`, the day-of
     hub's own shell — never a second one) shows one at a time. Each group asks
     for the tab it belongs to and `hubTabFor` files it on the nearest tab this
     reader's bar HAS, so nothing the long page showed is ever stranded on a tab
     nobody can open. Off these two stages, in the Maker's canvas, or with no
     bar, `group()` returns its content untouched — those pages are
     byte-identical to before. */
  const tabsOn = hubTabsOn({
    stage: pageStage,
    bodyNormal: plan.body === 'normal',
    barDrawn:
      siteMenuEnabled({ flag: process.env.NEXT_PUBLIC_WEBSITE_MENU_ENABLED, isSample: Boolean(event.is_sample) }) &&
      showGuestBars,
    makerCanvas: isMakerCanvas || canvasOnly !== null,
  });
  /** The Day's first tab, or the Invitation's — where the masthead lives. */
  const leadTab = pageStage === 'event' ? 'live' : 'home';
  /** A group with nothing in it draws no box — an empty box would still take
   *  its place in the page's rhythm (a fragment of conditions that all failed). */
  const nothingIn = (node: React.ReactNode): boolean =>
    node === null ||
    node === undefined ||
    node === false ||
    (Array.isArray(node) && node.every(nothingIn)) ||
    (isValidElement(node) && node.type === Fragment && nothingIn((node.props as { children?: React.ReactNode }).children));
  const pageTabsFor = (bar: readonly NavSlot[]) => {
    const inPage = tabsOn ? inPageTabs(bar) : [];
    const on = inPage.length > 0;
    const active = activeHubTab(activeTab, inPage);
    /** One tab's content. `chapters` keeps the §6 scroll reveal on its children
     *  (the group itself is never hidden by it — it IS the page's first screen
     *  whenever it is shown). */
    const group = (
      want: string,
      node: React.ReactNode,
      opts: { chapters?: boolean; className?: string; id?: string } = {},
    ) => {
      if (!on || nothingIn(node)) return on ? null : node;
      const tab = hubTabFor(want, inPage);
      return (
        <div
          id={opts.id}
          {...{ [HUB_TAB_ATTR]: tab }}
          hidden={tab !== active ? true : undefined}
          {...(opts.chapters ? { 'data-pahina-first-screen': '', 'data-pahina-chapters': '' } : {})}
          className={`${opts.className ?? ''} empty:hidden`.trim()}
        >
          {node}
        </div>
      );
    };
    /** The same marks, for a block that draws its own root (a component
     *  outside both trees). Empty on a page that is one scroll. */
    const attrs = (want: string): { [HUB_TAB_ATTR]?: string; hidden?: boolean } => {
      if (!on) return {};
      const tab = hubTabFor(want, inPage);
      return { [HUB_TAB_ATTR]: tab, ...(tab !== active ? { hidden: true } : {}) };
    };
    return { on, active, group, attrs, bar };
  };
  /* The tabs the tree below resolved for its reader — set by whichever tree
     renders (they are evaluated in JSX order, before the blocks after them that
     read it: the doorway strip, the stories). */
  let pageTabs = pageTabsFor([]);
  /* 🧭 THE DAY'S WELCOME reads the couple's scenes whatever the day's own list
     says (`welcomePartsOnTheDay`): the dress code and the reminders are made on
     the Invitation, and a guest on the day still dresses by one and reads the
     other. Switched off by the couple → not shown. */
  const dayWelcomeFacts = {
    bodyNormal: plan.body === 'normal' && pageStage === 'event',
    dressCodeOn: widgetShouldRender(widgetByType(widgets, 'dress_code')),
    remindersOn: widgetShouldRender(widgetByType(widgets, 'what_to_bring')),
    reminders: event.what_to_bring,
    giftHref: doorways.pabuya,
    maker: isMakerCanvas,
  };
  const dayRemindersRow = widgetShouldRender(widgetByType(widgets, 'what_to_bring'))
    ? widgetByType(widgets, 'what_to_bring')
    : null;
  /* 🗺 THE DAY'S LIVE LEADS WITH DIRECTIONS until the programme begins
     (`directionsLead`). Only venues this reader may see — `event.venues` is
     already withheld per viewer by page.tsx. */
  const eventTzForDay = eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude);
  /* 🗺 ONE PLACE, NOT TWO (owner 2026-10-01: *"directions to the location/venue
     where things are happening is only 1 of 2"*). The ceremony venue until the
     ceremony is over, then the reception — `lib/day-venue-now.ts`, the one rule
     the Live directions, the Welcome venue and the day's venue scene ask. */
  const dayVenues = dayVenuesNow({ venues: event.venues, blocks: scheduleBlocks, nowMs: venueNowMs(eventTzForDay) });
  const directionsOnTop =
    pageStage === 'event' &&
    dayOfPhase === 'live' &&
    dayVenues.length > 0 &&
    directionsLead({ firstStartAt: scheduleBlocks[0]?.start_at ?? null, venueNowMs: venueNowMs(eventTzForDay) });

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
          /* 📖 Post Event's scene markers — the Maker's canvas only, the same
             gate as `makerMark` above; every guest's HTML is unchanged. */
          makerMarkers={Boolean(isEditorCanvas && editorBridge)}
          /* 💾 The host's drafted scenes — never a guest's (null for them) —
             and 🕰 the couple's own preview, where a scene with nothing yet
             says what fills it. Both false for every guest. */
          draft={isEditorCanvas ? editorialDraft : null}
          hostPreview={isEditorCanvas}
          /* 🎨 ONE VALUE ACROSS STAGES — the Schedule and Gallery scenes wear the
             style picked on the section of the same name (`POST_EVENT_STYLE_HOME`),
             read off the rows this page already holds (the host's draft laid
             over them in the Maker, live for everyone else). */
          sharedStyles={Object.fromEntries(
            Object.values(POST_EVENT_STYLE_HOME).map((t) => [
              t,
              sanitizeHubCanvas(widgets.find((w) => w.widget_type === t)?.config_json).style ?? null,
            ]),
          )}
        />
        {/* 🎞 "YOUR KEEPSAKE REEL" IN THE RECAP (owner 2026-10-04, DECISION_LOG
            "STORY-TAB PLACEMENT CORRECTED AND APPROVED") — it was a row of the
            retired "Everything else" sheet; now one quiet line under the story.
            Gated exactly as before: the album door resolved ONCE by
            `resolveAlbumDoor` (anonymous identity only — the guest tree has no
            resolved door), a composed recap that really has photos, and never
            in the Maker's canvas. */}
        {recapKeepsakeHref ? (
          <p className="mx-auto mt-8 w-full max-w-3xl px-4 text-center" data-recap-keepsake="">
            <Link
              href={recapKeepsakeHref}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] text-ink underline-offset-4 hover:underline"
            >
              Your keepsake reel
              <span aria-hidden>→</span>
            </Link>
          </p>
        ) : null}
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
      /* 🧭 The film's handle rides INSIDE the handoff, immediately before the
         film itself — outside it, the marker's next element was the page
         column, so the navigator's film tile pointed at the names below.
         🖼 In the Maker's canvas the film is one SLIDE in the stage's order
         (film → names → …), never the full-screen takeover: the takeover, the
         opening and the hand-over belong to "Preview the whole stage". */
      <StdFilmHandoff
        film={stdFilmView()}
        marker={makerMark('f:film')}
        asSlide={isMakerCanvas}
        autoplay={!isMakerCanvas}
      >
        {normalBody()}
      </StdFilmHandoff>
    ) : (
      normalBody()
    );

  /** The Save-the-Date view, factored so the open-browse and flag-off branches
   *  above render the IDENTICAL film rather than two drifting copies. */
  const stdFilmView = () => (
      <SaveTheDateView
        displayName={event.display_name}
        dateIso={event.event_date}
        venueName={firstPlace ? firstPlace.name : event.venue_name}
        venueAddress={firstPlace ? firstPlace.address : event.venue_address}
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
        receptionCity={stdFilmPlaceLine(stdVenues?.receptionCity, event)}
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
        // 🖼 The Maker's canvas draws the film as a slide in place — muted,
        // no opening to wait for, no full screen.
        slide={isMakerCanvas}
      />
  );

  /** The anonymous tree — verbatim the old PublicLanding body. */
  const anonymousTree = (anon: AnonymousSiteIdentity) => {
    const { reason, publicCandidCameraActive, publicAlbumHref } = anon;
    /* 🔒 TWO LEVELS OF ACCESS (owner 2026-09-26, "THE GENERAL LINK IS GENERIC;
       THE KEY OR SIGN-IN IS PERSONAL"): *"if just the event link will be
       generic and no access to the announcements, and other info"*. This tree
       is the page for everyone WITHOUT a key, so the inside of the event — the
       camera, the photo wall, the seat finder — is not rendered for them at all.
       Decided HERE, on the server; nothing is drawn and then hidden. The couple
       (their own page) and a booked supplier (working the day) keep it. */
    const insideAllowed = viewerIsHost || vendorCapability !== null;
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
    /* 🏠 THE WELCOME PAGE, for a stranger and for the Maker's canvas (owner
       2026-09-30 — `lib/invitation-welcome.ts`). A stranger has no look to be
       shown (no role), so they meet Reminders and E-Gifts; the canvas draws
       every place so the couple can fill it, in the order the navigator lists. */
    const welcome = welcomeParts({
      stage: pageStage,
      bodyNormal: plan.body === 'normal',
      scenes: plan.publicSafeWidgets.map((w) => w.widget_type),
      identified: false,
      reminders: event.what_to_bring,
      giftHref: doorways.pabuya,
      // 👁 See as › Signed out: the stranger's Welcome, not the canvas's every place.
      maker: isMakerCanvas && sampleViewer === null,
      // 🗂 "Accept gifts? — No" (Your info): the canvas draws no gift place either.
      giftsOff: event.gifts_on === false,
    });
    const detailsScenes = scenesLeftForDetails(plan.publicSafeWidgets, welcome);
    // 📱 On a tabbed page the "Our love story" scene is Our Love Story's page,
    // not a Details section (owner 2026-09-30: each tab its own page). One
    // scene, one tab: it moves, it is never drawn twice.
    const storyScene = tabsOn ? (detailsScenes.find((w) => w.widget_type === 'our_love_story') ?? null) : null;
    const detailsSceneList = storyScene ? detailsScenes.filter((w) => w !== storyScene) : detailsScenes;
    // 📖 THE LOVE STORY ONCE (guest text audit 2026-09-30): the "Our love story"
    // scene and the prose `OurStory` below both drew it, so a guest read the
    // couple's story twice in a row. When the scene is on the page, it IS the
    // story; the prose stands in only when it is not.
    const storySceneShown = detailsScenes.some((w) => w.widget_type === 'our_love_story');
    const remindersScene = welcome.includes('reminders')
      ? (plan.publicSafeWidgets.find((w) => w.widget_type === 'what_to_bring') ?? null)
      : null;
    const menuSections = {
      details: bodyRenders && (plan.openBrowse || detailsSceneList.length > 0),
      // 🔴 THE OWNER SAW THIS ONE: a Story tab on a seven-year-old's birthday.
      // The love story is wedding-by-nature — it asks how the two of them met,
      // and a type with no two people has no answer.
      // 📖 …and only once there is a chapter to land on (`storyTabHasChapter`):
      // open-browse no longer draws it empty — `{}` read as a story.
      story:
        weddingOnly.love_story &&
        bodyRenders &&
        storyTabHasChapter(event.love_story, storySceneShown),
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
    const sceneNodes = (list: typeof detailsScenes) => (
      <HubScenes widgets={list} scrubAllowed={proWatermarkHidden} stageMarks={stageAutoplayOn}>
      {list.map((widget) => (
      /* One node per widget still (HubScenes pairs by position): the marker
         and the section travel together in one fragment. */
      <Fragment key={widget.widget_id}>
      {makerMark(`w:${widget.widget_type}`)}
      <PublicHideableWidget
        widget={widget}
        stage={pageStage}
        canvasMediaUrls={canvasMediaUrls}
        hubTheme={sceneTheme}
        ownClipPlays={isMakerCanvas}
        guestView={!isMakerCanvas}
        makerEmpty={
          isMakerCanvas && makerDrawsEmpty(widget.widget_type) &&
          (openBrowseContent as Partial<Record<string, boolean>>)[widget.widget_type] === false
        }
        event={event}
        roleNames={roleNames}
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
    // 🎒 What to bring follows the entourage on the Invitation (owner 2026-10-07,
    // `splitAroundEntourage`) — drawn right after the entourage mount below.
    const detailsAround = splitAroundEntourage(pageStage, detailsSceneList);
    const publicWidgetNodes = sceneNodes(detailsAround.before);
    /* 🎨 THE DAY'S OWN PARTS — the Maker's canvas only, never a guest: a
       stand-in for each part a guest meets as their own (their table, their
       photos) or only once it happens (a message, a stream), so the couple can
       tap it and pick its style. Same list, same order, same places as the
       navigator (`makerDayPartsOn`): before the stage's sections, right after
       them, or after the entourage. */
    const makerDayStandIns = (place: MakerDayPartPlace) =>
      isMakerCanvas
        ? makerDayPartsOn(pageStage, place).map((part) => (
            <Fragment key={part}>
              {makerMark(`f:${part}`)}
              <MakerDayPartStandIn
                part={part as Exclude<FixedStyleScene, 'entourage'>}
                styleName={
                  sceneStylesOn(part, pageStage, event.event_type).find((st) => st.id === fixedStyle(part as FixedStyleScene))?.name ?? null
                }
              />
            </Fragment>
          ))
        : null;
    // Task #13 — day-of-mode badge surfaces to public-landing viewers too so a
    // guest at the venue without a session cookie still sees "happening now".
    // ONE "Happening now" (owner 2026-10-05: it showed twice, overlapping the
    // card) — when the live spotlight card already says it, the masthead does not.
    const dayOfBadge =
      dayOfPhase === 'live' && plan.spotlight?.kind !== 'watch_live' ? (
        <p className="inline-flex items-center gap-2 rounded-full border border-terracotta px-3 py-1 font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
          Happening now
        </p>
      ) : dayOfPhase === 'post' ? (
        <p className="inline-flex rounded-full bg-ink/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.15em] text-ink/70">
          {clientWords.solemn ? 'Thank you for being here' : 'Thank you for celebrating'}
        </p>
      ) : null;

    /* 🏠 THE DAY'S WELCOME, for a reader without a key: the couple's reminders
       and E-Gifts (a stranger has no look to dress by), and the seat finder
       for whoever may use it. */
    // 🔒 The reminders reach a reader without a key only as the page's own
    // anonymous fence would let them: a public-safe type, not set to "guests
    // only" (`lib/public-widget-allowlist.ts`, `openBrowseWidgetVisibleTo`).
    const dayRemindersPublic =
      PUBLIC_WIDGET_ALLOWLIST.includes('what_to_bring') && dayRemindersRow?.audience !== 'guests_only';
    const dayWelcome = welcomePartsOnTheDay({
      ...dayWelcomeFacts,
      identified: false,
      remindersOn: dayWelcomeFacts.remindersOn && dayRemindersPublic,
    });
    const findSeatShown = Boolean(
      insideAllowed && doorwayFacts?.seatingSurfaceEnabled && doorwayFacts?.seatingPublished,
    );
    const anonBar = resolveSiteNav({
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
        /* 🧭 In the Maker's canvas the bar is the one a GUEST holding their
           key sees (owner 2026-09-26: "show the actual guest bar for that
           stage") — Home · Details · RSVP · Story · Me on the Invitation.
           Since 2026-09-27 a stranger's bar is only Home · Details · Story,
           which is not the bar the couple is designing for. */
        viewer: ownerCapability && !isEditorCanvas ? { kind: 'couple' } : isEditorCanvas ? { kind: 'guest' } : { kind: 'public' },
        phase: navPhase,
        hostAllowsCamera: hostCameraOpen,
        anyChapterPublic: menuSections.gallery,
        hasStory: menuSections.story,
        hasDetails: menuSections.details,
        hasSchedule: plan.publicSafeWidgets.some((w) => w.widget_type === 'schedule'),
        liveBroadcast: Boolean(plan.liveMediaVisible && watchLive),
        // 📖 After the day: Film and Suppliers, only where the recap drew them.
        postEvent: recapBar,
        destinations: {
          film: openUpHash('film'),
          suppliers: `#${POST_EVENT_SUPPLIERS_ANCHOR}`,
          // Carries the event so the guest camera's refusal screen can
          // send an unrecognised visitor BACK TO THIS INVITATION instead
          // of to Setnayan's homepage — which was the only way off it.
          camera: hostCameraOpen ? `/papic/guest?from=${event.slug}` : null,
          watch: `/${event.slug}/hub`,
          join: `/${event.slug}/invite`,
        },
        stageSlots: STAGE_BAR[pageStage].slots,
        // 🏠 The day's Welcome, when this reader has one (the reminders, E-Gifts,
        // the seat finder) — a tab with nothing behind it is not drawn.
        hasWelcome: dayWelcome.length > 0 || findSeatShown,
        // 📱 Each tab its own page, on the Invitation and The Day.
        tabbed: tabsOn,
    });
    const tabs = pageTabsFor(anonBar);
    pageTabs = tabs;
    const { group } = tabs;
    /** On the day the page's sections are Live's — except a supplier's, whose
     *  "Cues" tab IS the day's details. */
    const scenesTab = pageStage === 'event' && vendorCapability === null ? 'live' : 'details';

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
        {/* 📱 THE FIRST TAB'S TOP — the Invitation's Welcome, The Day's Live
            (`group`, a no-op on a page that is one scroll). */}
        {group(leadTab, <>
        {/* Menu-shell anchor targets (PR6). aria-hidden zero-height markers so
            the fixed SiteMenuBar's in-page links land on the right sections. */}
        <div id={SITE_MENU_ANCHORS.home} aria-hidden className="scroll-mt-6" />
        {/* Open-browse Home spotlight (PR7). Null (byte-inert) unless
            event.website_open_browse is TRUE; identity-aware.
            ☝ ONE BUTTON (owner 2026-09-26/27): the stranger's "Find your
            invitation" card is a second way in beside "Get inside" — it is not
            drawn; "Get inside" is the one door. */}
        {plan.spotlight && plan.spotlight.kind !== 'find_invite' ? (
          <SpotlightCard spotlight={plan.spotlight} occasion={clientWords.occasion} />
        ) : null}
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
            {...heroElements}
            twoPeople={clientWords.twoPeople}
            eventDate={event.event_date}
            venueName={venueLine}
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
            mediaCaption={venueLine}
          />
        ) : null}
        </>, { chapters: true })}
        {phasedBody(() => (
          <>
            {/* `data-pahina-first-screen`: this chapter IS the first screen (the
                masthead), so the scroll reveal never hides it — see globals.css. */}
            {group(leadTab, (
            <div data-pahina-first-screen="" className="space-y-6 text-center">
              {!hasHeroMedia ? makerMark('f:hero') : null}
              {!hasHeroMedia ? (
                /* Pahina masthead, text-only variant (wave A PR-2). */
                <PahinaMasthead
                  eyebrow={mastheadEyebrow(clientWords)}
                  displayName={event.display_name}
                  {...heroElements}
                  card={inviteCard ?? undefined}
                  twoPeople={clientWords.twoPeople}
                  eventDate={event.event_date}
                  venueName={venueLine}
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
              {/* 🎟 A PUBLIC event's "Get tickets" (owner 2026-09-29) — above the
                  door, for everyone who reads the general details, the host's
                  own view included, so they see what their visitors get. The
                  organizer sells the tickets; this only links to their page. */}
              <GetTickets url={ticketUrl} />
              {viewerIsHost ? (
                /* THE HOST'S OWN PAGE. Wins over every `reason` variant below:
                   a stale or absent guest cookie says nothing about somebody
                   whose host membership the database just confirmed, and the
                   invite-error wording would be actively wrong for them.
                   ✂ No explaining paragraph (owner 2026-10-03, "too much going
                   on"): the host ribbon above already says "Your Event Hub — as
                   a guest sees it". The host simply meets no "Get inside". */
                null
              ) : (
                /* ── THE STRANGER'S ONE BUTTON (owner 2026-09-26/27) ──────────
                   General details above; ONE way in below — "Get inside: Scan
                   your QR, Tap NFC or Sign in", or, for a signed-in account not
                   on this list, "Ask to join". A stale or other-event key keeps
                   its one explaining line above the same button. */
                <div className="space-y-4">
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
                  ) : null}
                  {/* 👁 See as › Signed out draws THE DOOR on the canvas — the
                      same GetInside, with no join action bound (a sample
                      viewer asks to join nothing). */}
                  {vendorCapability || (isEditorCanvas && sampleViewer !== 'signed-out') ? null : (
                    <GetInside
                      slug={event.slug}
                      eventId={event.event_id}
                      signedInNotListed={anon.signedInNotListed}
                      theOrganizer={clientWords.theOrganizer}
                      mayAskToJoin={anyoneMayAskToJoin(event.rsvp_ask_config)}
                      joinAction={
                        sampleViewer === null && oneQrLetsYouIn(event.rsvp_ask_config)
                          ? joinEventAction.bind(null, event.event_id, '')
                          : undefined
                      }
                    />
                  )}
                </div>
              )}
            </div>
            ), { chapters: true })}

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
              /* 🔒 Inside content — the camera, the photos, the day-of hub — is
                 handed to nobody without a key (`insideAllowed` above). With all
                 three withheld the bar draws nothing at all. */
              candidCameraActive={insideAllowed && publicCandidCameraActive}
              photosHref={insideAllowed ? publicAlbumHref : null}
              hubHref={
                /* 📱 A page whose tabs ARE the day (Live · Welcome · Camera ·
                   Gallery · Me) needs no door to a second hub. */
                !tabs.on && insideAllowed && (dayOfPhase === 'live' || dayOfPhase === 'post')
                  ? `/${event.slug}/hub`
                  : null
              }
              menuOn={menuOn}
            />
            )}

            {/* Find your seat — the FREE guest finder (seat-finding PR 1). Pure
                navigation on the public landing. A guest who scanned the shared
                venue QR taps this, types their name, and sees their table — no
                app, no login, no paid SKU. */}
            {/* 🪑 2026-09-30 (owner: "seat plan is only on the day"): shown only
                once guests may see their seats — the one rule
                (lib/guests-may-see-seats.ts, via `doorwayFacts.seatingPublished`),
                never a door to a "not yet" page. */}
            {/* 🏠 The day's Welcome begins here — the seat finder is its table. */}
            {pageStage === 'event' ? group('home', <div id={SITE_WELCOME_ANCHOR} aria-hidden className="scroll-mt-6" />) : null}
            {group('home', <>{insideAllowed && doorwayFacts?.seatingSurfaceEnabled && doorwayFacts?.seatingPublished ? (
            <div className="mt-8 text-center">
              <Link
                href={`/${event.slug}/find-seat`}
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-cream px-5 py-2.5 text-sm font-medium text-ink/75 shadow-sm hover:border-terracotta hover:text-terracotta-700"
              >
                <MapPin aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                Find your seat
              </Link>
            </div>
            ) : null}</>)}

            {/* Panood Watch-Live — anonymous path FIRST: the remote relatives
                clicking the shared link from Messenger are exactly the cookie-less
                viewers this exists for. Follows the broadcast, not the calendar
                (owner-ruled 2026-09-02): `watchLive` is only ever set when the
                couple's links resolve, so no dayOfPhase gate is needed here. */}
            {/* 🎨 THE LIVE HUB'S STYLE — style A (no pick) draws the player and the
                wall exactly as before; Theatre / Wall first arrange the SAME two
                blocks together (`live-hub-styles.tsx`). */}
            {(() => {
              const playerPart = (
                <>
                {plan.liveMediaVisible && watchLive ? (
                  <section className="mt-10">
                    <WatchLiveBlock watchLive={watchLive} slug={event.slug ?? ''} occasion={clientWords.occasion} />
                  </section>
                ) : null}
                </>
              );
              const wallPart = (
                <>
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
                {insideAllowed && dayOfPhase === 'live' && plan.liveMediaVisible && !liveWall && liveWallUnreadable ? (
                  <section id="live-photo-wall" className="mt-10 scroll-mt-6">
                    <p className="rounded-lg bg-ink/5 px-4 py-3 text-center text-sm text-ink/60">
                      {LIVE_WALL_UNREADABLE_LINE}
                    </p>
                  </section>
                ) : null}

                {insideAllowed && dayOfPhase === 'live' && plan.liveMediaVisible && liveWall ? (
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
                </>
              );
              // The same two gates the blocks above carry — an arrangement never
              // draws a frame around a block this visitor would not be shown.
              const playerShown = Boolean(plan.liveMediaVisible && watchLive);
              const wallShown = Boolean(
                insideAllowed && dayOfPhase === 'live' && plan.liveMediaVisible && (liveWall || liveWallUnreadable),
              );
              // 📱 Live is the stream (and the couple's arrangement of stream and
              // wall); on its own the wall is the Gallery's — everyone's photos.
              return liveHubArranged && (playerShown || wallShown) ? group('live', (
                <div className="mt-10">
                  <LiveHubArrangement
                    sceneStyle={liveHubStyle}
                    player={playerShown ? playerPart : null}
                    wall={wallShown ? wallPart : null}
                  />
                </div>
              )) : (
                <>
                  {tabs.on ? (playerShown ? group('live', playerPart) : null) : playerPart}
                  {tabs.on ? (wallShown ? group('gallery', wallPart) : null) : wallPart}
                </>
              );
            })()}

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
            {/* 👤 The guest-link scenes, in place, in the Maker's canvas only
                ("Your guest" — `maker-guest-scenes.tsx`). Guests: nothing here. */}
            {isMakerCanvas ? (
              <MakerGuestScenes
                show={{ greeting: plan.greetingShouldRender, pass: plan.qrCardShouldRender, rsvp: plan.rsvpShouldRender }}
                eventDate={event.event_date}
                solemn={clientWords.solemn}
                mark={makerMark}
              />
            ) : null}
            {/* 🏠 WELCOME — after the reply, before Details (owner 2026-09-30).
                A stranger meets Reminders and E-Gifts here; the Maker's canvas
                draws all three places, each after its navigator marker. */}
            {welcome.length > 0 ? group('home', (
              <div className="mt-12">
                <GuestWelcome
                  partLooks={welcomeLooks}
                  parts={welcome}
                  words={clientWords}
                  look={null}
                  reminders={
                    remindersScene ? (
                      <PublicHideableWidget
                        widget={remindersScene}
                        canvasMediaUrls={canvasMediaUrls}
                        hubTheme={sceneTheme}
                        ownClipPlays={isMakerCanvas}
                        guestView={!isMakerCanvas}
                        makerEmpty={
                          isMakerCanvas &&
                          (openBrowseContent as Partial<Record<string, boolean>>).what_to_bring === false
                        }
                        event={event}
                        words={clientWords}
                        scheduleBlocks={scheduleBlocks}
                        isLive={dayOfPhase === 'live'}
                        ourPhotoUrls={ourPhotoUrls}
                      />
                    ) : null
                  }
                  giftHref={doorways.pabuya}
                  mark={makerMark}
                  maker={isMakerCanvas}
                />
              </div>
            )) : null}
            {/* 🏠 THE DAY'S WELCOME (owner 2026-09-30, "THE DAY'S MENU HAS
                FIVE") — for a reader without a key, the couple's Reminders and
                E-Gifts. Never on the Maker's canvas (`welcomePartsOnTheDay`). */}
            {dayWelcome.length > 0 ? group('home', (
              <div className="mt-12">
                <GuestWelcome
                  partLooks={welcomeLooks}
                  parts={dayWelcome}
                  words={clientWords}
                  look={null}
                  reminders={
                    dayRemindersRow ? (
                      <PublicHideableWidget
                        widget={dayRemindersRow}
                        canvasMediaUrls={canvasMediaUrls}
                        hubTheme={sceneTheme}
                        ownClipPlays={isMakerCanvas}
                        guestView={!isMakerCanvas}
                        event={event}
                        words={clientWords}
                        scheduleBlocks={scheduleBlocks}
                        isLive={dayOfPhase === 'live'}
                        ourPhotoUrls={ourPhotoUrls}
                      />
                    ) : null
                  }
                  giftHref={doorways.pabuya}
                />
              </div>
            )) : null}
            {makerDayStandIns('before')}
            {group(scenesTab, plan.openBrowse ? (
              // Open-browse Details — always present so the tab is never dead:
              // event-level facts (the anonymous event_details variant — §5.10),
              // the public widgets, then a teaser plate when nothing is filled.
              <section id={SITE_MENU_ANCHORS.details} className="mt-12 space-y-8 scroll-mt-6">
                <PublicEventDetails
                  dateLabel={event.event_date ? formatEventDate(event.event_date) : null}
                  venueName={event.venue_name}
                  venueAddress={event.venue_address}
                  venues={event.venues}
                  dateIso={event.event_date ?? null}
                  sceneStyle={sceneStyleOfRow(
                    widgets.find((w) => w.widget_type === 'event_details'),
                    pageStage,
                    event.event_type,
                  )}
                />
                <div className="sn-hub-cards space-y-4">{publicWidgetNodes}</div>
                {detailsSceneList.length === 0 ? (
                  <SectionEmptyPlate kind="details" pastTense={archiveTense} occasion={clientWords.occasion} />
                ) : null}
              </section>
            ) : detailsSceneList.length > 0 ? (
              <section id={SITE_MENU_ANCHORS.details} className="mt-12 space-y-8 scroll-mt-6">
                <div className="sn-hub-cards space-y-4">{publicWidgetNodes}</div>
              </section>
            ) : null)}

            {makerDayStandIns('after')}

            {/* THE ENTOURAGE — under Details, never a sixth tab (owner ruling
                2026-09-14). Its own anchor so the couple can link straight at
                it; no slot, so `_lib/site-nav.ts`'s five-slot budget is
                untouched. Draws nothing when nobody holds a role.

                No `previewHref` (owner, 2026-09-26: "same goes to the guest
                list" — it should not "see other [list]", it should extend as
                needed). Everyone shows inline; `/[slug]/everyone` keeps
                working for old links, it just isn't linked from here. */}
            {group(scenesTab, stageShowsEntourage(pageStage) ? <EntourageSection groups={entourage} id="site-entourage" sceneStyle={entourageStyle} /> : null)}
            {detailsAround.after.length > 0 ? group(scenesTab, <div className="sn-hub-cards mt-8 space-y-4">{sceneNodes(detailsAround.after)}</div>) : null}

            {makerDayStandIns('last')}

            {/* Our Story — the couple's love story on the run-up paths (rsvp/event).
                The normal body only renders pre-event (STD + editorial are separate
                branches), so this naturally stays off the post-event Editorial.
                Under open-browse a teaser plate stands in when there's no story so
                the Story tab never lands on nothing. */}
            {group('story', <>
            {/* 📱 On a tabbed page the "Our love story" scene is this tab's own
                page (it left Details above), in the couple's scene look. */}
            {storyScene ? (
              <div id={SITE_MENU_ANCHORS.story} className="sn-hub-cards mt-12 space-y-4 scroll-mt-6">
                {sceneNodes([storyScene])}
              </div>
            ) : null}
            <div id={storySceneShown ? undefined : SITE_MENU_ANCHORS.story} className="scroll-mt-6">
              {storySceneShown ? null : !weddingOnly.love_story ? null : event.love_story ? (
                <OurStory loveStory={event.love_story} variant="full" />
              ) : plan.openBrowse ? (
                <SectionEmptyPlate kind="story" pastTense={archiveTense} occasion={clientWords.occasion} />
              ) : null}
            </div>
            </>)}
          </>
        ))}
        {/* Me tab — under open-browse a cookie-less visitor gets designed
            find-mode (§1.1); otherwise the account/claim affordance lives in the
            fixed PublicEventDayBar and this marker just gives the tab a landing. */}
        {group('me', <>{plan.openBrowse && viewerIsHost ? (
          /* The host half of the Me tab. `FindModeCard` asks "Have an
             invitation?" and offers "Open my invitation" — a dead end for the
             person who ISSUES the invitations, and the tab must still land
             somewhere, so it says what this page is instead of pointing them
             at a door that is not theirs. Copy only; no control moves here. */
          <section id={SITE_MENU_ANCHORS.me} className="mt-12 scroll-mt-6">
            <div className="rounded-2xl border border-ink/10 bg-white/70 px-6 py-8 text-center shadow-sm">
              <p className="font-serif text-lg text-ink">You&rsquo;re the host</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">
                You don&rsquo;t need an invitation to your own {watchLiveOccasion(clientWords.occasion)}. Guests
                who open their personal link see their greeting, seat and RSVP in this spot.
              </p>
            </div>
          </section>
        ) : plan.openBrowse && archiveTense ? (
          /* ☝ Before the day a stranger's one door is "Get inside" (owner
             2026-09-26/27) — the "Open my invitation" card would be a second.
             After the day it asks something different ("Were you a guest? Claim
             your photos"), so it stays there. */
          <section id={SITE_MENU_ANCHORS.me} className="mt-12 scroll-mt-6">
            <FindModeCard slug={event.slug} reason={reason} pastTense={archiveTense} occasion={clientWords.occasion} />
          </section>
        ) : (
          <div id={SITE_MENU_ANCHORS.me} aria-hidden className="scroll-mt-6" />
        )}</>)}
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
        {(() => {
          /* 🧭 ONE VALUE, TWO READERS: the tab bar a guest sees, and — in the
             Maker's canvas only — the navigator's tabs (`data-maker-bar`), so
             the two can never disagree (owner 2026-09-26: *"this depends on
             what menu they are looking at"*). */
          return (
            <>
              {isMakerCanvas && menuOn ? (
                <span hidden data-maker-bar={JSON.stringify(makerBarItems(anonBar))} />
              ) : null}
        {menuOn && showGuestBars ? (
          <SiteMenuBar
            slots={anonBar}
          />
        ) : null}
        {/* 📱 Each tab its own page — the hub shell's page frame shows one tab
            at a time and keeps its address (`hub/hub-shell.tsx`). */}
        {menuOn && showGuestBars && tabs.on ? <HubShell frame="page" slots={anonBar} /> : null}
            </>
          );
        })()}
      </>
    );
  };

  /** The guest tree — verbatim the old InvitationSite body. */
  const guestTree = (g: GuestSiteIdentity) => {
    const {
      guest,
      guestLiveGallery,
      guestOwnShots,
      poolGalleryOpen,
      seatPassActive,
      needsFaceEnroll,
      guestHubData,
      seatMap,
      papicGuest,
      showClaimAccountCta,
      account,
      profileDetails,
      eventVendorCredits,
      saveFlash,
      rsvpFlash,
      faceMode,
      faceTaggingAskable,
    } = g;

    // 🔒 A SIDE EXISTS ONLY WHERE TWO PEOPLE DO (2026-09-30). "Bride's side /
    // Groom's side / Both sides" was built for every event type, so a debut's
    // guest read "Side: Both sides". `side_labels` in lib/wedding-only-parts.ts
    // has always said which types may show it; nothing read it. Null = no side
    // rendered anywhere on this guest's page.
    const sideLabel: string | null = !weddingOnly.side_labels
      ? null
      : guest.side === 'both'
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
    /* 🏠 THE WELCOME PAGE (owner 2026-09-30 — `lib/invitation-welcome.ts`):
       this guest's look · the couple's Reminders · E-Gifts, after the reply.
       Reminders LEAVES Details for it; the dress code stays on Details as the
       everyone view, and this guest's own half moves to Welcome. */
    /* 👤 INVITATION › ME — THE FOUR FOR-EACH-GUEST PARTS (owner 2026-10-06,
       `lib/guest-me-parts.ts`): List only · Guests reply, a guest on the list,
       and only the facts their own row carries. Drawn on the Invitation's Me
       tab (a tabbed page — Me is a page of its own there). */
    const meParts =
      guestStages && pageStage === 'rsvp' && tabsOn && !isMakerCanvas
        ? guestMePartsShown({
            on: guestStages,
            getIn: readGuestsGetIn(event.rsvp_ask_config),
            listed: readerIsListed({ kind: 'guest', entrySource: (guest as { entry_source?: string | null }).entry_source ?? null }),
            facts: guestMeFacts({
              role: guest.role ?? null,
              dressCodeConfig: event.dress_code_config ?? null,
              rolePalette: event.role_palette,
              roleNames,
              comingWith,
            }),
          })
        : [];
    /* ✉ THE REPLY CARD (owner 2026-10-06) — the page's one action, in its three
       reply states, said as a card: under the names on Welcome and at the top
       of Me. Only where the reply sheet it opens is on the page. */
    const replyBy = plan.guestListClosed
      ? null
      : guestReplyBy({ deadline: event.guest_list_edit_deadline ?? null, today: todayYmd() });
    const replyCard =
      guestStages && pageStage === 'rsvp' && plan.rsvpShouldRender && !isMakerCanvas
        ? replyCardOf({
            action: arrivalAction,
            replyBy: replyBy ? formatEventDateWithPrecision(replyBy.date, 'day') || null : null,
            seats: 1 + plusOneSeats(guest),
            solemn: clientWords.solemn,
          })
        : null;
    /* 👗 THIS GUEST'S OWN LOOK — read once, for the Welcome's "you" panel and
       for Me's parts (one home per fact: when Me draws them, the Welcome's
       look stands down — DECISION_LOG 2026-10-06 "'YOUR DETAILS' LIVES ON
       INVITATION › ME"). */
    const guestLook = {
      config: event.dress_code_config ?? null,
      ceremonyType: dressRiteOf(event),
      genderSeparation: (event as { gender_separation?: string | null }).gender_separation ?? null,
      guestRole: guest.role ?? null,
      march: marchPlaceOf(entourage, guest.guest_id),
      rolePalette: event.role_palette,
      paletteLook: paletteLookOfRow(widgetByType(widgets, 'dress_code')),
    };
    const welcome = welcomeParts({
      stage: pageStage,
      bodyNormal: plan.body === 'normal',
      scenes: plan.hideableInOrder.map((w) => w.widget_type),
      // 👁 A See as sample guest is identified — their own look, like any guest's.
      identified: !isMakerCanvas || sampleViewer !== null,
      reminders: event.what_to_bring,
      giftHref: doorways.pabuya,
      maker: false,
    });
    const detailsScenes = scenesLeftForDetails(plan.hideableInOrder, welcome);
    // 📱 On a tabbed page the "Our love story" scene is Our Love Story's page —
    // see the stranger's tree above. It moves; it is never drawn twice.
    const storyScene = tabsOn ? (detailsScenes.find((w) => w.widget_type === 'our_love_story') ?? null) : null;
    const detailsSceneList = storyScene ? detailsScenes.filter((w) => w !== storyScene) : detailsScenes;
    // 📖 The love story once — see the stranger's tree above.
    const storySceneShown = detailsScenes.some((w) => w.widget_type === 'our_love_story');
    // The day is behind us: the post-event window, the recap body, or a date
    // long past (`inactive` covers both "weeks before" and "weeks after").
    const eventIsBehind =
      dayOfPhase === 'post' ||
      lifecyclePhase === 'editorial' ||
      (dayOfPhase === 'inactive' && Boolean(event.event_date) && Date.parse(String(event.event_date)) < Date.now());
    const remindersScene = welcome.includes('reminders')
      ? (plan.hideableInOrder.find((w) => w.widget_type === 'what_to_bring') ?? null)
      : null;
    const menuSections = {
      details: guestBodyRenders && detailsSceneList.length > 0,
      // A type with no two people has no love story (same gate as the public page).
      // …and only once there is a chapter to land on (`storyTabHasChapter`).
      story: weddingOnly.love_story && guestBodyRenders && storyTabHasChapter(event.love_story, storySceneShown),
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

    /* 🎫 THE PASS IS NOT ON HOME ANY MORE — IT IS THE DIGITAL TICKET, ON ME
       (owner 2026-09-30, on `#site-pass`: "i thought this will be the digital
       ticket" — then: the ticket belongs on the guest's Me page only, not on
       Home/Details). `GuestTicket` (guest-ticket.tsx) is mounted into the Me
       section by page.tsx and carries `PASS_ANCHOR`, so the day-of "Show your
       ticket" link still lands on it. Do NOT re-add a pass or QR block here:
       two would mean two elements with one id, and a second drawing of the
       ticket. Guarded by `the-hub-shows-the-ticket.test.ts`. */

    const greetingBlock = plan.greetingShouldRender ? (
      /* Pahina §7: the greeting's setting. 🎩 NO CASUAL GREETING (owner
         2026-09-30, DECISION_LOG "NO CASUAL GREETINGS": *"no casual
         greeting"*) — the "Hi, <first name>." salutation that led this block
         is gone from the Welcome page; the sentence that says when, where and
         as whom stays, and names nobody. */
      <section className="space-y-3">
        <p className="max-w-prose text-base leading-relaxed text-ink/70">
          {clientWords.solemn
            ? 'We hope you can be with us on'
            : 'We’d love to celebrate with you on'}{' '}
          <span className="font-medium text-ink">{formatEventDate(event.event_date)}</span>
          {venueNamesLine(event, ' and ') ? (
            <>
              {' '}
              — at <span className="font-medium text-ink">{venueNamesLine(event, ' and ')}</span>
            </>
          ) : null}
          . You&rsquo;re joining us as{' '}
          <span className="font-medium text-ink">{guestRoleLabel(guest.role, roleNames)}</span>
          {sideLabel ? (
            <>
              {' '}·{' '}
              <span className="text-ink/80">{sideLabel}</span>
            </>
          ) : null}
          .
        </p>
      </section>
    ) : null;

    /* 🏠 THE DAY'S WELCOME (owner 2026-09-30, "THE DAY'S MENU HAS FIVE"):
       this guest's table (the seat block, drawn above), their look, the
       couple's reminders and E-Gifts. */
    const dayWelcome = welcomePartsOnTheDay({
      ...dayWelcomeFacts,
      // 👁 A See as sample guest is identified — their own look, like any guest's.
      identified: !isMakerCanvas || sampleViewer !== null,
      // 🚶🗺 Scrolled, the day's Welcome carries the walking order and the ONE
      // venue (owner 2026-10-01, prototype the_day_guest_phone frame 2b).
      march: pageStage === 'event' && stageShowsEntourage(pageStage) && entourage.length > 0,
      venue: pageStage === 'event' && dayVenues.length > 0,
    });
    /** The walking order is Welcome's on the day — so it leaves the Live tab (one place). */
    const marchOnWelcome = dayWelcome.includes('march');
    const guestEntourage = stageShowsEntourage(pageStage) ? <EntourageSection groups={entourage} id="site-entourage" sceneStyle={entourageStyle} myGuestId={guest.guest_id} /> : null;
    /* Same resolver, guest viewer. The camera destination keeps the shipped
       precedence — a guest's OWN roll first, then the couple's shared camera,
       the same order GuestHubBar already uses; neither open ⇒ the resolver
       LOCKS the slot rather than hiding it. */
    const guestBar = resolveSiteNav({
      viewer: { kind: 'guest' },
      phase: navPhase,
      stageSlots: STAGE_BAR[pageStage].slots,
      // `papicGuest` is the guest's own roll (an object), not a flag —
      // coerce it, or the resolver receives a truthy non-boolean.
      hostAllowsCamera: Boolean(papicGuest) || hostCameraOpen,
      anyChapterPublic: menuSections.gallery,
      hasStory: menuSections.story,
      hasDetails: menuSections.details,
      hasSchedule: plan.hideableInOrder.some((w) => w.widget_type === 'schedule'),
      liveBroadcast: Boolean(plan.liveMediaVisible && watchLive),
      // 🏠 The day's Welcome — their table, their look, the reminders, E-Gifts.
      hasWelcome: dayWelcome.length > 0 || Boolean(seatMap) || seatPassActive,
      // 📱 Each tab its own page, on the Invitation and The Day.
      tabbed: tabsOn,
      // 📖 After the day: Film and Suppliers, only where the recap drew them.
      postEvent: recapBar,
      destinations: {
        film: openUpHash('film'),
        suppliers: `#${POST_EVENT_SUPPLIERS_ANCHOR}`,
        // 📸 Straight to the camera — "the whole page is the camera" (prototype
        // frame 3b) — through the token→session bridge, carrying the event so
        // its × comes back here (`cameraHrefWithBack` adds the tab).
        camera: papicGuest
          ? `/papic/me/${encodeURIComponent(guest.qr_token)}/session?next=guest&from=${event.slug ?? ''}`
          : hostCameraOpen
            ? // Same reason as the anonymous tree: carry the event so a
              // refusal can hand them back their invitation.
              `/papic/guest?from=${event.slug}`
            : null,
        watch: `/${event.slug}/hub`,
        join: `/${event.slug}/invite`,
      },
    });
    const tabs = pageTabsFor(guestBar);
    pageTabs = tabs;
    const { group } = tabs;
    // 👁 A See as sample guest has no session to sign out of — no form at all.
    const signOut = sampleViewer !== null ? null : (
      <section className="border-t border-ink/10 pt-6 text-center text-xs text-ink/50">
        <form action={`/${event.slug}/sign-out`} method="post">
          {/* 🧽 Said BEFORE the tap (owner 2026-09-30): the sign-out route
              erases the face-tagging selfie; tags stay. */}
          {guest.photo_source === 'selfie' ? (
            <p data-sign-out-erases-selfie="" className="mb-2">{SIGN_OUT_ERASES_SELFIE}</p>
          ) : null}
          <button type="submit" className="underline-offset-4 hover:underline">
            Sign out of this invitation
          </button>
        </form>
      </section>
    );
    /** On the day the page's sections are Live's (owner 2026-09-30). */
    const scenesTab = pageStage === 'event' ? 'live' : 'details';
    /** 🎒 What to bring follows the entourage on the Invitation (`splitAroundEntourage`). */
    const guestAround = splitAroundEntourage(pageStage, detailsSceneList);
    /** One of the couple's scenes, as this guest reads it — for Details, and on
     *  a tabbed page for the love story scene on its own tab. */
    const renderScene = (widget: (typeof detailsScenes)[number]) => (
    <HideableWidgetRender
      key={widget.widget_id}
      widget={widget}
      /* 🏠 This guest's own look is on Welcome (or on Me); Details keeps everyone's. */
      dressCodeGeneral={welcome.includes('look')}
      stage={pageStage}
      canvasMediaUrls={canvasMediaUrls}
      hubTheme={sceneTheme}
      ownClipPlays={isMakerCanvas}
      guestView={!isMakerCanvas}
      event={event}
      roleNames={roleNames}
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
      hostPitch={account ? hostPitchShows(account) : false}
      /* 🚶 "You walk 5th, with …" under the dress code's "You are <role>" —
         from the SAME built entourage the section below prints (owner
         2026-09-29). Never on the Maker canvas (no guest reads it there). */
      marchPlace={isMakerCanvas ? null : marchPlaceOf(entourage, guest?.guest_id)}
    />
    );

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
        {/* 📸 BACK FROM THE CAMERA (owner 2026-10-01, the P9 addendum: "with
            a 'N photos added · See them' note"). On every tab — it is about
            the visit, not a page — and only when shots really landed: the
            camera counts each one the server confirmed (`cameraExitHref`). */}
        {shotsAdded && !isMakerCanvas ? (
          <p
            data-shots-added=""
            role="status"
            className="mx-auto flex w-fit items-center gap-2 rounded-full border border-ink/10 bg-cream px-4 py-2 text-sm text-ink shadow-sm"
          >
            <span>
              {shotsAdded.toLocaleString('en-PH')} {shotsAdded === 1 ? 'photo' : 'photos'} added
            </span>
            <span aria-hidden className="text-ink/30">
              ·
            </span>
            <a href={hubTabHref('gallery')} className="font-medium underline underline-offset-4">
              See them
            </a>
          </p>
        ) : null}
        <article data-pahina-chapters className="space-y-12">
          {/* 📱 THE FIRST TAB'S TOP — the Invitation's Welcome, The Day's Live
              (`group`: a no-op on a page that is one scroll). */}
          {group(leadTab, <>
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

          {/* "DIDN'T REPLY · YOU'RE IN" (owner 2026-09-26 "yes to all" (b);
              2026-09-27: shown to the guest). The final count is locked and this
              guest never answered — they are inside anyway, and no headcount
              question is asked. `rsvpGate` decided it on the server. */}
          {g.didntReply ? (
            <p
              data-didnt-reply
              className="mx-auto w-fit border border-ink/20 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-ink/70"
            >
              Didn&rsquo;t reply · you&rsquo;re in
            </p>
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
              {...heroElements}
              twoPeople={clientWords.twoPeople}
              eventDate={event.event_date}
              venueName={venueLine}
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
              mediaCaption={venueLine}
            />
          ) : plan.body === 'normal' && plan.heroShouldRender ? (
            <PahinaMasthead
              eyebrow={mastheadEyebrow(clientWords)}
              displayName={event.display_name}
              {...heroElements}
              card={inviteCard ?? undefined}
              twoPeople={clientWords.twoPeople}
              eventDate={event.event_date}
              venueName={venueLine}
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

          {replyCard ? (
            <ReplyCardRow card={replyCard} landed={Boolean(rsvpFlash && rsvpFlash.tone !== 'error')} />
          ) : (
          <ArrivalActionRow
            action={arrivalAction}
            landed={Boolean(rsvpFlash && rsvpFlash.tone !== 'error')}
          />
          )}
          </>, { chapters: true, className: 'space-y-12' })}

          {group('home', <>

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
          {/* ☑ "YOUR CHECKLIST" — the last 30 days (owner 2026-09-26/27):
              what to wear · motif colours · arrive by · venue + Maps · their
              table · their pass, each a tick saved to THIS guest (their own
              reply action, +0 routes). `g.checklist` is null outside the
              window; the page decided that on the server. */}
          {g.checklist && plan.body === 'normal' && !isMakerCanvas && !isLive && !isPost ? (
            <GuestChecklist
              items={guestChecklistItems({
                role: guest.role,
                dressCodeConfig: event.dress_code_config ?? null,
                rolePalette: event.role_palette,
                arriveBy: firstScheduleTimeLabel,
                venueName: firstPlace ? firstPlace.name : event.venue_name,
                venueAddress: firstPlace ? firstPlace.address : event.venue_address,
                venueLatitude: firstPlace ? firstPlace.latitude : event.venue_latitude,
                venueLongitude: firstPlace ? firstPlace.longitude : event.venue_longitude,
                tableLabel: guestHubData.tableLabel,
                // The pass card, or no pass item at all for a guest who has none yet.
                passHref: g.passCard === null ? undefined : g.passCard === 'pass' ? PASS_CARD_ROUTE : null,
              })}
              initialTicks={g.checklist.ticks}
              readFailed={g.checklist.readFailed}
              save={submitRsvp.bind(null, event.event_id, guest.guest_id)}
              /* 🔢 The countdown's own rule (`daysToGo`): whole days of real
                 time left, so this never reads a day more than the countdown
                 tile beside it. On the eve and the day it draws no number. */
              daysLeft={(() => {
                const left = daysToGo(event.event_date, eventTzForDay, Date.now());
                return left?.kind === 'days' ? left.days : null;
              })()}
              dateLabel={event.event_date ? formatEventDate(event.event_date) : null}
            />
          ) : null}
          {plan.spotlight ? <SpotlightCard spotlight={plan.spotlight} occasion={clientWords.occasion} /> : null}
          {/* 🎫 NO "HI AGAIN · YOUR INVITATION SUMMARY" CARD (owner 2026-09-30).
              Its reply, seat, meal and "coming up" were a second statement of
              what the top control, the Digital ticket on Me and the Your details
              sheet each already say. Its one door — the reply sheet — is the top
              control's Change, the Me tab, and the line in the reply section. */}

          {/* ⛔ NO "ADD TO HOME SCREEN" CARD ON THE EVENT HUB — owner, 2026-09-30,
              pointing at the "Keep it with you · Put … on your home screen" card
              that sat here: "remove this part on the website". The per-event
              manifest and the couple's icon still ship (app/[slug]/manifest.
              webmanifest · icon/[spec]), so a guest can still install from the
              browser's own menu — the page just no longer teaches it. Pinned by
              `lib/the-event-hub-has-no-home-screen-card.test.ts`. */}
          {/* ── "SAVE TO MY ACCOUNT" LIVES ON ME, ONCE (owner 2026-10-03, on the
              live hub: "too many buttons. too much going on" — each control has
              ONE place). The account card that stood here asked the same thing
              as Me's Save, in a second place on the same visit. Me carries every
              state it drew (offer · sign in · this seat · linked · held
              elsewhere) through the shared `SaveToAccount`. Pinned by
              `each-guest-page-has-one-main-action.test.ts`. */}

          {seatMap ? (
            <YourSeatBlock
              tableLabel={guestHubData.tableLabel ?? 'your table'}
              venueName={receptionPlace ? receptionPlace.name : event.venue_name}
              plan={seatMap.plan}
              arrived={guestHubData.arrived}
              sceneStyle={fixedStyle('find_your_seat')}
              /* 🪪 The Place card is a name card: the guest's FORMAL name, in the
                 event's Name style and the hero's Names look (owner 2026-09-30)
                 — never a bare first name. */
              formalName={placeCardName(guest, eventNameStyle)}
              nameStyle={hubElementInlineStyle(heroCanvas.elements?.names)}
            />
          ) : null}
          </>, { chapters: true, className: 'space-y-12' })}

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
              {/* 🗺 THE DAY'S LIVE LEADS WITH DIRECTIONS until the programme
                  begins (owner 2026-09-30, "THE DAY'S MENU HAS FIVE"). */}
              {directionsOnTop ? group('live', <DayDirections venues={dayVenues} />, { chapters: true, className: 'space-y-12' }) : null}
              {group(leadTab, <>{dayOfLead.greetingStepsBack ? null : greetingBlock}</>, { chapters: true, className: 'space-y-12' })}

              {/* Task #13 — day-of-mode promotes the schedule block to the top of
                  the article so a guest at the venue sees "happening now" before
                  scrolling past hero / greeting / QR. The same ScheduleWidget renders
                  in its default position below for non-live phases. */}
              {/* Panood Watch-Live — leads the live page: the loved ones who
                  couldn't fly home open the same link and watch the ceremony.
                  Spec §7.5: remote guests first. Follows the broadcast, not the
                  calendar (owner-ruled 2026-09-02) — `watchLive` is only ever set
                  when the couple's links resolve, so no `isLive` gate here. */}
              {/* 🎨 Theatre / Wall first draw the player AND the wall here, together;
                  style A keeps the wall in its own place further down. */}
              {group('live', liveHubArranged && (watchLive || (isLive && liveWall)) ? (
                <LiveHubArrangement
                  sceneStyle={liveHubStyle}
                  player={watchLive ? <WatchLiveBlock watchLive={watchLive} slug={event.slug ?? ''} occasion={clientWords.occasion} /> : null}
                  wall={
                    isLive && liveWall ? (
                      <LiveWallBlock
                        slug={event.slug}
                        initialTiles={liveWall.tiles}
                        initialCount={liveWall.count}
                        initialCaption={liveWall.caption}
                        timeZone={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
                      />
                    ) : null
                  }
                />
              ) : watchLive ? (
                <WatchLiveBlock watchLive={watchLive} slug={event.slug ?? ''} occasion={clientWords.occasion} />
              ) : null, { chapters: true, className: 'space-y-12' })}

              {/* Pahina §7 · functional-color exile STARTS HERE: the day-of
                  promotion used to wrap the whole widget in an app-green box.
                  The emphasis now lives inside the programme rail — the live
                  row carries an accent left rule + veil wash + "Happening now"
                  tag. Same promotion, same gating, no green on a wedding page. */}
              {group('live', isLive && scheduleBlocks.length > 0 ? (
                <section aria-label="Day-of schedule">
                  <ScheduleWidget
                    blocks={scheduleBlocks}
                    eventTz={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
                    nowTrigger={isGuestNowTriggerEnabled()}
                    eventType={event.event_type}
                  />
                </section>
              ) : null, { chapters: true, className: 'space-y-12' })}


              {/* Chinese (Tsinoy) tea-ceremony card — static, guest-safe tradition copy
                  (no roster / no PII). Mirrors the public + identified-guest paths for
                  parity; gates on isChineseWedding (primary OR secondary rite). */}
              {group(pageStage === 'event' ? 'live' : 'details', isChineseWedding(event) ? <TeaCeremonyCard event={event} /> : null, { chapters: true, className: 'space-y-12' })}

              {/* Live Photo Wall mirror — the venue wall on the guest's own phone
                  while the celebration runs (owner 2026-06-12: the wall + live
                  gallery belong ON the on-the-day page). Renders only when the
                  event owns LIVE_WALL and the live window is on; polls for fresh
                  tiles while the tab is visible. */}
              {/* 📸 THE WALL IS LIVE'S, NOT THE GALLERY'S (owner 2026-10-01,
                  DECISION_LOG "THE EVENT HUB IS FULL SCREEN WITH ONE EXIT…": the
                  guest's Gallery is their own shots + photos of them, and shows
                  everyone's only when the couple shares the whole gallery). The
                  venue wall the couple put up is Live's — prototype frame 1b:
                  "Now · Next · the couple's announcement · the stream · the
                  wall". (A Theatre / Wall first arrangement already draws it
                  with the stream, above; then it is not drawn twice.) */}
              {group('live', isLive && liveWall && !(tabs.on && liveHubArranged) ? (
                <>
                  {/* Menu-shell "Gallery" anchor (PR6) — lands on the live wall.
                      On a tabbed page the Gallery group itself carries it. */}
                  {menuOn && !tabs.on ? (
                    <span id={SITE_MENU_ANCHORS.gallery} aria-hidden className="sr-only" />
                  ) : null}
                  {liveHubArranged ? null : (
                    <LiveWallBlock
                      slug={event.slug}
                      initialTiles={liveWall.tiles}
                      initialCount={liveWall.count}
                      initialCaption={liveWall.caption}
                      timeZone={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
                    />
                  )}
                </>
              ) : null, { chapters: true, className: 'space-y-12', id: tabs.on ? undefined : SITE_MENU_ANCHORS.gallery })}

              {/* Ask the band for a song (SUP-52) — the guest's end of the song
                  desk. Live window only, and only when a booked act can READ
                  the requests (the inbox is paid): a card on a band-less night
                  would say "sent" to nobody. Also folded into the couple's
                  "What do you ask your guests?" toggle (owner 2026-09-25) — its
                  own open/paused window stays a separate, second gate. */}
              {group('live', rsvpAsk.song_request && songRequestCardShows({ isLive, door: songRequestDoor }) ? (
                <SongRequestCard paused={songRequestDoor === 'paused'} />
              ) : null, { chapters: true, className: 'space-y-12' })}

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
              {/* 📷 THE CAMERA'S CONSENT CARD BELONGS TO THE DAY, NOT THE INVITATION
                  (owner 2026-10-01 walk-through: Welcome opened on "Before you
                  start shooting" 162 days out; DECISION_LOG face-tagging rows —
                  Papic asks only when it is on, the selfie only on the day).
                  Asked of the stage's OWN bar, never a second list: the Event Bar
                  (`STAGE_BAR`) carries a Camera slot only on The Day and after it,
                  so a guest on Save the Date / Invitation meets no camera card. */}
              {group('live', papicGuest && STAGE_BAR[pageStage].slots.includes('camera') ? (
                <PapicGuestCapture
                  /* Inside the hub: the terms / blocked / no-camera states are
                     ONLY the small card — no full-page frame (owner 2026-09-30,
                     "space is too big also should only be the small frame"). */
                  embedded
                  guestName={guest.first_name}
                  eventName={event.display_name}
                  eventId={event.event_id}
                  initialRemaining={papicGuest.initialRemaining}
                  total={papicGuest.total}
                  termsAccepted={papicGuest.termsAccepted}
                  needsFaceEnroll={needsFaceEnroll}
                  faceTaggingWish={guest.face_tagging_wanted ?? null}
                  capApplies={papicGuest.capApplies}
                  poolLow={papicGuest.poolLow}
                  sponsorShare={papicGuest.sponsorShare}
                  eventStyle={papicGuest.eventStyle}
                  faceMode={papicGuest.faceMode}
                />
              ) : null, { chapters: true, className: 'space-y-12' })}

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
              {group(leadTab, <>{dayOfLead.greetingStepsBack ? greetingBlock : null}</>, { chapters: true, className: 'space-y-12' })}

              {group('gallery', <>{isLive || isPost ? (
                <PhotosOfYouGallery
                  gallery={guestLiveGallery}
                  eventId={event.event_id}
                  isLive={isLive}
                  isPost={isPost}
                  showClaimAccountCta={showClaimAccountCta}
                  occasion={clientWords.occasion}
                  eventWord={clientWords.eventWord}
                  timeZone={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
                  sceneStyle={fixedStyle('photos_of_you')}
                  selfieLine={guest.photo_source === 'selfie' ? SELFIE_LIFETIME_LINE : null}
                />
              ) : null}
              {/* 📸 YOUR SHOTS + EVERYONE'S (ONLY IF SHARED) — owner 2026-10-01,
                  DECISION_LOG "THE EVENT HUB IS FULL SCREEN WITH ONE EXIT…":
                  the Gallery is the guest's own shots + the photos they are
                  tagged in (above); everyone's only when the couple's shipped
                  "Shared gallery" switch is on (`events.pool_gallery_open`). */}
              {isLive || isPost ? (
                <YourShotsGallery
                  shots={guestOwnShots}
                  qrToken={guest.qr_token || null}
                  cameraOn={Boolean(papicGuest)}
                  everyoneHref={poolGalleryOpen && guest.qr_token ? `/papic/me/${encodeURIComponent(guest.qr_token)}/session?next=pool` : null}
                />
              ) : null}</>, { chapters: true, className: 'space-y-12', id: tabs.on ? SITE_MENU_ANCHORS.gallery : undefined })}

              {/* (The "Keep this event for good" note that stood here folded into the
                  one account card near the top, which says the same thing while
                  the photo window is closing — `photosClosing`.) */}

              {/* Invite/Join v2 — "vendors who made this day": the couple's booked
                  marketplace vendors, savable to a guest's OWN account so they carry to
                  the guest's future planning (the growth loop). RSVP / Event / Editorial
                  only (never Save the Date), and only when there are credited vendors. */}
              {/* A solemn event renders no vendor-save pitch: "Loved a vendor?
                  Keep them… when you plan your own celebration" is marketing on
                  a memorial page. The suppliers who served are still reachable
                  through the marketplace; only the pitch is withheld. */}
              {/* 🕰 ONLY AFTER THE DAY (guest text audit 2026-09-30). "Suppliers
                  who made this day" is past tense — before the event it thanked
                  people for a day that had not happened, and asked guests to
                  shop in the middle of an invitation. And "supplier", never
                  "vendor", on a guest's screen. */}
              {group('home', <>{!clientWords.solemn &&
              eventIsBehind &&
              eventVendorCredits.length > 0 ? (
                <section
                  aria-label="Suppliers who made this day"
                  className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6"
                >
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
                    Suppliers who made this day
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">Loved a supplier? Keep them.</h2>
                  <p className="mt-1 text-sm text-ink/70">
                    Save any supplier here to your Setnayan account — they&rsquo;ll be waiting when you
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
                </section>
              ) : null}</>, { chapters: true, className: 'space-y-12' })}


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
              {group('home', <>{plan.rsvpShouldRender ? (
                <section className="space-y-4">
                  {/* 🎫 NO "YOUR KEEPSAKE" FOR A GUEST WHO IS COMING (owner
                      2026-09-30). It restated the name, the seat, where and when —
                      everything the Digital ticket on Me now carries. The AFTER
                      memento (same component, "You were there") is untouched. */}
                  {guest.rsvp_status === 'declined' ? (
                    /* Declined: a quiet line, never a keepsake — the ticket is
                       for people who are coming (design §11). */
                    <div>
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
                      className={`text-sm font-medium ${rsvpFlash.tone === 'error' ? 'text-terracotta-700' : 'text-ink/80'}`}
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
                  {/* …UNLESS THE TOP CONTROL ALREADY OPENS IT (owner 2026-09-30).
                      "You're going · Change" under the mark links the same sheet
                      (`#your-details` is the arrival action's href now, RSVP_SHEET_ANCHORS), so a
                      second "Need to change your reply…" was the same door twice.
                      Keyed on the action HAVING a Change, not on its words: on
                      the day, or for a guest still owed a reply, it has none and
                      this line is the way in. */}
                  {/* ☝ ONE DOOR TO THE SHEET (owner 2026-10-03). Not when the
                      action under the mark already opens it, and not for a
                      guest who replied on a tabbed page — Me carries "Change
                      your reply" there. A guest still owed a reply on the day
                      keeps this line: it is their only way in. */}
                  {actionOpensReply(arrivalAction) ||
                  (tabs.on && (guest.rsvp_status === 'attending' || guest.rsvp_status === 'declined')) ? null : (
                  <a
                    href="#your-details"
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 text-sm text-ink/80 underline-offset-4 transition-colors hover:text-ink hover:underline"
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
                  )}
                </section>
              ) : null}</>, { chapters: true, className: 'space-y-12' })}

              {/* 🏠 WELCOME — after the reply: this guest's look · Reminders ·
                  E-Gifts (owner 2026-09-30). One self-contained section; what
                  it holds is `welcomeParts`' answer above, nothing decided here.
                  Guarded by `lib/welcome-is-the-guests-own.test.ts`. */}
              {tabs.on && welcome.length === 0 ? null : group('home', (
              <GuestWelcome
                partLooks={welcomeLooks}
                parts={welcome}
                words={clientWords}
                /* 🏠 One home per fact: once Me draws this guest's role and
                   outfit (`meParts`), the Welcome's look stands down. */
                look={meParts.length > 0 ? null : guestLook}
                reminders={
                  remindersScene ? (
                    <HideableWidgetRender
                      widget={remindersScene}
                      canvasMediaUrls={canvasMediaUrls}
                      hubTheme={sceneTheme}
                      ownClipPlays={isMakerCanvas}
                      guestView={!isMakerCanvas}
                      event={event}
                      guest={guest}
                      sideLabel={sideLabel}
                      scheduleBlocks={scheduleBlocks}
                      isLive={isLive}
                      isLimitedPlusOne={isLimitedPlusOne}
                      ourPhotoUrls={ourPhotoUrls}
                      words={clientWords}
                    />
                  ) : null
                }
                giftHref={doorways.pabuya}
              />
              ), { chapters: true, className: 'space-y-12' })}

              {/* 🏠 THE DAY'S WELCOME (owner 2026-09-30, "THE DAY'S MENU HAS
                  FIVE"): after their table (the seat block above), this guest's
                  look, the couple's Reminders and E-Gifts — the Invitation's
                  Welcome, on the day. `welcomePartsOnTheDay` decides; nothing
                  empty is drawn. */}
              {group('home', dayWelcome.length > 0 ? (
                <GuestWelcome
                  partLooks={welcomeLooks}
                  parts={dayWelcome}
                  words={clientWords}
                  look={{
                    config: event.dress_code_config ?? null,
                    ceremonyType: dressRiteOf(event),
                    genderSeparation: (event as { gender_separation?: string | null }).gender_separation ?? null,
                    guestRole: guest.role ?? null,
                    march: marchPlaceOf(entourage, guest.guest_id),
                    rolePalette: event.role_palette,
                  }}
                  reminders={
                    dayRemindersRow ? (
                      <HideableWidgetRender
                        widget={dayRemindersRow}
                        canvasMediaUrls={canvasMediaUrls}
                        hubTheme={sceneTheme}
                        ownClipPlays={isMakerCanvas}
                        guestView={!isMakerCanvas}
                        event={event}
                        guest={guest}
                        sideLabel={sideLabel}
                        scheduleBlocks={scheduleBlocks}
                        isLive={isLive}
                        isLimitedPlusOne={isLimitedPlusOne}
                        ourPhotoUrls={ourPhotoUrls}
                        words={clientWords}
                      />
                    ) : null
                  }
                  march={marchOnWelcome ? guestEntourage : null}
                  venue={<DayDirections venues={dayVenues} />}
                  giftHref={doorways.pabuya}
                />
              ) : null, { chapters: true, className: 'space-y-12' })}

              {/* 🙂 The face-data controls (blur · receipt · remove) are Me's on a
                  tabbed page, beside the Face tagging row (owner 2026-10-03:
                  each thing in one place; Welcome is the guest's look,
                  reminders and E-Gifts). One scroll: here, as before. */}
              {tabs.on ? null : group('home', guest.photo_source === 'selfie' ? (
                <FaceDataNotice eventId={event.event_id} guestId={guest.guest_id} />
              ) : null, { chapters: true, className: 'space-y-12' })}

              {/* The scan-trail switch — UNGATED on purpose. Every recognised
                  guest leaves a scan trail whether or not they ever gave a
                  selfie, so this cannot hide behind the selfie test above.
                  See scan-trail-notice.tsx. */}
              {/* Not in the Maker's canvas, and never for the SAMPLE guest of
                  the "After they reply" preview — it has no row to read, and
                  the honest "we couldn't check" line would be a lie about a
                  person who does not exist (owner 2026-09-27). */}
              {/* ⚖ …in the page body ONLY when there is no reply sheet to carry
                  it (owner 2026-09-30: off the page, into "Your details"). The
                  opt-out is the guest's right under RA 10173, so it may move
                  but never vanish: with the sheet it renders there, below. */}
              {plan.rsvpShouldRender ? null : (
                group('home', (
                <ScanTrailNotice eventId={event.event_id} guestId={guest.guest_id} preview={isEditorCanvas} />
                ), { chapters: true, className: 'space-y-12' })
              )}

              {/* Hideable widgets render here in display_order. The host
                  controls visibility + order via the widget editor at
                  /dashboard/[eventId]/website/widgets — invitation_widgets
                  table column display_order governs the order; is_visible
                  governs which widgets render at all. */}
              {/* Menu-shell "Details" anchor (PR6) — the couple's detail widgets
                  (schedule · dress code · FAQ · registry · …). Present only when
                  at least one such widget rendered, matching menuSections.details. */}
              {menuOn && !tabs.on && detailsSceneList.length > 0 ? (
                <span id={SITE_MENU_ANCHORS.details} aria-hidden className="sr-only" />
              ) : null}
              {/* 🪑 "Your seat · Table 3 →" — the Details scene's seat line (owner
                  2026-09-27, "FIND YOUR SEAT, REDESIGNED" (4): no new bar slot;
                  Details carries it, Me repeats it). Same two facts the pass
                  card's link asks: this kind seats people, the plan is posted. */}
              {/* 📱 …and on a tabbed page it is the guest's own Welcome's: their table. */}
              {/* …but not under the floor plan that already names it: with
                  `seatMap` drawn, the table is on Welcome once (one place per
                  fact on a page — owner 2026-10-02). */}
              {group('home', <>{seatPassActive && !isMakerCanvas && !seatMap ? (
                <SeatDoorLine slug={event.slug ?? ''} tableLabel={guestHubData.tableLabel} />
              ) : null}</>, { chapters: true, className: 'space-y-12' })}
              {/* 🎬 Scroll · Scrub per section (owner 2026-09-24). Byte-identical
                  children unless a section scrubs AND the event owns Event Hub
                  Pro (`proWatermarkHidden` is that read). See hub-scenes.tsx. */}
              {group(scenesTab, <>
              <div className="sn-hub-cards space-y-4">
              <HubScenes widgets={guestAround.before} scrubAllowed={proWatermarkHidden} stageMarks={stageAutoplayOn}>
              {guestAround.before.map(renderScene)}
              </HubScenes>
              </div>

              {/* The same entourage, for the guest tree. TWO MOUNTS, ONE
                  SECTION: the anonymous and guest trees are separate subtrees
                  and a single mount above the fork would land outside Details
                  in one of them. `the-entourage-is-mounted-in-both-trees.test.ts`
                  fails if either disappears.

                  No `previewHref` here either — see the anonymous mount above. */}
              {marchOnWelcome ? null : guestEntourage}
              {/* 🎒 What to bring, after the entourage (owner 2026-10-07). No stage
                  marks: only the Invitation splits, and the marks are the Save the Date's. */}
              {guestAround.after.length > 0 ? (
                <div className="sn-hub-cards space-y-4">
                  <HubScenes widgets={guestAround.after} scrubAllowed={proWatermarkHidden}>
                    {guestAround.after.map(renderScene)}
                  </HubScenes>
                </div>
              ) : null}
              </>, { chapters: true, className: 'space-y-12', id: pageStage === 'event' ? undefined : SITE_MENU_ANCHORS.details })}

              {group('home', isLimitedPlusOne ? (
                <section className="rounded-xl border-l-2 border-ink/30 bg-paper-deep p-5 text-sm text-ink/75">
                  You&rsquo;re joining as a +1. Photos taken of you will appear in your inviter&rsquo;s
                  gallery — ask them to share. In-app features like Shutter
                  require a full Setnayan account, which {clientWords.theOrganizer} hasn&rsquo;t
                  enabled for +1s on this {clientWords.eventWord}.
                </section>
              ) : null, { chapters: true, className: 'space-y-12' })}

              {/* Our Story — the couple's love story on the run-up paths (rsvp/event).
                  The normal body only renders pre-event (STD + editorial are separate
                  branches), so this naturally stays off the post-event Editorial. */}
              {/* Menu-shell "Story" anchor (PR6) — present only when a love story
                  exists (OurStory renders nothing otherwise), matching
                  menuSections.story. */}
              {menuOn && !tabs.on && event.love_story && !storySceneShown ? (
                <span id={SITE_MENU_ANCHORS.story} aria-hidden className="sr-only" />
              ) : null}
              {/* 📱 On a tabbed page this is Our Love Story's own page: the
                  couple's scene of it (moved off Details above), or the prose
                  when there is no scene. One page, drawn once. */}
              {group('story', <>
              {storyScene ? (
                <div className="sn-hub-cards space-y-4">
                  {/* No stage marks: a tabbed page is never the Save the Date the autoplay walks. */}
                  <HubScenes widgets={[storyScene]} scrubAllowed={proWatermarkHidden}>
                    {[storyScene].map(renderScene)}
                  </HubScenes>
                </div>
              ) : null}
              {storySceneShown ? null : <OurStory loveStory={event.love_story} variant="full" />}
              </>, { chapters: true, className: 'space-y-12', id: SITE_MENU_ANCHORS.story })}
              {/* ✍ GUEST COLUMNS ARE NOT ON THE WELCOME ANY MORE (owner 2026-10-04,
                  DECISION_LOG "STORY-TAB PLACEMENT CORRECTED AND APPROVED"):
                  "Write a column" is in the Camera on the day
                  (`app/papic/guest/page.tsx`) and in the Recap after it (the
                  second argument below) — one place per stage, never here. */}
            </>
          ), recapBody ? (<>
          {memento ? (
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
              venueName={venueLine}
              eventDate={event.event_date}
            />
          ) : null}
          {/* ✍ "WRITE A COLUMN" IN THE RECAP (owner 2026-10-04, DECISION_LOG
              "STORY-TAB PLACEMENT CORRECTED AND APPROVED"). After the day the
              guest's column card sits in the Recap, under the story — the paper
              of approved columns, and the form in its closed state (the card
              itself mirrors the editorial cutoff). Guest-session tree only;
              GUEST_COLUMNS_ENABLED + the `guest_columns` DPO control, or null. */}
          <GuestColumnCard
            eventId={event.event_id}
            guestId={guest.guest_id}
            eventDate={event.event_date}
            eventTz={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
            eventEndDate={(event as { event_end_date?: string | null }).event_end_date ?? null}
          />
          </>) : null)}

          {/* Menu-shell "Me" anchor (PR6) — used to be an EMPTY div, so a guest
              who tapped Me scrolled to nothing and the real affordance (their
              personal QR) sat on the GuestHubBar that was covering the menu.
              PR11: GuestHubBar renders the real `#site-me` section under the
              same `menuOn` condition, so this marker would now be a second
              element with the same id — and the first one wins. Removed. */}
          {/* Footer with sign-out — on a tabbed page it is Me's (below). */}
          {tabs.on ? null : signOut}
        </article>
        {/* 👤 ME, ON A TABBED PAGE (owner 2026-09-30: *"Me = the Digital
            ticket"*) — the guest's own section, handed in by page.tsx, then the
            sign-out. A SIBLING of the chapters article, like the reply sheet
            below, so nothing inside it sits under the §6 reveal's transform. */}
        {/* 📐 THE SAME SIDE GUTTER AS EVERY OTHER GUEST STAGE (`px-4`, inside the
            `PLATE` column) — Me was the one stage drawn edge to edge: the name,
            "Not you? Switch", the Save bar and "Photos of you" sat flush on the
            glass (owner walk-through 2026-10-01).
            🎫 ME OPENS ON THE TICKET, SHEET CLOSED. `#site-me` no longer raises the
            reply sheet (rsvp-sheet-state.ts); a guest who has replied changes it
            with this button, which points at the sheet's own anchor. Gated on the
            sheet's own gate (`plan.rsvpShouldRender`) so the button and its
            destination can never disagree about existing — and drawn only when
            the action under the mark does NOT already open the sheet (before the
            day "You're going" is that door; owner 2026-10-03, one place each). */}
        {/* 👁 …and in the Maker's canvas for a See as sample guest (PR-10):
            Me drawn for a sample guest — its ticket from the guest page's own
            GuestTicket (page.tsx), never a Maker-only twin. */}
        {tabs.on || sampleViewer !== null ? group('me', (
          <div data-me-stage="" className={`mx-auto w-full ${PLATE} space-y-12 px-4`}>
            {/* ✉ The Reply card at the top of Me — once they have replied. Before
                a reply, Me already leads with the one reply door (the ticket's
                "Reply to the invitation", `meLeadsWithReply`); a second would be
                the same door twice. */}
            {replyCard && replyCard.kind !== 'ask' ? <ReplyCardRow card={replyCard} /> : null}
            {/* 👤 Your role · What to wear · Arrive by · Coming with you. */}
            {meParts.length > 0 ? (
              <GuestMeParts
                partLooks={meLooks}
                parts={meParts}
                words={clientWords}
                look={{ ...guestLook, roleNames }}
                comingWith={comingWith}
              />
            ) : null}
            {typeof meSection === 'function'
              ? meSection({
                  replyHref: meLeadsWithReply({
                    action: arrivalAction,
                    replyOpen: plan.rsvpShouldRender,
                    isPlusOne: Boolean(guest.plus_one_of_guest_id),
                  })
                    ? `#${REPLY_SHEET_ANCHOR}`
                    : null,
                })
              : meSection}
            {guest.photo_source === 'selfie' ? (
              <FaceDataNotice eventId={event.event_id} guestId={guest.guest_id} />
            ) : null}
            {plan.rsvpShouldRender && (guest.rsvp_status === 'attending' || guest.rsvp_status === 'declined') && !actionOpensReply(arrivalAction) ? (
              <a
                href="#your-details"
                data-me-change-reply=""
                className="button-secondary flex w-full"
              >
                {plan.guestListClosed ? 'Update your details' : 'Change your reply'}
              </a>
            ) : null}
            {signOut}
          </div>
        )) : null}
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
                /* 🏷 THE QUESTION ONLY — never the camera (owner 2026-09-30,
                   "THE TAGGING QUESTION IS ASKED AT RSVP; THE SELFIE IS TAKEN
                   ON THE DAY"). This card used to draw the selfie and enrol a
                   face weeks early; the day-of catch takes it now. Asked only
                   where Papic is active and open and face tagging runs
                   (`resolveFaceTagging`, lib/face-tagging-gate.ts). */
                askTagging={faceTaggingAskable}
                flash={rsvpFlash}
                replyLocked={plan.guestListClosed}
                profileDetails={profileDetails}
                hostPitch={account ? hostPitchShows(account) : false}
                ask={rsvpAsk}
                /* "Ask one question at a time" — the SAME stored value the RSVP
                   page reads (owner 2026-09-27: "this is not one question per
                   screen"). In the Maker's canvas `event` is the couple's DRAFT,
                   so the switch shows here before Apply. */
                oneAtATime={askOneAtATime(event.rsvp_ask_config)}
                answerWords={readRsvpWords(event.rsvp_ask_config)}
                /* 🎨 The reply card's style — the RSVP row's `canvas.style`. */
                sceneStyle={sceneStyleOfRow(
                  widgets.find((w) => w.widget_type === 'rsvp'),
                  pageStage,
                  event.event_type,
                )}
              />
            </div>
            {/* ⚖ THE SCAN-TRAIL OPT-OUT, unchanged, as one small line at the
                foot of "Your details" (owner 2026-09-30) — where a guest goes
                to change what we hold about them. RA 10173: moved, never gone. */}
            <div data-scan-trail-in-details className="mt-6 border-t border-ink/10 pt-4">
              <ScanTrailNotice eventId={event.event_id} guestId={guest.guest_id} preview={isEditorCanvas} />
            </div>
          </RsvpSheet>
        ) : null}
        {/* 🧭 A GUEST'S first-visit tour — never in the Maker's canvas or its
            stage preview (`isEditorCanvas`: both `?editor=1` and
            `?preview=draft`). Seen live 2026-09-27: "You're invited · STEP 1
            OF 3" mounted inside the Maker's RSVP-page preview and covered it.
            Decided here, on the server — the couple is not a guest arriving. */}
        {isEditorCanvas ? null : <GuestGuidedTour tourKey="guest_welcome_v1" tour={guidedTourView('guest_welcome_v1')} />}
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
            slots={guestBar}
          />
        ) : null}
        {/* 📱 Each tab its own page — the hub shell's page frame shows one tab
            at a time and keeps its address (`hub/hub-shell.tsx`). */}
        {menuOn && showGuestBars && tabs.on ? <HubShell frame="page" slots={guestBar} /> : null}
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
      /* 🌈 An ombré is painted by the layout's paper (draft-overlaid for the
         host's canvas, since `event` is the overlaid row) — the shell leaves
         its opaque paper off for it, Classic included — and for any Main
         background layer (a moving background of ours can sit under
         Classic since 2026-10-05), or that layer would be painted over. */
      ownGround={isOmbreValue(event.site_bg_color) || mainGroundLayer !== null}
      backdrop={backdrop}
      fullBleed={plan.fullBleed}
      editorCanvas={!showGuestBars}
      stageLabel={STAGE_BAR[pageStage].label}
      hideWatermark={proWatermarkHidden}
      magicTraveller={magicTraveller}
      /* ✕ One exit, top-left, back to Setnayan — never in a Maker preview,
         which carries its own way back (`makerWayBack`). */
      exitHref={makerWayBack || isMakerCanvas ? null : '/'}
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
      {mainGroundLayer}
      {/* 🖼 The root layout's own floating notices (cookie consent, a stale
          tab) are client components this page cannot un-mount, so in the
          Maker's canvas they are hidden by the one attribute they carry. */}
      {isEditorCanvas ? <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style> : null}
      {/* 🖼 ONE SCENE ALONE (Maker's Hero page, `?only=hero`) — host canvas only,
          hides everything but that scene. See `_lib/editor-canvas.ts`. */}
      {isEditorCanvas && canvasOnly ? <style>{canvasOnlyCss(canvasOnly)}</style> : null}
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
      {/* ↩ THE WAY BACK TO THE MAKER — the preview tab only (DECISION_LOG
          2026-09-28). A sibling of both trees, like the ribbon: never inside the
          chapters article, where a transform breaks `position: fixed`. */}
      {isStagePreview && makerWayBack ? <PreviewWayBack href={makerWayBack} /> : null}
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
        /* 🎬 The opening is the preview tab's and the guests' — never the
           Maker's canvas, where it replayed on every reload (a Guest bars tap
           among them) and hid the scene being edited. */
        enabled={plan.revealEnabled && !isMakerCanvas}
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
          /* 📱 On a tabbed page these doors are the Welcome's. */
          tabAttrs={pageTabs.attrs('home')}
          /* 🪑 "Walk the room in 3D" — on The Day's Welcome only (owner
             2026-10-04, DECISION_LOG "STORY-TAB PLACEMENT CORRECTED AND
             APPROVED"), one quiet line. `doorways.venueWalk` is null unless
             the ONE seat rule opens the room (lib/guests-may-see-seats.ts). */
          venueWalk={pageStage === 'event' ? doorways.venueWalk : null}
          /* 🏠 On the Invitation the gift door is on the Welcome page instead
             (owner 2026-09-30) — one door per page, never two. */
          pabuya={
            welcomeCarriesGifts({ stage: pageStage, bodyNormal: plan.body === 'normal', giftHref: doorways.pabuya, maker: false })
              ? null
              : doorways.pabuya
          }
          broadcast={broadcastNotice}
          dateLabel={event.event_date ? formatEventDate(event.event_date) : null}
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
        <section {...pageTabs.attrs('home')} className={`mx-auto mt-10 w-full ${PLATE} px-4`}>
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
      {isEditorCanvas && editorBridge && !themeTile && !stylePreview ? <EditorBridge /> : null}
      {/* 👁 See as: the sample viewer touches nothing (sample-viewer-inert.tsx). */}
      {sampleViewer !== null ? <SampleViewerInert canvas={isEditorCanvas} /> : null}
      {sceneRunsOnPage ? <HubSceneRuns /> : null}
      </EventWordsProvider>
    </InvitationShell>
  );
}
