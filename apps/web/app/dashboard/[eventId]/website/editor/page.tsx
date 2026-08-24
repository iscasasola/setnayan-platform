import { redirect } from 'next/navigation';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { getLifecyclePhase } from '@/lib/invitation-widgets';
import { LaunchStdButton } from '../../studio/save-the-date/_components/launch-std-button';
import { EditorShell, type RailGroup } from './_components/editor-shell';
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
import { updateOurPhotos } from '../our-photos/actions';
import { updateSiteChrome } from '../site-chrome/actions';
import { updateLandingPageVisibility } from '../privacy/actions';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { SectionsPanel } from './_components/sections-panel';
import {
  DressCodePanel,
  PhotoMomentsPanel,
  StoryPanel,
  SchedulePeekPanel,
  StdPanel,
  EditorialPanel,
} from './_components/authoring-panels';
import { OpenBrowsePanel } from './_components/media-panels';
import { setOpenBrowse } from './actions';
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
  toggleWidgetVisibility,
  moveWidgetUp,
  moveWidgetDown,
  setSectionMode,
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
import { updateWhatToBring } from '../what-to-bring/actions';

export const metadata = { title: 'Website editor' };

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
 */
export default async function WebsiteEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ open?: string }>;
}) {
  const { eventId } = await params;
  const { open: openRow } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      `event_id, display_name, slug, event_type, event_date, event_end_date, timezone, venue_name, venue_address, landing_page_visibility, std_launched_at, scheduled_launch_at, website_open_browse, love_story, our_photos, site_bg_music_r2_key, landing_page_hero_image_url, site_art_direction, site_bg_color, site_button_color, special_message, what_to_bring, site_bg_music_enabled, landing_page_hero_video_r2_key, dress_code_config, photo_moments_config, role_palette, std_reveal_template, std_theme, std_invitation_launch_date, ${SECTION_CONTENT_EVENT_COLUMNS}`,
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

  const ownsPro = await eventCoupleWebsiteProActive(supabase, eventId);

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

  // The phase the preview opens on = the phase the site is actually in today.
  const initialPhase = getLifecyclePhase(
    (event.event_date as string | null) ?? null,
    ((event as { timezone?: string | null }).timezone) ?? undefined,
    (event as { event_end_date?: string | null }).event_end_date ?? null,
  );

  // Locked = no Pro AND no existing content (the grandfather rule shipped in
  // PR #3664 — a couple who already has content keeps editing it).
  const lockedIf = (hasContent: boolean) => !ownsPro && !hasContent;
  const proUnlockHref = `${base}/studio/website-pro`;
  /** A locked Pro row's inline panel: one honest line + the ONE umbrella CTA. */
  const lockPanel = (featureName: string) => (
    <ProLockPanel featureName={featureName} unlockHref={proUnlockHref} />
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
          const url = await displayUrlForStoredAsset(ref);
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
  const allWidgets: InvitationWidgetRow[] = ((widgetsRaw ?? []) as Array<
    Omit<InvitationWidgetRow, 'widget_type'> & { widget_type: string }
  >)
    .filter((r): r is InvitationWidgetRow => isWidgetType(r.widget_type))
    .map((r) => r as InvitationWidgetRow);
  // Hideable rows only — always-on sections can't be hidden or moved, so
  // offering the controls would be a lie. Ordered by display_order.
  const sectionRows = [...allWidgets]
    .filter((r) => !r.is_always_on)
    .sort((a, b) => a.display_order - b.display_order);
  const sectionContent = await computeSectionContentMap(
    supabase,
    eventId,
    event as Parameters<typeof computeSectionContentMap>[2],
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

  const story: LoveStoryBlob =
    event.love_story && typeof event.love_story === 'object'
      ? (event.love_story as LoveStoryBlob)
      : {};

  const dressCodeConfig = normalizeDressCodeConfig(
    (event as { dress_code_config?: unknown }).dress_code_config,
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

  const photoMomentsConfig = parsePhotoMomentsConfig(
    (event as { photo_moments_config?: unknown }).photo_moments_config,
  );

  const colorsLocked = lockedIf(Boolean(event.site_bg_color || event.site_button_color));
  const musicLocked = lockedIf(Boolean(event.site_bg_music_r2_key));
  const galleryLocked = lockedIf(ourPhotos.length > 0);

  const groups: RailGroup[] = [
    {
      key: 'site',
      title: '① Site',
      rows: [
        {
          key: 'url',
          label: 'Website address',
          blurb: 'Your one link, on every QR and invite.',
          href: `${w}/editor`,
          status: slug ?? 'Not set',
        },
        {
          key: 'visibility',
          label: 'Who can view',
          blurb: 'Private while you build, public when you launch.',
          href: `${w}/privacy`,
          status: visibility === 'private' ? 'Private' : visibility === 'public' ? 'Public' : 'Unlisted',
          panel: (
            <VisibilityPanel
              action={updateLandingPageVisibility}
              eventId={eventId}
              visibility={visibility}
            />
          ),
        },
        {
          key: 'open-browse',
          label: 'Open browsing',
          blurb: 'Let guests browse every page from day one.',
          href: `${w}/widgets`,
          status: event.website_open_browse === true ? 'On' : 'Off',
          panel: (
            <OpenBrowsePanel
              action={setOpenBrowse}
              eventId={eventId}
              on={event.website_open_browse === true}
            />
          ),
        },
        {
          key: 'colors',
          label: 'Colors',
          blurb: 'Background and button colors.',
          href: `${w}/colors`,
          pro: true,
          locked: colorsLocked,
          panel: colorsLocked ? (
            lockPanel('Colors')
          ) : (
            <ColorsPanel
              action={updateSiteColors.bind(null, eventId)}
              eventId={eventId}
              rowKey="colors"
              bgColor={(event.site_bg_color as string | null) ?? null}
              buttonColor={(event.site_button_color as string | null) ?? null}
              artDirection={
                (event.site_art_direction as 'daylight' | 'candlelight' | null) ?? null
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
          status: heroRef ? 'Photo set' : 'Not set',
          panel: (
            <HeroPhotoPanel
              action={uploadHeroPhoto}
              eventId={eventId}
              currentRef={heroRef}
              displayUrls={heroDisplay}
            />
          ),
        },
        {
          key: 'story',
          label: 'Our story',
          blurb: 'How you met, the proposal, the milestones.',
          href: `${w}/our-story`,
          anchor: 'story',
          status: event.love_story ? 'Written' : 'Not set',
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
          status: scheduleBlocks.length > 0 ? `${scheduleBlocks.length} public` : 'No schedule',
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
          label: 'Photo gallery',
          blurb: 'Your engagement and prenup shots.',
          href: `${w}/our-photos`,
          anchor: 'gallery',
          pro: true,
          locked: galleryLocked,
          status: galleryLocked ? undefined : `${galleryRefs.length} photo${galleryRefs.length === 1 ? '' : 's'}`,
          panel: galleryLocked ? (
            lockPanel('Photo gallery')
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
          label: 'Photo moments',
          blurb: 'When to lift the camera, when to stay present.',
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
          status: event.special_message ? 'Written' : 'Not set',
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
                (event.special_message as string | null) ||
                invitationWordsDraft({
                  displayName: (event.display_name as string | null) ?? null,
                  eventDate: (event.event_date as string | null) ?? null,
                  venueName: (event.venue_name as string | null) ?? null,
                  occasionNoun: profile.terminology.occasionNoun,
                  // 🕊 THE LINE THAT MATTERS MOST. A wake takes the solemn arm;
                  // a cheerful auto-draft on a funeral page is precisely the
                  // defect the whole solemn register exists to prevent.
                  register: profile.terminology.register,
                  existing: (event.special_message as string | null) ?? null,
                }) ||
                ''
              }
              hint={
                event.special_message ? undefined : INVITATION_WORDS_HINT
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
          status: event.what_to_bring ? 'Written' : 'Not set',
          panel: (
            <TextPanel
              action={updateWhatToBring.bind(null, eventId)}
              eventId={eventId}
              rowKey="what-to-bring"
              name="note"
              label="What to bring"
              maxLength={600}
              placeholder="Gifts, registry, or a kind no-gift note…"
              defaultValue={(event.what_to_bring as string | null) ?? ''}
            />
          ),
        },
        {
          key: 'sections-order',
          label: 'Show, hide & reorder',
          blurb: 'What appears on your site, and in what order.',
          href: `${w}/widgets`,
          status: `${sectionRows.filter((r) => r.is_visible).length} showing`,
          panel: (
            <SectionsPanel
              eventId={eventId}
              rows={sectionRows}
              contentMap={sectionContent}
              toggleAction={toggleWidgetVisibility}
              moveUpAction={moveWidgetUp}
              moveDownAction={moveWidgetDown}
              setModeAction={setSectionMode}
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
          status: ownsPro ? 'Pro beats on' : undefined,
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
            <EditorialPanel eventId={eventId} ownsPro={ownsPro} unlockHref={proUnlockHref} />
          ),
        },
      ],
    },
  ];

  return (
    <EditorShell
      groups={groups}
      publicLandingUrl={slug ? `/${slug}` : null}
      initialPhase={initialPhase}
      initialOpenRow={typeof openRow === 'string' ? openRow : null}
      proUnlockHref={proUnlockHref}
      showProCta={!ownsPro}
      liveHref={slug ? `/${slug}` : null}
      goLiveSlot={
        <LaunchStdButton
          eventId={eventId}
          slug={slug}
          initialLaunched={stdLaunched}
          initialScheduledAt={scheduledAt}
        />
      }
    />
  );
}
