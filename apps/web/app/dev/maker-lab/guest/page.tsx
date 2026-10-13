import { Fragment, type ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WishLab } from './wish-lab';
import { cookies } from 'next/headers';
import { mainGroundLayerFor } from '@/app/[slug]/_lib/main-ground-layer';
import { CountdownWidget } from '@/app/[slug]/_components/countdown';
import { EditorBridge } from '@/app/[slug]/_components/editor-bridge';
import { HUB_STAGES, type HubStage } from '@/lib/hub-canvas';
import { sceneStyleOfRow, paletteLookOfRow, dosLookOfRow } from '@/lib/scene-style-of-row';
import { CustomSectionWidget } from '@/app/[slug]/_components/custom-section-widget';
import { SpecialMessageWidget } from '@/app/[slug]/_components/special-message-widget';
import { MakerGuestScenes, MakerWelcomeGiftsEmpty, MakerWelcomeLook } from '@/app/[slug]/_components/maker-guest-scenes';
import { WelcomeGifts } from '@/app/[slug]/_components/guest-doorway-strip';
import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import { ScheduleWidget } from '@/app/[slug]/_components/schedule-widget';
import { VenueWidget } from '@/app/[slug]/_components/venue-widget';
import { HubCanvasFrame } from '@/app/[slug]/_components/hub-canvas-frame';
import { HubCoverHold, HubPageHold, HubScenes, hubCoverLeaves, hubScrubHoldsAtMost } from '@/app/[slug]/_components/hub-scenes';
import { EDITOR_CANVAS_HIDES_APP_CHROME, canvasOnlyCss, canvasOnlyScene, canvasStylePreview } from '@/app/[slug]/_lib/editor-canvas';
import { withStylePreview } from '@/app/[slug]/_lib/style-preview';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { fixedSceneStyleOf } from '@/lib/fixed-scene-style-of';
import type { StyledScene } from '@/lib/fixed-scene-styles';
import { HERO_PART_LOOK, partLookAttr } from '@/lib/scene-styles-parts';
import { MakerEmptyScene } from '@/app/[slug]/_components/maker-empty-scene';
import { WhenYesCelebration } from '@/app/[slug]/_components/when-yes-celebration';
import { celebrationColours, isRsvpCelebration } from '@/lib/rsvp-celebration';
import { RsvpCanvasBridge } from '@/app/[slug]/_components/rsvp-canvas-bridge';
import { BLOCK_LOOKS_STYLE_ATTR, BLOCK_MARK_ATTR, blockLooksCss, blockOfCanvas, readBlockLooks } from '@/lib/block-looks';
import { RsvpLookStyle } from '@/app/[slug]/_components/rsvp-look-style';
import { RsvpWidget } from '@/app/[slug]/_components/rsvp-widget';
import { submitInviteReply } from '@/app/[slug]/invite/actions';
import { RsvpSheet } from '@/app/[slug]/_components/rsvp-sheet';
import { LabReplyDoor } from './lab-reply-door';
import { RsvpNoteLines } from '@/app/[slug]/_components/rsvp-note-lines';
import type { GuestRow } from '@/app/[slug]/_lib/types';
import { landingHeadline } from '@/lib/guest-landing';
import { readRsvpLook, rsvpScreenLayout } from '@/lib/rsvp-look';
import { postEventSceneDrawn } from '@/lib/post-event-scenes';
import { postEventLookOf } from '@/lib/post-event-draft';
import { resolvePostEventStyle } from '@/lib/post-event-style-resolve';
import { LAB_EDITORIAL_COOKIE, labEditorialDraft, labPostEventRead } from '../lab-post-event';
import { LAB_SCRUB_CHAIN, LAB_SCRUB_NAME, labScrubCanvases, labScrubLabel, labWidgetsCookie, type LabScrubScene } from '../lab-scrub';
import { LabScrubBadge } from './scrub-badge';
import { LabDayPages } from './lab-day';
import { LAB_SAMPLE, labEntourage, labDressConfig, labRolePalette } from './lab-sample';
import { LabStagePages } from './lab-stage';
import { LAB_NAMES_COOKIE, LAB_OWN_COOKIE, LAB_OWN_SCENE, LAB_ROWS_COOKIE, labDraftedRows, labNamesFrom } from '../lab-draft';
import { labSeen, labStageTiles } from '../lab-navigator';
import { sceneOnStage } from '@/lib/what-guests-see';
import type { WidgetType } from '@/lib/invitation-widgets';
import { heroCanvasOf } from '@/app/[slug]/_lib/hero-design-of';
import { heroDesignOf } from '@/lib/hero-design';
import { DressCodeWidget } from '@/app/[slug]/_components/dress-code-widget';
import { EntourageSection } from '@/app/[slug]/_components/entourage-section';

/** maria-and-jose's run of show and venues (read-only shape, 2026-10-05) — the lab has no database. */
const LAB_BLOCK = (i: number, label: string, at: string, location: string | null, type = 'pre_ceremony') => ({
  block_id: `lab-${i}`, public_id: `lab-${i}`, event_id: 'lab', label, block_type: type, start_at: `2026-12-12T${at}:00Z`, end_at: null,
  location, notes: null, is_public: true, sort_order: i, parent_block_id: null, created_at: '2026-10-01T00:00:00Z',
  run_state: 'upcoming', actual_start_at: null, actual_end_at: null, audience: null,
});
const LAB_BLOCKS = [
  LAB_BLOCK(1, 'Guests arrive', '14:30', 'Santuario de San Antonio'),
  LAB_BLOCK(2, 'Ceremony', '15:00', 'Santuario de San Antonio', 'ceremony'),
  LAB_BLOCK(3, 'Cocktails', '17:30', 'Seda Vertis North', 'cocktails'),
  LAB_BLOCK(4, 'Dinner & dancing', '19:00', 'Seda Vertis North', 'reception'),
];
/** 🎚 The Scrub chain's run of show (`?scrub=1`): eight moments — a list long enough to be scrolled THROUGH, row by row. */
const LAB_BLOCKS_LONG = [
  LAB_BLOCK(1, 'Guests arrive', '14:30', 'Santuario de San Antonio'),
  LAB_BLOCK(2, 'Ceremony', '15:00', 'Santuario de San Antonio', 'ceremony'),
  LAB_BLOCK(3, 'Photos with the families', '16:00', 'Santuario de San Antonio'),
  LAB_BLOCK(4, 'Cocktails', '17:30', 'Seda Vertis North', 'cocktails'),
  LAB_BLOCK(5, 'Grand entrance', '18:30', 'Seda Vertis North', 'reception'),
  LAB_BLOCK(6, 'Dinner', '19:00', 'Seda Vertis North', 'reception'),
  LAB_BLOCK(7, 'First dance', '20:30', 'Seda Vertis North', 'reception'),
  LAB_BLOCK(8, 'Send-off', '22:00', 'Seda Vertis North', 'reception'),
];
const LAB_VENUE_EVENT = {
  event_date: '2026-12-12',
  venues: [
    { role: 'ceremony', name: 'Santuario de San Antonio', address: 'McKinley Rd, Forbes Park, Makati', latitude: 14.5476, longitude: 121.0335 },
    { role: 'reception', name: 'Seda Vertis North', address: '1 Astra Way, Vertis North, Quezon City', latitude: 14.6537, longitude: 121.0367 },
  ],
};

