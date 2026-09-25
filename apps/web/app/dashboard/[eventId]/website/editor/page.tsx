import { redirect } from 'next/navigation';
import { resolveMonogram } from '@/lib/monogram';
import { countdownTargetMs } from '@/lib/countdown-target';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';
import { nextFreeCustomSlot } from '@/lib/custom-sections';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { getLifecyclePhase, manualLaunchPhase } from '@/lib/invitation-widgets';
import { LaunchStdButton } from '../../studio/save-the-date/_components/launch-std-button';
import {
  MakerWork,
  type MakerRowPanel,
  type MakerScene,
  type RailGroup,
} from './_components/editor-shell';
import { isStoreShellRequest } from '@/lib/request-platform';
import { INVITE_THEMES, normalizeThemeId } from '@/lib/invite-themes';
import { hubMainGround, isHubMainFollow, sanitizeHubCanvas } from '@/lib/hub-canvas';
import { resolveHero } from '@/lib/event-hero';
import { MiniTour } from '@/app/_components/mini-tour';
import { HeroFrameSync, MainBackgroundPanel } from './_components/main-background-panel';
import { HUB_TRANSITION_LABEL, resolveTransition } from '@/lib/hub-scenes';
/* 🔴 `done`/`todo` come from `rail-rows.ts`, NOT from `editor-shell.tsx`. That
   file is `'use client'`, and calling a client export from this server page is
   what returned a 500 for the whole editor (production 2026-09-23, digest
   2184633741). A component may be RENDERED across that boundary; a function may
   not be CALLED across it. */
import { done, todo } from './_components/rail-rows';
import { proPriceLabelFrom } from './_components/unlock-label';
import { TextPanel } from './_components/text-panel';
import {
  invitationWordsDraft,
  INVITATION_WORDS_HINT,
} from '@/lib/invitation-words-draft';
import { ColorsPanel, ProLockPanel } from './_components/pro-panels';
import {
  HeroPhotoPanel,
  GalleryPanel,
  SiteChromePanel,
  VisibilityPanel,
} from './_components/media-panels';
import { updateSiteColors } from '../colors/actions';
import { uploadHeroPhoto } from '../hero-photo/actions';
import {
  MakerHeroPanel,
  MakerLogoPanel,
  MakerRevealPanel,
} from '../../launch/_components/maker-made-once';
import { updateOurPhotos } from '../our-photos/actions';
import { updateSiteChrome } from '../site-chrome/actions';
import { updateLandingPageVisibility } from '../privacy/actions';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { SectionsPanel } from './_components/sections-panel';
import {
  DressCodePanel,
  PhotoMomentsPanel,
  StoryPanel,
  SchedulePeekPanel,
  StdPanel,
  EditorialPanel,
} from './_components/authoring-panels';
import {LaunchPhasePanel,
  OpenBrowsePanel,
  RsvpBackdropPanel,
  } from './_components/media-panels';
import { launchPhaseLabel } from './_components/launch-phase-choices';
import { clearRsvpBackdrop, saveRsvpBackdrop, setLaunchPhase, setOpenBrowse } from './actions';
import { parseRsvpBackdropConfig, SPATIAL_THEMES } from '@/lib/spatial-backdrop';
import { updateOurStory } from '../our-story/actions';
import type { LoveStoryBlob } from '../our-story/_components/story-fields';
import { paletteSwatches } from '@/lib/site-palette';
import type { RolePalette } from '@/lib/mood-board';
import { updateDressCode } from '../dress-code/actions';
import { normalizeDressCodeConfig } from '../dress-code/_components/dress-code-fields';
import { updatePhotoMoments } from '../photo-moments/actions';
import { parsePhotoMomentsConfig } from '../photo-moments/config';
import { eventNoun } from '@/lib/event-noun';
import {
  addCustomSection,
  moveWidgetDown,
  moveWidgetUp,
  saveCustomSection,
  setSectionMode,
  setWidgetBackground,
  setWidgetCrop,
  setWidgetMotion,
  toggleWidgetVisibility,
} from '../widgets/actions';
import {
  computeSectionContentMap,
  SECTION_CONTENT_EVENT_COLUMNS,
} from '@/lib/website-section-content';
import {
  isWidgetType,
  visibleHideableWidgets,
  type InvitationWidgetRow,
} from '@/lib/invitation-widgets';
import { updateSpecialMessage } from '../special-message/actions';
import { readHubDraft } from '@/lib/hub-draft-store';
import { overlayHubDraftEvent, overlayHubDraftWidgets, type HubDraft } from '@/lib/hub-draft';
import { HubSavesImmediately } from '../_components/hub-draft-field';
import { updateWhatToBring } from '../what-to-bring/actions';
import { buildMakerNavigatorData } from './_components/maker-navigator-data';
import { resolveHubPhase } from '@/lib/event-hub-control';
import { readPostEventForMaker } from '@/lib/post-event-compile.server';
import { makerSceneLabel } from '@/lib/maker-scene-list';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { ourStoryRenders } from '@/app/[slug]/_components/our-story';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { ENTOURAGE_ROLES } from '@/lib/entourage';
import { formatEventDate } from '@/lib/events';

/* No `metadata` of its own: opened directly this page only forwards, and inside
   the Maker the Maker's page names the tab. Only ONE surface may declare
   "Event Hub Maker" (`one-event-hub-door.test.ts`). */

/**
 * /dashboard/[eventId]/website/editor — THE unified website editor
 * (design 2026-07-25 · PR-1 of 5).
 *
 * One surface for everything about the couple's website: the controls rail on
 * the left, their REAL page live on the right, edited while they watch it. It
 * absorbs the Launch surface (owner 2026-07-25 "rebuild the launch page and
 * improve it") — go-live + status live in this page's rail/topbar — and it
 * replaces the legacy `/site-editor` as the destination of every edit/preview
 * link (that route redirects here in PR-2).
 *
 * PR-1 scope: shell + live preview + two-way sync + link re-point. Every rail
 * row deep-links to the editor that already owns its setting; PR-3/PR-4 convert
 * them to inline panels calling those SAME server actions (never a new write
 * path). Entitlement presentation only — the Pro gating truth stays in the
 * per-editor gates shipped in PR #3664.
 *
 * ══ 2026-09-25 · THIS IS NOW THE EVENT HUB MAKER'S WORK AREA ══
 * (`EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 1.) The Maker lives at
 * `/dashboard/[eventId]/launch` — menu key `launch`, owner "label change only".
 * That page renders THIS component inside its full-screen shell with
 * `maker=1`, and every panel below is built exactly as before — same reads,
 * same bound actions, same Pro locks — then handed to `MakerWork`, which lays
 * them out as navigator · canvas · inspector instead of a rail.
 * Opened directly (a bookmark, an old link, a save that returns here), it
 * redirects into the Maker, carrying `?open=` / `?pin=` so the row the couple
 * was on is the row they land on.
 */
