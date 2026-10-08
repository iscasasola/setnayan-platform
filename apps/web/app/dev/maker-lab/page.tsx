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

/** Stand-ins for a moving background's still and loop when the lab has no public media address — files this repo ships. */
/**
 * 🧪 The Studio cards' states in the lab — a stand-in for what the server measures on a real event (`studioTiles`):
 * a MIX, so a Ready card, a Missing one and a page nobody could measure (no badge) are each on screen, and the head's
 * "n of 11 ready" can be read against them (6 here). Fixture only — nothing is read or written.
 */
const LAB_STUDIO_DONE: Record<(typeof STUDIO_TILE_KEYS)[number], boolean | undefined> = {
  info: true,
  look: true,
  logo: false,
  mood: true,
  schedule: true,
  story: false,
  march: false,
  seats: false,
  gifts: undefined,
  rsvp: true,
  prints: true,
};
const LAB_STILLS = ['ballroom', 'starlit', 'fairy-lights', 'rose-archway', 'seascape', 'sunrise', 'aurora', 'peonies', 'bridgerton'];
const LAB_CLIPS = ['jack-jill-vclip', 'jack-rose-vclip', 'maria-juan-vclip', 'john-jane-vclip', 'peter-mary-vclip'];

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
  /* 🎞 The lab's DRAFTED main background (`lab_main`, the cookie the lab's save stand-in writes and its canvas reads) —
     the lab's "server" hands it back on its next render, as the real Maker's does, so a pick survives a render. */
  let labMain: ReturnType<typeof sanitizeHubMainGround> | undefined;
  {
    const raw = (await cookies()).get('lab_main')?.value;
    if (raw !== undefined) {
      try {
        const v = JSON.parse(decodeURIComponent(raw)) as unknown;
        labMain = v === null ? null : sanitizeHubMainGround(v);
      } catch {
        labMain = undefined;
      }
    }
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
      loops={hubMovingBackgroundIds().map((id, i) => ({
        id,
        name: themeBackgroundName(id),
        /* Where this machine has no address for our public art (no media settings in the lab's env), a LOCAL stand-in
           still and clip — so the cards, the instant preview and the stopwatch have a real picture and a real film. */
        stillUrl: resolveThemeGround(id, { ownColours: false })?.poster ?? `/std/backgrounds/${LAB_STILLS[i % LAB_STILLS.length]}.webp`,
        loopUrl: resolveThemeGround(id, { ownColours: false })?.loop ?? `/realstories/${LAB_CLIPS[i % LAB_CLIPS.length]}.mp4`,
      }))}
      pageColour={sp.paper === 'dark' ? '#1e2229' : null}
      /* 🌄 `?bg=video|pattern|scene` — start Look › Background on that Source (nothing is written; a fixture). */
      mainBackground={
        labMain !== undefined
          ? labMain
          : sp.bg === 'video'
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
      /* ✓ `?changes=3` — a draft with unapplied changes (lab only; nothing is stored). */
      changes={Math.max(0, Math.min(99, Math.floor(Number(sp.changes) || 0)))}
      /* Moves with every render, as the real Maker's stamp does — a save's refresh reaches the canvas. */
      renderStamp={String(Date.now())}
      /* 🧭 `?studio=1` (or `?ss=1`) — the new Maker on the lab's fixtures (its cards' states are the lab's stand-in, `LAB_STUDIO_DONE`). */
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
                /* 🧪 The lab's stand-in for what the server measures (the real Maker reads each from the event): a mix,
                   so Ready, Missing and "no claim" can each be seen on a card — and the head's count beside them. */
                done: LAB_STUDIO_DONE[key],
                status: STUDIO_TILES[key].sub,
              })),
            }
          : null
      }
    />
  );
}