/** The canvas keys whose node draws its own marker (the guest stand-ins), or has none (the March — `#site-entourage`). */
const STAGE_SELF_MARKED = ['f:greeting', 'f:pass', 'f:rsvp', 'f:entourage'] as const;

/** The public ready-made scene photo the lab's scene backgrounds use, as its own URL (a legacy ref is served verbatim). */
const LAB_MEDIA = { '/std/backgrounds/golden-hour.webp': '/std/backgrounds/golden-hour.webp' };

/**
 * 🧑 THE LAB'S SAMPLE GUEST — nobody's row: the reply pages are drawn by their REAL components here (the reply card,
 * the note after a reply), and those are drawn for a guest.
 */
const LAB_GUEST = {
  guest_id: 'lab-guest',
  first_name: 'Teresita',
  last_name: 'Aquino',
  display_name: null,
  rsvp_status: 'pending',
  meal_preference: null,
  dietary_restrictions: null,
  guest_note: null,
  email: null,
  mobile: null,
  plus_one_allowed: false,
  plus_one_count: 0,
  qr_token: 'lab',
  photo_source: null,
  photo_url: null,
} as unknown as GuestRow;

/**
 * The Reply door's own save, as `invite/reply` hands it to the card — for nobody's event and nobody's guest. On the
 * Maker's canvas the bridge stops every send before it is one; this is here so the card is drawn as the DOOR draws it
 * (a card inside a door: no letterpress head of its own). A save of the lab's own that read nothing was a real
 * finding of the Root map ("sends rsvp_status, but labReply never reads it") — so it is the real one, not a stand-in.
 */
const labReply = submitInviteReply.bind(null, 'lab', 'lab-guest');

/**
 * `?look=<json>` — a stored `rsvp_ask_config.look` to draw the lab's reply screens with, as the SERVER draws a guest's
 * (the Maker lays its own changes on the page live; this is how the lab is asked for a page that was saved). Read by
 * the same one strict reader as everything else, so a bad value is simply the page's own.
 */
function labRsvpConfig(raw: string | string[] | undefined): { look: unknown } | null {
  if (typeof raw !== 'string') return null;
  try {
    return { look: JSON.parse(raw) };
  } catch {
    return null;
  }
}

/**
 * 🏷 THE TAB'S TITLE, AS A REAL GUEST PAGE WORDS IT (`app/[slug]/page.tsx` `generateMetadata`, the title a page that
 * does not name the couple wears: the event type's own word + "invitation" — "Wedding invitation"). The lab's guest
 * page had no title of its own, so its tab read the SITE's default line (the walk of 2026-10-11, M16). That line —
 * the brand's — is not this file's to change.
 */
export async function generateMetadata(): Promise<Metadata> {
  const words = await eventWordsFor('wedding').catch(() => null);
  return { title: `${(words?.eventWord ?? 'event').replace(/^./, (c) => c.toUpperCase())} invitation`, robots: { index: false, follow: false } };
}

/** maria-and-jose's board stand-in — Oxblood & olive, the prototype's first palette. */
const LAB_BOARD = ['#5B1A22', '#6B7A3A', '#E0A52B', '#8E2E3C', '#F2C8C2'];

/**
 * /dev/maker-lab/guest — the Maker lab's CANVAS stand-in: maria-and-jose's
 * page, same words and shape (read-only from production, 2026-10-05), drawn
 * here because the real guest page needs the database the lab does not have.
 * DEV-ONLY: production builds 404 it.
 */
