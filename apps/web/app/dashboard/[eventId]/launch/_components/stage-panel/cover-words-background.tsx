'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { FileUpload } from '@/app/_components/file-upload';
import { MakerMediaMeter } from '@/app/_components/maker-media-meter';
import {
  COVER_SCENE_SOURCE_IS_PRO,
  COVER_SCENE_THEME_LINE,
  coverClipCardName,
  coverShadeLook,
  coverUploadCards,
  coverGroundSource,
  coverSceneTakesClips,
  coverSceneUploadLabel,
  coverSceneUploadRefusal,
  type CoverSceneSource,
} from '@/lib/cover-scene';
import { HUB_GLASS_OPACITY_MAX, HUB_GLASS_OPACITY_MIN, HUB_GLASS_OPACITY_STEP, hubMovingBackgroundIds, sanitizeHubCanvas, type HubCoverGround, type HubSectionCanvas } from '@/lib/hub-canvas';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { HUB_DRAFT_BAR_FIELD, makerRedrawSave } from '@/lib/maker-refresh';
import { forgetCanvasSent, noteDraftedCanvas, sendCanvasBase } from '@/lib/maker-draft-store';
import { MAKER_MAX_CLIP_SECONDS, makeMakerVideoDurationValidator } from '@/lib/maker-media-limits';
import { coupleMediaRefusalLink } from '@/lib/couple-media-allowance';
import { SCENE_BACKGROUND_FOLDER, sceneBackgroundPathPrefix } from '@/lib/scene-media-choices';
import { uploadStill } from '@/lib/upload-still';
import { extractPosterFrame } from '../../../_components/std-media-picker';
import type { SceneUpload } from '../../../website/editor/_components/scene-background-row';
import { sceneShadeAt, sceneShadeOf } from '@/lib/scene-shade-bar';
import { tileFrostCss, tileFrostFoot, tileGlassColour, tileNameOnFlat, tileNameOnPhoto } from '@/lib/bg-tile-name';
import { ColourSheet } from '../../../website/editor/_components/colour-well';
import type { ElementDraftAction } from '../../../website/editor/_components/element-sheet';
import { StageBackground, type StageBgSource, type StageBgTile } from './stage-background';

/**
 * 🌗 Lay the cover's Darker ↔ Lighter on every Maker canvas now (`app/[slug]/_components/cover-shade-preview.ts`, the
 * bridge lays it); null takes it off. Nothing is saved by this — the release's one write is.
 */
function showCoverShade(look: ReturnType<typeof coverShadeLook> | null): void {
  const message = look ? { source: 'setnayan-editor', t: 'coverShade', ...look } : { source: 'setnayan-editor', t: 'coverShade', off: true };
  document.querySelectorAll<HTMLIFrameElement>('iframe[data-maker-canvas-frame]').forEach((frame) => {
    frame.contentWindow?.postMessage(message, window.location.origin);
  });
}

/** The toolbar's source keys ↔ the Cover Scene's (`lib/cover-scene.ts`): the first source is The theme's own. */
const TO_BG: Readonly<Record<CoverSceneSource, StageBgSource>> = { theme: 'hub', colour: 'colour', scene: 'scene', own: 'own' };
const FROM_BG: Readonly<Record<StageBgSource, CoverSceneSource>> = { hub: 'theme', colour: 'colour', scene: 'scene', own: 'own' };
const COLOUR_KINDS = ['color', 'diagonal', 'glow', 'glass', 'frost'] as const;
type ColourKind = (typeof COLOUR_KINDS)[number];
const COLOUR_NAME: Readonly<Record<ColourKind, string>> = { color: 'Plain', diagonal: 'Diagonal', glow: 'Glow', glass: 'Opaque', frost: 'Frosted' };
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

