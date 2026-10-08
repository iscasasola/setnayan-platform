'use client';

import { HUB_DRAFT_BAR_FIELD, makerRedrawSave, makerSave } from '@/lib/maker-refresh';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { extractPosterFrame } from '../../../_components/std-media-picker';
import { hubDraftAction } from '../../hub-draft-actions';
import { CALMER_CLIP_SCRIM, adaptiveThemeVars, measureFrame, resolveAdaptiveTheme } from '@/lib/adaptive-theme';
import { hubThemePageTokens } from '@/lib/hub-theme-tokens';
import { INVITE_THEMES, type InviteTheme, type InviteThemeId } from '@/lib/invite-themes';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel, type PaidMarkState } from '@/lib/paid-mark';
import {
  HUB_MAIN_BLURS,
  HUB_MAIN_FOCUSES,
  HUB_MAIN_PATTERNS,
  HUB_MAIN_PATTERN_LABEL,
  HUB_MEDIA_MOTIONS,
  HUB_MEDIA_MOTION_LABEL,
  hubMainTakes,
  isHubMainFollow,
  isHubMainLoop,
  isHubMainOwn,
  mainGroundPosition,
  type HubMainFocus,
  type HubMainGround,
  type HubMainOwn,
} from '@/lib/hub-canvas';
import { MAIN_GROUND_SHADES, MAIN_GROUND_SHADE_LABEL } from '@/lib/main-ground-shade';
import { patternCardSwatch } from '@/lib/main-ground-pattern-cards';
import { BACKGROUND_EFFECTS, BACKGROUND_EFFECT_LABEL, encodeBackgroundChoice, ombreCss, parseSiteBackground, type BackgroundEffect } from '@/lib/ombre';
import {
  BACKGROUND_MAIN_INFO,
  BACKGROUND_SHADE_CANDLELIGHT,
  BACKGROUND_SHADE_CANDLELIGHT_LABEL,
  backgroundSourcesOffered,
  BACKGROUND_SOURCE_IS_PRO,
  BACKGROUND_SOURCE_LABEL,
  backgroundShadeValue,
  backgroundShadeWrite,
  backgroundSourceOf,
  coverCardShows,
  backgroundWritePatch,
  type BackgroundSource,
  type BackgroundWrite,
} from '@/lib/background-source';
import { MAIN_COLOUR_SLOTS as MOOD_COLOUR_NAMES } from '@/lib/colour-access';
import { STUDIO_ROW_PICK } from '@/lib/studio-skin';
import { InfoTip } from '@/app/_components/info-tip';
import { StudioColourField } from '../../../launch/_components/studio-colour-field';
import { BgCard, BgCards, BgPickLine, BgRow, LoopPicture, UploadPicture } from './background-cards';
import {
  BACKGROUND_PICK_CANVAS_WAIT_MS,
  BACKGROUND_PICK_FAILED,
  MAIN_GROUND_PREVIEW,
  backgroundLayOf,
  backgroundPickAfter,
  backgroundPickRedraws,
  mainGroundLandedMessage,
  type MainGroundWorn,
  backgroundPickStep,
  backgroundPictureKey,
  createLookGroundStore,
  lookGroundPictures,
  mainGroundPreviewMessage,
  type BackgroundPick,
  type LookGround,
  type LookGroundPictures,
} from '@/lib/background-pick';
import { tellLookSample } from '@/lib/look-sample-store';
import { mainGroundChoice } from '@/lib/main-ground-choice';
import { heroFrameWrites } from '@/lib/hero-frame-sync';
import { IMAGE_MAX_EDGE } from '@/lib/image-max-edge';
import { STD_REALISTIC_BACKGROUNDS, isStdLibrarySrc } from '@/lib/std-backgrounds';
import { ClipTile, PhotoTile, type SceneUpload } from './scene-background-row';
import { PickMenu } from './pick-menu';
import type { PickOption } from './pick-menu-types';
import { useMaker } from '../../../launch/_components/maker-context';
import { MAKER_MAX_CLIP_SECONDS, makeMakerVideoDurationValidator } from '@/lib/maker-media-limits';
import { uploadStill } from '@/lib/upload-still';
import { MakerMediaMeter } from '@/app/_components/maker-media-meter';

/**
 * BEHIND EVERY SCENE — your hero, and the theme follows its colours
 * (Event Hub Maker Phase 10).
 *
 * 🔑 THE HERO IS THE MAIN BACKGROUND (owner, 2026-09-25, "six controller
 * questions" item 6): *"whatever they make on the hero scene will be their cover
 * and the main background."* So there is no second upload by default: "Same as
 * my hero" is the first choice and the default, and the adaptive theme — owner,
 * *"Adaptive theme is for PRO – i like this"* — reads the hero's own photo. A
 * couple who wants something else behind the page can still pick "A different
 * clip or photo": an opt-in override, never a step they have to repeat.
 *
 * ── ALL IN THE BROWSER, NO SERVER ─────────────────────────────────────────
 * The hero's photo is read once, here, straight off its public URL (the media
 * bucket answers the app's own origins with CORS) — `HeroFrameSync`, which the
 * Hero workspace mounts too, so a new hero is measured the moment it lands. An
 * override is read the moment it is picked: a photo as it is, a clip through
 * `extractPosterFrame` (the Save-the-Date's frame grab), its still uploaded
 * beside it. `measureFrame` turns the pixels into a handful of colours.
 *
 * ── THE DRAFT, NEVER LIVE ─────────────────────────────────────────────────
 * Every change posts `hubDraftAction` intent=save with the hero row's `main` —
 * the same one draft action the Reveal and the Logo use. A free couple may try
 * it; it goes live at Apply, where Event Hub Pro is asked for.
 *
 * 🔎 A REFUSED SAVE, OR A FRAME THAT COULD NOT BE READ, SAYS SO. Footage whose
 * colours were not measured is never used — its words would sit over pixels
 * nobody looked at.
 */

/** One moving background of ours, as the dropdown lists it (built on the server). */
export type MovingBackgroundOption = {
  id: InviteThemeId;
  name: string;
  stillUrl: string | null;
  /** 🎞 The loop itself (its public address) — Studio › Look › Background's Video card plays it. Absent = the still only. */
  loopUrl?: string | null;
};

/** 🌈 The page colour as Studio › Look › Background's Colour source sets it — the drafted look over live. */
export type MainBackgroundPage = {
  /** `events.site_bg_color` as stored — a plain hex or an encoded ombré (`lib/ombre.ts`); null = the Mood Board's. */
  bgColor: string | null;
  /** The colour the page wears while that is blank — the Mood Board's, else the theme's paper. */
  resolved: string;
  /** The Mood Board's five — the colour picker's first row. */
  five: readonly string[];
  /** `events.site_art_direction` — Candlelight is Shade ▾'s darkest step. */
  artDirection: 'daylight' | 'candlelight' | null;
  /**
   * The buttons wear a colour of the couple's own (`events.site_button_color`) — a picture's tint then leaves them
   * alone (`adaptiveThemeVars`). Absent = not known here: a picture pick asks the page to redraw itself instead.
   */
  ownButton?: boolean;
};

type LookWrite = BackgroundWrite;

const PRO_TRAIL = { text: '◆', tone: 'muted' as const, label: 'Event Hub Pro' };
/** "Just the colour" — nothing laid over the page colour. */
const NO_PICTURE: HubMainGround = { ground: 'none' };
/** A card with no picture of its own yet — paper, never a blank. */
const PAPER_SWATCH = 'rgb(var(--color-ink) / 0.05)';
const BLUR_LABEL = { soft: 'Soft', strong: 'Strong' } as const;
const FOCUS_LABEL = { top: 'Top', bottom: 'Bottom' } as const;

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

/** The long edge the frame is measured at — plenty for colour, cheap to read. */
const MEASURE_EDGE = 96;

type Measured = { frame: string[]; kind: 'photo' | 'snippet'; poster: string | null };

async function readFrame(blob: Blob): Promise<string[]> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = MEASURE_EDGE / Math.max(bitmap.width, bitmap.height, 1);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(bitmap, 0, 0, w, h);
    return measureFrame(ctx.getImageData(0, 0, w, h).data, w, h);
  } finally {
    bitmap.close();
  }
}

async function saveMain(eventId: string, main: HubMainGround | null, draft: typeof hubDraftAction = hubDraftAction) {
  return saveLookWrite(eventId, { main }, draft);
}

