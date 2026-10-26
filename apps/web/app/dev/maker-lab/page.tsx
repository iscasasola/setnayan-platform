import { sanitizeSceneAccents, type SceneAccents } from '@/lib/art-kit-accents';
import { NEED_PRESETS, needsColumns, needsForPreset, needsHidesStage, needsHidesStudioTile, readEventNeeds, type NeedPreset } from '@/lib/event-needs';
import { MAKER_PAGE_STAGES } from '@/app/dashboard/[eventId]/launch/_components/maker-bar';
import { sanitizeFixedSceneStyles, type FixedSceneStyles } from '@/lib/fixed-scene-styles';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { sanitizeHubCanvas, type HubSectionCanvas } from '@/lib/hub-canvas';
import { isCustomSectionType, sanitizeCustomSection } from '@/lib/custom-sections';
import { sceneTypeWords } from '@/lib/scene-type-words';
import { buildMakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import { makerSceneLabel } from '@/lib/maker-scene-list';
import { themeBackgroundName } from '@/lib/invite-themes';
import { hubMovingBackgroundIds, sanitizeHubMainGround } from '@/lib/hub-canvas';
import { resolveThemeGround } from '@/app/[slug]/_lib/theme-ground';
import { detailsLabFacts, detailsLabNode, labChurchVenues } from '../details-lab/details-lab-node';
import { LAB_SAMPLE } from './guest/lab-sample';
import { MakerLabShell } from './maker-lab-shell';
import { LAB_EDITORIAL_COOKIE, labEditorialDraft, labPostEventRead } from './lab-post-event';
import { labScrubCanvases, labWidgetsCookie } from './lab-scrub';
import { STUDIO_TILE_KEYS, STUDIO_TILES } from '@/lib/studio-tiles';
import { LAB_BAR_COOKIE, LAB_OWN_COOKIE, LAB_PASS_COOKIE, LAB_ROWS_COOKIE, labBarFromCookie, labDraftedRows, labOwnKind } from './lab-draft';
import { labNavigatorInput } from './lab-navigator';
import { REVEAL_NONE, revealAllowedFor } from '@/lib/reveal-access';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from '@/lib/reveal-config-pure';
import { LastSeenScope } from '@/app/_components/last-seen/last-seen-scope';
import { LabPageSpotlight } from '../_components/lab-page-spotlight';
import { TOURS } from '@/lib/tours';
import { HOST_PAGE_TOURS } from '@/lib/host-page-tours';

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
/** The Studio pages the lab cannot draw — their tiles are not offered (see `tiles` below). */
const LAB_STUDIO_NOT_DRAWN: ReadonlyArray<(typeof STUDIO_TILE_KEYS)[number]> = ['seats'];
const LAB_STILLS = ['ballroom', 'starlit', 'fairy-lights', 'rose-archway', 'seascape', 'sunrise', 'aurora', 'peonies', 'bridgerton'];
const LAB_CLIPS = ['jack-jill-vclip', 'jack-rose-vclip', 'maria-juan-vclip', 'john-jane-vclip', 'peter-mary-vclip'];

export default async function MakerLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const labNeeds =
    typeof sp.needs === 'string' && (NEED_PRESETS as readonly string[]).includes(sp.needs)
      ? readEventNeeds(needsColumns(needsForPreset(sp.needs as NeedPreset, { marketplace: true })))
      : null;
  /* ⏱ `?slow=1`: a whole-Maker render takes as long as production's (3–6 s). */
  if (sp.slow === '1') await new Promise((r) => setTimeout(r, 4000));
  /* 🧾 The sample's rows WITH THE LAB'S DRAFT LAID OVER THEM — a scene's place on a stage, its eye, its Auto · Hidden
     (`./lab-draft.ts`, the real `overlayHubDraftWidgets`). They were a constant: Earlier · Later · Remove saved a
     real patch and the Maker and its canvas were drawn from rows that never moved (the walk of 2026-10-11, P02). */
  const rows = labDraftedRows((await cookies()).get(LAB_ROWS_COOKIE)?.value, labOwnKind((await cookies()).get(LAB_OWN_COOKIE)?.value));
  /* 🎞 The lab's Post Event story — the day's facts compiled by the real compiler, the lab's drafted story keys
     (`lab_editorial`) laid over (`./lab-post-event.ts`). It was `null`: the Post Event panel could not be opened. */
  const labPostEvent = labPostEventRead(labEditorialDraft((await cookies()).get(LAB_EDITORIAL_COOKIE)?.value));
  const navigator = buildMakerNavigatorData({
    postEvent: labPostEvent,
    ...labNavigatorInput(rows),
  });
  /* 🎨 The lab's draft of each scene's canvas (`lab_widgets`, set by the lab's
     save stand-in) — the "server" canvases every render hands the work area. */
  /* 🎚 `?scrub=1` — the Scrub chain (`./lab-scrub.ts`): the chain's scenes start on its canvases (so each scene's
     Animate says what its canvas plays), saved to the chain's own cookie, and the canvas is the chain's address. */
  const scrub = sp.scrub === '1';
  let drafted: Record<string, unknown> = {};
  try {
    drafted = JSON.parse(decodeURIComponent((await cookies()).get(labWidgetsCookie(scrub))?.value ?? '{}')) as Record<string, unknown>;
  } catch {
    drafted = {};
  }
  drafted = labScrubCanvases(scrub, drafted);
  /* 🎨 The lab's drafted part styles (set by the lab's save stand-in). */
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
  /* 🧱 The lab's drafted block looks (`lab_blocks`, the stand-in for `style_preferences.block_looks`). */
  let blockLooks: Record<string, unknown> = {};
  try {
    const held = JSON.parse(decodeURIComponent((await cookies()).get('lab_blocks')?.value ?? '{}')) as unknown;
    if (held && typeof held === 'object' && !Array.isArray(held)) blockLooks = held as Record<string, unknown>;
  } catch {
    blockLooks = {};
  }
  /* 🕯 The lab's drafted Accent picks (`lab_accents`, the stand-in for `style_preferences.scene_accents`), and the look
     the lab's page wears for them — `lab_kit=vintage` puts the Vintage look on, so each scene starts at its accent. */
  let sceneAccents: SceneAccents = {};
  try {
    sceneAccents = sanitizeSceneAccents(JSON.parse(decodeURIComponent((await cookies()).get('lab_accents')?.value ?? '{}')));
  } catch {
    sceneAccents = {};
  }
  const labKitTheme = (await cookies()).get('lab_kit')?.value === 'vintage' ? ('vintage' as const) : null;
  const canvases: Record<string, HubSectionCanvas> = Object.fromEntries(
    /* (A row that holds a canvas of its own — the owner's template scene, `lab_own=tpl20` — wears it until the draft has one.) */
    rows.map((r) => [r.widget_type, sanitizeHubCanvas({ canvas: drafted[r.widget_type] ?? (r.config_json as { canvas?: unknown } | null)?.canvas ?? {} })]),
  );
  /* ✍ Each scene of their own's words, drafted over the sample — what Edit's Heading and Words read (`ownWords`), and the
     words the canvas is told to find (`typeHere`), as the real Maker hands both (`website/editor/page.tsx`). */
  const ownWords = Object.fromEntries(rows.filter((r) => isCustomSectionType(r.widget_type)).map((r) => [r.widget_type, sanitizeCustomSection(r.config_json)]));
  const typeHere = sceneTypeWords({ types: rows.map((r) => r.widget_type), canvases, message: null, reminders: null, own: ownWords });
  const scenes = rows.map((r) => ({
    id: r.widget_id,
    type: r.widget_type,
    label: makerSceneLabel(r.widget_type),
    /* The draft's eye and Auto · Hidden, as the real Maker hands them — a removed scene is one ＋ can bring back. */
    mode: r.mode ?? ('auto' as const),
    isVisible: r.is_visible,
    hasContent: true,
    transitionLabel: 'Scroll',
  }));
  /* 🎭 `?reveal=owner` — the owner's Reveal screen of 2026-10-08 (theme Cyber Neon, nothing chosen, the Reveal Studio's
     map switched every opening off but Sheer veil, house default Sheer veil); `?reveal=all` — the same theme, every
     opening on. The default opening is asked of the guest page's OWN rule, in the shape `MakerRevealPanel` asks it
     (`maker-made-once.tsx`). `&before=1` hands the panel the theme's opening instead — main's rule before #6464. */
  const revealLab = (() => {
    if (sp.reveal !== 'owner' && sp.reveal !== 'all') return null;
    const theme = INVITE_THEMES.cyber;
    const on: readonly RevealTemplateId[] = sp.reveal === 'owner' ? ['veil-sheer'] : REVEAL_TEMPLATE_IDS;
    const allowed = Object.fromEntries(REVEAL_TEMPLATE_IDS.map((id) => [id, on.includes(id)])) as Record<RevealTemplateId, boolean>;
    const themeOpening = theme.opening;
    const plays = revealAllowedFor({
      ownsPro: true,
      chosenTemplate: themeOpening === REVEAL_NONE ? null : themeOpening,
      adminDefault: 'veil-sheer',
      isStaffPreview: false,
      allowed,
    });
    const before = sp.before === '1';
    return {
      themeName: theme.name,
      defaultOpening: before ? themeOpening : plays,
      defaultIsTheme: before ? themeOpening !== REVEAL_NONE : themeOpening !== REVEAL_NONE && plays === themeOpening,
      openings: on,
    };
  })();
  /* 🕘 A signed-in viewer on this event, as the event layout hands down (`LastSeenScope`) — so the colour picker's
     "Recently used" (per person, per event, this browser) works in the lab as in the app. A lab id, never a real one. */
  return (
    <LastSeenScope userId="lab-viewer" eventId={EVENT}>
    <MakerLabShell
      eventId={EVENT}
      tourHint={sp.spot === '1'}
      revealLab={revealLab}
      scenes={scenes}
      navigator={navigator}
      /* 🧭 `studio: '1'` ALWAYS (2026-10-26): there is one Maker, and the real launch page always hands Details its Studio
         (`studioDetails`) — without it this lab drew Details' retired one-piece Prints view ("INVITATION SET · The Invitation" +
         its editor sheet), a door no couple has, instead of Studio › Prints. */
      details={detailsLabNode({ ...sp, studio: '1', shape: 'mj', look: '1', labPass: (await cookies()).get(LAB_PASS_COOKIE)?.value })}
      /* ✍ `&facts=1` — the fact editors the launch page hands the real Maker (`factEditors`): a tap that opens one in the
         work area is seen as it is on a couple's Maker (the Love Story's moments, 2026-10-19). Off by default. */
      factEditors={sp.facts === '1' ? detailsLabFacts(sp, { specialMessage: LAB_SAMPLE.message, pabuyaMessage: 'Thank you for joining us — every gift is received with thanks.' }) : undefined}
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
      ownWords={ownWords}
      typeHere={typeHere}
      scrub={scrub}
      ownsPro={sp.pro === '1'}
      storeShellLab={sp.shell === '1'}
      fixedStyles={fixedStyles}
      blockLooks={blockLooks}
      sceneAccents={sceneAccents}
      kitTheme={labKitTheme}
      /* ✓ The draft's summary as this render read it (`lab_bar`, written from the draft by the lab's door) — it was 0
         on every render, so the ✓ count fell to nothing by itself (P05). `?changes=3` still stands in for a draft. */
      summary={
        Number(sp.changes) > 0
          ? ((n) => ({ hasChanges: true, changeCount: n, proCount: 0, canUndo: true }))(Math.min(99, Math.floor(Number(sp.changes))))
          : labBarFromCookie((await cookies()).get(LAB_BAR_COOKIE)?.value)
      }
      /* Moves with every render, as the real Maker's stamp does — a save's refresh reaches the canvas. */
      renderStamp={String(Date.now())}
      /* 🚪 `?needs=simple|open|list|full` (owner 2026-10-08, Level 1): the stages this event does not need are absent. */
      hiddenStages={labNeeds ? MAKER_PAGE_STAGES.filter((st) => needsHidesStage(st, labNeeds)) : []}
      /* 📱 `?venue=church` — the Venue scene › Edit's Picture ▾ rows, on the SAME fixture Details › Venues draws
         (`&vpic=photo|drawing|none`, `&pro=1`). */
      venuePictures={
        sp.venue === 'church'
          ? ((v) => ({ slots: v.slots, pro: v.pro ?? { owns: false, storeShell: false } }))(labChurchVenues(typeof sp.vpic === 'string' ? sp.vpic : undefined, sp.pro === '1'))
          : null
      }
      /* 🧭 The Maker on the lab's fixtures — there is one Maker (2026-10-25), so `?studio=1` / `&desk=1` are no longer
         needed (still accepted: they change nothing). Its cards' states are the lab's stand-in, `LAB_STUDIO_DONE`. */
      studio={{
        /* 🪑 No Seat plan tile: the lab's Studio draws no seat plan (`MakerDetails` is handed none), and a tile
           with nothing behind it opened the Wedding March under the name "Seat plan" (P03). The real Maker
           drops such a tile the same way (`lib/studio-tiles.ts` `studioTiles` — `offered`). */
        tiles: STUDIO_TILE_KEYS.filter((key) => !LAB_STUDIO_NOT_DRAWN.includes(key)).map((key) => ({
          key,
          label: STUDIO_TILES[key].label,
          short: STUDIO_TILES[key].short,
          item: STUDIO_TILES[key].item,
          immersive: STUDIO_TILES[key].immersive === true,
          /* 🧪 The lab's stand-in for what the server measures (the real Maker reads each from the event): a mix,
             so Ready, Missing and "no claim" can each be seen on a card — and the head's count beside them. */
          done: LAB_STUDIO_DONE[key],
          status: STUDIO_TILES[key].sub,
        }))
          /* 🚪 `&needs=simple|open|list|full` — what the event needs drops tiles, as the real Maker does. */
          .filter((t) => !(labNeeds && needsHidesStudioTile(t.key, labNeeds))),
      }}
    />
    {/* 🔦 `&spot=1` — the Maker's own spotlight (owner 2026-10-22), inside the Maker, first run. */}
    {sp.spot === '1' && TOURS[HOST_PAGE_TOURS.maker].spotlight ? (
      <LabPageSpotlight tourKey={HOST_PAGE_TOURS.maker} script={TOURS[HOST_PAGE_TOURS.maker].spotlight!} inMaker />
    ) : null}
    </LastSeenScope>
  );
}
