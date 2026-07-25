import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { getLifecyclePhase } from '@/lib/invitation-widgets';
import { LaunchStdButton } from '../../studio/save-the-date/_components/launch-std-button';
import { EditorShell, type RailGroup } from './_components/editor-shell';
import { TextPanel } from './_components/text-panel';
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

  const { data: event } = await supabase
    .from('events')
    .select(
      'event_id, display_name, slug, event_type, event_date, landing_page_visibility, std_launched_at, scheduled_launch_at, website_open_browse, love_story, our_photos, site_bg_music_r2_key, landing_page_hero_image_url, site_bg_color, site_button_color, special_message, what_to_bring, site_bg_music_enabled, landing_page_hero_video_r2_key',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const profile = await resolveProfile((event.event_type as string | null) ?? 'wedding');
  if (!surfaceEnabled(profile, 'website')) redirect(`/dashboard/${eventId}`);

  // Couple gate — mirrors the launch surface this page absorbs (its go-live
  // actions are requireCouple).
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
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
  const initialPhase = getLifecyclePhase((event.event_date as string | null) ?? null);

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
        },
        {
          key: 'details',
          label: 'Details & schedule',
          blurb: 'Date, venue, run-of-show.',
          href: `${w}/widgets`,
          anchor: 'details',
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
        },
        {
          key: 'photo-moments',
          label: 'Photo moments',
          blurb: 'When to lift the camera, when to stay present.',
          href: `${w}/photo-moments`,
          anchor: 'details',
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
              defaultValue={(event.special_message as string | null) ?? ''}
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
        },
        {
          key: 'editorial',
          label: 'After — your editorial',
          blurb: 'The story page guests revisit after the day.',
          href: `${w}/editorial`,
          pro: true,
          locked: !ownsPro,
          ...(!ownsPro ? { panel: lockPanel('Editorial editing') } : {}),
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
