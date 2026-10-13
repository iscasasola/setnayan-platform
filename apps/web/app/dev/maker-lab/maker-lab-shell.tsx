'use client';

import type { FixedSceneStyles } from '@/lib/fixed-scene-styles';
import type { CameraLook } from '@/lib/camera-look';
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { LAB_SCRUB_GUEST } from './lab-scrub';
import type * as LabDraft from './lab-draft';
import { LAB_SAMPLE } from './guest/lab-sample';
import { HUB_DRAFT_BAR_FIELD, requestMakerRefresh } from '@/lib/maker-refresh';
import { offerScrubOutInTheLab } from '@/lib/scrub-out-offered';
import { setStudioDraftDoor } from '@/app/dashboard/[eventId]/launch/_components/studio-info';
import { MakerShell } from '@/app/dashboard/[eventId]/launch/_components/maker-shell';
import type { StudioTileModel } from '@/lib/studio-tiles';
import { MakerRsvpStage } from '@/app/dashboard/[eventId]/launch/_components/maker-rsvp-stage';
import { MakerWork, type MakerScene } from '@/app/dashboard/[eventId]/website/editor/_components/editor-shell';
import type { MakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import { HubDraftToolbar } from '@/app/dashboard/[eventId]/website/_components/hub-draft-bar';
import type { HubDraftActionResult, HubDraftSummary } from '@/lib/hub-draft';
import { sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';
import { MainBackgroundPanel, type MovingBackgroundOption } from '@/app/dashboard/[eventId]/website/editor/_components/main-background-panel';
import { ColorsPanel } from '@/app/dashboard/[eventId]/website/editor/_components/pro-panels';
import { SiteChromePanel } from '@/app/dashboard/[eventId]/website/editor/_components/media-panels';
import { ButtonsLookRow } from '@/app/dashboard/[eventId]/website/editor/_components/buttons-look-row';
import { FontsLookRows } from '@/app/dashboard/[eventId]/website/editor/_components/fonts-look-rows';
import { LookSample } from '@/app/dashboard/[eventId]/launch/_components/look-sample';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { hubButtonPage } from '@/lib/hub-buttons';
import type { HubMainGround, HubSectionCanvas } from '@/lib/hub-canvas';
import { celebrationColours } from '@/lib/rsvp-celebration';
import { MakerRevealPicker } from '@/app/dashboard/[eventId]/launch/_components/maker-reveal';
import { MakerLogoDoor } from '@/app/dashboard/[eventId]/launch/_components/details-lazy';
import { LabStudioActions } from '../details-lab/lab-studio-actions';
import { LabLogoActions } from './lab-logo-actions';
import { REVEAL_LIBRARY } from '@/app/[slug]/_components/reveal/reveal-templates';
import { DEFAULT_REVEAL_EFFECTS } from '@/lib/std-reveal-effects';

/**
 * The Maker lab's client half (`page.tsx` says what is real): the real shell,
 * work area, RSVP stage and draft bar, on the lab's draft — the REAL draft's own
 * reducers (`./lab-draft.ts`: save · undo · restore · reset, the ✓ count, a
 * scene's place and eye), kept in this browser; nothing leaves it.
 */
/** maria-and-jose's five main colours — the Look rows' and the sample screen's. */
const LAB_FIVE = ['#5B1A22', '#F7F2EC', '#C9A86A', '#FBFAF7', '#7A8B6F'];

/**
 * 📦 THE LAB'S DRAFT ENGINE IS FETCHED BY THE LAB, IN DEV — A PRODUCTION BUILD NEVER COMPILES IT INTO THE BROWSER.
 *
 * MEASURED 2026-10-11 (PR #6475, CI "bundle size check"): the Maker's first load went 501.7 KB → 519.4 KB gzipped,
 * 12.4 KB over its ceiling (`scripts/check-maker-js-budget.mjs`) — and under 1 KB of that was the Maker's own new
 * code. The rest was THIS file's `import … from './lab-draft'`. `lab-draft.ts` runs the real draft's reducers
 * (`mergeHubDraft` · `sanitizeHubDraft` · `summarizeHubDraft`, and `planHubDraftApply` through the change lines and
 * the Pro effects), which until that import only the SERVER ran. Webpack decides which exports of a module are
 * "used" ONCE, for the whole browser build — so the day one browser file anywhere imported them, `lib/hub-draft.ts`
 * stopped being a field name and two small helpers (708 B in the shipped chunk) and became the whole engine, with
 * every sanitiser it calls, in EVERY chunk that carries it. The Maker's first load carries it (`HUB_DRAFT_FIELD`),
 * so every couple's phone downloaded a dev page's engine.
 *
 * 🔑 A LAB THAT 404s IN PRODUCTION IS STILL COMPILED — `page.tsx`, and everything this file imports.
 * So the engine is reached by an `import()` that a production build removes: `process.env.NODE_ENV` is a build-time
 * constant, the branch below is dead there, and webpack does not follow an import in a dead branch. No browser file
 * imports the engine, and `lib/hub-draft.ts` is its few small names again. In dev (the only place this page draws)
 * the engine is fetched on arrival, before anything can be pressed; the draft door waits for it.
 * 🛡 `lib/the-draft-engine-stays-out-of-the-browser.test.ts` fails if a file the browser can load imports the engine
 * again — from here or from anywhere else.
 */
type LabDraftEngine = typeof LabDraft;
let labEngineLoaded: LabDraftEngine | null = null;
const labEngine = (): Promise<LabDraftEngine> =>
  process.env.NODE_ENV === 'production' ? Promise.reject(new Error('The Maker lab is dev-only.')) : import('./lab-draft').then((m) => (labEngineLoaded = m));
/** The engine in hand. Every reader below runs only after `labEngine()` has answered. */
function labEngineNow(): LabDraftEngine {
  if (!labEngineLoaded) throw new Error('The lab’s draft engine has not arrived yet.');
  return labEngineLoaded;
}

/** Where the browser keeps the lab's draft — the Scrub chain's is its own (`./lab-scrub.ts`). */
const labDraftKey = (scrub: boolean) => (scrub ? 'lab_draft_scrub_v1' : 'lab_draft_v1');
const labScrubOn = () => new URLSearchParams(window.location.search).get('scrub') === '1';
function readLabDraft(scrub: boolean) {
  const { labDraftFrom } = labEngineNow();
  try {
    return labDraftFrom(window.localStorage.getItem(labDraftKey(scrub)));
  } catch {
    return labDraftFrom(null);
  }
}
/** 📣 Where the browser keeps what the lab has PUBLISHED (✓ Apply) — the state the draft is read against. */
const labLiveKey = (scrub: boolean) => (scrub ? 'lab_live_scrub_v1' : 'lab_live_v1');
function readLabPublished(scrub: boolean) {
  const { labPublishedFrom } = labEngineNow();
  try {
    return labPublishedFrom(window.localStorage.getItem(labLiveKey(scrub)));
  } catch {
    return null;
  }
}
/**
 * The draft's state, handed to the lab's server-drawn pages: every cookie written from the STATE (`labDraftCookies`
 * — what is published with the draft over it), a cleared one cleared. True when a cookie CHANGED — the pages then
 * need drawing again.
 */
function writeLabCookies(draft: ReturnType<LabDraftEngine['labDraftFrom']>, scrub: boolean): boolean {
  const { labDraftCookies } = labEngineNow();
  const published = readLabPublished(scrub);
  const held = new Map(document.cookie.split('; ').map((c) => [c.slice(0, c.indexOf('=')), c.slice(c.indexOf('=') + 1)] as const));
  let changed = false;
  for (const [name, value] of Object.entries(labDraftCookies(draft, scrub, published))) {
    if ((held.get(name) ?? null) === value) continue;
    changed = true;
    document.cookie = value === null ? `${name}=; path=/; max-age=0; SameSite=Lax` : `${name}=${value}; path=/; SameSite=Lax`;
  }
  return changed;
}
/**
 * 🚪 THE LAB'S DRAFT DOOR — `hubDraftAction`'s shape, answered by the same reducers (`labDraftStep`). Every writer in
 * the lab comes through here: a pick, a typed word, a move, the eye, Studio's rows — and the bar's ↺ · ✓ · Restore ·
 * Reset (`HubDraftToolbar` `draftAction`), which used to go to the REAL action with the lab's made-up event and
 * land on the sign-in page (the walk of 2026-10-11, P01).
 */
async function labDraft(_eventId: string, fd: FormData): Promise<HubDraftActionResult> {
  /* ⏱ The lab's stopwatch (`performance.getEntriesByName`): when a draft write left and when it answered. */
  performance.mark('lab-draft-sent');
  const fail = new URLSearchParams(window.location.search).get('fail');
  /* 📵 `?fail=throw`: the request never leaves (no signal) — the door THROWS, as a server action does offline. */
  if (fail === 'throw') {
    await new Promise((r) => setTimeout(r, 300));
    throw new TypeError('Failed to fetch');
  }
  /* 💥 `?fail=1`: every save is refused — the lab's way to see a failure said in place. */
  if (fail === '1') {
    await new Promise((r) => setTimeout(r, 600));
    performance.mark('lab-draft-answered');
    return { ok: false, error: 'Your background could not be changed. Please try again.' } as HubDraftActionResult;
  }
  const w = window as unknown as { __labDrafts?: Array<Record<string, string>> };
  (w.__labDrafts ??= []).push(Object.fromEntries([...fd].filter(([, v]) => typeof v === 'string')) as Record<string, string>);
  const { labDraftStep } = await labEngine();
  const scrub = labScrubOn();
  const { draft, result, published } = labDraftStep(readLabDraft(scrub), { intent: fd.get('intent'), patch: fd.get('patch'), stage: fd.get('stage'), bar: fd.get(HUB_DRAFT_BAR_FIELD) }, scrub, readLabPublished(scrub));
  if (result.ok) {
    try {
      /* 📣 ✓ Apply moved the draft into the lab's published state — kept first, so the pages are drawn from both. */
      if (result.intent === 'apply') {
        if (published) window.localStorage.setItem(labLiveKey(scrub), JSON.stringify(published));
        else window.localStorage.removeItem(labLiveKey(scrub));
      }
      window.localStorage.setItem(labDraftKey(scrub), JSON.stringify(draft));
    } catch {
      performance.mark('lab-draft-answered');
      return { ok: false, intent: result.intent, error: 'The sample’s draft could not be kept in this browser. Restore it and try again.' };
    }
    writeLabCookies(draft, scrub);
  }
  /* ⏱ `?slow=1`: a save takes as long as production's (~1.5 s), so a race can show. */
  if (new URLSearchParams(window.location.search).get('slow') === '1') await new Promise((r) => setTimeout(r, 1500));
  performance.mark('lab-draft-answered');
  return result;
}
const noop = async () => {};
const formNoop = async () => {};

export function MakerLabShell({
  eventId,
  scenes,
  navigator,
  details,
  loops = [],
  mainBackground = null,
  pageColour = null,
  openDetails = false,
  canvases = {},
  renderStamp = 'lab',
  stagesStudio = false,
  studio = null,
  fixedStyles = {},
  cameraLook = 'classic',
  blockLooks = {},
  summary,
  scrub = false,
  revealLab = null,
}: {
  /** 🎭 `?reveal=owner|all` — the Reveal panel on the owner's map (`page.tsx` asks the guest page's own rule). */
  revealLab?: { themeName: string; defaultOpening: string; defaultIsTheme: boolean; openings: readonly string[] } | null;
  /** 🎚 `?scrub=1` — the canvas is the lab's Scrub chain (`./lab-scrub.ts`, `./guest/scrub`). */
  scrub?: boolean;
  /** ✓ The lab draft's summary as its "server" read it for this render (`lab_bar`; `?changes=N` stands in for it). */
  summary: HubDraftSummary;
  /** 🎨 The lab's drafted part styles (`lab_styles`) and 🎛 camera look (`lab_camera`). */
  fixedStyles?: FixedSceneStyles;
  cameraLook?: CameraLook;
  /** 🧱 The lab's drafted block looks (`lab_blocks`). */
  blockLooks?: Record<string, unknown>;
  /** 🧭 `?studio=1` — the new Maker ("Stages | Studio"), with its tiles. */
  stagesStudio?: boolean;
  studio?: { tiles: readonly StudioTileModel[] } | null;
  eventId: string;
  scenes: MakerScene[];
  navigator: MakerNavigatorData;
  details: ReactNode;
  loops?: readonly MovingBackgroundOption[];
  /** 🌄 `?bg=` — the main background the lab starts on, so each Source of Studio › Look › Background can be seen (default: just the colour). */
  mainBackground?: HubMainGround | null;
  /** 🌈 `?paper=dark` — the page colour the lab starts on (a dark one shows whether a Pattern card still shows its pattern). */
  pageColour?: string | null;
  openDetails?: boolean;
  /** The lab's "server" canvases — what its draft holds (`lab_widgets`), read on every render. */
  canvases?: Record<string, HubSectionCanvas>;
  /** Moves with every render of the lab page, as the real Maker's does (`String(Date.now())`). */
  renderStamp?: string;
}) {
  /* 🧾 Studio › Info's kept rows (drawn by the server — there is no `draftAction` prop to hand them) save into the
     lab's stand-in too, so a kept name shows its tick and ✓ Apply's count rises here as it would for a signed-in
     couple — and nothing leaves the browser. Put back when the lab is left. */
  useEffect(() => {
    setStudioDraftDoor(labDraft as never);
    return () => setStudioDraftDoor(null);
  }, []);
  /* 🔁 LEAVING AND COMING BACK KEEPS THE DRAFT. The draft is this browser's (`localStorage`); the pages are drawn from
     the cookies written from it. On arrival they are written afresh — a tab opened elsewhere, an older lab's cookies,
     a cleared jar: whatever the pages were drawn with, they are drawn again from the draft if it differs. */
  useEffect(() => {
    let here = true;
    void labEngine().then(
      () => {
        /* 🧹 `?unpublish=1`: the lab starts with nothing published again (✓ Apply publishes here — `lab-draft.ts`). */
        if (new URLSearchParams(window.location.search).get('unpublish') === '1') {
          try {
            window.localStorage.removeItem(labLiveKey(scrub));
          } catch {
            /* a browser that keeps nothing has nothing published */
          }
        }
        if (here && writeLabCookies(readLabDraft(scrub), scrub)) requestMakerRefresh();
      },
      () => {},
    );
    return () => {
      here = false;
    };
  }, [scrub]);
  /* 🧪 "Scrub out" ships dark in the app (`lib/scrub-out-offered.ts`); on the lab's chain (`?scrub=1`) the Maker's
     controls keep offering it, so the owner can go on arranging the real thing. Put back when the lab is left. */
  useEffect(() => {
    offerScrubOutInTheLab(scrub);
    return () => offerScrubOutInTheLab(false);
  }, [scrub]);
  /* ✓ THE BAR A RENDER BRINGS NAMES ITS CHANGES (`labRenderedSummary`). The server's prop is the count from a cookie;
     the draft is this browser's, so once the render is on the page the bar is read from the draft itself — the same
     count, with the lines the Apply sheet lists. (`?changes=N` is a stand-in with no draft behind it: left as given.) */
  const [bar, setBar] = useState<HubDraftSummary>(summary);
  useEffect(() => {
    const standIn = new URLSearchParams(window.location.search).has('changes');
    let here = true;
    void labEngine().then(
      ({ labRenderedSummary }) => {
        if (here) setBar(standIn ? summary : labRenderedSummary(readLabDraft(scrub), scrub, readLabPublished(scrub)));
      },
      () => {},
    );
    return () => {
      here = false;
    };
  }, [summary, scrub, renderStamp]);
  const stand = (name: string) => <div data-lab-stand={name} className="rounded-md bg-white/70 p-3 text-[13px] text-ink/60">{name}</div>;
  /* 🗳 THE RSVP STAGE IS HANDED THE DRAFT'S OWN CONFIG, A NEW OBJECT EVERY RENDER — as the launch page hands a
     signed-in couple's. It was a constant (`sanitizeRsvpAskConfig({})`), so no render here could ever show an Undo: a
     tester (2026-10-11) took two steps back and could not tell whether the line still on the canvas was the lab's
     fault or the product's. (It was both: this constant, and the stage never being told — `lib/rsvp-stage-truth.ts`.)
     `?rsvp_const=1` puts the constant back, to see the lab as it was. */
  const [rsvpNow, setRsvpNow] = useState<ReturnType<typeof sanitizeRsvpAskConfig>>(() => sanitizeRsvpAskConfig({}));
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('rsvp_const') === '1') return;
    let here = true;
    void labEngine().then(
      () => {
        const drafted = readLabDraft(scrub).events.rsvp_ask_config;
        const live = readLabPublished(scrub)?.events?.rsvp_ask_config;
        if (here) setRsvpNow(sanitizeRsvpAskConfig(drafted ?? live ?? {}));
      },
      () => {},
    );
    return () => {
      here = false;
    };
  }, [scrub, renderStamp]);
  const rsvpProps = useMemo<ComponentProps<typeof MakerRsvpStage>>(
    () => ({
      eventId,
      publicLandingUrl: '/dev/maker-lab/guest',
      solemn: false,
      current: rsvpNow,
      drafted: false,
      replyBy: { date: '2026-11-12', isDefault: true },
      replyByOwn: { deadline: null, pricingMode: 'realtime' },
      replyByFallback: '2026-11-12',
      frameSrc: (scene) => `/dev/maker-lab/guest?rsvp=${scene}`,
      draftAction: labDraft as never,
      /* Answers as `updatePaxSettings` does — a stub that answers nothing reads as a refused save ("Reply by did not save"). */
      replyByAction: (async () => ({ ok: true })) as never,
      celebration: { ownsPro: false, colours: celebrationColours(['#5B1A22', '#6B7A3A', '#E0A52B', '#8E2E3C', '#F2C8C2']) },
    }),
    [eventId, rsvpNow],
  );
  /* 🎨 Look's rows — the REAL controls (Background · Page colour · Colours · Font · Buttons), on
     maria-and-jose's shape: Classic, no hero photo, nothing chosen yet. A
     Background pick drafts into the lab (`window.__labDrafts`), never a database. */
  const house = INVITE_THEMES.house;
  const formDraft = (fd: FormData) => void labDraft(eventId, fd);
  const heroVideo = <SiteChromePanel action={formDraft} eventId={eventId} part="video" musicRef={null} musicEnabled={false} videoRef={null} />;
  const lookRows = {
    'main-background': {
      label: 'Behind every scene',
      node: (
        <MainBackgroundPanel
          eventId={eventId}
          themeId="house"
          colours={house.palette}
          current={mainBackground}
          hero={{ photoRef: null, photoUrl: null, hasClip: false, liveRef: null }}
          overrideStillUrl={null}
          drafted={false}
          ownsPro={false}
          loops={loops}
          /* 🌈 Studio › Look › Background's Colour source — Classic's paper and maria-and-jose's five. */
          page={{ bgColor: pageColour, resolved: house.palette.canvas, five: LAB_FIVE, artDirection: null, ownButton: false }}
          draftAction={labDraft as never}
          heroVideo={heroVideo}
        />
      ),
    },
    font: {
      label: 'Font',
      /* 🔤 The Studio's four font rows, on the lab's own draft stand-in (no write leaves the lab). */
      node: stagesStudio ? (
        <FontsLookRows eventId={eventId} themeId="house" fontKey={null} roles={null} draftAction={labDraft as never} />
      ) : (
        <ColorsPanel action={formDraft} eventId={eventId} rowKey="font" part="font" bgColor={null} buttonColor={null} artDirection={null} fontKey={null} proMark="try" />
      ),
    },
    /* 🌈 The page fill — Look › Background's since 2026-10-08 (`LOOK_ROW_OF.page`). */
    'page-colour': {
      label: 'Page colour',
      node: <ColorsPanel action={formDraft} eventId={eventId} rowKey="page-colour" part="page" bgColor={null} buttonColor={null} artDirection={null} />,
    },
    colors: {
      label: 'Colours',
      node: (
        <ColorsPanel action={formDraft} eventId={eventId} rowKey="colors" part="art" bgColor={null} buttonColor={null} artDirection={null} fontKey={null} magicTraveller={null} proMark="try" />
      ),
    },
    /* 🎵 The song and 🎬 the hero video — the REAL form parts, posting into the lab's stand-in (no file leaves it). */
    music: {
      label: 'Background music',
      node: (
        <SiteChromePanel
          action={formDraft}
          eventId={eventId}
          part="music"
          musicRef={null}
          musicEnabled={false}
          videoRef={null}
          /* 🎵 The music button's three designs — drawn once a sample song is picked; the pick goes to the lab's stand-in. */
          musicButton="bars"
          draftAction={labDraft as never}
          /* 🎵 Sample songs, so Our music's list can be seen in the lab — no address: nothing is fetched or played here. */
          ourMusic={[
            { trackId: '00000000-0000-4000-8000-0000000000a1', ref: 'r2://setnayan-media/hub-music/lab-1.mp3', title: 'First light', moodLabel: 'Romantic', length: '2:27', previewUrl: null },
            { trackId: '00000000-0000-4000-8000-0000000000a2', ref: 'r2://setnayan-media/hub-music/lab-2.mp3', title: 'Garden vows', moodLabel: 'Romantic', length: '3:05', previewUrl: null },
            { trackId: '00000000-0000-4000-8000-0000000000a3', ref: 'r2://setnayan-media/hub-music/lab-3.mp3', title: 'Open sky', moodLabel: 'Joyful', length: '2:48', previewUrl: null },
          ]}
        />
      ),
    },
    'hero-video': { label: 'Hero video', node: heroVideo },
    buttons: {
      label: 'Buttons',
      node: <ButtonsLookRow eventId={eventId} theme={house} page={hubButtonPage(house, null)} style={null} colour={null} palette={[house.palette.accent, house.palette.ink]} />,
    },
  };
  return (
    /* 🧪 Studio pages' writes (E-Gifts…) stand in locally — a lab press never reaches the database; "Accept gifts?" drafts into this lab's own counter. */
    <LabStudioActions draft={labDraft as never}>
    <MakerShell
      eventId={eventId}
      /* The lab's own guest page stands in for /maria-and-jose (Preview's "Preview the stage"). */
      slug={scrub ? LAB_SCRUB_GUEST.slice(1) : 'dev/maker-lab/guest'}
      liveStage="rsvp"
      initialStage="rsvp"
      /* `?tool=details` / `?guide=…` open on Details (the guided flow), as the real Maker does. */
      initialSelection={openDetails ? { kind: 'tool', key: 'details' } : null}
      storeShell={false}
      tourSlides={[]}
      firstVisit={false}
      completeTourAction={noop}
      renderStamp={renderStamp}
      more={null}
      applySlot={<HubDraftToolbar eventId={eventId} summary={bar} storeShell={false} priceLabel={null} proHref={null} draftAction={labDraft} />}
      details={{ page: details, controls: null }}
      rsvpStage={<MakerRsvpStage {...rsvpProps} />}
      hasWork
      theHost="the couple"
      stagesStudio={stagesStudio}
      studio={studio}
    >
      <MakerWork
        eventId={eventId}
        publicLandingUrl={scrub ? LAB_SCRUB_GUEST : '/dev/maker-lab/guest'}
        scenes={scenes}
        navigator={navigator}
        scenePanels={Object.fromEntries(scenes.map((s) => [s.id, stand(`${s.label} — its settings`)]))}
        rows={lookRows}
        ownsPro={false}
        toggleAction={formNoop}
        setModeAction={formNoop}
        moveUpAction={formNoop}
        moveDownAction={formNoop}
        proUnlockHref="/dev/maker-lab"
        proPriceLabel={null}
        showProCta={false}
        revealStages={['save_the_date']}
        madeOnce={{
          hero: stand('The names & date design'),
          /* 🪟 Studio › Look's sample screen — the REAL component on the standard sample event (Maria & Jose), fed the
             same stand-in values the Look rows above are (Classic, their five, the lab's background and loops). */
          'look-sample': (
            <LookSample
              seed={{
                eventId,
                themeId: 'house',
                fontClassName: '',
                row: {
                  role_palette: { reception: LAB_FIVE },
                  site_bg_color: pageColour ?? null,
                  site_button_color: null,
                  site_button_style: null,
                  site_font_key: null,
                  site_art_direction: null,
                  site_roles: null,
                },
                main: mainBackground ?? null,
                coverRef: null,
                sources: { loops, photoChoices: [], videoChoice: null, sceneUploads: [], cover: null, themeId: 'house' },
                words: { names: LAB_SAMPLE.names, date: LAB_SAMPLE.dateLabel, line: LAB_SAMPLE.venue },
                /* On, so the sample shows the music button while Music is the tab open. */
                musicOn: true,
                musicButton: 'bars',
              }}
            />
          ),
          /* 🎭 The real Reveal picker on fixtures (its saves are refused here — no write leaves the lab),
             so the Stages panel's Reveal part draws what the Maker draws. */
          reveal: (
            <MakerRevealPicker
              eventId={eventId}
              current={revealLab ? null : 'four-flap'}
              drafted={false}
              stages={revealLab ? ['save_the_date', 'rsvp', 'event'] : ['save_the_date']}
              stagesDrafted={false}
              effects={DEFAULT_REVEAL_EFFECTS}
              effectsDrafted={false}
              tuneHouse={{} as ComponentProps<typeof MakerRevealPicker>['tuneHouse']}
              themeName={revealLab?.themeName ?? 'Classic'}
              defaultOpening={revealLab?.defaultOpening ?? 'four-flap'}
              defaultIsTheme={revealLab?.defaultIsTheme ?? false}
              dressing={null}
              openings={REVEAL_LIBRARY.filter((t) => !revealLab || revealLab.openings.includes(t.id)).map((t) => ({ id: t.id, label: t.label, blurb: t.blurb }))}
              ownsPro={revealLab !== null}
              storeShell={false}
              stdWindowDays={180}
              part="settings"
            />
          ),
          /* ⭐ The REAL logo editor on maria-and-jose's initials (no saved logo — `names`), so Studio › Logo can be
             checked in place against the prototype (owner 2026-10-07: it must never leave the Maker) and the Logo
             replot's side-by-side (2026-10-08). It saves only after a touch (`maker-logo-save-gate`), and the lab's
             event id is not a real event — its one write is the lab's stand-in (`lab-logo-actions.tsx`: counted, nothing sent). */
          logo: (
            <LabLogoActions refuse={typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('refuse') === '1'}>
              <MakerLogoDoor
                eventId={eventId}
                opening={{ source: 'names', layers: [], svg: null, names: 'M&J', anim: null }}
                motionMark={null}
                mainColours={['#5B1A22', '#F7F2EC', '#C9A86A', '#FBFAF7', '#7A8B6F']}
              />
            </LabLogoActions>
          ),
        }}
        elementEditing={{
          canvases,
          palette: { ink: '#2C2A29', heading: '#2C2A29', accent: '#A9834B', muted: '#8A8580', surface: '#FBF9F5' },
          draftAction: labDraft,
        }}
        sceneFormat={{
          /* maria-and-jose's Classic colours — Look › Colours › Palette needs some to show. */
          colorChoices: ['#A9834B', '#2C2A29', '#C7A27C', '#E8D9C5'],
          photoChoices: [],
          videoChoice: null,
          mediaHref: '/dev/maker-lab',
          hubTheme: 'house',
          openBrowse: true,
          hideLocked: false,
          twoPeople: true,
          eventType: 'wedding',
          heroCard: true,
          heroPhoto: false,
          ticketStyle: 'classic',
          fixedStyles,
          cameraLook,
          blockLooks,
        }}
      />
    </MakerShell>
    </LabStudioActions>
  );
}