/**
 * ONE draft save for one pick — the main background and/or the page's own colour and art direction (`hubDraftAction` intent=save).
 * `bar`: a HELD save (no whole-Maker render follows) asks the action for the Apply bar in its own answer (`HUB_DRAFT_BAR_FIELD`).
 */
async function saveLookWrite(eventId: string, write: LookWrite, draft: typeof hubDraftAction = hubDraftAction, bar = false) {
  const fd = new FormData();
  fd.set('intent', 'save');
  if (bar) fd.set(HUB_DRAFT_BAR_FIELD, '1');
  fd.set('patch', JSON.stringify(backgroundWritePatch(write)));
  return draft(eventId, fd);
}

/* ══ ⚡ STUDIO › LOOK › BACKGROUND — A PICK SHOWS AT ONCE (`lib/background-pick.ts`) ══════════════
   Owner 2026-10-08: *"took 8 seconds before a background shows"* · *"when i press, and it has a
   loading state, we want to know something is pressed and loading files... applying to your Hub."* */

/** The Maker's own copy of the page's background while the server has not caught up — one for the session, like the canvases'. */
const lookGround = createLookGroundStore();
/** Every pick's number. Module-wide: the canvas refuses a number lower than the last it laid, and a panel that is closed and opened again must not start over. */
let lookPickSeq = 0;
/**
 * The number of the last pick DRAWN (in the panel's own copy). A refusal puts the last landed background back only
 * when it is this one's — a later tap whose picture is still being read has a higher number but has drawn nothing
 * yet, and must not leave a refused pick on screen as if it had landed.
 */
let lookDrawnSeq = 0;
/**
 * The page the couple is LOOKING AT — the frames Look › Buttons lays its instant preview on (`buttons-look-row.tsx`),
 * less the ones kept behind (a render still loading, another stage kept warm): a preview there would fetch a still
 * and decode a film nobody sees. They get the truth with everyone else — the redraw reaches every frame.
 */
const LOOK_FRAMES = 'iframe[data-maker-page-frame], iframe[data-maker-canvas-frame="shown"]';

/** Post to every page the Maker shows; how many heard it (0 = no canvas to wait for). */
function postToCanvas(message: unknown): number {
  let n = 0;
  for (const f of document.querySelectorAll<HTMLIFrameElement>(LOOK_FRAMES)) {
    if (!f.contentWindow) continue;
    f.contentWindow.postMessage(message, window.location.origin);
    n += 1;
  }
  return n;
}

/**
 * ⏱ THE STOPWATCH (`performance.getEntriesByType('mark')`, names `bg-pick:*`): tap · canvas-told · files-read ·
 * write-sent · write-answered · still-painted · loop-playing · canvas-redrawn. Measured, never guessed — the
 * "8 seconds" was a path nobody had timed.
 */
function pickMark(name: string): void {
  try {
    performance.mark(`bg-pick:${name}`);
  } catch {
    /* no stopwatch here — nothing depends on it */
  }
}


/**
 * READS THE HERO'S PHOTO so the Main background can follow it. Renders nothing
 * but a status line while it works (and says so if it cannot). Mounted in the
 * Main panel AND beside the Hero workspace — a new hero is measured where it
 * was made, without the couple being asked to do anything.
 *
 * It only ever writes a FOLLOW (`{ follow: 'hero', of, tint }`) and never
 * replaces an override. The couple's colour choice survives a new hero.
 *
 * 🚫 NEVER ON OPENING ALONE (`lib/hero-frame-sync.ts`): it writes only beside a
 * change of the couple's own — a hero they drafted, or a Main choice that
 * differs from live — so opening the Maker leaves Apply at 0.
 */
