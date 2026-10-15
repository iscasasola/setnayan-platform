'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { FileUpload } from '@/app/_components/file-upload';
import { MakerMediaMeter } from '@/app/_components/maker-media-meter';
import { COVER_SCENE_SOURCE_IS_PRO, COVER_SCENE_THEME_LINE, coverGroundShape, coverGroundSource, type CoverSceneSource } from '@/lib/cover-scene';
import { HUB_GLASS_OPACITY_MAX, HUB_GLASS_OPACITY_MIN, HUB_GLASS_OPACITY_STEP, hubMovingBackgroundIds, sanitizeHubCanvas, type HubCoverGround, type HubSectionCanvas } from '@/lib/hub-canvas';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { HUB_DRAFT_BAR_FIELD, makerRedrawSave } from '@/lib/maker-refresh';
import { noteDraftedCanvas } from '@/lib/maker-draft-store';
import { MAKER_MAX_CLIP_SECONDS, coupleMediaCapBytes, makeMakerVideoDurationValidator } from '@/lib/maker-media-limits';
import { coupleMediaRefusalLink } from '@/lib/couple-media-allowance';
import { sceneBackgroundPathPrefix } from '@/lib/scene-media-choices';
import { sceneShadeAt, sceneShadeOf } from '@/lib/scene-shade-bar';
import { tileFrostCss, tileFrostFoot, tileGlassColour, tileNameOnFlat, tileNameOnPhoto } from '@/lib/bg-tile-name';
import { ColourSheet } from '../../../website/editor/_components/colour-well';
import type { ElementDraftAction } from '../../../website/editor/_components/element-sheet';
import { StageBackground, type StageBgSource, type StageBgTile } from './stage-background';

/** The toolbar's source keys ↔ the Cover Scene's (`lib/cover-scene.ts`): the first source is The theme's own. */
const TO_BG: Readonly<Record<CoverSceneSource, StageBgSource>> = { theme: 'hub', colour: 'colour', scene: 'scene', own: 'own' };
const FROM_BG: Readonly<Record<StageBgSource, CoverSceneSource>> = { hub: 'theme', colour: 'colour', scene: 'scene', own: 'own' };
const COLOUR_KINDS = ['color', 'diagonal', 'glow', 'glass', 'frost'] as const;
type ColourKind = (typeof COLOUR_KINDS)[number];
const COLOUR_NAME: Readonly<Record<ColourKind, string>> = { color: 'Plain', diagonal: 'Diagonal', glow: 'Glow', glass: 'Opaque', frost: 'Frosted' };
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
/** The one line under the upload: a clip is kept and counted, never worn on the cover while it cannot play for guests. */
export const COVER_SCENE_CLIP_LINE = 'Videos are kept in your media — they don’t play for guests on the cover yet.';

/**
 * 🖼 THE COVER SCENE'S BACKGROUND, IN THE TOOLBAR'S FOUR ROWS — the thin adapter the approved prototype names
 * (`cover-words-background.tsx`): it hands the group's saves to the UNCHANGED `StageBackground`, as
 * `scene-background-row.tsx` does for a scene. Sources: The theme's own (nothing stored — the written card) ·
 * Colour (free) · Scene ◆ (Setnayan's own loops — they play for guests) · Upload ◆ (the couple's photos). ◆ never
 * blocks the trying: Apply names it ("Unlock Pro and Apply").
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
  mediaUsedBytes,
  ownsPro,
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
  mediaUsedBytes?: number;
  /** The real Pro gate for this event (`eventCoupleWebsiteProActive`) — the meter's allowance is the PLAN's (Free 10 MB · Pro 500 MB). Required, so a new mount cannot fall back to Free silently. */
  ownsPro: boolean;
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
  const [uploaded, setUploaded] = useState<{ ref: string; url: string }[]>([]);
  const [clipKept, setClipKept] = useState(false);
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
      fd.set(HUB_DRAFT_BAR_FIELD, '1');
      const res = await makerRedrawSave(() => draftAction(eventId, fd), () => router.refresh()).catch(() => ({
        ok: false as const,
        intent: 'save' as const,
        error: 'That change could not be saved. Please try again.',
      }));
      if (!res.ok) {
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
  const photos = [...uploaded.filter((u) => !photoChoices.some((p) => p.ref === u.ref)), ...photoChoices];
  const picture = (url: string | null) => (url ? { backgroundImage: `url("${url.replace(/"/g, '%22')}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: '#3a382f' });
  const tiles: StageBgTile[] =
    source === 'colour'
      ? COLOUR_KINDS.map(colourTile)
      : source === 'scene'
        ? loops.map((id) => ({ key: id, name: INVITE_THEMES[id].name, moving: true, picture: picture(loopPosters[id] ?? null), ...tileNameOnPhoto(null) }))
        : source === 'own'
          ? photos.map((p) => ({ key: p.ref, name: 'Your photo', picture: picture(p.url), ...tileNameOnPhoto(null) }))
          : [];
  const tile = !worn || !ground ? null : ground.kind === 'loop' ? ground.loop : ground.kind === 'photo' ? ground.media : ground.kind === 'snippet' ? null : ground.kind;
  const colourOn = worn && ground && (ground.kind === 'color' || ground.kind === 'diagonal' || ground.kind === 'glow' || ground.kind === 'glass' || ground.kind === 'frost');
  const glass = worn && ground && (ground.kind === 'glass' || ground.kind === 'frost') ? ground : null;
  const shaded = worn && ground && ground.kind !== 'glass' && ground.kind !== 'frost';

  const kindRef = useRef<'clip' | { url: string } | null>(null);
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
        validateFile={makeMakerVideoDurationValidator()}
        onFilePicked={(file) => {
          kindRef.current = file.type.startsWith('video/') ? 'clip' : { url: URL.createObjectURL(file) };
        }}
        onChange={(value) => {
          const ref = typeof value === 'string' ? value : null;
          const kind = kindRef.current;
          kindRef.current = null;
          if (!ref || !kind) return;
          /* 🔒 A clip is kept and counted, never worn on the cover while the hero clip may not reach guests. */
          if (kind === 'clip') return setClipKept(true);
          setUploaded((was) => [{ ref, url: kind.url }, ...was]);
          put({ kind: 'photo', media: ref });
        }}
        disabled={pending}
        label="Upload a photo"
      />
      <p className="pt-1 text-[12px] text-ink/60" data-cover-scene-clip-line="" role={clipKept ? 'status' : undefined}>
        {COVER_SCENE_CLIP_LINE}
      </p>
      {typeof mediaUsedBytes === 'number' ? <MakerMediaMeter usedBytes={mediaUsedBytes} capBytes={coupleMediaCapBytes(ownsPro)} proHref={proHref} className="pt-2" /> : null}
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
          put({ kind: 'photo', media: key });
        }}
        onUpload={source === 'own'}
        upload={upload}
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
        shade={shaded ? { at: sceneShadeAt(ground!.shade), onMove: () => {}, onKeep: (n) => putKeys({ shade: sceneShadeOf(n) as HubCoverGround['shade'] }) } : null}
        /* Framed | Full width — the whole first screen tall either way (owner 2026-10-15). */
        shape={worn && ground ? coverGroundShape(ground) : null}
        onShape={(k) => putKeys({ shape: k === 'full' ? 'full' : undefined })}
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
