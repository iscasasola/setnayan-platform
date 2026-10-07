'use client';

import { makerSave } from '@/lib/maker-refresh';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { extractPosterFrame } from '../../../_components/std-media-picker';
import { hubDraftAction } from '../../hub-draft-actions';
import { CALMER_CLIP_SCRIM, measureFrame, resolveAdaptiveTheme } from '@/lib/adaptive-theme';
import { hubThemePageTokens } from '@/lib/hub-theme-tokens';
import { INVITE_THEMES, type InviteTheme, type InviteThemeId } from '@/lib/invite-themes';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel, type PaidMarkState } from '@/lib/paid-mark';
import {
  HUB_MEDIA_MOTIONS,
  HUB_MEDIA_MOTION_LABEL,
  isHubMainFollow,
  isHubMainLoop,
  isHubMainOwn,
  type HubMainGround,
  type HubMainOwn,
} from '@/lib/hub-canvas';
import { mainGroundChoice } from '@/lib/main-ground-choice';
import { heroFrameWrites } from '@/lib/hero-frame-sync';
import { IMAGE_MAX_EDGE } from '@/lib/image-max-edge';
import { STD_REALISTIC_BACKGROUNDS } from '@/lib/std-backgrounds';
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
export type MovingBackgroundOption = { id: InviteThemeId; name: string; stillUrl: string | null };

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
  const fd = new FormData();
  fd.set('intent', 'save');
  fd.set('patch', JSON.stringify({ widgets: { hero: { main } } }));
  return draft(eventId, fd);
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
  current,
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
}: {
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

  const save = (main: HubMainGround | null, failure: string, after?: () => void) =>
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

  const COULD_NOT_READ =
    'We could not read the colours of that picture, so it was not used — the words over it could not be checked. Please try another one.';

  const onUploaded = async (value: string | string[] | null) => {
    const ref = typeof value === 'string' ? value : null;
    if (!ref) return;
    const measured = await measuring.current;
    measuring.current = null;
    if (!measured || measured.frame.length === 0) {
      setError(COULD_NOT_READ);
      return;
    }
    save(
      {
        kind: measured.kind,
        media: ref,
        ...(measured.poster ? { poster: measured.poster } : {}),
        tint: { match: true, frame: measured.frame },
      },
      'Your background could not be saved. Please try again.',
    );
  };

  /* 🖼 ONE OF THE COUPLE'S PICTURES (or a ready-made one), picked in place —
     its colours read straight off its URL (the media bucket and the ready-made
     scenes answer the app's own origin), like the hero's own. A clip is read
     through its still. */
  const pickExisting = (media: { kind: 'photo' | 'snippet'; ref: string; stillUrl: string | null; poster?: string | null }) => {
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
        save(
          {
            kind: media.kind,
            media: media.ref,
            ...(media.kind === 'snippet' && media.poster ? { poster: media.poster } : {}),
            tint: { match: own?.tint?.match ?? true, frame },
            ...(media.kind === 'photo' && own?.motion ? { motion: own.motion } : {}),
          },
          'Your background could not be saved. Please try again.',
        );
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
  const groundOptions: PickOption[] = [
            ...loops.map((l) => ({
              key: l.id,
              label: l.name,
              group: 'Moving background',
              ...(l.stillUrl ? { thumb: l.stillUrl } : {}),
              ...(proMark && !(l.id === themeId && INVITE_THEMES[themeId]?.tier === 'free')
                ? { trail: { text: '◆', tone: 'muted' as const, label: 'Event Hub Pro' } }
                : {}),
            })),
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
            if (k === 'src:hero') return save(null, 'Your background could not be changed. Please try again.');
            if (k === 'src:none') return save({ ground: 'none' }, 'Your background could not be changed. Please try again.');
            const id = loops.find((l) => l.id === k)?.id;
            if (!id) return;
            save(
              id === themeId ? { ground: 'theme' } : { ground: 'loop', loop: id },
              'Your background could not be changed. Please try again.',
            );
  };
  const studio = useMaker()?.stagesStudio === true;

  return (
    <section className={studio ? 'flex flex-col gap-3' : 'flex flex-col gap-3 rounded-md bg-white/70 px-3 py-3'} data-maker-main-background="">
      {studio ? (
        <GroundCarousel options={groundOptions} value={groundValue} plain={colours.canvas} onPick={pickGround} source={choice} />
      ) : (
      <>
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
          options={groundOptions}
          onPick={pickGround}
          dataAttr="data-main-ground-loop-pick"
          className="w-full justify-between text-ink"
        />
      </div>
      </>
      )}
      {choice === 'hero' && hero.photoRef ? (
        <HeroFrameSync eventId={eventId} heroRef={hero.photoRef} heroUrl={hero.photoUrl} current={current} liveHeroRef={hero.liveRef} mainDrafted={drafted} />
      ) : null}

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
 * 🧭 STUDIO › LOOK › BACKGROUND (owner 2026-10-07 side-by-side M29; prototype `lookBackground`):
 * the SAME choices as the dropdown, as a carousel of real pictures — each moving background's
 * still, the hero, the couple's own upload, the plain page colour — the name under each, the one
 * on screen ringed. A tap does exactly what its dropdown row does (`pickGround`); a ◆ rides its name.
 */
function GroundCarousel({
  options,
  value,
  plain,
  onPick,
  source,
}: {
  options: readonly PickOption[];
  value: string | null;
  plain: string;
  onPick: (key: string) => void;
  source: string;
}) {
  return (
    <div
      role="group"
      aria-label="Behind every scene"
      data-main-ground-carousel=""
      data-main-ground-source={source}
      className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* The plain colour first, as the prototype draws it ("Plain colour"), then every picture. */}
      {[...options.filter((o) => o.key === 'src:none'), ...options.filter((o) => o.key !== 'src:none')].map((o) => {
        const on = o.key === value;
        const off = Boolean(o.disabledNote);
        return (
          <button
            key={o.key}
            type="button"
            disabled={off}
            aria-pressed={on}
            data-main-ground-card={o.key}
            onClick={() => !on && onPick(o.key)}
            className="sn-press flex w-[46%] shrink-0 snap-start flex-col items-stretch gap-1.5 text-left disabled:opacity-50"
          >
            <span
              className={`relative block h-[86px] overflow-hidden rounded-xl ring-1 ${on ? 'ring-2 ring-terracotta-700' : 'ring-ink/10'}`}
              style={o.thumb ? undefined : { background: o.key === 'src:none' ? plain : undefined }}
            >
              {o.thumb ? (
                /* eslint-disable-next-line @next/next/no-img-element -- a loop's public still / the couple's own picture, already signed */
                <img src={o.thumb} alt="" aria-hidden loading="lazy" className="h-full w-full object-cover" />
              ) : o.key === 'src:media' ? (
                <span aria-hidden className="flex h-full w-full items-center justify-center bg-ink/[0.04] text-[22px] text-ink/40">＋</span>
              ) : o.key === 'src:hero' ? (
                <span aria-hidden className="flex h-full w-full items-center justify-center bg-ink/[0.04] text-[12px] text-ink/45">Your hero</span>
              ) : null}
            </span>
            <span className={`flex items-center justify-center gap-1 truncate text-center text-[13px] ${on ? 'font-semibold text-ink' : 'font-medium text-ink/70'}`}>
              <span className="truncate">{o.label}</span>
              {o.trail ? <span aria-label={o.trail.label} className="shrink-0 text-[11px] text-ink/45">{o.trail.text}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