export default async function WebsiteEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ open?: string; pin?: string; maker?: string; scene?: string; chain?: string }>;
}) {
  const { eventId } = await params;
  const {
    open: openRow,
    pin: pinResult,
    maker: inMaker,
    scene: sceneParam,
    chain: chainParam,
  } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      `event_id, display_name, slug, event_type, event_date, event_end_date, timezone, venue_name, venue_address, landing_page_visibility, std_launched_at, scheduled_launch_at, website_open_browse, launch_mode, manual_phase, love_story, our_photos, site_bg_music_r2_key, landing_page_hero_image_url, site_art_direction, site_bg_color, site_button_color, site_font_key, site_magic_traveller, special_message, what_to_bring, site_bg_music_enabled, landing_page_hero_video_r2_key, dress_code_config, photo_moments_config, role_palette, std_reveal_template, std_theme, invite_theme, std_invitation_launch_date, rsvp_backdrop, ${SECTION_CONTENT_EVENT_COLUMNS}`,
    )
    .eq('event_id', eventId)
    .maybeSingle();
  // ⚠ the event record. Degrades rather than claiming.
  if (eventError) {
    logQueryError('WebsiteEditorPage.event', eventError, { eventId }, 'graceful_degrade');
  }
  if (!event) redirect(`/dashboard/${eventId}`);

  const profile = await resolveProfile((event.event_type as string | null) ?? 'wedding');
  if (!surfaceEnabled(profile, 'website')) redirect(`/dashboard/${eventId}`);

  // Couple gate — mirrors the launch surface this page absorbs (its go-live
  // actions are requireCouple).
  const { data: membership, error: membershipError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  // ⚠ the viewer's membership. An absence here DENIES rather than renders.
  if (membershipError) {
    logQueryError('WebsiteEditorPage.membership', membershipError, { eventId }, 'graceful_degrade');
  }
  if (!membership) redirect(`/dashboard/${eventId}`);

  const [ownsPro, proSku] = await Promise.all([
    eventCoupleWebsiteProActive(supabase, eventId),
    /*
      ⛔ THE PRICE, READ LIVE — the same read `launch/page.tsx` makes.
      `platform_retail_catalog_v2` is admin-managed and is the only figure a
      customer is ever charged. Null on failure, and every unlock button then
      renders with no number rather than a remembered one (`unlock-label.ts`).
    */
    formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null),
  ]);
  // A plain string crosses to the client panels — never a function or icon.
  const proPriceLabel = proPriceLabelFrom(proSku?.price_php, formatPhp);

  const base = `/dashboard/${eventId}`;
  const w = `${base}/website`;
  const slug = (event.slug as string | null) ?? null;
  const visibility = (event.landing_page_visibility ?? 'private') as
    | 'public'
    | 'unlisted'
    | 'private';
  const stdLaunched = Boolean(event.std_launched_at) || visibility === 'public';
  const scheduledAt =
    typeof event.scheduled_launch_at === 'string' ? event.scheduled_launch_at : null;
  const ourPhotos = Array.isArray(event.our_photos) ? event.our_photos : [];

  // The phase the preview opens on = the phase the site is actually in today:
  // the couple's pin when they set one (DAY-33), the clock otherwise.
  const pinnedPhase = manualLaunchPhase(
    (event as { launch_mode?: string | null }).launch_mode,
    (event as { manual_phase?: string | null }).manual_phase,
  );
  const clockPhase = getLifecyclePhase(
    (event.event_date as string | null) ?? null,
    ((event as { timezone?: string | null }).timezone) ?? undefined,
    (event as { event_end_date?: string | null }).event_end_date ?? null,
  );
  const initialPhase = pinnedPhase ?? clockPhase;

  /* Opened on its own — not from inside the Maker — this address forwards to
     the Maker, on the stage the site is in today and on the row the couple was
     editing. The panels' saves still name this path; this is where they land. */
  if (inMaker !== '1') {
    const q = new URLSearchParams({ stage: initialPhase });
    if (typeof openRow === 'string') q.set('open', openRow);
    if (typeof pinResult === 'string') q.set('pin', pinResult);
    redirect(`/dashboard/${eventId}/launch?${q.toString()}`);
  }
  // 🔒 App-store shell: Pro-only rows and their locks are HIDDEN, not locked.
  const storeShell = await isStoreShellRequest();

  // Locked = no Pro AND no existing content (the grandfather rule shipped in
  // PR #3664 — a couple who already has content keeps editing it).
  const lockedIf = (hasContent: boolean) => !ownsPro && !hasContent;
  const proUnlockHref = `${base}/studio/website-pro`;
  /** A locked Pro row's inline panel: one honest line + the ONE umbrella CTA.
   *  Nothing at all in the store shell — no pitch, no price (App Review 3.1.1). */
  const lockPanel = (featureName: string) =>
    storeShell ? null : (
      <ProLockPanel
        featureName={featureName}
        unlockHref={proUnlockHref}
        priceLabel={proPriceLabel}
      />
    );

  // Presigned display URLs so the inline uploaders show what's already set
  // (same helper the sub-pages use).
  const heroRef = (event.landing_page_hero_image_url as string | null) ?? null;
  const musicRef = (event.site_bg_music_r2_key as string | null) ?? null;
  const videoRef = (event.landing_page_hero_video_r2_key as string | null) ?? null;
  const galleryRefs = ourPhotos.filter((r): r is string => typeof r === 'string');
  const displayFor = async (refs: Array<string | null>) => {
    const out: Record<string, string> = {};
    await Promise.all(
      refs
        .filter((r): r is string => Boolean(r))
        .map(async (ref) => {
          // 🔒 Every ref here is couple-writable website media: held to the
          // public bucket before signing (lib/site-media-ref.ts).
          const url = await displayUrlForStoredAsset(siteMediaServeRef(ref));
          if (url) out[ref] = url;
        }),
    );
    return out;
  };
  const [heroDisplay, galleryDisplay, chromeDisplay] = await Promise.all([
    displayFor([heroRef]),
    displayFor(galleryRefs),
    displayFor([musicRef, videoRef]),
  ]);

  /* 🎨 The photos a couple may use as a section background — their own hero
     first, then their gallery, each with the display URL this page ALREADY
     signed for the inline uploaders. No second signing pass, and no photo from
     anywhere but this event. */
  const photoChoices = [heroRef, ...galleryRefs]
    .filter((ref): ref is string => Boolean(ref))
    .map((ref) => ({ ref, url: heroDisplay[ref] ?? galleryDisplay[ref] ?? '' }))
    .filter((p) => p.url.length > 0);

  /* 🎬 The ONE video an event owns. `displayFor([musicRef, videoRef])` above
     already signed it for the inline uploader, so this is a lookup, not a
     second signing pass. Null when they have none — the picker then simply
     does not offer a snippet, rather than offering a control that cannot work. */
  const videoDisplay = chromeDisplay[videoRef ?? ''] ?? '';
  const videoChoice =
    videoRef && videoDisplay ? { ref: videoRef, url: videoDisplay } : null;

  /* 🎨 A flat ground is chosen FROM the wedding. `paletteSwatches` is the same
     reader the dress-code panel seeds from, so the colours a couple sees here
     are the colours they already picked — not a free wheel that invites a
     ground fighting every other surface on the page. */
  const colorChoices = paletteSwatches(
    (event as { role_palette?: RolePalette | null }).role_palette ?? null,
  ).slice(0, 8);

  // Sections manager data — the same reads the widgets sub-editor does.
  const { data: widgetsRaw, error: widgetsRawError } = await supabase
    .from('invitation_widgets')
    .select(
      'widget_id, event_id, widget_type, display_order, is_visible, is_always_on, tier, config_json, created_at, updated_at, mode, audience',
    )
    .eq('event_id', eventId);
  // ⚠ 🚨 THE COUPLE'S OWN WEBSITE BLOCKS. Refused, the editor opens EMPTY — every
  // ⚠ widget they placed is absent, and an editor that loads blank invites them to
  // ⚠ rebuild a page that already exists. Worse: saving from that state could
  // ⚠ overwrite the real one with nothing.
  if (widgetsRawError) {
    logQueryError('WebsiteEditorPage.widgetsRaw', widgetsRawError, { eventId }, 'graceful_degrade');
  }
  const liveWidgets: InvitationWidgetRow[] = ((widgetsRaw ?? []) as Array<
    Omit<InvitationWidgetRow, 'widget_type'> & { widget_type: string }
  >)
    .filter((r): r is InvitationWidgetRow => isWidgetType(r.widget_type))
    .map((r) => r as InvitationWidgetRow);

  /* 💾 THE MAKER EDITS THE DRAFT, SO IT SHOWS THE DRAFT (Phase 2). Every
     draft-capable form below posts `draft=1`; if the panels and the navigator
     then read the LIVE rows, a drafted eye would never flip and a drafted motion
     would never look chosen — the couple would press it again and again. So the
     draft is laid over the live rows here, with the SAME overlay the host's
     `?editor=1` preview uses (`overlayHubDraftWidgets`), and every control reads
     what the preview shows.
     ⚠ A draft that cannot be read is logged and the live rows are shown; the
     toolbar's own read (`loadHubDraftBarData`) renders that failure as
     "could not read your draft", never as "no changes". */
  let hubDraft: HubDraft | null = null;
  try {
    hubDraft = await readHubDraft(supabase, eventId);
  } catch (e) {
    console.error('[hub-draft] editor could not read the draft:', e instanceof Error ? e.message : e);
  }
  const allWidgets = overlayHubDraftWidgets(liveWidgets, hubDraft);

  /* 🎞 THE MAIN BACKGROUND (Maker Phase 10) — BY DEFAULT THE HERO (owner,
     2026-09-25 item 6: "whatever they make on the hero scene will be their
     cover and the main background"), with the adaptive theme riding on it; an
     explicit "different clip or photo" is the opt-in override. Stored on the
     hero row (`hubMainGround`), so the draft-over-live read above is the one
     the panel shows, and "in your draft" is that read against live. The hero is
     read through the one resolver (`resolveHero`) over the DRAFTED event row, so
     a hero just changed in the Hero workspace is the one measured. Pro, so it
     is HIDDEN in the store shell (never shown locked there). */
  const mainLive = hubMainGround(liveWidgets.find((r) => r.widget_type === 'hero')?.config_json);
  const mainNow = hubMainGround(allWidgets.find((r) => r.widget_type === 'hero')?.config_json);
  const draftedHero = resolveHero(overlayHubDraftEvent(event as Record<string, unknown>, hubDraft));
  const signOrNull = async (ref: string | null) =>
    ref ? await displayUrlForStoredAsset(siteMediaServeRef(ref)).catch(() => null) : null;
  const [heroPhotoUrl, mainOverrideStillUrl] = await Promise.all([
    signOrNull(draftedHero.photoRef),
    signOrNull(mainNow && !isHubMainFollow(mainNow) ? (mainNow.kind === 'photo' ? mainNow.media : (mainNow.poster ?? null)) : null),
  ]);
  const mainThemeId = normalizeThemeId((event as { invite_theme?: string | null }).invite_theme) ?? 'house';
  const currentThemeId = (event as { invite_theme?: string | null }).invite_theme ?? 'house';
  // Hideable rows only — always-on sections can't be hidden or moved, so
  // offering the controls would be a lie. Ordered by display_order.
  const sectionRows = [...allWidgets]
    .filter((r) => !r.is_always_on)
    .sort((a, b) => a.display_order - b.display_order);
  const sectionContent = await computeSectionContentMap(
    supabase,
    eventId,
    event as Parameters<typeof computeSectionContentMap>[2],
    // The couple's own sections keep their words on their OWN row, so the rows
    // have to travel with the event for the map to know whether one is empty.
    allWidgets,
  );

  // Public schedule blocks — the same set guests see (source of truth stays
  // the Schedule page; the panel mirrors it + links there).
  const { data: scheduleBlocksRaw, error: scheduleBlocksRawError } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, label, start_at, location')
    .eq('event_id', eventId)
    .eq('is_public', true)
    .order('start_at', { ascending: true })
    .limit(12);
  // ⚠ the schedule the couple authored, shown on their site. Refused, the day reads
  // ⚠ as having no events in it.
  if (scheduleBlocksRawError) {
    logQueryError('WebsiteEditorPage.scheduleBlocksRaw', scheduleBlocksRawError, { eventId }, 'graceful_degrade');
  }
  const scheduleBlocks = (scheduleBlocksRaw ?? []) as Array<{
    block_id: string;
    label: string;
    start_at: string;
    location: string | null;
  }>;

  /* 💾 THE PANELS SHOW THE DRAFT THEY SAVE INTO (2026-09-25). The Colors,
     Text, Our story, Dress code and Camera cues panels now post `draft=1`, so
     each reads its column from the draft laid over the live row — the same
     overlay the host's canvas renders — or a drafted edit would vanish from the
     panel that just saved it. (Locks and grandfathering still read `event`:
     what the couple already HAS live, never what they are trying.) */
  const drafted = overlayHubDraftEvent(event as Record<string, unknown>, hubDraft) as typeof event;

  const story: LoveStoryBlob =
    drafted.love_story && typeof drafted.love_story === 'object'
      ? (drafted.love_story as LoveStoryBlob)
      : {};

  const dressCodeConfig = normalizeDressCodeConfig(
    (drafted as { dress_code_config?: unknown }).dress_code_config,
  );
  // Dress code starts from the Mood Board (owner 2026-07-25): when the couple
  // hasn't set a palette yet, seed the panel's swatches from role_palette so
  // "edit" begins from their own colours, not a blank. Saving persists the
  // override — the source shows, the couple can change it (their call A).
  if (dressCodeConfig.palette.length === 0) {
    dressCodeConfig.palette = paletteSwatches(
      (event as { role_palette?: RolePalette | null }).role_palette ?? null,
    )
      .slice(0, 6)
      .map((hex) => ({ name: '', hex }));
  }

  /* The hero panel posts into the draft too (`uploadHeroPhoto`'s Phase 6
     door), so it shows the drafted photo — signed here only when it is not the
     live one already signed above. */
  const heroPanelRef = (drafted.landing_page_hero_image_url as string | null) ?? null;
  const heroPanelDisplay =
    heroPanelRef && !heroDisplay[heroPanelRef] ? await displayFor([heroPanelRef]) : heroDisplay;

  const photoMomentsConfig = parsePhotoMomentsConfig(
    (drafted as { photo_moments_config?: unknown }).photo_moments_config,
  );

  // The backdrop the public invitation already renders. Parsed through the same
  // guard the site uses, so a malformed row shows as "off" here exactly as it
  // shows as no backdrop there — the editor and the page cannot disagree.
  const rsvpBackdrop = parseRsvpBackdropConfig(
    // The drafted backdrop when there is one — the panel shows what the preview shows.
    overlayHubDraftEvent(event as Record<string, unknown>, hubDraft).rsvp_backdrop,
  );

  /* 🎨 The background colour is FREE (owner 2026-09-24: "changing background
     color is free"), so the Colours row is never locked as a whole. Only its Pro
     half — buttons, face, art direction, magic move — locks, and with the same
     grandfather: a couple who already chose any of them keeps that half. */
  const colorsProLocked = lockedIf(
    Boolean(
      event.site_button_color ||
        (event as { site_font_key?: string | null }).site_font_key ||
        (event as { site_magic_traveller?: string | null }).site_magic_traveller ||
        event.site_art_direction === 'candlelight',
    ),
  );
  // The song and the hero video share one panel, so either one keeps it open.
  const musicLocked = lockedIf(Boolean(event.site_bg_music_r2_key || videoRef));
  const galleryLocked = lockedIf(ourPhotos.length > 0);
  /* 📷 THE LOOK IS PRO (owner 2026-09-24, "A" — "Free is the page we write. Pro
     is changing how it looks."). Their own hero photo and the invitation
     backdrop join the rows above. Same grandfather: a couple who already has
     one keeps its panel, and the server lets them take it off. */
  const heroLocked = lockedIf(Boolean(heroRef));
  const backdropLocked = lockedIf(Boolean(rsvpBackdrop));

  const groups: RailGroup[] = [
    {
      key: 'site',
      title: '① Site',
      rows: [
        {
          key: 'url',
          label: 'Event Hub address',
          blurb: 'Your one link, on every QR and invite.',
          href: `${w}/editor`,
          status: slug ? done(slug) : todo('Not set'),
        },
        {
          key: 'visibility',
          label: 'Who can view',
          blurb: 'Private while you build, public when you launch.',
          href: `${w}/privacy`,
          /* 🔑 `Private` IS THE ROW THIS FIX EXISTS FOR. It used to carry the
             success chip — the same green as a published site — to a couple
             whose wedding page nobody at all could open. `Unlisted` stays green:
             a link-only site is a deliberate, working choice, not an empty one. */
          status:
            visibility === 'private'
              ? todo('Private')
              : visibility === 'public'
                ? done('Public')
                : done('Unlisted'),
          panel: (
            <VisibilityPanel
              action={updateLandingPageVisibility}
              eventId={eventId}
              visibility={visibility}
            />
          ),
        },
        {
          key: 'launch-phase',
          label: 'Which version guests see',
          blurb: 'Let the date decide, or keep one version up — like the RSVP.',
          href: `${w}/editor?open=launch-phase`,
          status: pinnedPhase ? done(`Always: ${launchPhaseLabel(pinnedPhase)}`) : todo('Automatic'),
          panel: (
            <LaunchPhasePanel
              action={setLaunchPhase}
              eventId={eventId}
              pinned={pinnedPhase}
              autoPhase={clockPhase}
              refused={pinResult === 'refused'}
            />
          ),
        },
        {
          key: 'open-browse',
          label: 'Open browsing',
          blurb: 'Let guests browse every page from day one.',
          href: `${w}/widgets`,
          status: event.website_open_browse === true ? done('On') : todo('Off'),
          panel: (
            <OpenBrowsePanel
              action={setOpenBrowse}
              eventId={eventId}
              on={event.website_open_browse === true}
            />
          ),
        },
        {
          key: 'backdrop',
          label: 'Invitation backdrop',
          blurb: 'A scene that moves behind your invitation as guests scroll.',
          href: `${w}/widgets`,
          status: rsvpBackdrop ? done(SPATIAL_THEMES[rsvpBackdrop.theme].label) : todo('Off'),
          pro: true,
          locked: backdropLocked,
          panel: backdropLocked ? (
            lockPanel('Invitation backdrop')
          ) : (
            <RsvpBackdropPanel
              saveAction={saveRsvpBackdrop}
              clearAction={clearRsvpBackdrop}
              eventId={eventId}
              current={rsvpBackdrop}
            />
          ),
        },
        ...(storeShell
          ? []
          : [
              {
                key: 'main-background',
                label: 'Behind every scene',
                blurb: 'Your hero behind every scene — the theme’s colours follow it.',
                href: `${base}/launch?open=main-background`,
                status:
                  mainNow && !isHubMainFollow(mainNow)
                    ? done(mainNow.kind === 'snippet' ? 'Your clip' : 'Your photo')
                    : draftedHero.photoRef
                      ? done('Your hero')
                      : todo('Theme’s own'),
                pro: true,
                locked: false,
                panel: (
                  <>
                    {/* First visit only — the hint opens the first time the couple opens Main. */}
                    <MiniTour tourKey="customer_adaptive_theme_v1" storeShell={storeShell} />
                    <MainBackgroundPanel
                      eventId={eventId}
                      themeId={mainThemeId}
                      current={mainNow}
                      hero={{
                        photoRef: draftedHero.photoRef,
                        photoUrl: heroPhotoUrl,
                        hasClip: Boolean(draftedHero.videoRef),
                      }}
                      overrideStillUrl={mainOverrideStillUrl}
                      drafted={JSON.stringify(mainNow) !== JSON.stringify(mainLive)}
                      ownsPro={ownsPro}
                    />
                  </>
                ),
              },
            ]),
        {
          key: 'colors',
          label: 'Colors',
          blurb: 'Background and button colors.',
          href: `${w}/colors`,
          pro: true,
          locked: false,
          panel: (
            <ColorsPanel
              action={updateSiteColors.bind(null, eventId)}
              eventId={eventId}
              rowKey="colors"
              proLocked={colorsProLocked}
              proLock={lockPanel('Button colour, typeface and motion')}
              bgColor={(drafted.site_bg_color as string | null) ?? null}
              buttonColor={(drafted.site_button_color as string | null) ?? null}
              artDirection={
                (drafted.site_art_direction as 'daylight' | 'candlelight' | null) ?? null
              }
              fontKey={(drafted as { site_font_key?: string | null }).site_font_key ?? null}
              magicTraveller={
                (drafted as { site_magic_traveller?: string | null }).site_magic_traveller ?? null
              }
            />
          ),
        },
        {
          key: 'music',
          label: 'Background music',
          blurb: 'A song that plays softly as guests browse.',
          href: `${w}/site-chrome`,
          pro: true,
          locked: musicLocked,
          panel: musicLocked ? (
            lockPanel('Background music')
          ) : (
            <SiteChromePanel
              action={updateSiteChrome.bind(null, eventId)}
              eventId={eventId}
              musicRef={musicRef}
              musicEnabled={event.site_bg_music_enabled === true}
              musicDisplay={chromeDisplay}
              videoRef={videoRef}
              videoDisplay={chromeDisplay}
            />
          ),
        },
      ],
    },
    {
      key: 'sections',
      title: '② Sections',
      hint: 'hover = preview scrolls',
      rows: [
        {
          key: 'hero',
          label: 'Hero',
          blurb: 'The photo and names at the top.',
          href: `${w}/hero-photo`,
          anchor: 'home',
          status: heroRef ? done('Photo set') : todo('Not set'),
          pro: true,
          locked: heroLocked,
          panel: heroLocked ? (
            lockPanel('Your own hero photo')
          ) : (
            <HeroPhotoPanel
              action={uploadHeroPhoto}
              eventId={eventId}
              currentRef={heroPanelRef}
              displayUrls={heroPanelDisplay}
            />
          ),
        },
        {
          key: 'story',
          label: 'Our story',
          blurb: 'How you met, the proposal, the milestones.',
          href: `${w}/our-story`,
          anchor: 'story',
          status: drafted.love_story ? done('Written') : todo('Not set'),
          panel: (
            <StoryPanel
              action={updateOurStory.bind(null, eventId)}
              eventId={eventId}
              story={story}
            />
          ),
        },
        {
          key: 'details',
          label: 'Details & schedule',
          blurb: 'Date, venue, run-of-show.',
          href: `${w}/widgets`,
          anchor: 'details',
          status:
            scheduleBlocks.length > 0
              ? done(`${scheduleBlocks.length} public`)
              : todo('No schedule'),
          panel: (
            <SchedulePeekPanel
              eventId={eventId}
              eventDate={(event.event_date as string | null) ?? null}
              venueName={(event as { venue_name?: string | null }).venue_name ?? null}
              venueAddress={(event as { venue_address?: string | null }).venue_address ?? null}
              blocks={scheduleBlocks}
            />
          ),
        },
        {
          key: 'gallery',
          label: 'Photos you add',
          blurb: 'A gallery you upload yourself.',
          href: `${w}/our-photos`,
          anchor: 'gallery',
          pro: true,
          locked: galleryLocked,
          status: galleryLocked
            ? undefined
            : galleryRefs.length > 0
              ? done(`${galleryRefs.length} photo${galleryRefs.length === 1 ? '' : 's'}`)
              : todo('0 photos'),
          panel: galleryLocked ? (
            lockPanel('Photos you add')
          ) : (
            <GalleryPanel
              action={updateOurPhotos.bind(null, eventId)}
              eventId={eventId}
              currentRefs={galleryRefs}
              displayUrls={galleryDisplay}
              maxFiles={24}
            />
          ),
        },
        {
          key: 'dress-code',
          label: 'Dress code',
          blurb: 'Palette, dos and don’ts.',
          href: `${w}/dress-code`,
          anchor: 'details',
          panel: (
            <DressCodePanel
              action={updateDressCode.bind(null, eventId)}
              eventId={eventId}
              config={dressCodeConfig}
              eventNoun={eventNoun((event.event_type as string | null) ?? 'wedding')}
            />
          ),
        },
        {
          key: 'photo-moments',
          label: 'Camera cues',
          blurb: 'When you want guests shooting, and when present.',
          href: `${w}/photo-moments`,
          anchor: 'details',
          panel: <PhotoMomentsPanel eventId={eventId} initial={photoMomentsConfig} />,
        },
        {
          key: 'special-message',
          label: 'Special message',
          blurb: 'A note to your guests.',
          href: `${w}/special-message`,
          anchor: 'details',
          status: drafted.special_message ? done('Written') : todo('Not set'),
          // Inline panel (PR-3) — posts to the SAME action the sub-page uses.
          panel: (
            <TextPanel
              action={updateSpecialMessage.bind(null, eventId)}
              eventId={eventId}
              rowKey="special-message"
              name="message"
              label="Your message"
              maxLength={600}
              placeholder="A heartfelt note to everyone joining you…"
              /* AP-11 · THE BOX STARTS SOMEWHERE. It was blank, and a blank box
                 in front of a whole guest list is why most couples write
                 nothing and the section never appears on their site.
                 ⛔ NOTHING IS SAVED. `invitationWordsDraft` returns null the
                 moment any words exist, so it can never sit on top of somebody's
                 own message, and the stored column stays empty until they press
                 Save — which is why the row above still honestly reads "Not set".
                 ⛔ NOT A LANGUAGE MODEL. Deterministic, and it says only what
                 the event already knows; with nothing known it returns null and
                 the box is exactly as blank as before. */
              defaultValue={
                (drafted.special_message as string | null) ||
                invitationWordsDraft({
                  displayName: (event.display_name as string | null) ?? null,
                  eventDate: (event.event_date as string | null) ?? null,
                  venueName: (event.venue_name as string | null) ?? null,
                  occasionNoun: profile.terminology.occasionNoun,
                  // 🕊 THE LINE THAT MATTERS MOST. A wake takes the solemn arm;
                  // a cheerful auto-draft on a funeral page is precisely the
                  // defect the whole solemn register exists to prevent.
                  register: profile.terminology.register,
                  existing: (drafted.special_message as string | null) ?? null,
                }) ||
                ''
              }
              hint={
                drafted.special_message ? undefined : INVITATION_WORDS_HINT
              }
            />
          ),
        },
        {
          key: 'what-to-bring',
          label: 'What to bring',
          blurb: 'Gifts, registry, or a kind no-gift note.',
          href: `${w}/what-to-bring`,
          anchor: 'details',
          status: drafted.what_to_bring ? done('Written') : todo('Not set'),
          panel: (
            <TextPanel
              action={updateWhatToBring.bind(null, eventId)}
              eventId={eventId}
              rowKey="what-to-bring"
              name="note"
              label="What to bring"
              maxLength={600}
              placeholder="Gifts, registry, or a kind no-gift note…"
              defaultValue={(drafted.what_to_bring as string | null) ?? ''}
            />
          ),
        },
        {
          key: 'sections-order',
          label: 'Show, hide & reorder',
          blurb: 'What appears on your site, and in what order.',
          href: `${w}/widgets`,
          status: (() => {
            const showing = sectionRows.filter((r) => r.is_visible).length;
            return showing > 0 ? done(`${showing} showing`) : todo('0 showing');
          })(),
          panel: (
            <SectionsPanel
              eventId={eventId}
              rows={sectionRows}
              contentMap={sectionContent}
              toggleAction={toggleWidgetVisibility}
              moveUpAction={moveWidgetUp}
              moveDownAction={moveWidgetDown}
              setModeAction={setSectionMode}
              setMotionAction={setWidgetMotion}
              transitionLocked={!ownsPro}
              setBackgroundAction={setWidgetBackground}
              setCropAction={setWidgetCrop}
              saveCustomAction={saveCustomSection}
              addCustomAction={addCustomSection}
              photoChoices={photoChoices}
              /* Two Pro locks, both the SAME panel every other Pro row uses,
                 passed as ELEMENTS: a section of their own (owner 2026-09-22)
                 and how each section looks and moves (owner 2026-09-24). The
                 actions refuse a free couple independently. */
              ownsPro={ownsPro}
              customLock={lockPanel('A section of your own')}
              lookLock={lockPanel('How each section looks and moves')}
              videoChoice={videoChoice}
              colorChoices={colorChoices}
              sceneStage={
                /* The prototype's heading words: "Add a scene to the Invitation",
                   "…to Save the Date", "…to On the Day", "…to Post Event". */
                initialPhase === 'rsvp' ? `the ${PUBLIC_STAGE_LABELS.rsvp}` : PUBLIC_STAGE_LABELS[initialPhase]
              }
            />
          ),
        },
      ],
    },
    {
      key: 'chapters',
      title: '③ Chapters',
      rows: [
        {
          key: 'save-the-date',
          label: 'Save-the-Date',
          blurb: 'The announcement film — opening, video, launch date.',
          href: `${base}/studio/save-the-date`,
          // The film itself is free; its Cinematic Reveal + video beats are Pro
          // (already gated in the STD studio via STD_PREMIUM_OPENINGS →
          // COUPLE_WEBSITE_PRO), so we only hint here — never block the row.
          status: ownsPro ? done('Pro beats on') : undefined,
          panel: (
            <StdPanel
              eventId={eventId}
              openingLabel={String(
                (event as { std_reveal_template?: string | null }).std_reveal_template ?? 'sheer veil',
              ).replace(/_/g, ' ')}
              themeLabel={
                (event as { std_theme?: string | null }).std_theme?.replace(/_/g, ' ') ?? null
              }
              launchDate={
                (event as { std_invitation_launch_date?: string | null })
                  .std_invitation_launch_date ?? null
              }
            />
          ),
        },
        {
          key: 'editorial',
          label: 'After — your editorial',
          blurb: 'The story page guests revisit after the day.',
          href: `${w}/editorial`,
          pro: true,
          locked: !ownsPro,
          // Free-vs-Pro split, honest in BOTH states (owner 2026-07-25).
          panel: (
            <EditorialPanel
              eventId={eventId}
              ownsPro={ownsPro}
              unlockHref={proUnlockHref}
              priceLabel={proPriceLabel}
            />
          ),
        },
      ],
    },
  ];

  /* ══ THE MAKER'S PARTS ══════════════════════════════════════════════════
     The rows above are the same rows the rail carried, with the same panels.
     The Maker addresses them by key: the navigator's scenes open their own
     section controls, the bar's tools open a row, "Main" opens the look. */
  const rows: Record<string, MakerRowPanel> = {};
  for (const row of groups.flatMap((g) => g.rows)) {
    if (!row.panel) continue;
    // 🔒 Store shell: a locked Pro row is HIDDEN, not shown locked.
    if (storeShell && row.pro && row.locked) continue;
    rows[row.key] = {
      label: row.label,
      blurb: row.blurb,
      anchor: row.anchor,
      status: row.status,
      node: row.panel,
    };
  }
  // The go-live control the rail's top carried — now in the ⋯ sheet.
  rows['go-live'] = {
    label: 'Go live',
    blurb: 'Open your Event Hub to guests, or schedule it.',
    node: (
      <>
      <HubSavesImmediately className="mb-2" />
      <LaunchStdButton
        eventId={eventId}
        slug={slug}
        initialLaunched={stdLaunched}
        initialScheduledAt={scheduledAt}
      />
      </>
    ),
  };

  /* One scene per section of the page, in the order guests meet them. The
     transition label is the section's own (`resolveTransition`), read from the
     same canvas JSON the guest page reads. */
  const scenes: MakerScene[] = sectionRows.map((row) => ({
    id: row.widget_id,
    type: row.widget_type,
    // A scene from a template is named by its template ("Three mosaic"), so
    // six "Your own section" rows are told apart in the navigator.
    label: (() => {
      const t = sanitizeHubCanvas(row.config_json).template;
      // 🗣 Guest-facing words (`makerSceneLabel`), never the catalogue's internal names.
      return t ? SCENE_TEMPLATES[t].name : makerSceneLabel(row.widget_type);
    })(),
    mode: (row.mode ?? 'auto') as MakerScene['mode'],
    isVisible: row.is_visible,
    hasContent: sectionContent[row.widget_type] !== false,
    transitionLabel: HUB_TRANSITION_LABEL[resolveTransition(sanitizeHubCanvas(row.config_json))],
  }));
  /* 🧭 THE NAVIGATOR FOLLOWS THE PAGE (owner 2026-09-25: *"why does the slides
     not follow the sequence alotted"*). For each stage, what the canvas draws,
     in its order — asked of the page's own plan (`lib/maker-scene-list.ts`) —
     with the fold of what that stage leaves out and why. */
  const { count: entourageCount, error: entourageError } = await supabase
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .or(`role.in.(${ENTOURAGE_ROLES.join(',')}),extra_roles.ov.{${ENTOURAGE_ROLES.join(',')}}`);
  // ⚠ Unread is NOT "nobody": the page reads the entourage with its own client,
  // so an unreadable count keeps the tile rather than hiding a real section.
  if (entourageError) {
    logQueryError('WebsiteEditorPage.entourageCount', entourageError, { eventId }, 'graceful_degrade');
  }
  const eventTz = ((event as { timezone?: string | null }).timezone) ?? 'Asia/Manila';
  const countdownMs = countdownTargetMs((event.event_date as string | null) ?? null, eventTz);
  const firstBlock = scheduleBlocks[0] ?? null;
  /*
    📖 POST EVENT, WRITTEN FOR THEM (Maker Phase 8). After the day — the
    has-it-happened resolver, never the website phase, which reaches
    'editorial' by a second path — the story's scenes are compiled from what
    happened. The repo has no scheduler, so the couple's open of the Maker IS
    the moment it is written (`lib/post-event-compile.server.ts`). This page is
    couple-only (the membership gate above), so this open may write.
  */
  const postEvent =
    resolveHubPhase({
      measured: true,
      eventDate: (event.event_date as string | null) ?? null,
      eventEndDate: (event as { event_end_date?: string | null }).event_end_date ?? null,
      timezone: (event as { timezone?: string | null }).timezone ?? null,
    }) === 'after'
      ? await readPostEventForMaker({ eventId, eventEnded: true, isCouple: true })
      : null;

  const navigator = buildMakerNavigatorData({
    postEvent,
    plan: {
      widgets: allWidgets,
      openBrowse: Boolean((event as { website_open_browse?: boolean | null }).website_open_browse),
      weddingOnlyParts: resolveWeddingOnlyParts(profile),
      content: sectionContent,
      solemn: (await eventWordsFor((event.event_type as string | null) ?? 'wedding')).solemn,
      hasHeroMedia: Boolean(heroRef || videoRef),
      hasEntourage: entourageCount === null ? true : entourageCount > 0,
      storyRenders: ourStoryRenders(event.love_story),
      countdownPast: countdownMs !== null && countdownMs <= Date.now(),
    },
    sectionRows,
    tint: (() => {
      const pal = INVITE_THEMES[currentThemeId as keyof typeof INVITE_THEMES]?.palette ?? INVITE_THEMES.house.palette;
      return { canvas: pal.canvas, ink: pal.ink, accent: pal.accent };
    })(),
    facts: {
      names: (event.display_name as string | null) ?? null,
      dateLabel: event.event_date ? formatEventDate(event.event_date as string) : null,
      daysToGo: countdownMs === null ? null : Math.max(0, Math.ceil((countdownMs - Date.now()) / 86_400_000)),
      venueName: (event.venue_name as string | null) ?? null,
      venueAddress: (event.venue_address as string | null) ?? null,
      firstBlock: firstBlock
        ? {
            label: firstBlock.label,
            time: (() => {
              const d = new Date(firstBlock.start_at);
              return Number.isNaN(d.getTime())
                ? null
                : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: eventTz });
            })(),
          }
        : null,
      dressTitle: dressCodeConfig.title || null,
      dressLine: dressCodeConfig.description || null,
      photoMomentsLine: photoMomentsConfig.intro_copy || photoMomentsConfig.moments[0]?.title || null,
      specialMessage: (event.special_message as string | null) ?? null,
      whatToBring: (event.what_to_bring as string | null) ?? null,
      loveStory: event.love_story,
      entourageCount: entourageCount ?? null,
      heroPhotoUrl: heroRef ? (heroDisplay[heroRef] ?? null) : null,
      firstGalleryUrl: galleryRefs[0] ? (galleryDisplay[galleryRefs[0]] ?? null) : null,
    },
    photoUrls: { ...heroDisplay, ...galleryDisplay },
  });

  const scenePanels = Object.fromEntries(
    sectionRows.map((row) => [
      row.widget_id,
      <SectionsPanel
        key={row.widget_id}
        only={row.widget_id}
        returnTo={`/dashboard/${eventId}/launch?scene=${row.widget_id}`}
        hideLocked={storeShell}
        eventId={eventId}
        rows={sectionRows}
        contentMap={sectionContent}
        toggleAction={toggleWidgetVisibility}
        moveUpAction={moveWidgetUp}
        moveDownAction={moveWidgetDown}
        setModeAction={setSectionMode}
        setMotionAction={setWidgetMotion}
        transitionLocked={!ownsPro}
        setBackgroundAction={setWidgetBackground}
        setCropAction={setWidgetCrop}
        saveCustomAction={saveCustomSection}
        addCustomAction={addCustomSection}
        photoChoices={photoChoices}
        ownsPro={ownsPro}
        customLock={lockPanel('A section of your own')}
        lookLock={lockPanel('How each section looks and moves')}
        videoChoice={videoChoice}
        colorChoices={colorChoices}
      />,
    ]),
  );

  /* The theme panel reads the registry as it stands at merge time (Phase 3
     owns it). Only id · name · ready cross — plain strings. */
  const currentTheme = currentThemeId;
  const themes = Object.values(INVITE_THEMES).map((t) => ({
    id: t.id,
    name: t.name,
    ready: t.ready,
    current: t.id === currentTheme,
  }));

  return (
    <MakerWork
      eventId={eventId}
      /* 🧩 Phase 6 — Logo · Hero · Reveal, made once, each drafted. */
      madeOnce={{
        hero: (
          <>
            <MakerHeroPanel eventId={eventId} ownsPro={ownsPro} storeShell={storeShell} />
            {/* 🎞 The hero is also the Main background (owner 2026-09-25 item 6):
                a new hero photo is measured HERE, where it was made, so the page
                behind every scene follows it without a second step. Themed, and
                never in the store shell (the adaptive theme is Pro). */}
            {!storeShell && mainThemeId !== 'house' ? (
              <HeroFrameSync
                eventId={eventId}
                heroRef={draftedHero.photoRef}
                heroUrl={heroPhotoUrl}
                current={mainNow}
                quiet
              />
            ) : null}
          </>
        ),
        reveal: <MakerRevealPanel eventId={eventId} ownsPro={ownsPro} storeShell={storeShell} />,
        logo: <MakerLogoPanel eventId={eventId} />,
      }}
      publicLandingUrl={slug ? `/${slug}` : null}
      scenes={scenes}
      navigator={navigator}
      scenePanels={scenePanels}
      rows={rows}
      themes={themes}
      themeHref={`${base}/guests/invite`}
      ownsPro={ownsPro}
      initialScene={typeof sceneParam === 'string' ? sceneParam : null}
      initialOpenRow={typeof openRow === 'string' ? openRow : null}
      chain={typeof chainParam === 'string' ? chainParam : null}
      toggleAction={toggleWidgetVisibility}
      setModeAction={setSectionMode}
      moveUpAction={moveWidgetUp}
      moveDownAction={moveWidgetDown}
      proUnlockHref={proUnlockHref}
      proPriceLabel={proPriceLabel}
      /* 🔒 Never in the store shell — no pitch, no price (App Review 3.1.1). */
      showProCta={!ownsPro && !storeShell}
      /* 🎬 "+ Add a scene" — the 25 templates (Phase 5). A scene of their own
         is Pro (`addCustomSection` refuses without it), and six is the shape
         (`nextFreeCustomSlot`), so the control appears only where it can
         succeed and otherwise says why. Hidden in the store shell (a Pro
         feature there would be a paid pitch). */
      sceneFacts={{
        names: (event.display_name as string | null) ?? null,
        monogram: resolveMonogram({
          display_name: (event.display_name as string | null) ?? null,
          monogram_text: (event as { monogram_text?: string | null }).monogram_text ?? null,
          monogram_color: null,
        }).text,
        days: (() => {
          const target = countdownTargetMs(
            (event.event_date as string | null) ?? null,
            ((event as { timezone?: string | null }).timezone) ?? undefined,
          );
          const d = target === null ? null : Math.ceil((target - Date.now()) / 86_400_000);
          return d !== null && d >= 0 ? d : null;
        })(),
      }}
      addScene={
        storeShell
          ? null
          : !ownsPro
            ? { note: 'Scenes of your own, from 25 templates, come with Event Hub Pro.' }
            : !nextFreeCustomSlot(allWidgets.map((w) => w.widget_type))
              ? { note: 'You have all six of your own scenes. Remove one you are not using to add another.' }
              : { action: addCustomSection, returnTo: `/dashboard/${eventId}/launch` }
      }
    />
  );
}
