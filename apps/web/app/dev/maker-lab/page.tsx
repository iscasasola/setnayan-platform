import { sanitizeFixedSceneStyles, type FixedSceneStyles } from '@/lib/fixed-scene-styles';
import { isCameraLook, type CameraLook } from '@/lib/camera-look';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { sanitizeHubCanvas, type HubSectionCanvas } from '@/lib/hub-canvas';
import { buildMakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import { makerSceneLabel } from '@/lib/maker-scene-list';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { INVITE_THEMES, themeBackgroundName } from '@/lib/invite-themes';
import { hubMovingBackgroundIds, sanitizeHubMainGround } from '@/lib/hub-canvas';
import { resolveThemeGround } from '@/app/[slug]/_lib/theme-ground';
import type { InvitationWidgetRow, WidgetType } from '@/lib/invitation-widgets';
import { detailsLabNode } from '../details-lab/details-lab-node';
import { MakerLabShell } from './maker-lab-shell';
import { STUDIO_TILE_KEYS, STUDIO_TILES } from '@/lib/studio-tiles';

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
  /* ⏱ `?slow=1`: a whole-Maker render takes as long as production's (3–6 s). */
  if (sp.slow === '1') await new Promise((r) => setTimeout(r, 4000));
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
  /* 🎨 The lab's draft of each scene's canvas (`lab_widgets`, set by the lab's
     save stand-in) — the "server" canvases every render hands the work area. */
  let drafted: Record<string, unknown> = {};
  try {
    drafted = JSON.parse(decodeURIComponent((await cookies()).get('lab_widgets')?.value ?? '{}')) as Record<string, unknown>;
  } catch {
    drafted = {};
  }
  /* 🎨 🎛 The lab's drafted part styles and camera look (set by the lab's save stand-in). */
  let fixedStyles: FixedSceneStyles = {};
  try {
    fixedStyles = sanitizeFixedSceneStyles(JSON.parse(decodeURIComponent((await cookies()).get('lab_styles')?.value ?? '{}')));
  } catch {
    fixedStyles = {};
  }
  const camRaw = (await cookies()).get('lab_camera')?.value;
  const cameraLook: CameraLook = isCameraLook(camRaw) ? camRaw : 'classic';
  const canvases: Record<string, HubSectionCanvas> = Object.fromEntries(
    rows.map((r) => [r.widget_type, sanitizeHubCanvas({ canvas: drafted[r.widget_type] ?? {} })]),
  );
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
      details={detailsLabNode({ ...sp, shape: 'mj', ...(sp.studio === '1' || sp.ss === '1' ? { look: '1' } : {}) })}
      /* 🎞 Look › Background's moving backgrounds, built as the editor page builds them. */
      loops={hubMovingBackgroundIds().map((id) => ({
        id,
        name: themeBackgroundName(id),
        stillUrl: resolveThemeGround(id, { ownColours: false })?.poster ?? null,
        loopUrl: resolveThemeGround(id, { ownColours: false })?.loop ?? null,
      }))}
      /* 🌄 `?bg=video|pattern|scene` — start Look › Background on that Source (nothing is written; a fixture). */
      mainBackground={
        sp.bg === 'video'
          ? sanitizeHubMainGround({ ground: 'loop', loop: hubMovingBackgroundIds()[0] })
          : sp.bg === 'pattern'
            ? sanitizeHubMainGround({ ground: 'pattern', pattern: 'dots' })
            : sp.bg === 'scene'
              ? sanitizeHubMainGround({ kind: 'photo', media: '/std/backgrounds/golden-hour.webp', tint: { match: false, frame: ['#f0d5b4', '#291d10'] }, shade: 'dark' })
              : null
      }
      openDetails={sp.tool === 'details' || typeof sp.guide === 'string'}
      canvases={canvases}
      fixedStyles={fixedStyles}
      cameraLook={cameraLook}
      /* Moves with every render, as the real Maker's stamp does — a save's refresh reaches the canvas. */
      renderStamp={String(Date.now())}
      /* 🧭 `?studio=1` (or `?ss=1`) — the new Maker on the lab's fixtures (no ✓ claimed: nothing was measured here). */
      stagesStudio={sp.studio === '1' || sp.ss === '1'}
      studio={
        sp.studio === '1' || sp.ss === '1'
          ? {
              tiles: STUDIO_TILE_KEYS.map((key) => ({
                key,
                label: STUDIO_TILES[key].label,
                short: STUDIO_TILES[key].short,
                item: STUDIO_TILES[key].item,
                immersive: STUDIO_TILES[key].immersive === true,
                done: undefined,
                status: STUDIO_TILES[key].sub,
              })),
            }
          : null
      }
    />
  );
}
