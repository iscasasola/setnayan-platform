import { notFound } from 'next/navigation';
import { buildMakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import { makerSceneLabel } from '@/lib/maker-scene-list';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { INVITE_THEMES } from '@/lib/invite-themes';
import type { InvitationWidgetRow, WidgetType } from '@/lib/invitation-widgets';
import { detailsLabNode } from '../details-lab/details-lab-node';
import { MakerLabShell } from './maker-lab-shell';

/**
 * /dev/maker-lab — THE WHOLE MAKER on maria-and-jose's REAL SHAPE, with no
 * sign-in and no database (the lower third, 2026-10-05). DEV-ONLY: production
 * builds 404 it, the same kill-switch as `/dev/details-lab`.
 *
 * 🧪 The shape was read READ-ONLY from production (2026-10-05): its 16 section
 * rows in their order and modes, the names, the date, Classic (no saved theme),
 * no print settings (Classic ticket), 32 guests — the first coming one
 * "Teresita Aquino". The real shell, the real work area and Details are
 * mounted; only what needs a signed-in database is a stand-in: the canvas (a
 * same-shaped guest page, `./guest`), the draft (no write leaves the lab) and
 * the ticket picture.
 */
const EVENT = '00000000-0000-4000-8000-000000000000';

/** maria-and-jose's section rows, as production holds them (order · always-on · mode · visible). */
const MJ_ROWS: ReadonlyArray<[WidgetType, boolean]> = [
  ['hero', true],
  ['greeting', true],
  ['qr_card', true],
  ['event_details', false],
  ['countdown', false],
  ['schedule', false],
  ['rsvp', true],
  ['venue_map', false],
  ['dress_code', false],
  ['photo_moments', false],
  ['your_photos', false],
  ['tier_comparison', false],
  ['special_message', false],
  ['what_to_bring', false],
  ['our_photos', false],
  ['our_love_story', false],
];

export default async function MakerLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const now = '2026-10-05T00:00:00Z';
  const rows: InvitationWidgetRow[] = MJ_ROWS.map(([type, alwaysOn], i) => ({
    widget_id: `w-${type}`,
    event_id: EVENT,
    widget_type: type,
    display_order: i + 1,
    is_visible: true,
    is_always_on: alwaysOn,
    tier: 'basic',
    config_json: {},
    created_at: now,
    updated_at: now,
    mode: 'auto',
  }));
  const pal = INVITE_THEMES.house.palette;
  const navigator = buildMakerNavigatorData({
    postEvent: null,
    plan: {
      widgets: rows,
      openBrowse: true,
      weddingOnlyParts: resolveWeddingOnlyParts(WEDDING_PROFILE),
      content: {},
      solemn: false,
      hasHeroMedia: false,
      hasEntourage: true,
      dayParts: true,
      storyRenders: false,
      countdownPast: false,
      giftsOff: false,
      setupLocks: true,
    },
    sectionRows: rows,
    tint: { canvas: pal.canvas, ink: pal.ink, accent: pal.accent },
    facts: {
      names: 'Maria & Jose',
      dateLabel: 'December 12, 2026',
      daysToGo: 68,
      venueName: null,
      venueAddress: null,
      firstBlock: null,
      dressTitle: null,
      dressLine: null,
      photoMomentsLine: null,
      specialMessage: null,
      whatToBring: null,
      loveStory: null,
      entourageCount: 32,
      heroPhotoUrl: null,
      firstGalleryUrl: null,
    },
    photoUrls: {},
  });
  const scenes = rows.map((r) => ({
    id: r.widget_id,
    type: r.widget_type,
    label: makerSceneLabel(r.widget_type),
    mode: 'auto' as const,
    isVisible: true,
    hasContent: true,
    transitionLabel: 'Scroll',
  }));
  return (
    <MakerLabShell
      eventId={EVENT}
      scenes={scenes}
      navigator={navigator}
      details={detailsLabNode({ ...sp, shape: 'mj' })}
    />
  );
}