export default async function MakerLabGuestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  /* 🎁 `?wish=…` — the guest's wish list on fixtures (`wish-lab.tsx`), instead of the canvas. */
  if (typeof sp.wish === 'string') {
    return <WishLab state={sp.wish} look={typeof sp.look === 'string' ? sp.look : undefined} known={sp.known !== '0'} named={sp.name !== '0'} mine={sp.mine === '1'} />;
  }
  const rsvp = typeof sp.rsvp === 'string' ? sp.rsvp : null;
  /* 🎉 `?play=<pick>` plays the When yes celebration as a guest who just said
     yes (`&freeze=<s>` holds one still frame for a screenshot); without it the
     thank-you listens to the Maker, as the real one does on the stage. */
  const play = typeof sp.play === 'string' && isRsvpCelebration(sp.play) ? sp.play : null;
  const freeze = typeof sp.freeze === 'string' && Number.isFinite(Number(sp.freeze)) ? Number(sp.freeze) : undefined;
  const phase = typeof sp.phase === 'string' ? sp.phase : 'rsvp';
  /* 🎞 The lab's drafted Main background (a cookie the lab's draft stand-in
     sets), drawn by the REAL guest layer — `mainGroundLayerFor`, on the host's
     canvas (`tryOn`), Classic like maria-and-jose. A moving background needs no
     database on this path. */
  let main: unknown = null;
  try {
    main = JSON.parse(decodeURIComponent((await cookies()).get('lab_main')?.value ?? 'null'));
  } catch {
    main = null;
  }
  const ground = main
    ? await mainGroundLayerFor({
        theme: 'house',
        heroConfig: { main },
        event: { event_id: '00000000-0000-4000-8000-000000000000' },
        viewerIsHost: true,
        tryOn: true,
      })
    : null;
  /* 🎨 The lab's drafted scene canvases (`lab_widgets`, the lab's save
     stand-in) — each scene drawn below wears its drafted Style through the
     REAL resolver (`sceneStyleOfRow`) and the REAL widget, as the guest page does. */
  /* 🎚 `?scrub=1` (the Maker reaches it as `./scrub`): the lab's scenes as the Scrub chain (`../lab-scrub.ts`),
     drawn through the guest page's own renderer — see the chain below. */
  const scrub = sp.scrub === '1';
  let drafted: Record<string, unknown> = {};
  try {
    drafted = JSON.parse(decodeURIComponent((await cookies()).get(labWidgetsCookie(scrub))?.value ?? '{}')) as Record<string, unknown>;
  } catch {
    drafted = {};
  }
  drafted = labScrubCanvases(scrub, drafted);
  /* ⏱ A `lab_slow` cookie: the canvas page takes as long as production's to arrive. */
  if ((await cookies()).get('lab_slow')?.value === '1') await new Promise((r) => setTimeout(r, 2500));
  const labPhoto = (await cookies()).get('lab_photo')?.value === '1';
  const stage: HubStage | null = (HUB_STAGES as readonly string[]).includes(phase) ? (phase as HubStage) : null;
  /* 🖼 A style's true miniature (`?only=` + `?style=`), as the real canvas honours them — the lab is a host canvas. */
  const only = canvasOnlyScene({ only: typeof sp.only === 'string' ? sp.only : undefined }, true);
  const preview = canvasStylePreview({ style: typeof sp.style === 'string' ? sp.style : undefined }, true);
  /* 🎨 The lab's drafted part styles (`lab_styles`, the lab's `fixedStyles` stand-in), the preview's laid on top. */
  /* 🧱 The lab's drafted block looks (`lab_blocks`, the stand-in for `style_preferences.block_looks`). */
  let labBlocks: unknown = {};
  try {
    labBlocks = JSON.parse(decodeURIComponent((await cookies()).get('lab_blocks')?.value ?? '{}')) as unknown;
  } catch {
    labBlocks = {};
  }
  let labStyles: Record<string, unknown> = {};
  try {
    labStyles = JSON.parse(decodeURIComponent((await cookies()).get('lab_styles')?.value ?? '{}')) as Record<string, unknown>;
  } catch {
    labStyles = {};
  }
  const { event: labEvent, widgets: labRows } = withStylePreview(
    { style_preferences: { scene_styles: labStyles } },
    Object.keys({ ...drafted, countdown: 1, special_message: 1, schedule: 1, venue_map: 1, dress_code: 1, our_love_story: 1 }).map((t) => ({ widget_type: t, config_json: { canvas: drafted[t] ?? {} } })),
    preview,
  );
  const rowOf = (type: string) => labRows.find((r) => r.widget_type === type) ?? { widget_type: type, config_json: { canvas: {} } };
  const look = (type: StyledScene) => partLookAttr(type, fixedSceneStyleOf(labEvent.style_preferences, type, stage, 'wedding'));
  const heroLooks = Object.fromEntries(
    (Object.entries(HERO_PART_LOOK) as Array<[keyof typeof HERO_PART_LOOK, StyledScene]>).flatMap(([part, type]) => {
      const v = look(type);
      return v ? [[part, v]] : [];
    }),
  );
  const words = await eventWordsFor('wedding').catch(() => null);
  /* 🎞 The lab's Post Event story as guests would meet it: the scenes drawn, in the run's order, each with the marker
     its tile scrolls to, the style it is drawn in and the couple's own words where they wrote some. */
  const labStory = phase === 'editorial' ? labPostEventRead(labEditorialDraft((await cookies()).get(LAB_EDITORIAL_COOKIE)?.value)) : null;
  let chaptersMarked = false;
  const postEventScenes = (labStory?.rows ?? [])
    .filter((r) => postEventSceneDrawn(r.status, r.hidden))
    .map((r) => {
      const chapter = r.block === 'chapters';
      const marker = chapter ? (chaptersMarked ? null : 'ch-1') : r.key;
      if (chapter) chaptersMarked = true;
      const look = postEventLookOf(labStory!.arrangement, r.key);
      return { key: r.key, name: r.name, source: r.source, marker, style: resolvePostEventStyle(r.key, look.style, 'wedding'), words: look.words ?? null };
    });
  /* On the chain the markers are drawn as the REAL page draws them — on the Maker's canvas only (`site-body.tsx`
     `makerMark`). The Scrub island reads them: a page that has one is being edited, and holds nothing until ▶ is
     held (`hub-scrub.tsx`); the same address opened plainly is a guest's page, and its hand-overs run. */
  const mark = (key: string) => (scrub && sp.editor !== '1' ? null : <span hidden data-maker-section={key} />);
  /** The Maker's canvas (`?editor=1`) — the only reader the canvas's own stand-ins are drawn for. */
  const makerCanvas = sp.editor === '1';
  /* 🗂 THE STAGE'S OWN PARTS, IN THE MAKER'S ORDER (`../lab-navigator.ts` — the real `makerStageLists` on the sample's
     rows with the lab's draft over them): a stage draws what the Maker lists for it and nothing else, a scene moved
     Earlier · Later is drawn where it now stands, and one taken off is not drawn (P02 · P12). */
  const stageNow: HubStage = stage ?? 'rsvp';
  const labRowsNow = labDraftedRows((await cookies()).get(LAB_ROWS_COOKIE)?.value, (await cookies()).get(LAB_OWN_COOKIE)?.value === '1');
  const stageTiles = labStageTiles(labRowsNow, stageNow, labStory);
  /* 🗓 DOES THE DAY DRAW THIS SCENE? — its own list, or one of the two places off it (the Welcome's dress code and
     reminders, a guest's own schedule and directions): the page's one answer (`sceneOnStage`), on the lab's rows
     with its draft over them. The lab's Day drew a fixed set — the gallery always, whatever the table said (the walk
     of 2026-10-11, M08: "Our photos × The Day EMPTY but drawn"). */
  const dayDraws = (type: WidgetType): boolean =>
    stageTiles.includes(`w:${type}`) || (sceneOnStage({ ...labSeen(labRowsNow), stage: 'event', reader: 'guest' }, type)?.offList ?? null) !== null;
  /* 🧭 THE REAL HERO (`PahinaMasthead`, the guest page's own) — ONE mount for every page of the lab's canvas, wearing
     the hero row's drafted canvas as the real page does (`site-body.tsx` `heroElements`): a typed Title, a part's
     colour, size and motion, the design picked. The lab's masthead read none of it, so a typed Title was gone at the
     next reload — and an Undo of it could not be seen (the walk of 2026-10-11, P01 · P05). */
  const heroCanvas = heroCanvasOf([rowOf('hero')] as never);
  /* ✍ The cover draws the DRAFTED names, as the real canvas does — so a cover drawn for one name can be typed into. */
  const labNames = labNamesFrom((await cookies()).get(LAB_NAMES_COOKIE)?.value, LAB_SAMPLE.names);
  const masthead = (
    <PahinaMasthead
      displayName={labNames}
      eventDate={LAB_SAMPLE.date}
      venueName={LAB_SAMPLE.venueLine}
      eyebrow={LAB_SAMPLE.openingLine}
      elements={heroCanvas.elements ?? null}
      design={heroDesignOf(heroCanvas)}
      stampElements
      looks={Object.keys(heroLooks).length > 0 ? heroLooks : null}
      monogramSlot={
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-gild font-serif text-2xl italic text-terracotta-700">
          M &amp; J
        </span>
      }
    />
  );
  /* 👗 The REAL dress code, fed the sample (`./lab-sample.ts`) — the palette look it wears is the one picked in the Maker. */
  const dressCode = words ? (
    <DressCodeWidget
      words={words}
      config={labDressConfig(LAB_BOARD)}
      ceremonyType={null}
      genderSeparation={null}
      rolePalette={labRolePalette(LAB_BOARD)}
      roleNames={null}
      sceneStyle={sceneStyleOfRow(rowOf('dress_code'), stage, 'wedding')}
      paletteLook={paletteLookOfRow(rowOf('dress_code'))}
      dosLook={dosLookOfRow(rowOf('dress_code'))}
      makerSample
    />
  ) : null;
  /* 🚶 The REAL Wedding March (`EntourageSection`, as `site-body.tsx` mounts it): the sample entourage, in its picked Style. */
  const marchBlock = (
    <div data-lab-scene="entourage" className="border-t border-ink/10 px-4 py-8 text-left">
      {/* 🧱 The March's own mark, right BEFORE the real block as the real page puts it (`lib/block-looks.ts`) — inside
          the lab's wrapper, so a look lands on the block a guest sees and not on the lab's own padding. */}
      <span hidden {...{ [BLOCK_MARK_ATTR]: 'entourage' }} />
      <EntourageSection groups={labEntourage()} id="site-entourage" sceneStyle={fixedSceneStyleOf(labEvent.style_preferences, 'entourage', stage, 'wedding')} />
    </div>
  );
  /* 🧩 THE LAB'S SCENES, each drawn ONCE — placed by the ordinary sample below, or (`?scrub=1`) by the Scrub chain. */
  const scene: Record<LabScrubScene | 'our_love_story', ReactNode> = {
    countdown: (
      /* 🌗 In the REAL scene frame, as every scene of the guest page is (`hideable-widget-render.tsx` wraps each in
         `HubCanvasFrame`). The lab drew the Countdown bare, so its Background picked a tile, raised ✓ and drew
         nothing (the walk of 2026-10-11, M11) — the lab's fault alone: the real page has always framed it. */
      <HubCanvasFrame widget={{ ...rowOf('countdown'), widget_id: 'lab-countdown' } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
        <section data-lab-scene="countdown" className="border-t border-ink/10 px-4 py-8">
          <CountdownWidget targetIso="2026-12-12" timeZone="Asia/Manila" sceneStyle={sceneStyleOfRow(rowOf('countdown'), stage, 'wedding')} />
        </section>
      </HubCanvasFrame>
    ),
    /* 🧩 AN EMPTY SCENE IS THE MAKER'S CANVAS ALONE (`makerCanvas`), as on the real page (`site-body.tsx`
       `isMakerCanvas`; `maker-empty-scene.tsx`: "A guest never receives this markup"). The lab drew "Only you see this"
       on its guest page whoever asked (the walk of 2026-10-11, P11). */
    our_love_story: makerCanvas ? (
      <div data-lab-scene="our_love_story" className="border-t border-ink/10 px-4 py-8">
        <MakerEmptyScene type="our_love_story" />
      </div>
    ) : null,
    special_message: (
      /* 🌗 The REAL scene frame (`HubCanvasFrame`): its drafted background, Darker ↔ Lighter and Spacing, as guests see them. */
      <HubCanvasFrame widget={{ ...rowOf('special_message'), widget_id: 'lab-special-message' } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
        <div data-lab-scene="special_message" className="border-t border-ink/10 px-4 py-8 text-left">
          <SpecialMessageWidget
            text="We cannot wait to celebrate with you."
            signedBy="Maria & Jose"
            sceneStyle={sceneStyleOfRow(rowOf('special_message'), stage, 'wedding')}
          />
        </div>
      </HubCanvasFrame>
    ),
    schedule: (
      /* 🗓 The day's moments — the REAL Schedule widget on maria-and-jose's run of show, in its drafted (or previewed) Style. */
      <HubCanvasFrame widget={{ ...rowOf('schedule'), widget_id: 'lab-schedule' } as never} hubTheme="house" ownClipPlays>
        <section data-lab-scene="schedule" className="border-t border-ink/10 px-4 py-8 text-left">
          <ScheduleWidget blocks={LAB_BLOCKS as never} eventTz="Asia/Manila" eventType="wedding" sceneStyle={sceneStyleOfRow(rowOf('schedule'), stage, 'wedding')} />
        </section>
      </HubCanvasFrame>
    ),
    venue_map: (
      /* 🏛 The REAL Venue widget — the church and the hotel, in its drafted (or previewed) Style. */
      <HubCanvasFrame widget={{ ...rowOf('venue_map'), widget_id: 'lab-venue' } as never} hubTheme="house" ownClipPlays>
        <section data-lab-scene="venue_map" className="border-t border-ink/10 px-4 py-8 text-left">
          <VenueWidget event={LAB_VENUE_EVENT as never} sceneStyle={sceneStyleOfRow(rowOf('venue_map'), stage, 'wedding')} map="none" blocks={LAB_BLOCKS as never} />
        </section>
      </HubCanvasFrame>
    ),
    dress_code: (
      /* 👗 The REAL Dress code (`DressCodeWidget`, as `hideable-widget-render.tsx` draws it for the Maker's canvas) on a
         sample dress code and Mood Board, in its drafted Style, palette look and do's look. */
      <HubCanvasFrame widget={{ ...rowOf('dress_code'), widget_id: 'lab-dress-code' } as never} hubTheme="house" ownClipPlays>
        <section data-lab-scene="dress_code" className="border-t border-ink/10 px-4 py-8 text-left">
          {dressCode}
        </section>
      </HubCanvasFrame>
    ),
  };
  const giftsBlock = (
    /* The lab wraps the gift card; the Maker asks the block's root whether it is the real card (`data-welcome-gifts`),
       so the wrapper says so when the real card is what it holds — else Animate is grey here and cannot be tried. */
    <div data-lab-scene="gifts" {...(words ? { 'data-welcome-gifts': '' } : {})} className="border-t border-ink/10 px-4 py-8 text-left">
      {/* 🧱 E-Gifts' own mark, right BEFORE the real block (`lib/block-looks.ts`) — inside the lab's wrapper. */}
      <span hidden {...{ [BLOCK_MARK_ATTR]: 'gifts' }} />
      {words ? <WelcomeGifts href="#gifts" words={words} look={look('gifts')} /> : <MakerWelcomeGiftsEmpty look={look('gifts')} />}
    </div>
  );
  /* 👤 The Invitation's "Guest's look" — the guest page's own stand-in (the Maker's What to wear part). THE MAKER'S
     CANVAS ONLY, as on the real page (`guest-welcome.tsx`: `maker ? <MakerWelcomeLook/> : null` — "a guest never
     receives this markup"). The lab drew it whoever asked, so its guest preview read "Each guest sees their own look,
     from your Mood Board" to a guest (the walk of 2026-10-11, M15). */
  const lookBlock = makerCanvas ? (
    <div data-lab-scene="look" className="border-t border-ink/10 px-4 py-8 text-left">
      {/* 🧱 What to wear's own mark, right BEFORE the sample (`lib/block-looks.ts`) — inside the lab's wrapper. */}
      <span hidden {...{ [BLOCK_MARK_ATTR]: 'look' }} />
      <MakerWelcomeLook look={look('my_wear')} />
    </div>
  ) : null;
  /* 👤 WHAT EACH GUEST GETS — the greeting, the pass, the reply — as the REAL canvas stands in for them
     (`MakerGuestScenes`: "Each guest sees their own"), each behind its own marker so it can be picked. The Maker's
     canvas only: a page opened plainly has no guest to draw them for. (They were two bare headings of the lab's own —
     "Personal greeting", "Guest's ticket" — that no part could pick and the whole-page preview showed; P10.) */
  const guestScene = (which: 'greeting' | 'pass' | 'rsvp') =>
    makerCanvas ? (
      <div className="border-t border-ink/10 px-4 pb-8 text-left">
        <MakerGuestScenes
          show={{ greeting: which === 'greeting', pass: which === 'pass', rsvp: which === 'rsvp' }}
          eventDate={LAB_SAMPLE.date}
          solemn={false}
          mark={(key) => <>{blockOfCanvas(key) ? <span hidden {...{ [BLOCK_MARK_ATTR]: blockOfCanvas(key) }} /> : null}{mark(key)}</>}
        />
      </div>
    ) : null;
  /** A scene the sample has nothing in yet: its place on the Maker's canvas (`MakerEmptyScene`), nothing for a guest. */
  const emptyScene = (type: 'what_to_bring' | 'our_photos') =>
    makerCanvas ? (
      <div data-lab-scene={type} className="border-t border-ink/10 px-4 py-8">
        <MakerEmptyScene type={type} />
      </div>
    ) : null;
  /* 🧩 THE LAB'S NODE FOR EACH CANVAS KEY — a stage draws the ones its own list names (`./lab-stage.tsx`). */
  const stageGiven: Record<string, ReactNode> = {
    'f:hero': <section className="px-4 pb-10 pt-6">{masthead}</section>,
    'f:greeting': guestScene('greeting'),
    'f:pass': guestScene('pass'),
    'f:rsvp': guestScene('rsvp'),
    'f:look': lookBlock,
    'f:gifts': giftsBlock,
    'w:countdown': scene.countdown,
    'w:special_message': scene.special_message,
    'w:our_love_story': scene.our_love_story,
    'w:schedule': scene.schedule,
    'w:venue_map': scene.venue_map,
    'w:dress_code': scene.dress_code,
    'w:what_to_bring': emptyScene('what_to_bring'),
    'w:our_photos': emptyScene('our_photos'),
    /* ✍ The lab's one scene of the couple's own (`LAB_OWN_COOKIE`) — the guest page's own widget for it. Listed by
       the Maker only when the walk asked for it, so it is drawn only then (a stage draws what its list names). */
    [`w:${LAB_OWN_SCENE.type}`]: (
      <div data-lab-scene={LAB_OWN_SCENE.type} className="border-t border-ink/10 px-4 py-8 text-left">
        <CustomSectionWidget config={LAB_OWN_SCENE.config} />
      </div>
    ),
    'f:entourage': marchBlock,
  };
  /* 🎚 THE CHAIN'S CARDS (`?scrub=1`). Each scene of the chain is drawn as the prototype drew it, so a hold can be
     READ (2026-10-09 — a hold was "mostly a blank white screen with one faint element in the middle and nothing
     saying anything is happening"): a card (the hub's card look: paper, hairline, radius, shadow) in a phone-wide
     column, labelled with what it is set to — read from the canvas it is drawn with (`labScrubLabel`), never written
     by hand. The card sits INSIDE the real frame (`HubCanvasFrame`), so the scene's Build in and Build out move the
     card itself, as they move a scene on the guest page. The first card says the cover is not in the chain.
     🖼 THE CARD IS THE HUB'S OWN RULE (`globals.css` "THE HUB IS CARDS", its last arm — a section inside a frame that
     paints nothing): the lab draws none of its own, so what is seen here is what a guest's page draws. A scene given
     a background of its own in the Maker wears THAT as its box, by the same rule. (Until 2026-10-09 the rule did
     not reach a framed scene and each card here was a stand-in, written out in classes.) */
  const chainBody: Record<LabScrubScene, ReactNode> = {
    countdown: <CountdownWidget targetIso="2026-12-12" timeZone="Asia/Manila" sceneStyle={sceneStyleOfRow(rowOf('countdown'), stage, 'wedding')} />,
    schedule: <ScheduleWidget blocks={LAB_BLOCKS_LONG as never} eventTz="Asia/Manila" eventType="wedding" sceneStyle={sceneStyleOfRow(rowOf('schedule'), stage, 'wedding')} />,
    special_message: <SpecialMessageWidget text="We cannot wait to celebrate with you." signedBy="Maria & Jose" sceneStyle={sceneStyleOfRow(rowOf('special_message'), stage, 'wedding')} />,
    dress_code: <>{dressCode}</>,
    venue_map: <VenueWidget event={LAB_VENUE_EVENT as never} sceneStyle={sceneStyleOfRow(rowOf('venue_map'), stage, 'wedding')} map="none" blocks={LAB_BLOCKS as never} />,
  };
  /* 🎬 THE COVER AS HAND-OVER ZERO (`hub-scenes.tsx` `HubCoverHold`): on the chain the lab's cover is the hero row, and
     it hands over when that row Leaves by Scrub — the chain's start (`LAB_SCRUB_COVER`), or whatever "Scene leaves ◆"
     on one of the cover's parts saved here. Asked through the real question, with the lab's door open. */
  const coverLeaves = scrub && hubCoverLeaves([rowOf('hero')] as never, true, true);
  const chainCard = (type: LabScrubScene, i: number) => (
    <HubCanvasFrame widget={{ ...rowOf(type), widget_id: `lab-${type}` } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
      <section
        data-lab-scene={type}
        data-lab-name={LAB_SCRUB_NAME[type]}
        className="text-left"
      >
        <p data-lab-card-label="" className="mb-3 text-[10.5px] font-bold uppercase leading-snug tracking-[0.08em] text-gild">
          {labScrubLabel(rowOf(type).config_json, { last: i === LAB_SCRUB_CHAIN.length - 1 }).map((l, n) => (
            <span key={l.name}>
              {n > 0 ? ' · ' : ''}
              {l.name} <b className="font-bold text-terracotta-700">{l.value}</b>
            </span>
          ))}
          {i === 0 && !coverLeaves ? <span className="mt-1 block normal-case tracking-normal text-ink/60">The cover above does not leave by Scrub.</span> : null}
        </p>
        {chainBody[type]}
      </section>
    </HubCanvasFrame>
  );
  /* 🧭 THE DAY, AS PAGES (`./lab-day.tsx`) — the Stages canvas's own shape for The Day (`&tabs=1`, as the Maker asks
     for it): one page per tab, the day's own parts on the page the one filing puts them on, the Camera a page. */
  if (phase === 'event' && sp.tabs === '1' && !scrub && !rsvp) {
    return (
      <main className="min-h-dvh bg-cream text-center text-ink" data-lab-phase={phase}>
        <div data-guest-ground="" aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#FBF9F5]" />
        <LabDayPages
          tab={typeof sp.tab === 'string' ? sp.tab : undefined}
          paged={!only}
          draws={dayDraws}
          maker={makerCanvas}
          tiles={stageTiles}
          mark={mark}
          styleOf={(part) => fixedSceneStyleOf(labEvent.style_preferences, part, stage, 'wedding')}
          galleryStyle={sceneStyleOfRow(rowOf('our_photos'), stage, 'wedding')}
          /* Every node the lab has (`stageGiven`): the day's own five, and any scene ticked onto The Day. */
          given={stageGiven}
        />
        {sp.editor === '1' && !preview ? <EditorBridge /> : null}
        {only ? <style>{canvasOnlyCss(only)}</style> : null}
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        {/* 🧱 The fixed blocks' own looks on The Day's pages too, as the real page carries them — this branch had the
            March's mark and no style, so a look picked on The Day › Welcome drew nothing here (seen 2026-10-10). */}
        <style {...{ [BLOCK_LOOKS_STYLE_ATTR]: '' }}>{blockLooksCss(readBlockLooks({ block_looks: labBlocks }))}</style>
      </main>
    );
  }
  if (rsvp) {
    const labConfig = labRsvpConfig(sp.look);
    const labLook = readRsvpLook(labConfig);
    if (rsvp === 'form' && sp.door === '1') {
      /* 🚪 The reply page as a guest walks it — `./lab-reply-door.tsx`. */
      return <LabReplyDoor sp={sp} words={await eventWordsFor('wedding')} look={labLook} config={labConfig} board={celebrationColours(LAB_BOARD)} guest={LAB_GUEST} reply={labReply} />;
    }
    if (rsvp === 'form' && sp.sheet === '1') {
      /* 🧾 `?rsvp=form&sheet=1#your-details` — THE EVENT HUB'S OWN REPLY SHEET (`rsvp-sheet.tsx`), the second place a
         guest replies: the real sheet, the real card inside it and the look's one `<style>` exactly as `site-body.tsx`
         mounts them (`surface="sheet"`), over a page to judge its paper against. A guest's view: no canvas bridge. */
      return (
        <main className="min-h-dvh px-5 py-6 text-ink" style={{ background: `linear-gradient(160deg, ${LAB_BOARD[4]} 0%, ${LAB_BOARD[2]} 52%, ${LAB_BOARD[1]} 100%)` }} data-lab-reply-sheet="">
          <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
          <div className="space-y-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]">You&rsquo;re invited</p>
            <h1 className="font-serif text-4xl">Maria &amp; Jose</h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Saturday, December 12, 2026 · Seda Vertis North</p>
            {Array.from({ length: 8 }, (_, i) => (
              <p key={i} className="text-base leading-relaxed">
                Together with their families, Maria and Jose invite you to celebrate their wedding.
              </p>
            ))}
            <a href="#your-details" className="button-primary inline-flex">
              Reply
            </a>
          </div>
          <RsvpSheet heading="Your reply" privacyLine="Only the couple sees your reply." flash={null}>
            <div data-rsvp-form>
              <RsvpWidget
                words={await eventWordsFor('wedding')}
                guest={LAB_GUEST}
                eventId="lab"
                eventPublicId="lab"
                faceMode="mode_b"
                oneAtATime={sp.one === '1'}
                lines={rsvpScreenLayout(labLook, 'rsvp')}
              />
              <RsvpLookStyle config={labConfig} board={celebrationColours(LAB_BOARD)} parts={['rsvp']} surface="sheet" />
            </div>
          </RsvpSheet>
        </main>
      );
    }
    return (
      /* 🖼 A GROUND TO JUDGE THE CARD AGAINST (controller 2026-10-10): on plain cream, Frosted and None looked the
         same as Plain. A stand-in for the Look's background, made of the lab's own colours — the lab only. */
      <main className="min-h-dvh px-5 py-6 text-ink" style={{ background: `linear-gradient(160deg, ${LAB_BOARD[4]} 0%, ${LAB_BOARD[2]} 52%, ${LAB_BOARD[1]} 100%)` }}>
        {/* 🧩 THE REAL RSVP PAGES' PART MARKS, AND THEIR BRIDGE (2026-10-09 — the owner could not reach the RSVP
            stage's tools by hand in the lab: these screens had no marks, so a tap picked nothing and ticked an
            answer). As `invite/reply` and `invite/enter` draw them on the Maker's canvas: the masthead inside the
            door's header (`stampRsvpCanvas` names its parts and marks it `f:hero`), a hidden section marker before
            each part, and each word's own key. `RsvpCanvasBridge` then makes a tap PICK the part under it — never
            the form's own. In the Maker's frame only (`play` is the lab's own celebration preview, a plain page). */}
        {play === null ? <RsvpCanvasBridge /> : null}
        {/* The app's own chrome (the cookie card) stays off the lab's RSVP screens, as it does off the lab's other
            guest pages below: it sat over "Sadly, no", the hint and the Save button. The lab only. */}
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        {/* 🎨 Each line's look, as the real pages carry it — drawn at the tap in the Maker (`rsvp-look-style.tsx`). */}
        <RsvpLookStyle config={labConfig} board={celebrationColours(LAB_BOARD)} parts={rsvp === 'form' ? ['rsvp'] : rsvp === 'thanks' ? ['yesnote', 'pass'] : ['nonote']} canvas />
        {/* 🃏 The door's CARD, as `DoorShell` draws it: the masthead and every section inside ONE card — on the Maker's
            canvas the card is the screen's group of lines, picked from its edge (`RSVP_CARD_GROUPS`). */}
        <div className="rounded-3xl bg-white px-5 py-6 shadow-sm">
          <header data-door-header="">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gild">You&rsquo;re invited</p>
            <h1 className="mt-1 text-xl font-semibold">Maria &amp; Jose</h1>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60">
              <span data-el="date">Saturday, December 12, 2026</span>
            </p>
          </header>
        {rsvp === 'form' ? mark('f:greeting') : null}
        {rsvp === 'form' ? <p className="mt-4 text-sm">Teresita Aquino</p> : null}
        {rsvp === 'form' ? mark('f:rsvp') : null}
        {rsvp === 'form' ? (
          /* 🃏 THE REAL REPLY CARD (`RsvpWidget`), as `invite/reply` draws it on the Maker's canvas: the invitation's
             Reply door, the SAMPLE guest, every question drawn. It was a hand-made copy of the card's answers — which
             could not show a line the couple added, an order or a group, and had drifted from the card before
             (2026-10-10; the hand-over's own trap: "the lab's stand-ins hide things from the owner"). One element
             after the marker, as the page's `CanvasSection` is. `?one=1`: one question at a time, on the server. */
          <div className="mt-4 space-y-4">
            <RsvpWidget
              words={await eventWordsFor('wedding')}
              guest={LAB_GUEST}
              eventId="lab"
              eventPublicId="lab"
              faceMode="mode_b"
              doorAction={labReply}
              termsOnSend
              previewEveryQuestion
              oneAtATime={sp.one === '1'}
              lines={rsvpScreenLayout(labLook, 'rsvp')}
            />
          </div>
        ) : rsvp === 'thanks' ? (
          <>
            {mark('f:yesnote')}
            {/* 💌 THE REAL NOTE AFTER A YES (`RsvpNoteLines`, as `invite/enter` draws it): the "✓ You replied" pill
                and the couple's message, in the block the marker stands before. */}
            <div data-landing="message" className="mt-6 space-y-3">
              <RsvpNoteLines
                reply="yes"
                canvas
                wordKeys={{ heading: 'thanksHeading', message: 'thanksMessage' }}
                headline={landingHeadline('attending')}
                ownHeadline={landingHeadline('attending')}
                ownMessage={null}
                firstName="Teresita"
                lines={rsvpScreenLayout(labLook, 'yesnote')}
              />
            </div>
            <WhenYesCelebration
              kind={play ?? 'none'}
              colours={celebrationColours(LAB_BOARD)}
              play={play !== null}
              name="Teresita"
              listen={play === null}
              freezeAt={freeze}
            />
            {/* The pass and its Save button — a line of the pass, named on a box around the (inert) button, as
                `invite/enter` does. */}
            {play === null ? mark('f:pass') : null}
            {play === null ? (
              <section className="mt-6 space-y-4 text-center">
                <div className="mx-auto h-40 w-[min(260px,100%)] rounded-2xl bg-ink/10" />
                <div data-rsvp-line="save">
                  <button type="button" className="button-primary w-full">
                    Save my ticket
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <>
            {mark('f:nonote')}
            {/* 💌 THE REAL NOTE AFTER A NO (`RsvpNoteLines`): the note's OWN card inside the door's card
                (`data-landing-missed`) — with a ground chosen for the door's card it gives up its paper, so ONE card
                shows (`RSVP_INNER_CARD_SELECTOR`). */}
            <div data-landing="message" className="mt-6 space-y-3">
              <RsvpNoteLines
                reply="no"
                canvas
                wordKeys={{ heading: 'declineHeading', message: 'declineMessage' }}
                headline={landingHeadline('declined')}
                ownHeadline={landingHeadline('declined')}
                ownMessage={null}
                firstName="Teresita"
                lines={rsvpScreenLayout(labLook, 'nonote')}
              />
            </div>
          </>
        )}
        </div>
      </main>
    );
  }
  return (
    <main className={`min-h-dvh text-center text-ink ${ground || labPhoto ? 'relative' : 'bg-cream'}`} data-lab-phase={phase}>
      {/* The page's paper is a LAYER under everything, as the real page's is (`GuestGround`) — never the box's own
          fill, which would hide a background laid behind the page (the main background, and its instant preview). */}
      {labPhoto && !ground ? null : <div data-guest-ground="" aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#FBF9F5]" />}
      {ground}
      {/* 🖼 a `lab_photo=1` cookie: a photo behind the page (the side-by-side's real-looking content) — a public ready-made scene. */}
      {!ground && labPhoto ? (
        <div data-guest-ground="" aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/std/backgrounds/golden-hour.webp" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#FBF9F5]/60" />
        </div>
      ) : null}
      {/* 🧍 THE PAGE'S OWN HOLD, as `site-body.tsx` wraps its article: on the chain, everything this page draws — the
          cover, the greeting, the ticket — stands still while a hand-over plays. (`holds` 0 off the chain: nothing is
          wrapped.) */}
      <HubPageHold holds={scrub ? hubScrubHoldsAtMost(LAB_SCRUB_CHAIN.map((t) => rowOf(t)) as never, true, true) + (coverLeaves ? 1 : 0) : 0}>
      <div className="flex justify-between border-b border-ink/10 px-4 py-2.5 text-[9.5px] font-semibold uppercase tracking-[0.3em] text-gild">
        <span>Setnayan</span>
        <span>{phase === 'save_the_date' ? 'Save the Date' : phase === 'event' ? 'The Day' : phase === 'editorial' ? 'Post Event' : 'Invitation'}</span>
      </div>
      {/* 🧭 THE REAL HERO (`PahinaMasthead`, the guest page's own) on maria-and-jose's words — its parts carry their
          `data-el` and, when picked, their own style (`data-part-look`), exactly as the guest page draws them. */}
      {/* 🎚 The chain's badge (lab only): is Scrub on, which hand-over, how far — or WHY it is off. Before the first
          marker, so the Maker's bridge never counts it as part of a scene. Never in a miniature. */}
      {/* 🎬 THE COVER, AND THE REST OF THE PAGE AFTER IT — as the page hands its cover over (`HubCoverHold`). With a
          cover that does not leave (the ordinary lab; a chain whose cover was set back to "As it scrolls away") both
          are returned as given: nothing is wrapped. The cover's marker goes IN with it, so the Maker's bridge still
          finds the cover right after its marker. */}
      {scrub ? (
      <>
      {scrub && !only && !preview ? <LabScrubBadge /> : null}
      <HubCoverHold
        leaves={coverLeaves}
        cover={
          <>
      {mark('f:hero')}
      <section className="px-4 pb-10 pt-6">
        {masthead}
      </section>
          </>
        }
      >
      <section className="border-t border-ink/10 px-4 py-8">
        <p className="font-serif text-lg">Personal greeting</p>
        <p className="mt-1 text-sm text-ink/70">Dear Teresita, we would love you there.</p>
      </section>
      <section className="border-t border-ink/10 px-4 py-8">
        <p className="font-serif text-lg">Guest&rsquo;s ticket</p>
      </section>
        {/* 🎚 THE SCRUB CHAIN (`../lab-scrub.ts`) — the lab's scenes through the guest page's OWN renderer (`HubScenes`),
           one node a scene with its marker, exactly as `site-body.tsx` hands them over: the hand-overs, the holds and
           the engine are the real ones, and what the owner arranges on a scene in the Maker is what plays here. The
           fixed blocks, and the one scene that is not in the chain, follow it as the ordinary lab draws them. */}
        <>
          <div className="sn-editorial mx-auto max-w-[430px] px-4 pb-6" data-lab-scrub="">
            <HubScenes widgets={LAB_SCRUB_CHAIN.map((t) => ({ ...rowOf(t), widget_id: `lab-${t}` })) as never} scrubAllowed scrubOut>
              {LAB_SCRUB_CHAIN.map((t, i) => (
                <Fragment key={t}>
                  {mark(`w:${t}`)}
                  {chainCard(t, i)}
                </Fragment>
              ))}
            </HubScenes>
          </div>
          <div className="sn-editorial">
            {mark('f:gifts')}
            {giftsBlock}
            {mark('f:look')}
            {lookBlock}
            {mark('w:our_love_story')}
            {scene.our_love_story}
          </div>
        </>
      </HubCoverHold>
      </>
      ) : (
        /* 🗂 EVERY OTHER PAGE OF THE LAB'S CANVAS — the stage's own parts, in the Maker's order, each tab its own page
           where the real canvas has tabs (`./lab-stage.tsx`). The cover is the stage's first part (`f:hero`), filed
           on its page like any other, as on The Day. */
        <LabStagePages
          stage={stageNow}
          tiles={stageTiles}
          tab={typeof sp.tab === 'string' ? sp.tab : undefined}
          paged={sp.tabs === '1' && !only}
          mark={mark}
          given={stageGiven}
          selfMarked={STAGE_SELF_MARKED}
        />
      )}
      {/* 🎞 POST EVENT'S OWN SCENES (the Post Event stage only) — a stand-in for each scene guests would meet, in the
          run's order, behind the marker the real story page puts before it (`p:<scene>`; the day's chapters share
          one, as they move together). The SAME rows the lab hands the Maker (`../lab-post-event.ts`), with the lab's
          drafted story keys laid over — so a scene hidden, moved, restyled or reworded in the panel is seen here. */}
      {phase === 'editorial' ? (
        <div className="sn-editorial" data-lab-post-event="">
          {postEventScenes.map((r) => (
            <div key={r.key} className="contents">
              {r.marker ? mark(`p:${r.marker}`) : null}
              <section data-lab-post-event-scene={r.key} data-lab-post-event-style={r.style ?? undefined} className="border-t border-ink/10 px-4 py-10 text-left">
                <p className="pahina-eyebrow">
                  <span data-el="label">{r.words?.label ?? r.name}</span>
                </p>
                <p className="mt-3 font-serif text-2xl" data-el="heading">
                  {r.words?.heading ?? r.source}
                </p>
                {r.words?.body ? (
                  <p className="mt-2 text-sm text-ink/70" data-el="body">
                    {r.words.body}
                  </p>
                ) : null}
                {r.style ? <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-ink/45">Style · {r.style}</p> : null}
              </section>
            </div>
          ))}
        </div>
      ) : null}
      </HubPageHold>
      {/* The Maker's two-way bridge, as the real canvas mounts it — its `ready` swaps a buffered frame in. Never in a miniature. */}
      {sp.editor === '1' && !preview ? <EditorBridge /> : null}
      {only ? <style>{canvasOnlyCss(only)}</style> : null}
      {/* 🍪 As the REAL canvas does (`site-body.tsx`, `isEditorCanvas`): the app's floating notices — the cookie consent
          among them — are not drawn inside the Maker's sample; the host answers them on the Maker's own page. The lab
          drew the banner over the foot of the sample, which the real Maker never does (seen on the review copy, 2026-10-09). */}
      <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
      {/* 🧱 The fixed blocks' own motion, as the real page carries it — redrawn at the tap in the Maker (`editor-bridge.tsx`). */}
      <style {...{ [BLOCK_LOOKS_STYLE_ATTR]: '' }}>{blockLooksCss(readBlockLooks({ block_looks: labBlocks }))}</style>
    </main>
  );
}