/**
 * 🖼 THE COVER SCENE'S BACKGROUND, IN THE TOOLBAR'S FOUR ROWS — the thin adapter the approved prototype names
 * (`cover-words-background.tsx`): it hands the group's saves to the UNCHANGED `StageBackground`, as
 * `scene-background-row.tsx` does for a scene. Sources: The theme's own (nothing stored — the written card) ·
 * Colour (free) · Scene ◆ (Setnayan's own loops — they play for guests) · Upload ◆ (the couple's photos, and — owner
 * 2026-10-16 — their own ≤ 15 s muted clip, which plays for guests on the event's own page). ◆ never blocks the
 * trying: Apply names it ("Unlock Pro and Apply").
 *
 * 📤 AN UPLOAD LEADS STRAIGHT ON — the stage's own pattern (`scene-background-row.tsx`), copied: the file is read
 * the moment it is picked (a clip's still grabbed and uploaded beside it), and when the upload lands its ref becomes
 * the cover's background at once, the sheet closes on the Upload row with the new card ringed, and ✓ Apply counts it.
 *
 * 💾 One save of the hero row's canvas (`widgets.hero.canvas.ground`) through the shipped draft action — to the
 * DRAFT, live at Apply. The canvas redraws itself in place once it lands (`makerRedrawSave`).
 */
