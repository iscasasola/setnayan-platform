'use client';

import type { FixedSceneStyles } from '@/lib/fixed-scene-styles';
import type { CameraLook } from '@/lib/camera-look';
import { useEffect, useMemo, type ComponentProps, type ReactNode } from 'react';
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
import { celebrationColours, celebrationDraftIsPro } from '@/lib/rsvp-celebration';
import { MakerRevealPicker } from '@/app/dashboard/[eventId]/launch/_components/maker-reveal';
import { MakerLogoDoor } from '@/app/dashboard/[eventId]/launch/_components/details-lazy';
import { REVEAL_LIBRARY } from '@/app/[slug]/_components/reveal/reveal-templates';
import { DEFAULT_REVEAL_EFFECTS } from '@/lib/std-reveal-effects';

/**
 * The Maker lab's client half (`page.tsx` says what is real): the real shell,
 * work area, RSVP stage and draft bar, with lab saves — a draft write here is
 * COUNTED by the lab (`window.__labDrafts`) and answers with the Apply bar, so
 * the count beside ✓ moves exactly as a real save moves it; nothing leaves the
 * browser.
 */
/** maria-and-jose's five main colours — the Look rows' and the sample screen's. */
const LAB_FIVE = ['#5B1A22', '#F7F2EC', '#C9A86A', '#FBFAF7', '#7A8B6F'];
let labChanges = 0;
/** 🎉 A Pro celebration drafted in the lab — the bar's ◆ follows it, as the real summary would. */
let labPro = 0;
function labSummary(n: number, pro = 0): HubDraftSummary {
  return { hasChanges: n > 0, changeCount: n, proCount: pro, canUndo: n > 0, changes: [] };
}
async function labDraft(_eventId: string, fd: FormData): Promise<HubDraftActionResult> {
  /* ⏱ The lab's stopwatch (`performance.getEntriesByName`): when a draft write left and when it answered. */
  performance.mark('lab-draft-sent');
  /* 💥 `?fail=1`: every save is refused — the lab's way to see a failure said in place. */
  if (new URLSearchParams(window.location.search).get('fail') === '1') {
    await new Promise((r) => setTimeout(r, 600));
    performance.mark('lab-draft-answered');
    return { ok: false, error: 'Your background could not be changed. Please try again.' } as HubDraftActionResult;
  }
  const w = window as unknown as { __labDrafts?: Array<Record<string, string>> };
  (w.__labDrafts ??= []).push(Object.fromEntries([...fd].filter(([, v]) => typeof v === 'string')) as Record<string, string>);
  /* 🎞 The lab's "draft": a Look › Background pick rides a cookie the lab's
     canvas (`./guest`) reads on its next load — the browser only, no database. */
  try {
    const patch = JSON.parse(String(fd.get('patch') ?? '{}')) as { widgets?: { hero?: { main?: unknown } }; events?: { rsvp_ask_config?: unknown } };
    if (patch.events && 'rsvp_ask_config' in patch.events) labPro = celebrationDraftIsPro(null, patch.events.rsvp_ask_config) ? 1 : 0;
    if (patch.widgets?.hero && 'main' in patch.widgets.hero) {
      document.cookie = `lab_main=${encodeURIComponent(JSON.stringify(patch.widgets.hero.main ?? null))}; path=/; SameSite=Lax`;
    }
  } catch {
    /* not a Background patch */
  }
  /* 🎨 …and a scene's canvas (its Style, its palette look) rides `lab_widgets`,
     which the lab's page reads back as the "server" canvases and its canvas
     (`./guest`) draws — so a pick reaches the canvas through the SAME refresh
     and hold a real save goes through. */
  try {
    const patch = JSON.parse(String(fd.get('patch') ?? '{}')) as { widgets?: Record<string, { canvas?: unknown }> };
    const held = labWidgetsFromCookie();
    let changed = false;
    for (const [type, w] of Object.entries(patch.widgets ?? {})) {
      if (w && typeof w === 'object' && 'canvas' in w) {
        held[type] = w.canvas ?? {};
        changed = true;
      }
    }
    if (changed) document.cookie = `lab_widgets=${encodeURIComponent(JSON.stringify(held))}; path=/; SameSite=Lax`;
  } catch {
    /* not a scene patch */
  }
  /* 🎨 A part's style (`fixedStyles`) rides `lab_styles`; 🎛 the camera's look rides `lab_camera` — the lab's
     stand-ins for `style_preferences.scene_styles` and `.camera_look`. */
  try {
    const patch = JSON.parse(String(fd.get('patch') ?? '{}')) as { fixedStyles?: Record<string, unknown>; events?: { style_preferences?: { camera_look?: unknown } } };
    if (patch.fixedStyles) {
      const raw = document.cookie.split('; ').find((c) => c.startsWith('lab_styles='))?.slice('lab_styles='.length);
      let held: Record<string, unknown> = {};
      try {
        held = raw ? (JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>) : {};
      } catch {
        held = {};
      }
      for (const [k, v] of Object.entries(patch.fixedStyles)) {
        if (v === null) delete held[k];
        else held[k] = v;
      }
      document.cookie = `lab_styles=${encodeURIComponent(JSON.stringify(held))}; path=/; SameSite=Lax`;
    }
    const cam = patch.events?.style_preferences?.camera_look;
    if (typeof cam === 'string') document.cookie = `lab_camera=${cam}; path=/; SameSite=Lax`;
  } catch {
    /* not a style patch */
  }
  labChanges += 1;
  /* ⏱ `?slow=1`: a save takes as long as production's (~1.5 s), so a race can show. */
  if (new URLSearchParams(window.location.search).get('slow') === '1') await new Promise((r) => setTimeout(r, 1500));
  const s = labSummary(labChanges, labPro);
  performance.mark('lab-draft-answered');
  return { ok: true, intent: 'save', applied: 0, held: [], bar: { free: s, owned: s, proEffects: [], priceLabel: null } } as HubDraftActionResult;
}
function labWidgetsFromCookie(): Record<string, unknown> {
  const raw = document.cookie.split('; ').find((c) => c.startsWith('lab_widgets='))?.slice('lab_widgets='.length);
  try {
    const v = raw ? (JSON.parse(decodeURIComponent(raw)) as unknown) : null;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
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
  changes = 0,
}: {
  /** ✓ `?changes=N` — the draft's unapplied count, as the draft bar would report it (the ✕ sheet's "kept" line). */
  changes?: number;
  /** 🎨 The lab's drafted part styles (`lab_styles`) and 🎛 camera look (`lab_camera`). */
  fixedStyles?: FixedSceneStyles;
  cameraLook?: CameraLook;
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
  const stand = (name: string) => <div data-lab-stand={name} className="rounded-md bg-white/70 p-3 text-[13px] text-ink/60">{name}</div>;
  const rsvpProps = useMemo<ComponentProps<typeof MakerRsvpStage>>(
    () => ({
      eventId,
      publicLandingUrl: '/dev/maker-lab/guest',
      solemn: false,
      current: sanitizeRsvpAskConfig({}),
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
    [eventId],
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
    <MakerShell
      eventId={eventId}
      /* The lab's own guest page stands in for /maria-and-jose (Preview's "Preview the stage"). */
      slug="dev/maker-lab/guest"
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
      applySlot={<HubDraftToolbar eventId={eventId} summary={labSummary(changes)} storeShell={false} priceLabel={null} proHref={null} />}
      details={{ page: details, controls: null }}
      rsvpStage={<MakerRsvpStage {...rsvpProps} />}
      hasWork
      theHost="the couple"
      stagesStudio={stagesStudio}
      studio={studio}
    >
      <MakerWork
        eventId={eventId}
        publicLandingUrl="/dev/maker-lab/guest"
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
                words: { names: 'Maria & Jose', date: 'December 12, 2026', line: 'Seda Vertis North' },
                musicOn: false,
              }}
            />
          ),
          /* 🎭 The real Reveal picker on fixtures (its saves are refused here — no write leaves the lab),
             so the Stages panel's Reveal part draws what the Maker draws. */
          reveal: (
            <MakerRevealPicker
              eventId={eventId}
              current="four-flap"
              drafted={false}
              stages={['save_the_date']}
              stagesDrafted={false}
              effects={DEFAULT_REVEAL_EFFECTS}
              effectsDrafted={false}
              tuneHouse={{} as ComponentProps<typeof MakerRevealPicker>['tuneHouse']}
              themeName="Classic"
              defaultOpening="four-flap"
              defaultIsTheme={false}
              dressing={null}
              openings={REVEAL_LIBRARY.map((t) => ({ id: t.id, label: t.label, blurb: t.blurb }))}
              ownsPro={false}
              storeShell={false}
              stdWindowDays={180}
              part="settings"
            />
          ),
          /* ⭐ The REAL logo editor on maria-and-jose's initials (no saved logo — `names`), so Studio › Logo can be
             checked in place against the prototype (owner 2026-10-07: it must never leave the Maker) and the Logo
             replot's side-by-side (2026-10-08). It saves only after a touch (`maker-logo-save-gate`), and the lab's
             event id is not a real event — writes fail here. */
          logo: (
            <MakerLogoDoor
              eventId={eventId}
              opening={{ source: 'names', layers: [], svg: null, names: 'M&J', anim: null }}
              motionMark={null}
              mainColours={['#5B1A22', '#F7F2EC', '#C9A86A', '#FBFAF7', '#7A8B6F']}
            />
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
        }}
      />
    </MakerShell>
  );
}