export function HeroFrameSync({
  eventId,
  heroRef,
  heroUrl,
  current,
  liveHeroRef,
  mainDrafted,
  quiet = false,
}: {
  eventId: string;
  /** The hero photo guests see today — a different one shown is the couple's own edit. */
  liveHeroRef: string | null;
  /** The Main background in the draft differs from live (the couple chose it). */
  mainDrafted: boolean;
  /** The hero photo as the preview shows it (the draft over live), or null. */
  heroRef: string | null;
  /** Its public URL, to read the pixels from. */
  heroUrl: string | null;
  current: HubMainGround | null;
  /** Say nothing while working (the Hero workspace); still says a failure. */
  quiet?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'reading' | 'failed'>('idle');
  const tried = useRef<string | null>(null);
  const needs = heroFrameWrites({ current, heroRef, liveHeroRef, mainDrafted });
  const match = current && isHubMainFollow(current) ? current.tint.match : true;

  useEffect(() => {
    if (!needs || !heroRef || !heroUrl || tried.current === heroRef) return;
    tried.current = heroRef;
    let cancelled = false;
    setState('reading');
    (async () => {
      try {
        const res = await fetch(heroUrl, { mode: 'cors' });
        if (!res.ok) throw new Error(String(res.status));
        const frame = await readFrame(await res.blob());
        if (frame.length === 0) throw new Error('empty frame');
        const r = await makerSave(() => saveMain(eventId, { follow: 'hero', of: heroRef, tint: { match, frame } }), () => router.refresh());
        if (!r.ok) throw new Error(r.error);
        if (!cancelled) setState('idle');
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needs, heroRef, heroUrl, eventId, match, router]);

  // Once the saved frame is this hero's, there is nothing left to say — the
  // effect may have been torn down by that very refresh before it could.
  if (!needs) return null;
  if (state === 'failed') {
    return (
      <p role="alert" className="text-[12px] text-terracotta-700" data-hero-frame-sync="failed">
        We could not read your hero photo&rsquo;s colours, so your background stays as it is for now. Re-open this panel
        to try again.
      </p>
    );
  }
  if (state === 'reading' && !quiet) {
    return (
      <p className="text-[12px] text-ink/60" data-hero-frame-sync="reading">
        Reading your hero photo&rsquo;s colours…
      </p>
    );
  }
  return null;
}

function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink/70">
      <span aria-hidden className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" style={{ backgroundColor: hex }} />
      {label}
    </span>
  );
}

function Choice({
  on,
  label,
  note,
  disabled,
  onClick,
  data,
  thumb = null,
  mark = null,
  keepEnabled = false,
}: {
  on: boolean;
  label: string;
  note?: string;
  disabled: boolean;
  onClick: () => void;
  data: Record<string, string>;
  /** A small picture of the choice (the theme's still, the hero, the photo). */
  thumb?: string | null;
  /** ◆ PRO while tried, the owned mark once owned (`makerProMark`); never a lock. */
  mark?: PaidMarkState | null;
  /** Stay tappable while on (Upload media opens its picker again). */
  keepEnabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled || (on && !keepEnabled)}
      onClick={onClick}
      {...data}
      className={`sn-press flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors duration-sn-control ease-sn disabled:cursor-default ${
        on ? 'bg-ink text-cream' : 'bg-white text-ink hover:bg-white/80'
      }`}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-9 w-12 shrink-0 rounded object-cover" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          {label}
          {mark ? <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" tone="current" /> : null}
        </span>
        {note ? <span className={`block text-[11.5px] ${on ? 'text-cream/80' : 'text-ink/60'}`}>{note}</span> : null}
      </span>
      {on ? <Check aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.25} /> : null}
    </button>
  );
}

export function MainBackgroundPanel({
  eventId,
  themeId,
  current: storedMain,
  hero,
  overrideStillUrl,
  drafted,
  ownsPro,
  loops = [],
  photoChoices = [],
  videoChoice = null,
  sceneUploads = [],
  mediaUsedBytes,
  colours,
  draftAction = hubDraftAction,
  page = null,
  heroVideo = null,
}: {
  /** 🌈 Studio › Look › Background's Colour source and Shade ▾ (the new Maker). Absent = the colour is set elsewhere (the lab). */
  page?: MainBackgroundPage | null;
  /** 🎬 The hero video's own uploader (Look › Background since 2026-10-08) — the Studio draws it under "Your photo or video". */
  heroVideo?: ReactNode;
  eventId: string;
  /** The couple's saved theme. Classic has no moving background at all. */
  themeId: InviteThemeId;
  /**
   * 🎨 The theme's colours as the Mood Board dresses them — `themeColours`
   * (`lib/theme-colours.ts`), asked on the server with the drafted board. The
   * adaptive tint and its legibility are measured on THESE (owner 2026-10-05).
   */
  colours: InviteTheme['palette'];
  /** The stored Main background as the preview shows it — the draft over live. */
  current: HubMainGround | null;
  /** The hero (the draft over live): its photo ref and a URL for it. */
  hero: { photoRef: string | null; photoUrl: string | null; hasClip: boolean; liveRef: string | null };
  /** A signed URL for an override's photo or still, for the thumbnail. */
  overrideStillUrl: string | null;
  /** The draft holds a different Main background from what guests see. */
  drafted: boolean;
  ownsPro: boolean;
  /**
   * 🎞 MOVING BACKGROUNDS — every shipped loop of ours (`hubMovingBackgroundIds`),
   * each by its picture-able name and public still, built on the server.
   */
  loops?: readonly MovingBackgroundOption[];
  /** 🖼 The SAME pictures a scene's Upload media offers (`scene-background-row.tsx`). */
  photoChoices?: readonly { ref: string; url: string }[];
  videoChoice?: { ref: string; url: string; poster?: string | null } | null;
  sceneUploads?: readonly SceneUpload[];
  /** 💾 The event's settled `couple_media_bytes` — the 100 MB meter under the upload. Absent = no meter. */
  mediaUsedBytes?: number;
  /** The draft door — `hubDraftAction` (the default); the dev Maker lab hands its own stand-in so no write leaves it. */
  draftAction?: typeof hubDraftAction;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [choosingMedia, setChoosingMedia] = useState(false);
  const measuring = useRef<Promise<Measured | null> | null>(null);
  const studio = useMaker()?.stagesStudio === true;
  /* 🪟 Studio › Look's sample screen is what the couple looks at (`look-sample.tsx`) — a pick is on screen the moment it is told. */
  const sampleNode = useMaker()?.lookPages?.look?.sample;
  const onSample = studio && Boolean(sampleNode);
  /* 🧭 Studio: the source whose cards are on screen (a look, never a write) and whether the upload is open. */
  const [viewed, setViewed] = useState<BackgroundSource | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  /* 🧭 Studio: the pick is DRAWN AT THE TAP — ringed, named, on the canvas — then saved behind it, HELD (no
     whole-Maker render): the Maker keeps its own copy of the page's background until a render brings the same
     (`createLookGroundStore`). The shipped Maker keeps waiting for the render, as it always did. */
  const server: LookGround = { main: storedMain, bg: page?.bgColor ?? null, art: page?.artDirection ?? null };
  const serverRef = useRef(server);
  serverRef.current = server;
  const lookKey = `look:${eventId}`;
  const ground = studio ? lookGround.read(lookKey, server) : server;
  /** ⚡ The pick on its way — which card is ringed and marked, and what the one line says. */
  const [pick, setPick] = useState<BackgroundPick | null>(null);
  /** What "Try again" does: the refused pick, once more. */
  const retry = useRef<(() => void) | null>(null);
  /** The card just tapped (`data-bg-card`) — the strip says it before the card's own handler runs. */
  const tapped = useRef<string | null>(null);
  const current = ground.main;

  const theme = useMemo(() => ({ ...INVITE_THEMES[themeId], palette: colours }), [themeId, colours]);
  const own: HubMainOwn | null = isHubMainOwn(current) ? current : null;
  const follow = current && isHubMainFollow(current) && current.of === hero.photoRef ? current : null;
  const tint = own?.tint ?? follow?.tint ?? null;
  /* 🖼 THE CHOICES (owner 2026-09-29, "THE MAIN BACKGROUND OFFERS EVERY
     CHOICE"; 2026-10-05 "THEMES ARE REPLACED BY THREE DIRECT GLOBAL
     SETTINGS"): a moving background ◆ · same as my hero ◆ · upload media ◆ ·
     just the colour. Nothing stored = the hero when there is a hero photo (it
     is being measured), else the loop the page already wears.
     🧱 CLASSIC IS NO LONGER PLAIN PAPER (owner 2026-10-06, DECISION_LOG "EVENT
     DETAILS IS REBUILT": the Classic "no photo or video" rule is dropped — own
     photo/video ◆ for everyone): every choice is offered on every theme. Its
     STORED default still reads as the colour (Classic never measured a hero). */
  const stored = mainGroundChoice({ current, choosingMedia, followsHero: Boolean(follow), heroPhotoRef: hero.photoRef });
  /* Classic never follows a hero (no measured follow) — an unstored hero default reads as the colour too. */
  const choice = themeId === 'house' && (stored === 'theme' || (stored === 'hero' && !follow)) ? 'none' : stored;
  /* The loop on screen: the one picked, else (the default) the page's own. */
  const loopNow: InviteThemeId | null = isHubMainLoop(current)
    ? current.loop
    : choice === 'theme' && INVITE_THEMES[themeId]?.media
      ? themeId
      : null;
  const proMark = makerProMark({ owns: ownsPro, storeShell: false });

  const adaptive = useMemo(() => (tint ? resolveAdaptiveTheme(theme, tint) : null), [tint, theme]);
  // What the theme would paint with the toggle ON — shown even while it is off,
  // so the couple can see what "match" would do before they choose it.
  const matched = useMemo(
    () => (tint ? resolveAdaptiveTheme(theme, { ...tint, match: true }).tint : null),
    [tint, theme],
  );

  const COULD_NOT_READ =
    'We could not read the colours of that picture, so it was not used — the words over it could not be checked. Please try another one.';

  /* ── ⚡ the Studio's pick: ringed, on the canvas, then saved — in that order ─────────────────── */

  /** Where the canvas finds a picture the panel already holds an address for (never a guess: unknown = null). */
  const lookPictures: LookGroundPictures = lookGroundPictures(
    { loops, photoChoices, videoChoice, sceneUploads, cover: hero.photoUrl, themeId },
    isStdLibrarySrc,
  );
  /**
   * The scrim and tint THE PAGE'S OWN RULES measure for a background (`resolveAdaptiveTheme` · `adaptiveThemeVars`,
   * the two `main-ground-layer.tsx` calls) — so the canvas wears a picture exactly as its render would, and the save
   * need ask the server for nothing more. A loop of ours is measured over its own two sampled colours and never tints.
   */
  const wornFor = (g: LookGround): MainGroundWorn => {
    const m = g.main;
    const loopId = isHubMainLoop(m) ? m.loop : m && 'ground' in m && m.ground === 'theme' ? themeId : null;
    const samples = loopId ? (INVITE_THEMES[loopId]?.media?.samples ?? null) : null;
    const measured = isHubMainOwn(m) || isHubMainFollow(m) ? m.tint : samples ? { match: false, frame: [samples.light, samples.dark] } : null;
    if (!measured || measured.frame.length === 0) return { scrim: null, vars: {} };
    const a = resolveAdaptiveTheme(theme, measured);
    return { scrim: a.scrim, vars: adaptiveThemeVars(a, { ownButton: page?.ownButton === true }) };
  };
  /** A pick's news from the canvas: the still is painted, its clip moves, or the page has redrawn itself with it. */
  useEffect(() => {
    if (!studio) return;
    const onCanvas = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: string; t?: string; seq?: unknown; shown?: unknown; playing?: unknown; redrawn?: unknown } | null;
      if (!d || d.source !== 'setnayan-site' || d.t !== MAIN_GROUND_PREVIEW) return;
      /* Only the page the couple is looking at is believed — a stage kept warm redraws too, and may finish first. */
      if (![...document.querySelectorAll<HTMLIFrameElement>(LOOK_FRAMES)].some((f) => f.contentWindow === e.source)) return;
      if (d.redrawn === true) {
        pickMark('canvas-redrawn');
        /* The page's own render is on screen — it holds this pick only if the pick's save had landed before it was asked for. */
        setPick((p) => (p && p.saved ? backgroundPickAfter(p, p.seq, { shown: true }) : p));
        return;
      }
      const seq = d.seq;
      if (typeof seq !== 'number') return;
      if (d.playing === true) return pickMark('loop-playing');
      if (d.shown === true) pickMark('still-painted');
      /* A still that could not be laid: nothing false is on the canvas — the pick now waits for the page's own render. */
      setPick((p) => backgroundPickAfter(p, seq, d.shown === true ? { shown: true } : { laid: false }));
    };
    window.addEventListener('message', onCanvas);
    return () => window.removeEventListener('message', onCanvas);
  }, [studio]);
  /** The save has landed and the canvas never said so (no bridge, a frame mid-load): the line does not wait for ever. */
  useEffect(() => {
    if (!pick || pick.failed || !pick.saved || pick.shown) return;
    const seq = pick.seq;
    const t = window.setTimeout(() => setPick((p) => (p && p.seq === seq ? null : p)), BACKGROUND_PICK_CANVAS_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [pick]);

  /**
   * 🧭 Studio: ONE pick — the main background and/or the page's colour or Candlelight — in four steps:
   * drawn in the panel (the ring), laid on the canvas (its still, scrim and tint, or its colour), saved behind it
   * HELD — ONE write and NO render when the canvas wears all of it; one redraw of the page in place
   * (`makerRedrawSave`) only where the server must measure something — and said (`BgPickLine`).
   * A LATER PICK WINS: an answer for an older number moves nothing on screen. A refusal puts the last
   * landed background back, takes the preview off, and says so with Try again.
   *   · `began` — the pick was already ringed and laid at the tap (its colours were being read);
   *   · `render` — nothing here can draw it (a file just uploaded has no address yet): the save brings the
   *     whole-Maker render, as it always did.
   */
  const pickLook = (write: LookWrite, failure: string, opts: { began?: number; render?: boolean } = {}) => {
    if (!('main' in write) && !write.events) return;
    const next: LookGround = {
      main: 'main' in write ? (write.main ?? null) : ground.main,
      bg: write.events && 'site_bg_color' in write.events ? (write.events.site_bg_color ?? null) : ground.bg,
      art: write.events?.site_art_direction ?? ground.art,
    };
    const fresh = opts.began === undefined;
    const seq = opts.began ?? ++lookPickSeq;
    if (fresh) pickMark('tap');
    /* ⚡ ONE WRITE, NO RENDER wherever the canvas can wear the change exactly from here (`backgroundPickRedraws`):
       another picture, where it is held, its blur, its tint, a pattern. A page colour, a Shade, Candlelight and
       Motion are measured on the server — those lay what they can at the tap and the page redraws itself ONCE. */
    const redraws = !opts.render && backgroundPickRedraws(ground, next, typeof page?.ownButton === 'boolean');
    const lay = opts.render || (redraws && backgroundPictureKey(next) === backgroundPictureKey(ground)) ? null : backgroundLayOf(next, lookPictures, wornFor(next), !redraws);
    const heard = opts.render ? 0 : lay ? postToCanvas(mainGroundPreviewMessage(seq, lay)) : document.querySelectorAll(LOOK_FRAMES).length;
    if (lay && heard > 0) pickMark('canvas-told');
    /** The canvas wears all of it: the save is the pick's only request. */
    const worn = !opts.render && !redraws && Boolean(lay) && heard > 0;
    lookDrawnSeq = seq;
    lookGround.draw(lookKey, next, serverRef.current);
    /* 🪟 The sample screen wears it from the tap — drawn in the browser, no request (`look-sample.tsx`). */
    tellLookSample(eventId, next);
    lookGround.sent();
    retry.current = () => pickLook(write, failure, opts.render ? { render: true } : {});
    setError(null);
    setPick((was) => ({
      seq,
      card: null,
      reading: false,
      laid: Boolean(lay) && heard > 0,
      /* No canvas to hear it, or a save that brings its own render: there is nothing more to wait for than the save. */
      shown: heard === 0 || Boolean(!lay && !fresh && was && was.seq === seq && was.shown) || onSample,
      saved: false,
      failed: null,
    }));
    /** The canvas is told the moment the save lands — BEFORE any redraw is asked for, so that redraw may take the preview away. */
    const landing = async <T extends { ok: boolean }>(saving: Promise<T>): Promise<T> => {
      const r = await saving;
      if (r.ok) postToCanvas(mainGroundLandedMessage(seq));
      return r;
    };
    void (async () => {
      let ok = false;
      let said = failure;
      try {
        pickMark('write-sent');
        const r = opts.render
          ? await makerSave(() => saveLookWrite(eventId, write, draftAction), () => router.refresh())
          : worn
            ? await makerSave(() => landing(saveLookWrite(eventId, write, draftAction, true)), () => router.refresh(), { held: true })
            : await makerRedrawSave(() => landing(saveLookWrite(eventId, write, draftAction, true)), () => router.refresh());
        pickMark('write-answered');
        if (!worn && !opts.render) pickMark('redraw-asked');
        ok = r.ok === true;
        if (!r.ok) said = r.error || failure;
      } catch {
        ok = false;
      }
      const latest = seq === lookDrawnSeq;
      lookGround.answered(lookKey, { ok, latest, value: next }, serverRef.current);
      if (ok) setPick((p) => backgroundPickAfter(p, seq, { saved: true }));
      else if (latest) {
        postToCanvas(mainGroundPreviewMessage(seq, null));
        setPick((p) => (p && p.seq === seq ? { ...p, reading: false, failed: said } : p));
        /* 🪟 Refused: the sample goes back with the panel — to what the last landed save left. */
        tellLookSample(eventId, lookGround.read(lookKey, serverRef.current));
      }
    })();
  };
  /**
   * 🧭 Studio: a PICTURE whose colours must be read before it may be saved (a scene, their photo or clip, the cover).
   * The tapped card is ringed and the still is on the canvas AT THE TAP; the read runs behind ("Loading files…");
   * then the one save. Unreadable = not used: the ring and the canvas go back, and the line says so with Try again.
   */
  const pickMeasured = (stillUrl: string | null, provisional: HubMainGround, build: (frame: string[]) => HubMainGround) => {
    const card = tapped.current;
    const seq = ++lookPickSeq;
    pickMark('tap');
    retry.current = () => {
      tapped.current = card;
      pickMeasured(stillUrl, provisional, build);
    };
    setError(null);
    const lay = stillUrl ? backgroundLayOf({ main: provisional, bg: ground.bg }, lookPictures) : null;
    const heard = lay ? postToCanvas(mainGroundPreviewMessage(seq, lay)) : 0;
    if (heard > 0) pickMark('canvas-told');
    setPick({ seq, card, reading: Boolean(stillUrl), laid: heard > 0, shown: false, saved: false, failed: stillUrl ? null : COULD_NOT_READ });
    if (!stillUrl) return;
    /* 🪟 The sample wears the picture at the tap, while its colours are read; a picture that cannot be read comes off again. */
    const before = ground.main;
    tellLookSample(eventId, { main: provisional });
    void (async () => {
      let frame: string[] = [];
      try {
        const res = await fetch(stillUrl, { mode: 'cors' });
        if (!res.ok) throw new Error(String(res.status));
        frame = await readFrame(await res.blob());
      } catch {
        frame = [];
      }
      if (seq !== lookPickSeq) return; // a later tap took over
      if (frame.length === 0) {
        postToCanvas(mainGroundPreviewMessage(seq, null));
        setPick((p) => (p && p.seq === seq ? { ...p, reading: false, failed: COULD_NOT_READ } : p));
        tellLookSample(eventId, { main: before });
        return;
      }
      pickMark('files-read');
      pickLook({ main: build(frame) }, BACKGROUND_PICK_FAILED, { began: seq });
    })();
  };

  const save = (main: HubMainGround | null, failure: string, after?: () => void) => {
    if (studio) return pickLook({ main }, failure);
    start(async () => {
      setError(null);
      try {
        const r = await makerSave(() => saveMain(eventId, main, draftAction), () => router.refresh());
        if (!r.ok) setError(r.error);
        else after?.();
      } catch {
        setError(failure);
      }
    });
  };

  const onFilePicked = (file: File) => {
    setError(null);
    setReading(true);
    const kind: Measured['kind'] = file.type.startsWith('video/') ? 'snippet' : 'photo';
    measuring.current = (async () => {
      try {
        if (kind === 'photo') return { kind, frame: await readFrame(file), poster: null };
        const still = await extractPosterFrame(file);
        if (!still) return null;
        const [frame, poster] = await Promise.all([readFrame(still), uploadStill(still, eventId)]);
        return poster ? { kind, frame, poster } : null;
      } catch {
        return null;
      } finally {
        setReading(false);
      }
    })();
  };

  const onUploaded = async (value: string | string[] | null) => {
    const ref = typeof value === 'string' ? value : null;
    if (!ref) return;
    const measured = await measuring.current;
    measuring.current = null;
    if (!measured || measured.frame.length === 0) {
      setError(COULD_NOT_READ);
      return;
    }
    const uploaded: HubMainGround = {
      kind: measured.kind,
      media: ref,
      ...(measured.poster ? { poster: measured.poster } : {}),
      tint: { match: true, frame: measured.frame },
    };
    /* A file just uploaded has no address the canvas could wear yet: in the Studio its save brings the Maker's render. */
    if (studio) pickLook({ main: uploaded }, 'Your background could not be saved. Please try again.', { render: true });
    else save(uploaded, 'Your background could not be saved. Please try again.');
  };

  /* 🖼 ONE OF THE COUPLE'S PICTURES (or a ready-made one), picked in place —
     its colours read straight off its URL (the media bucket and the ready-made
     scenes answer the app's own origin), like the hero's own. A clip is read
     through its still. */
  const pickExisting = (media: { kind: 'photo' | 'snippet'; ref: string; stillUrl: string | null; poster?: string | null }) => {
    const picked = (frame: string[]): HubMainGround => ({
      kind: media.kind,
      media: media.ref,
      ...(media.kind === 'snippet' && media.poster ? { poster: media.poster } : {}),
      tint: { match: own?.tint?.match ?? true, frame },
      ...(media.kind === 'photo' && own?.motion ? { motion: own.motion } : {}),
    });
    if (studio) return pickMeasured(media.stillUrl, picked([]), picked);
    if (!media.stillUrl) {
      setError(COULD_NOT_READ);
      return;
    }
    setError(null);
    setReading(true);
    void (async () => {
      try {
        const res = await fetch(media.stillUrl!, { mode: 'cors' });
        if (!res.ok) throw new Error(String(res.status));
        const frame = await readFrame(await res.blob());
        if (frame.length === 0) throw new Error('empty frame');
        save(picked(frame), 'Your background could not be saved. Please try again.');
      } catch {
        setError(COULD_NOT_READ);
      } finally {
        setReading(false);
      }
    })();
  };

  const noun = own?.kind === 'snippet' ? 'video' : 'photo';
  const themeTokens = hubThemePageTokens(theme);
  const thumb = own ? overrideStillUrl : hero.photoUrl;
  const urlOf = (ref: string | null | undefined) =>
    ref ? (photoChoices.find((p) => p.ref === ref)?.url ?? sceneUploads.find((u) => u.ref === ref)?.url ?? null) : null;

  /* 🧭 Every choice "Behind every scene" holds — one list, drawn as ONE dropdown, or (the new Maker's
     Studio › Look, prototype `lookBackground`) as the carousel of real pictures. */
  const groundValue = choice === 'theme' || choice === 'loop' ? (loopNow ?? null) : `src:${choice}`;
  const groundLoopOption = (l: MovingBackgroundOption): PickOption => ({
      key: l.id,
      label: l.name,
      group: 'Moving background',
      ...(l.stillUrl ? { thumb: l.stillUrl } : {}),
      ...(proMark && !(l.id === themeId && INVITE_THEMES[themeId]?.tier === 'free')
        ? { trail: { text: '◆', tone: 'muted' as const, label: 'Event Hub Pro' } }
        : {}),
  });
  const groundOwnOptions: PickOption[] = [
    /* "Same as my hero" follows a MEASURED hero (`HeroFrameSync`), which Classic never
       runs (it would write on open) — so Classic offers its own upload, not the follow. */
    ...(themeId === 'house'
      ? []
      : [{
          key: 'src:hero',
          label: 'Same as my hero',
          group: 'Your own',
          ...(hero.photoUrl ? { thumb: hero.photoUrl } : {}),
          ...(hero.photoRef ? {} : { disabledNote: 'add a hero photo first' }),
          ...(proMark ? { trail: { text: '◆', tone: 'muted' as const, label: 'Event Hub Pro' } } : {}),
        }]),
    {
      key: 'src:media',
      label: 'Upload media',
      group: 'Your own',
      ...(own && overrideStillUrl ? { thumb: overrideStillUrl } : {}),
      ...(proMark ? { trail: { text: '◆', tone: 'muted' as const, label: 'Event Hub Pro' } } : {}),
    },
    { key: 'src:none', label: 'Just the colour', group: 'Plain' },
  ];
  const pickGround = (k: string) => {
      if (pending) return;
      if (k === 'src:media') return setChoosingMedia(true);
      setChoosingMedia(false);
      /* 🧭 Studio: the cover is MEASURED in the pick itself and saved as the follow in ONE save — a bare "nothing
         stored" would redraw the page on the theme's own ground until `HeroFrameSync` caught up (a flash back). */
      if (k === 'src:hero' && studio && hero.photoRef) {
        const of = hero.photoRef;
        const followed = (frame: string[]): HubMainGround => ({ follow: 'hero', of, tint: { match: true, frame } });
        return pickMeasured(hero.photoUrl, followed([]), followed);
      }
      if (k === 'src:hero') return save(null, 'Your background could not be changed. Please try again.');
      if (k === 'src:none') return save({ ground: 'none' }, 'Your background could not be changed. Please try again.');
      const id = loops.find((l) => l.id === k)?.id;
      if (!id) return;
      save(
        id === themeId ? { ground: 'theme' } : { ground: 'loop', loop: id },
        'Your background could not be changed. Please try again.',
      );
  };

  /* 🔎 The hero's colours are read where the hero is the background — ONE mount, drawn by whichever Maker is on. */
  const heroSync =
    choice === 'hero' && hero.photoRef ? (
      <HeroFrameSync eventId={eventId} heroRef={hero.photoRef} heroUrl={hero.photoUrl} current={current} liveHeroRef={hero.liveRef} mainDrafted={drafted || ground !== server} />
    ) : null;

  /* ══ 🧭 STUDIO › LOOK › BACKGROUND — ONE SOURCE ▾ AND ITS PICTURE CARDS ════════════════════════
     (the new Maker; owner 2026-10-08, the Look restudy — `lib/background-source.ts`, prototype
     `background_restudy_2026-10-08_fable.html`). EVERY choice the dropdown, the "Pattern ▾" row, the
     page fill and the pictures under "Upload media" held is a card of ONE of five sources, and a tap
     does exactly what its old row did (`pickGround` · `pickExisting` · the same draft door). */
  if (studio) {
    const FAILED = BACKGROUND_PICK_FAILED;
    const proOn = Boolean(proMark);
    const storedSource = backgroundSourceOf(current, {
      themeHasLoop: Boolean(INVITE_THEMES[themeId]?.media),
      followsHero: Boolean(follow) || (!current && Boolean(hero.photoRef) && themeId !== 'house'),
    });
    const view = viewed ?? storedSource;
    /** The cards on screen are the source the page wears — only then is one of them ringed, and its rows drawn. */
    const active = view === storedSource;
    /* 🌈 The page colour: the couple's own (plain or blended), else the one the page wears (the Mood Board's). */
    const bgStored = ground.bg;
    const art = ground.art;
    const bg = parseSiteBackground(bgStored);
    const ownHex = bg ? (bg.kind === 'plain' ? bg.hex : bg.ombre.base) : null;
    const effect: BackgroundEffect = bg?.kind === 'ombre' ? bg.ombre.shape : 'plain';
    const paper = ownHex ?? page?.resolved ?? colours.canvas;
    const five = page?.five ?? [];
    const slot = five.findIndex((c) => c.toLowerCase() === paper.toLowerCase());
    const colourName = slot >= 0 ? (MOOD_COLOUR_NAMES[slot] ?? 'Your Mood Board') : ownHex ? 'Your own' : 'Your Mood Board';
    /** The page colour and its blend. Picked from a picture, a video or (a Colour card) a pattern, the colour IS the background now. */
    const pickPage = (nextEffect: BackgroundEffect, hex: string | null, keepPattern: boolean) => {
      const base = hex ?? (nextEffect === 'plain' ? null : paper);
      const value = base ? encodeBackgroundChoice(base, nextEffect) || null : null;
      const stays = storedSource === 'colour' || (keepPattern && storedSource === 'pattern');
      pickLook(stays ? { events: { site_bg_color: value } } : { events: { site_bg_color: value }, main: NO_PICTURE }, FAILED);
    };
    const pattern = current && 'ground' in current && current.ground === 'pattern' ? current.pattern : null;
    /* 🌗 Shade · 🌫 Blur · 🎯 Focus — stored on the main background, each only where it means something (`hubMainTakes`). */
    const takes = hubMainTakes(current);
    const extra = (key: 'shade' | 'blur' | 'focus'): string | null => {
      const v = (current as Record<string, unknown> | null)?.[key];
      return typeof v === 'string' ? v : null;
    };
    const withExtra = (key: 'shade' | 'blur' | 'focus', value: string | null): HubMainGround => {
      const { [key]: _drop, ...rest } = current as Record<string, unknown>;
      return (value ? { ...rest, [key]: value } : rest) as HubMainGround;
    };
    /* 🎯 The card of the picture ON the page is cropped where the page crops it (Focus ▾) — the guest page's own rule.
       Every other card is held at its centre: that is how the page would wear it the moment it is picked. */
    const heldAt = mainGroundPosition(takes.focus ? (extra('focus') as HubMainFocus | null) : null);
    const held = (isOn: boolean | null | undefined) => (isOn ? { position: heldAt } : {});
    const shadeNow = backgroundShadeValue({ art, shade: takes.shade ? extra('shade') : null });
    /** ONE list, one pick: a veil step is worn INSTEAD of Candlelight, and Candlelight instead of a veil. */
    const pickShade = (k: string) => {
      const w = backgroundShadeWrite(k, { art, shade: extra('shade'), takesShade: takes.shade && Boolean(current) });
      if (!w) return;
      const write: LookWrite = {};
      if (w.art) write.events = { site_art_direction: w.art };
      if (w.stepMoves) write.main = withExtra('shade', w.step);
      pickLook(write, FAILED);
    };
    const listed =
      own &&
      (isStdLibrarySrc(own.media) ||
        videoChoice?.ref === own.media ||
        sceneUploads.some((u) => u.ref === own.media) ||
        photoChoices.some((p) => p.ref === own.media));
    const matches = tint && ((choice === 'hero' && follow) || own) ? tint.match : null;
    return (
      <section className="flex flex-col gap-2" data-maker-main-background="" data-bg-source={view} data-bg-source-stored={storedSource}>
        {/* ONE dropdown for the set of sources (owner: "any set of choices is ONE dropdown"); what it is, behind ⓘ. */}
        <BgRow label="Source" data="source" info={BACKGROUND_MAIN_INFO}>
          <PickMenu
            label="Background"
            dataAttr="data-bg-source-pick"
            className={STUDIO_ROW_PICK}
            value={view}
            options={backgroundSourcesOffered(storedSource).filter((k) => k !== 'video' || loops.length > 0).map((k) => ({
              key: k,
              label: BACKGROUND_SOURCE_LABEL[k],
              ...(proOn && BACKGROUND_SOURCE_IS_PRO[k] ? { trail: PRO_TRAIL } : {}),
            }))}
            onPick={(k) => {
              setUploadOpen(false);
              setViewed(k as BackgroundSource);
            }}
          />
        </BgRow>

        <BgCards label={BACKGROUND_SOURCE_LABEL[view]} source={view} pick={pick} onTap={(data) => (tapped.current = data)}>
          {view === 'colour'
            ? BACKGROUND_EFFECTS.filter((e) => Boolean(page) || e === 'plain').map((e) => (
                <BgCard
                  key={e}
                  name={BACKGROUND_EFFECT_LABEL[e]}
                  data={`fill:${e}`}
                  on={active && effect === e}
                  swatch={e === 'plain' ? paper : ombreCss({ shape: e, base: paper })}
                  onPick={() => (page ? pickPage(e, ownHex, false) : pickGround('src:none'))}
                />
              ))
            : null}
          {/* 🧵 The page's own pattern, in an ink that SHOWS on this paper (`patternCardSwatch`) — on a dark page colour the dashboard's ink drew four identical dark cards. */}
          {/* 📋 Pattern is no longer a choice to pick (owner 2026-10-08) — only the pattern this event ALREADY wears is drawn, ringed. */}
          {view === 'pattern'
            ? HUB_MAIN_PATTERNS.filter((k) => k === pattern).map((k) => (
                <BgCard
                  key={k}
                  name={HUB_MAIN_PATTERN_LABEL[k]}
                  data={`pattern:${k}`}
                  on={active && pattern === k}
                  swatch={patternCardSwatch(k, paper).image}
                  swatchSize={patternCardSwatch(k, paper).size}
                  onPick={() => save({ ground: 'pattern', pattern: k }, FAILED)}
                />
              ))
            : null}
          {view === 'scene'
            ? STD_REALISTIC_BACKGROUNDS.map((b) => (
                <BgCard
                  key={b.id}
                  name={b.label}
                  data={`scene:${b.id}`}
                  pro={proOn}
                  on={active && own?.media === b.src}
                  swatch={PAPER_SWATCH}
                  onPick={() => pickExisting({ kind: 'photo', ref: b.src, stillUrl: b.src })}
                >
                  <StillOverSwatch src={b.src} swatch={PAPER_SWATCH} {...held(active && own?.media === b.src)} />
                </BgCard>
              ))
            : null}
          {view === 'video'
            ? loops.map((l) => (
                <BgCard
                  key={l.id}
                  name={l.name}
                  data={`loop:${l.id}`}
                  moving
                  pro={proOn && !(l.id === themeId && INVITE_THEMES[themeId]?.tier === 'free')}
                  on={active && loopNow === l.id}
                  swatch={loopSwatch(l.id, colours.canvas)}
                  onPick={() => pickGround(l.id)}
                >
                  {/* The loop itself, muted, over its poster, over its own two colours — never a broken image. */}
                  <LoopPicture src={l.loopUrl ?? null}>
                    <StillOverSwatch src={l.stillUrl} swatch={loopSwatch(l.id, colours.canvas)} />
                  </LoopPicture>
                </BgCard>
              ))
            : null}
          {view === 'own' ? (
            <>
              {/* 🖼 "Your cover photo" — drawn ONLY when there is one, and then with the photo itself. No cover photo = no card
                  (owner 2026-10-08, on an empty grey card: "why same as hero?") — never a placeholder in the strip.
                  It follows a MEASURED cover (`HeroFrameSync`), which Classic never runs — Classic offers its own upload. */}
              {coverCardShows({ classic: themeId === 'house', photoRef: hero.photoRef, photoUrl: hero.photoUrl }) ? (
                <BgCard
                  name="Your cover photo"
                  data="src:hero"
                  pro={proOn}
                  on={active && choice === 'hero'}
                  swatch={PAPER_SWATCH}
                  onPick={() => pickGround('src:hero')}
                >
                  <StillOverSwatch src={hero.photoUrl} swatch={PAPER_SWATCH} {...held(active && choice === 'hero')} />
                </BgCard>
              ) : null}
              {videoChoice ? (
                <BgCard
                  name="Your video"
                  data={`clip:${videoChoice.ref}`}
                  moving
                  pro={proOn}
                  on={active && own?.kind === 'snippet' && own.media === videoChoice.ref}
                  swatch={PAPER_SWATCH}
                  onPick={() => pickExisting({ kind: 'snippet', ref: videoChoice.ref, stillUrl: urlOf(videoChoice.poster), poster: videoChoice.poster })}
                >
                  <StillOverSwatch src={urlOf(videoChoice.poster)} swatch={PAPER_SWATCH} />
                </BgCard>
              ) : null}
              {sceneUploads.map((u) => (
                <BgCard
                  key={u.ref}
                  name={u.kind === 'snippet' ? 'Your clip' : 'Your photo'}
                  data={`own:${u.ref}`}
                  moving={u.kind === 'snippet'}
                  pro={proOn}
                  on={active && own?.media === u.ref}
                  swatch={PAPER_SWATCH}
                  onPick={() =>
                    u.kind === 'snippet'
                      ? pickExisting({ kind: 'snippet', ref: u.ref, stillUrl: u.posterUrl ?? null, poster: u.poster })
                      : pickExisting({ kind: 'photo', ref: u.ref, stillUrl: u.url })
                  }
                >
                  <StillOverSwatch src={u.kind === 'snippet' ? (u.posterUrl ?? null) : u.url} swatch={PAPER_SWATCH} {...held(active && own?.media === u.ref)} />
                </BgCard>
              ))}
              {photoChoices.map((p) => (
                <BgCard
                  key={p.ref}
                  name="Your photo"
                  data={`own:${p.ref}`}
                  pro={proOn}
                  on={active && own?.media === p.ref}
                  swatch={PAPER_SWATCH}
                  onPick={() => pickExisting({ kind: 'photo', ref: p.ref, stillUrl: p.url })}
                >
                  <StillOverSwatch src={p.url} swatch={PAPER_SWATCH} {...held(active && own?.media === p.ref)} />
                </BgCard>
              ))}
              {/* The background they uploaded here is a card too — ringed, so "what is on" is never empty. */}
              {own && !listed ? (
                <BgCard name="Your upload" data="own:upload" moving={own.kind === 'snippet'} pro={proOn} on={active} swatch={PAPER_SWATCH} onPick={() => {}}>
                  <StillOverSwatch src={overrideStillUrl} swatch={PAPER_SWATCH} {...held(active)} />
                </BgCard>
              ) : null}
              <BgCard name="Photo or video" data="upload" pro={proOn} on={false} swatch={PAPER_SWATCH} onPick={() => setUploadOpen((o) => !o)}>
                <UploadPicture />
              </BgCard>
            </>
          ) : null}
        </BgCards>
        {/* ⚡ What the pick is waiting for — "Loading files…", then "Applying to your Hub…"; a failure, in place, with Try again. */}
        <BgPickLine step={backgroundPickStep(pick)} error={pick?.failed ?? null} onRetry={pick?.failed ? () => retry.current?.() : null} />

        {heroSync}

        {view === 'own' && uploadOpen ? (
          <div className="flex flex-col gap-2" data-main-ground-media="">
            {/* The shipped uploader, in place — compressed on the phone before it uploads. */}
            <FileUpload
              bucket="media"
              pathPrefix={`events/${eventId}/main-background`}
              multiple={false}
              maxSizeMB={100}
              acceptedTypes={[...IMAGE_TYPES, ...VIDEO_TYPES]}
              compressImage
              compressVideo
              videoCompressProfile="maker"
              videoSilent
              maxVideoDurationS={MAKER_MAX_CLIP_SECONDS}
              validateFile={makeMakerVideoDurationValidator()}
              onFilePicked={onFilePicked}
              onChange={onUploaded}
              disabled={pending}
              label="Upload a photo or clip"
            />
            {typeof mediaUsedBytes === 'number' ? <MakerMediaMeter usedBytes={mediaUsedBytes} /> : null}
            <span className="text-[12px] text-ink/70" data-main-ground-tip="">
              <InfoTip label="Best size" align="start">
                An upright (portrait) photo, {IMAGE_MAX_EDGE.toLocaleString('en-US')} pixels or more on its long side. Faces near the middle — the edges are cropped. Clips up to{' '}
                {MAKER_MAX_CLIP_SECONDS} seconds.
              </InfoTip>
            </span>
          </div>
        ) : null}
        {reading ? (
          <p role="status" className="text-[12px] text-ink/60">
            Reading its colours…
          </p>
        ) : null}

        {/* 🎨 The colour the page (and a pattern) is drawn in — the Mood Board's ONE picker. */}
        {page && (view === 'colour' || view === 'pattern') ? (
          <BgRow label="Colour" data="colour" info="Your Mood Board’s five colours first, then colours that go with them.">
            <span className="min-w-0 flex-1 [&>button]:mb-0">
              <StudioColourField
                data="background"
                name={colourName}
                job="Background · paper"
                value={paper}
                palette={five}
                onPick={(hex) => pickPage(view === 'pattern' ? 'plain' : effect, hex, view === 'pattern')}
                {...(ownHex ? { reset: { label: 'Use your Mood Board’s', onReset: () => pickPage('plain', null, view === 'pattern') } } : {})}
              />
            </span>
          </BgRow>
        ) : null}

        {active ? (
          <>
            <BgRow label="Shade" data="shade" info="Darkens or lightens the background so the words stay clear. The words turn light on a dark shade.">
              <PickMenu
                label="Shade"
                dataAttr="data-studio-shade-pick"
                className={STUDIO_ROW_PICK}
                value={shadeNow}
                options={[
                  /* A flat colour or a pattern has no picture to veil — there the list is As is and Candlelight. */
                  ...MAIN_GROUND_SHADES.filter((k) => takes.shade || k === 'as-is').map((k) => ({ key: k, label: MAIN_GROUND_SHADE_LABEL[k] })),
                  { key: BACKGROUND_SHADE_CANDLELIGHT, label: BACKGROUND_SHADE_CANDLELIGHT_LABEL, ...(proOn ? { trail: PRO_TRAIL } : {}) },
                ]}
                onPick={pickShade}
              />
            </BgRow>
            {own?.kind === 'photo' ? (
              <BgRow label="Motion" data="motion" info="Parallax: the picture moves a little slower than the page as guests scroll. Off under “reduce motion”.">
                <PickMenu
                  label="How the photo moves"
                  dataAttr="data-main-ground-motion-pick"
                  className={STUDIO_ROW_PICK}
                  value={own.motion ?? 'still'}
                  options={HUB_MEDIA_MOTIONS.map((m) => ({ key: m, label: HUB_MEDIA_MOTION_LABEL[m], ...(proOn && m === 'parallax' ? { trail: PRO_TRAIL } : {}) }))}
                  onPick={(k) => {
                    if (k === (own.motion ?? 'still')) return;
                    const { motion: _m, ...rest } = own;
                    save(k === 'parallax' ? { ...rest, motion: 'parallax' } : rest, FAILED);
                  }}
                />
              </BgRow>
            ) : null}
            {takes.blur ? (
              <BgRow label="Blur" data="blur">
                <PickMenu
                  label="Blur"
                  dataAttr="data-studio-blur-pick"
                  className={STUDIO_ROW_PICK}
                  value={extra('blur') ?? 'none'}
                  options={[{ key: 'none', label: 'None' }, ...HUB_MAIN_BLURS.map((k) => ({ key: k, label: BLUR_LABEL[k] }))]}
                  onPick={(k) => k !== (extra('blur') ?? 'none') && save(withExtra('blur', k === 'none' ? null : k), FAILED)}
                />
              </BgRow>
            ) : null}
            {takes.focus ? (
              <BgRow label="Focus" data="focus">
                <PickMenu
                  label="Focus"
                  dataAttr="data-studio-focus-pick"
                  className={STUDIO_ROW_PICK}
                  value={extra('focus') ?? 'centre'}
                  options={[{ key: 'centre', label: 'Centre' }, ...HUB_MAIN_FOCUSES.map((k) => ({ key: k, label: FOCUS_LABEL[k] }))]}
                  onPick={(k) => k !== (extra('focus') ?? 'centre') && save(withExtra('focus', k === 'centre' ? null : k), FAILED)}
                />
              </BgRow>
            ) : null}
            {/* 🎨 Their own picture may lend the page its colours — ONE dropdown; what it measures, behind ⓘ. */}
            {tint && matches !== null ? (
              <BgRow
                label="Colours"
                data="match"
                info={
                  <>
                    {adaptive ? `Words read at ${adaptive.bodyContrast.toFixed(1)}:1 over it${adaptive.scrim > 0 ? ` with a ${Math.round(adaptive.scrim * 100)}% veil` : ''}. ` : ''}
                    {matched ? 'Match moves your buttons, accents and ornaments toward it.' : 'It has no strong colour to follow, so your colours stay as they are.'}
                  </>
                }
              >
                <PickMenu
                  label="Colours"
                  dataAttr="data-main-ground-match-pick"
                  className={STUDIO_ROW_PICK}
                  value={matches ? 'match' : 'keep'}
                  options={[
                    { key: 'match', label: `Match my ${own ? noun : 'photo'}’s colours` },
                    { key: 'keep', label: 'Keep my colours' },
                  ]}
                  onPick={(k) => {
                    const value = k === 'match';
                    if (value === matches) return;
                    save(own ? { ...own, tint: { ...tint, match: value } } : { ...follow!, tint: { ...tint, match: value } }, 'Your choice could not be saved. Please try again.');
                  }}
                />
              </BgRow>
            ) : null}
            {adaptive && adaptive.scrim >= CALMER_CLIP_SCRIM && (choice === 'hero' ? follow : own) ? (
              <p role="status" className="text-[12px] text-ink/75" data-main-ground-advice="">
                Your words need a strong veil over this {own ? noun : 'photo'}, so less of it shows. A calmer one shows more of itself.
              </p>
            ) : null}
          </>
        ) : null}

        {/* 🎬 The hero video (it was under Music) — beside the other pictures of theirs. */}
        {view === 'own' ? heroVideo : null}

        {error ? (
          <p role="alert" className="text-[12px] text-terracotta-700">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-md bg-white/70 px-3 py-3" data-maker-main-background="">
      <p className="text-[14px] font-semibold text-ink">Behind every scene</p>

      {/* 🧭 ONE DROPDOWN (owner rule "any set of choices is a dropdown"; controller sweep
          2026-10-06: the stack of Moving background · Same as my hero · Upload media ·
          Just the colour read as a pill column). Every choice it held is a row of it:
          each shipped loop (◆) under "Moving background", then the couple's own photo or
          video (◆), then the plain colour (free). A pick does exactly what its row did. */}
      <div className="flex flex-col gap-1.5" data-main-ground-source={choice} data-main-ground-choices="">
        <PickMenu
          label="Behind every scene"
          value={groundValue}
          options={[...loops.map(groundLoopOption), ...groundOwnOptions]}
          onPick={pickGround}
          dataAttr="data-main-ground-loop-pick"
          className="w-full justify-between text-ink"
        />
      </div>
      {heroSync}

      {choice === 'media' ? (
        <div className="flex flex-col gap-2" data-main-ground-media="">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Your pictures">
            {videoChoice ? (
              <ClipTile
                still={urlOf(videoChoice.poster)}
                on={own?.kind === 'snippet' && own.media === videoChoice.ref}
                onPick={() =>
                  pickExisting({ kind: 'snippet', ref: videoChoice.ref, stillUrl: urlOf(videoChoice.poster), poster: videoChoice.poster })
                }
              />
            ) : null}
            {sceneUploads.map((u) =>
              u.kind === 'snippet' ? (
                <ClipTile
                  key={u.ref}
                  still={u.posterUrl ?? null}
                  on={own?.media === u.ref}
                  onPick={() => pickExisting({ kind: 'snippet', ref: u.ref, stillUrl: u.posterUrl ?? null, poster: u.poster })}
                />
              ) : (
                <PhotoTile key={u.ref} url={u.url} on={own?.media === u.ref} onPick={() => pickExisting({ kind: 'photo', ref: u.ref, stillUrl: u.url })} />
              ),
            )}
            {photoChoices.map((p) => (
              <PhotoTile key={p.ref} url={p.url} on={own?.media === p.ref} onPick={() => pickExisting({ kind: 'photo', ref: p.ref, stillUrl: p.url })} />
            ))}
          </div>
          <p className="text-[12px] font-semibold text-ink/60">Ready-made</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Ready-made backgrounds" data-main-ground-library="">
            {STD_REALISTIC_BACKGROUNDS.map((b) => (
              <PhotoTile
                key={b.id}
                url={b.src}
                label={b.label}
                on={own?.media === b.src}
                onPick={() => pickExisting({ kind: 'photo', ref: b.src, stillUrl: b.src })}
              />
            ))}
          </div>
          <FileUpload
            bucket="media"
            pathPrefix={`events/${eventId}/main-background`}
            multiple={false}
            maxSizeMB={100}
            acceptedTypes={[...IMAGE_TYPES, ...VIDEO_TYPES]}
            compressImage
            compressVideo
            videoCompressProfile="maker"
            videoSilent
            maxVideoDurationS={MAKER_MAX_CLIP_SECONDS}
            validateFile={makeMakerVideoDurationValidator()}
            onFilePicked={onFilePicked}
            onChange={onUploaded}
            disabled={pending}
            label="Upload a photo or clip"
          />
          {/* 💾 The event's 100 MB of uploads, beside the upload that spends it. */}
          {typeof mediaUsedBytes === 'number' ? <MakerMediaMeter usedBytes={mediaUsedBytes} /> : null}
          {/* 📐 The owner asked for the best size (2026-10-01). The photo fills
              the screen and is cropped to it, and 99% of guests are on a phone —
              so upright, and at least the size the upload keeps. */}
          <p className="text-[12px] text-ink/60" data-main-ground-tip="">
            Best: an upright (portrait) photo, {IMAGE_MAX_EDGE.toLocaleString('en-US')} pixels or more on its long side — it fills a
            phone screen sharp. Keep faces near the middle; the edges are cropped. Clips up to {MAKER_MAX_CLIP_SECONDS} seconds.
          </p>
          {reading ? <p className="text-[12px] text-ink/60">Reading its colours…</p> : null}
          {own?.kind === 'photo' ? (
            <div className="flex items-center gap-2" data-main-ground-motion="">
              <span className="w-16 text-[12.5px] text-ink/60">Motion</span>
              <PickMenu
                label="How the photo moves"
                value={own.motion ?? 'still'}
                options={HUB_MEDIA_MOTIONS.map((m) => ({ key: m, label: HUB_MEDIA_MOTION_LABEL[m] }))}
                onPick={(k) => {
                  const { motion: _m, ...rest } = own;
                  save(k === 'parallax' ? { ...rest, motion: 'parallax' } : rest, 'Your choice could not be saved. Please try again.');
                }}
                dataAttr="data-main-ground-motion-pick"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {(choice === 'hero' && follow) || (choice === 'media' && own) ? (
        <div className="flex items-start gap-3">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-16 w-24 shrink-0 rounded-md object-cover" />
          ) : null}
          <div className="min-w-0 text-[12.5px] text-ink/70">
            <p className="font-semibold text-ink">
              {own ? `Your ${noun}` : hero.hasClip ? 'Your hero (its clip plays where it may)' : 'Your hero photo'}
              {drafted ? ' · in your draft' : ''}
            </p>
            {adaptive ? (
              <p className="mt-0.5">
                Words read at {adaptive.bodyContrast.toFixed(1)}:1 over it
                {adaptive.scrim > 0 ? ` with a ${Math.round(adaptive.scrim * 100)}% veil` : ''}.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {adaptive && adaptive.scrim >= CALMER_CLIP_SCRIM && (choice === 'hero' ? follow : choice === 'media' ? own : null) ? (
        <p role="status" className="rounded-md bg-ink/[0.04] px-2.5 py-2 text-[12px] text-ink/75" data-main-ground-advice="">
          Your words need a strong veil over this {own ? noun : 'photo'} to stay readable, so less of it shows. A calmer
          one — softer light, fewer bright-and-dark patches — will show more of itself.
        </p>
      ) : null}

      {tint && ((choice === 'hero' && follow) || (choice === 'media' && own)) ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="sr-only">Colours</legend>
          {([true, false] as const).map((value) => (
            <Choice
              key={String(value)}
              on={tint.match === value}
              label={value ? `Match my ${own ? noun : 'photo'}’s colours` : 'Keep my colours'}
              disabled={pending}
              data={{ 'data-main-ground-match': value ? 'on' : 'off' }}
              onClick={() =>
                save(
                  own ? { ...own, tint: { ...tint, match: value } } : { ...follow!, tint: { ...tint, match: value } },
                  'Your choice could not be saved. Please try again.',
                )
              }
            />
          ))}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {matched ? (
              <>
                <Swatch hex={matched.button ?? themeTokens.cta} label="Buttons" />
                <Swatch hex={matched.accent ?? themeTokens.gild} label="Accents" />
                <Swatch hex={matched.ornament} label="Ornaments" />
              </>
            ) : (
              <span className="text-[12px] text-ink/60">
                This has no strong colour to follow, so your colours stay as they are.
              </span>
            )}
          </div>
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-terracotta/10 px-2.5 py-1.5 text-[12px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}


/**
 * 🖼 A picture that can never show as broken (owner 2026-10-08, studio round 3: *"Modern gallery
 * walls" (and the next one) rendered as BROKEN images — "never show a broken image, and fall back
 * to a drawn swatch"*). The still is drawn over its swatch; until it loads it is invisible, and if
 * it fails (`onError`, or an address that answered with nothing) it is removed — the swatch stays.
 * Eager, not lazy: a lazy image in a sideways carousel that is hidden on mount can be skipped and
 * left as the browser's broken glyph, and there are only ten small stills.
 */
export function StillOverSwatch({
  src,
  swatch,
  position,
}: {
  src: string | null | undefined;
  swatch: string;
  /** 🎯 Where the picture is held when it is cropped — the guest page's own rule (`mainGroundPosition`). Absent = its centre. */
  position?: string;
}) {
  const [state, setState] = useState<'loading' | 'shown' | 'failed'>('loading');
  useEffect(() => setState('loading'), [src]);
  return (
    <span aria-hidden data-still-over-swatch={state} className="absolute inset-0 block" style={{ background: swatch }}>
      {src && state !== 'failed' ? (
        /* eslint-disable-next-line @next/next/no-img-element -- a loop's public still / the couple's own picture, already signed */
        <img
          src={src}
          alt=""
          decoding="async"
          onLoad={(e) => setState(e.currentTarget.naturalWidth > 0 ? 'shown' : 'failed')}
          onError={() => setState('failed')}
          className={`h-full w-full object-cover transition-opacity duration-200 ${state === 'shown' ? 'opacity-100' : 'opacity-0'}`}
          {...(position && position !== 'center' ? { style: { objectPosition: position } } : {})}
        />
      ) : null}
    </span>
  );
}

/** A moving background's drawn swatch — its own two sampled colours (`media.samples`), never a guess. */
export function loopSwatch(id: string, plain: string): string {
  const samples = (INVITE_THEMES as Record<string, InviteTheme | undefined>)[id]?.media?.samples;
  return samples ? `linear-gradient(160deg, ${samples.light}, ${samples.dark})` : plain;
}