export function CoverSceneGroundRows({
  eventId,
  canvas,
  draftAction,
  themeColours,
  board,
  photoChoices = [],
  videoChoice,
  sceneUploads,
  mediaUsedBytes,
  mediaCapBytes,
  proHref,
  loopPosters = {},
}: {
  /** Each ready-made loop's first frame, resolved on the server (`INVITE_THEMES[id].media.poster`) — its tile's picture. */
  loopPosters?: Readonly<Record<string, string | null>>;
  eventId: string;
  /** The hero row's canvas as the canvas draws it — the draft over live. */
  canvas: HubSectionCanvas;
  draftAction: ElementDraftAction;
  themeColours: readonly string[];
  board?: readonly string[];
  photoChoices?: readonly { ref: string; url: string }[];
  /** The event's one video (the hero clip) and its still — offered as a card, as on a stage's Upload. Null: none. */
  videoChoice: { ref: string; url: string; poster?: string | null } | null;
  /**
   * Photos and clips the event already wears from its own upload folder (a scene's, or this cover's), signed.
   * 🔒 REQUIRED — a mount that leaves it out lists no video at all (the 2026-10-17 fault; `every-cover-upload-is-listed.test.ts`).
   */
  sceneUploads: readonly SceneUpload[];
  mediaUsedBytes?: number;
  /** The PLAN's allowance for this event — `coupleMediaCapBytes(ownsPro)`, worked out by the caller from the real Pro
   *  gate (Free 10 MB · Pro 500 MB). A number, not the Pro flag: this panel draws no Pro control of its own. Required,
   *  so a new mount cannot fall back to Free silently (`couple-media-cap-is-enforced.test.ts` 4c). */
  mediaCapBytes: number;
  /** The existing Event Hub Pro buy path — given only to a Free event (null for Pro / a store shell), as `main-background-panel.tsx` does. */
  proHref: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<HubSectionCanvas>(canvas);
  const latest = useRef<HubSectionCanvas>(canvas);
  const canvasJson = JSON.stringify(canvas);
  useEffect(() => {
    latest.current = canvas;
    setShown(canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasJson]);
  /* 📤 What was uploaded HERE, this visit — shown from the file itself until the save's refresh brings the signed one. */
  const [justUploaded, setJustUploaded] = useState<SceneUpload[]>([]);
  /** Each upload that became the cover's background — it closes the Upload sheet (`StageBackground`). */
  const [uploadDone, setUploadDone] = useState(0);
  const [reading, setReading] = useState(false);
  const takesClips = coverSceneTakesClips();
  const ground = shown.ground ?? null;
  const stored = coverGroundSource(ground);
  const [view, setView] = useState<CoverSceneSource | null>(null);
  const source = view ?? stored;
  const worn = source === stored;
  const tint = (ground && 'color' in ground && ground.color) || themeColours[0] || '#2C2A29';

  /**
   * ONE save of the hero row's canvas with this ground (null: The theme's own). 🔑 THE ONE HERO WRITER: an Upload pick
   * IS the hero photo — the same save writes it to `landing_page_hero_image_url`, so `resolveHero` (the poster, the
   * home card, Post Event's starting cover, Details › Hero) keeps reading ONE value. Never two photos that disagree.
   */
  const put = (next: HubCoverGround | null) => {
    setError(null);
    setView(null);
    const before = latest.current;
    const { ground: _was, ...rest } = before;
    const canvasNext = sanitizeHubCanvas({ canvas: next ? { ...rest, ground: next } : rest });
    latest.current = canvasNext;
    setShown(canvasNext);
    noteDraftedCanvas('hero', canvasNext, before);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      const heroPhoto = canvasNext.ground?.kind === 'photo' ? canvasNext.ground.media : null;
      fd.set('patch', JSON.stringify({ widgets: { hero: { canvas: canvasNext } }, ...(heroPhoto ? { events: { landing_page_hero_image_url: heroPhoto } } : {}) }));
      // 👥 …with the canvas this pick was built on: another host's pick on the cover meanwhile is kept.
      sendCanvasBase(fd, 'hero', canvas, canvasNext, before);
      fd.set(HUB_DRAFT_BAR_FIELD, '1');
      const res = await makerRedrawSave(() => draftAction(eventId, fd), () => router.refresh()).catch(() => ({
        ok: false as const,
        intent: 'save' as const,
        error: 'That change could not be saved. Please try again.',
      }));
      if (!res.ok) {
        forgetCanvasSent('hero');
        /* A shade laid ahead of this refused save comes off the canvas with it. */
        showCoverShade(null);
        if (latest.current === canvasNext) {
          latest.current = before;
          setShown(before);
          noteDraftedCanvas('hero', before, before);
        }
        setError(res.error);
      }
    });
  };
  /** A key beside the ground (shade, shape, opacity, motion) — the same one save. */
  const putKeys = (keys: Partial<HubCoverGround>) => (ground ? put({ ...ground, ...keys } as HubCoverGround) : undefined);

  const colourTile = (k: ColourKind): StageBgTile => {
    const name = COLOUR_NAME[k];
    if (k === 'glass') return { key: k, name, picture: { background: tileGlassColour(tint, 'glass') }, ...tileNameOnFlat(tileGlassColour(tint, 'glass')) };
    if (k === 'frost') return { key: k, name, picture: { background: tileFrostCss(tint) }, ...tileNameOnFlat(tileFrostFoot(tint)) };
    if (k === 'diagonal') return { key: k, name, picture: { background: `linear-gradient(150deg, ${tint}, color-mix(in srgb, ${tint} 70%, #000))` }, ...tileNameOnFlat(tint) };
    if (k === 'glow') return { key: k, name, picture: { background: `radial-gradient(80% 70% at 50% 40%, color-mix(in srgb, ${tint} 70%, #fff), ${tint})` }, ...tileNameOnFlat(tint) };
    return { key: k, name, picture: { background: tint }, ...tileNameOnFlat(tint) };
  };
  const loops = hubMovingBackgroundIds();
  const uploads: SceneUpload[] = [...justUploaded.filter((u) => !sceneUploads.some((s) => s.ref === u.ref)), ...sceneUploads];
  /* 🖼 ONE FACT, ONE LIST (owner 2026-10-17, "why is the video not showing on the list of uploaded media files?"): the
     row is the couple's uploads — photos AND clips — and whatever the cover is wearing is always one of its cards
     (`coverUploadCards`), ringed, so it can be seen, re-picked and switched with the others. */
  const cards = coverUploadCards({ uploads, photoChoices, videoChoice, ground, takesClips });
  const photos = cards.photos;
  const clips = cards.clips;
  /* ⏱ "▶ Your video · 12 s" — each clip's own length, read from the file's header (only while the Upload row is up). */
  const seconds = useClipSeconds(source === 'own' ? clips.map((c) => c.url) : []);
  const picture = (url: string | null) => (url ? { backgroundImage: `url("${url.replace(/"/g, '%22')}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: '#3a382f' });
  const tiles: StageBgTile[] =
    source === 'colour'
      ? COLOUR_KINDS.map(colourTile)
      : source === 'scene'
        ? loops.map((id) => ({ key: id, name: INVITE_THEMES[id].name, moving: true, picture: picture(loopPosters[id] ?? null), ...tileNameOnPhoto(null) }))
        : source === 'own'
          ? [
              ...clips.map((c) => ({ key: c.ref, name: coverClipCardName(c.ref, clips.length, c.url ? seconds[c.url] : null), moving: true, picture: picture(c.posterUrl), ...tileNameOnPhoto(null) })),
              ...photos.map((p) => ({ key: p.ref, name: 'Your photo', picture: picture(p.url), ...tileNameOnPhoto(null) })),
            ]
          : [];
  const tile = !worn || !ground ? null : ground.kind === 'loop' ? ground.loop : ground.kind === 'photo' || ground.kind === 'snippet' ? ground.media : ground.kind;
  const colourOn = worn && ground && (ground.kind === 'color' || ground.kind === 'diagonal' || ground.kind === 'glow' || ground.kind === 'glass' || ground.kind === 'frost');
  const glass = worn && ground && (ground.kind === 'glass' || ground.kind === 'frost') ? ground : null;
  const shaded = worn && ground && ground.kind !== 'glass' && ground.kind !== 'frost';

  /* 📤 UPLOAD IN PLACE — read the moment it is picked: a photo shows from the file itself, a clip has its still grabbed
     and uploaded beside it (`extractPosterFrame` + `uploadStill`, the stage's own pair). */
  const picked = useRef<Promise<{ kind: 'photo' | 'snippet'; local: string; poster: string | null; posterUrl: string | null }> | null>(null);
  const onFilePicked = (file: File) => {
    setError(null);
    const kind = file.type.startsWith('video/') ? ('snippet' as const) : ('photo' as const);
    const local = URL.createObjectURL(file);
    if (kind === 'photo') {
      picked.current = Promise.resolve({ kind, local, poster: null, posterUrl: null });
      return;
    }
    setReading(true);
    picked.current = (async () => {
      try {
        const still = await extractPosterFrame(file);
        const poster = still ? await uploadStill(still, eventId, SCENE_BACKGROUND_FOLDER) : null;
        return { kind, local, poster, posterUrl: still && poster ? URL.createObjectURL(still) : null };
      } catch {
        return { kind, local, poster: null, posterUrl: null };
      } finally {
        setReading(false);
      }
    })();
  };
  /* …and the upload's ref becomes the cover's background at once — a clip as a clip, never thrown away. */
  const onUploaded = async (value: string | string[] | null) => {
    const ref = typeof value === 'string' ? value : null;
    const file = await picked.current;
    picked.current = null;
    if (!ref || !file) return;
    setJustUploaded((was) => [{ ref, url: file.local, kind: file.kind, poster: file.poster, posterUrl: file.posterUrl }, ...was]);
    put(file.kind === 'snippet' ? { kind: 'snippet', media: ref, ...(file.poster ? { poster: file.poster } : {}) } : { kind: 'photo', media: ref });
    setUploadDone((n) => n + 1);
  };
  const durationOk = makeMakerVideoDurationValidator();
  const upload = (
    <div className="py-2.5" data-cover-scene-upload="">
      <FileUpload
        bucket="media"
        refusalLink={coupleMediaRefusalLink(proHref)}
        pathPrefix={sceneBackgroundPathPrefix(eventId)}
        multiple={false}
        maxSizeMB={100}
        acceptedTypes={[...IMAGE_TYPES, ...VIDEO_TYPES]}
        compressImage
        compressVideo
        videoCompressProfile="maker"
        videoSilent
        maxVideoDurationS={MAKER_MAX_CLIP_SECONDS}
        /* 🔒 A video the cover cannot wear is refused HERE, before a byte is sent (`coverSceneUploadRefusal`); one it
           can is held to the 15 s rule (`MAKER_MAX_CLIP_SECONDS`, said in place). */
        validateFile={async (file) => coverSceneUploadRefusal(file.type) ?? durationOk(file)}
        onFilePicked={onFilePicked}
        onChange={onUploaded}
        disabled={pending}
        label={coverSceneUploadLabel()}
      />
      {reading ? (
        <p role="status" className="pt-1 text-[12px] text-ink/60" data-cover-scene-reading="">
          Reading your clip…
        </p>
      ) : null}
      {typeof mediaUsedBytes === 'number' ? <MakerMediaMeter usedBytes={mediaUsedBytes} capBytes={mediaCapBytes} proHref={proHref} className="pt-2" /> : null}
    </div>
  );
  return (
    <>
      <StageBackground
        pending={pending}
        source={TO_BG[source]}
        hubLabel="The theme’s own"
        hubLine={COVER_SCENE_THEME_LINE}
        sources={(['theme', 'colour', 'scene', 'own'] as const).map((k) => ({ key: TO_BG[k], pro: COVER_SCENE_SOURCE_IS_PRO[k] }))}
        onSource={(next) => {
          const s = FROM_BG[next];
          if (s === 'theme') return stored === 'theme' ? setView(null) : put(null);
          /* Any other source only SHOWS its choices — nothing is written until one is taken. */
          setView(s === stored ? null : s);
        }}
        tiles={tiles}
        tile={tile}
        onTile={(key) => {
          if (source === 'colour') {
            const k = key as ColourKind;
            return put(k === 'glass' || k === 'frost' ? { kind: k, color: tint } : { kind: k, color: tint });
          }
          if (source === 'scene') {
            const id = loops.find((l) => l === key);
            return id ? put({ kind: 'loop', loop: id }) : undefined;
          }
          const clip = clips.find((c) => c.ref === key);
          /* 🌗 Switching between the couple's own clip and photo keeps the bar where it is — it is the cover's one shade. */
          const keep = ground && (ground.kind === 'photo' || ground.kind === 'snippet') && ground.shade !== undefined ? { shade: ground.shade } : {};
          put(clip ? { kind: 'snippet', media: key, ...(clip.poster ? { poster: clip.poster } : {}), ...keep } : { kind: 'photo', media: key, ...keep });
        }}
        onUpload={source === 'own'}
        upload={upload}
        uploadDone={uploadDone}
        colour={colourOn ? tint : null}
        customColour={(close) => (
          <ColourSheet
            value={tint}
            shown={tint}
            what="the Cover Scene"
            palette={board ?? themeColours}
            slots={Boolean(board)}
            onPick={(hex) => putKeys({ color: hex.slice(0, 7) } as Partial<HubCoverGround>)}
            onClose={close}
          />
        )}
        opacity={
          glass
            ? {
                value: glass.opacity ?? (glass.kind === 'frost' ? 50 : 86),
                min: HUB_GLASS_OPACITY_MIN,
                max: HUB_GLASS_OPACITY_MAX,
                step: HUB_GLASS_OPACITY_STEP,
                onChange: (n) => putKeys({ opacity: n } as Partial<HubCoverGround>),
              }
            : null
        }
        /* 🌗 The canvas follows the thumb (`showCoverShade` — the prototype's `paintGround` on input); ONE write on release. */
        shade={shaded ? { at: sceneShadeAt(ground!.shade), onMove: (n) => showCoverShade(coverShadeLook(ground!, n)), onKeep: (n) => putKeys({ shade: sceneShadeOf(n) as HubCoverGround['shade'] }) } : null}
        /* No Framed | Full width: the Cover Scene is ALWAYS full screen, edge to edge (owner 2026-10-16, DECISION_LOG
           "THE COVER SCENE IS ALWAYS FULL SCREEN" — superseding 2026-10-15). A stored shape is ignored (`coverGroundShape`). */
        shape={null}
        onShape={() => {}}
        motion={worn && ground?.kind === 'photo' ? (ground.motion ?? 'still') : null}
        onMotion={(k) => putKeys({ motion: k === 'parallax' ? 'parallax' : undefined } as Partial<HubCoverGround>)}
      />
      {error ? (
        <p role="alert" className="row-start-4 px-1 text-[12.5px] leading-snug text-[var(--sp-ink)]">
          {error}
        </p>
      ) : null}
    </>
  );
}

/**
 * ⏱ Each clip's length in whole seconds, keyed by its URL — read from the file's own header (`preload="metadata"`, a
 * few KB), never stored. A clip whose header cannot be read simply has no "· N s" on its card.
 */
function useClipSeconds(urls: readonly (string | null)[]): Readonly<Record<string, number>> {
  const [out, setOut] = useState<Record<string, number>>({});
  const key = urls.filter(Boolean).join('\n');
  useEffect(() => {
    if (!key || typeof document === 'undefined') return;
    const live: HTMLVideoElement[] = [];
    for (const url of key.split('\n')) {
      if (out[url] !== undefined) continue;
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = () => {
        const s = Math.round(v.duration);
        if (Number.isFinite(s) && s > 0) setOut((was) => ({ ...was, [url]: s }));
        v.removeAttribute('src');
        v.load();
      };
      v.src = url;
      live.push(v);
    }
    return () => {
      for (const v of live) {
        v.onloadedmetadata = null;
        v.removeAttribute('src');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return out;
}
