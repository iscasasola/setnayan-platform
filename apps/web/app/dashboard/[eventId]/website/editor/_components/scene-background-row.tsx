'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, makerProUsable, paidMarkLabel } from '@/lib/paid-mark';
import { makerSave } from '@/lib/maker-refresh';
import { MAKER_MAX_CLIP_SECONDS, makeMakerVideoDurationValidator } from '@/lib/maker-media-limits';
import { SCENE_BACKGROUND_FOLDER, sceneBackgroundPathPrefix } from '@/lib/scene-media-choices';
import { uploadStill } from '@/lib/upload-still';
import { STD_REALISTIC_BACKGROUNDS } from '@/lib/std-backgrounds';
import { extractPosterFrame } from '../../../_components/std-media-picker';
import {
  HUB_DEFAULT_FOCAL,
  HUB_DEFAULT_SCENE_SHAPE,
  HUB_DEFAULT_ZOOM,
  HUB_FOCAL_POINTS,
  HUB_GLASS_DEFAULT_TINT,
  HUB_GLASS_OPACITY_MAX,
  HUB_GLASS_OPACITY_MIN,
  HUB_GLASS_OPACITY_STEP,
  HUB_MEDIA_MOTIONS,
  HUB_MEDIA_MOTION_LABEL,
  HUB_SCENE_SHAPES,
  HUB_SCENE_SHAPE_LABEL,
  HUB_ZOOMS,
  focalToObjectPosition,
  hubBackgroundTint,
  resolveHubBackground,
  sanitizeHubCanvas,
  type HubBackgroundKind,
  type HubSectionCanvas,
} from '@/lib/hub-canvas';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { ombreCss } from '@/lib/ombre';
import {
  everySceneBackgroundPatch,
  justThisSceneCanvas,
  sceneBackgroundScope,
  hubBackgroundCanvasFor,
  withBackground,
  type SceneOnStage,
} from '@/lib/scene-background-scope';
import { ColourWell } from './colour-well';
import type { ElementDraftAction } from './element-sheet';
import { IButton, IHint, IRow, ISection, ISeg, ISegmented } from './inspector-kit';
import { backgroundPickRedrawsBox } from './element-preview';
import { PickMenu } from './pick-menu';
import { sceneBgPreviewMessage, type SceneBgPreviewMessage } from './scene-bg-preview-message';

/**
 * 🖼 THE SCENE'S FORMAT → BACKGROUND, as the approved prototype draws it
 * (`prototypes/maker_toolbars_keynote_pages_2026-09-27.html`, frame A):
 *
 *   Background   No background · Plain · Diagonal · Glow · Opaque · Frosted ·
 *                Upload media  (owner, answer 1: Dawn is dropped per scene)
 *   ↳ the question, once, after a pick: "Use this background on every scene?"
 *                Just this scene / Every scene (never "Apply" — that word is
 *                the publish button), "every scene" = this stage (answer 6)
 *   Colour       one split well above the first five (`colour-well.tsx`)
 *   Opacity      20–100%, on Opaque AND Frosted (answer 5: "both")
 *   Media        the couple's pictures as thumbnails (hero · gallery · the Save
 *                the Date background · the one video · a scene's own uploads)
 *                and an upload IN PLACE (`<FileUpload>`, compressed in the
 *                browser), then — for a photo — Motion: Still · Parallax (the
 *                shipped hero parallax) and the crop
 *   Shape        Framed · Full width — hidden under No background (no box)
 *
 * A scene kept different wears "Own background · ↺ Use the Event Hub's" (the
 * owner's wording, DECISION_LOG 2026-09-27).
 *
 * 💾 THE DRAFT, NEVER LIVE — every choice is one `hubDraftAction` intent=save
 * of the scene's WHOLE canvas (the draft replaces a canvas whole), built from
 * the latest canvas (a ref, so two quick taps never undo each other). "Every
 * scene" is ONE save of every scene of the stage (`everySceneBackgroundPatch`).
 * Apply re-checks every photo is the couple's own (`hubDraftAction`).
 *
 * 🔓 PRO: No background, Plain, both ombrés, both glasses, opacity and the
 * shape are free (owner 2026-09-24: *"changing background color is free.
 * making media a background is pro."*). Upload media is Pro and is ALWAYS
 * drawn (owner 2026-09-28: *"where is the upload media"*) — and, since the
 * owner's same-day rule *"they can edit it with pro features. but need to
 * upgrade to pro when clicked on apply"*, it is OPEN for every couple: a free
 * couple picks, uploads and sees media on the canvas, in the DRAFT only; Apply
 * holds it until Event Hub Pro (`planHubDraftApply`), so guests never see it.
 * The small ◆ Pro mark is information, never a lock. In the app-store shell a
 * free couple is not shown it at all (`makerProUsable`, the shell's rule for
 * every Pro control); the mark is `makerProMark` — ◆ PRO while tried, the
 * diamond once owned.
 */

type Choice = 'none' | 'color' | 'diagonal' | 'glow' | 'glass' | 'frost' | 'media';
const CHOICE_LABEL: Record<Choice, string> = {
  none: 'No background',
  color: 'Plain',
  diagonal: 'Diagonal',
  glow: 'Glow',
  glass: 'Opaque',
  frost: 'Frosted',
  media: 'Upload media',
};
const TINTED: readonly Choice[] = ['color', 'diagonal', 'glow', 'glass', 'frost'];

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

/** One upload a scene of this Event Hub already wears (its own folder), signed by the page. */
export type SceneUpload = {
  ref: string;
  url: string;
  kind: 'photo' | 'snippet';
  /** A clip's still (its ref) and a URL to show it by, when there is one. */
  poster?: string | null;
  posterUrl?: string | null;
};

export function SceneBackgroundRow({
  eventId,
  widgetType,
  canvas,
  stageScenes,
  stageLabel,
  draftAction,
  themeColours,
  usedColours = [],
  photoChoices = [],
  videoChoice = null,
  sceneUploads = [],
  ownsPro,
  storeShell = false,
  onPreview,
  onSaving,
  hubTheme,
}: {
  /**
   * ⚡ THE CANVAS HOLD (`element-preview.ts`): every scene's canvas this save
   * writes, exactly as the preview laid it — told BEFORE the save is sent, so
   * the render the save brings back keeps the canvas instead of reloading a
   * page that already shows it. A refused save tells it again with the
   * canvases put back.
   *
   * 🖼 `redrawsBox` (`backgroundPickRedrawsBox`): this pick changes whether a
   * widget draws its OWN card — a thing the bridge never paints (it is decided
   * server-side, `sceneWidgetIsBare`). The shell must then NOT hold: the save's
   * render reloads the canvas, so the card goes (or comes back).
   */
  onSaving?: (canvases: Record<string, HubSectionCanvas>, redrawsBox: boolean) => void;
  /** The live theme — the preview's words take its inks over the new ground, as the page will. */
  hubTheme?: InviteThemeId | null;
  /**
   * ⚡ Lay a background on the canvas NOW (the bridge's `sceneBg`), before the
   * save. The buffered reload that follows the save confirms it.
   */
  onPreview?: (message: SceneBgPreviewMessage) => void;
  eventId: string;
  widgetType: string;
  /** This scene's canvas as the canvas draws it — the draft over live. */
  canvas: HubSectionCanvas;
  /** Every scene of THIS stage (this one included), each with its canvas. */
  stageScenes: readonly SceneOnStage[];
  /** "Invitation" — what "every scene" reaches, said out loud. */
  stageLabel: string;
  draftAction: ElementDraftAction;
  /** The couple's palette — the theme swatches in the Colour panel. */
  themeColours: readonly string[];
  usedColours?: readonly string[];
  photoChoices?: readonly { ref: string; url: string }[];
  /** The event's one video; `poster` = its still (the hero photo) for guests. */
  videoChoice?: { ref: string; url: string; poster?: string | null } | null;
  /** Photos and clips the scenes already wear from their own upload folder. */
  sceneUploads?: readonly SceneUpload[];
  ownsPro: boolean;
  /**
   * 💎 The app-store shell. On the web media behind a scene is TRIED without Pro
   * (the pick is drafted; Apply names it and asks for Pro — owner 2026-09-28);
   * only the shell hides it from a free couple (`makerProUsable`).
   */
  storeShell?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const latest = useRef<HubSectionCanvas>(canvas);
  /** This scene's canvas as the Maker canvas last had it laid — the revert point. */
  const laid = useRef<HubSectionCanvas>(canvas);
  const [shown, setShown] = useState<HubSectionCanvas>(canvas);
  const canvasJson = JSON.stringify(canvas);
  useEffect(() => {
    latest.current = canvas;
    laid.current = canvas;
    setShown(canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasJson]);
  /* A new scene is a new question. */
  useEffect(() => setAsking(false), [widgetType]);

  /* 📤 What was uploaded HERE, this visit — shown from the file itself (a
     local object URL) until the save's refresh brings the signed one. */
  const [justUploaded, setJustUploaded] = useState<SceneUpload[]>([]);
  const uploads: SceneUpload[] = [
    ...justUploaded.filter((u) => !sceneUploads.some((s) => s.ref === u.ref)),
    ...sceneUploads,
  ];
  /** The couple's own photo URLs, by ref — what a photo background paints with. */
  const mediaUrls: Record<string, string> = Object.fromEntries([
    ...photoChoices.map((p) => [p.ref, p.url] as const),
    ...(videoChoice ? [[videoChoice.ref, videoChoice.url] as const] : []),
    ...uploads.map((u) => [u.ref, u.url] as const),
    /* 🖼 The ready-made Save the Date scenes — public pictures, their own URL. */
    ...STD_REALISTIC_BACKGROUNDS.map((b) => [b.src, b.src] as const),
  ]);
  const mediaUrl = (ref: string) => mediaUrls[ref] ?? null;
  const theme = INVITE_THEMES[hubTheme ?? 'house'] ?? INVITE_THEMES.house;
  const save = (
    patch: { widgets: Record<string, { canvas: HubSectionCanvas }> },
    after?: () => void,
  ) => {
    setError(null);
    const touched = Object.fromEntries(Object.entries(patch.widgets).map(([type, w]) => [type, w.canvas]));
    /** This scene as the canvas showed it BEFORE the change — what a refused save puts back. */
    const prior = laid.current;
    if (widgetType in touched) laid.current = touched[widgetType]!;
    /* What each touched scene showed before — put back if the save is refused. */
    const before: Record<string, HubSectionCanvas> = Object.fromEntries(
      Object.keys(touched).map((type) => [
        type,
        type === widgetType ? prior : (stageScenes.find((sc) => sc.type === type)?.canvas ?? {}),
      ]),
    );
    const lay = (canvases: Record<string, HubSectionCanvas>) =>
      onPreview?.(
        sceneBgPreviewMessage(
          Object.entries(canvases).map(([type, canvas]) => ({ type, canvas })),
          mediaUrl,
          theme,
          mediaUrls,
        ),
      );
    /* 🖼 Does this pick change who draws the box — a widget's own card on or
       off (`backgroundPickRedrawsBox`)? The bridge paints the frame, never the
       card, so such a save is told to the shell as one it must NOT hold.
       🎞 Nor does it draw a <video>: a clip going on or coming off a scene is
       released too, so the save's render reloads the canvas with it. */
    const isClip = (c: HubSectionCanvas | undefined) => resolveHubBackground(c ?? {})?.kind === 'snippet';
    const clipMoves = Object.keys(touched).some((type) => isClip(touched[type]) || isClip(before[type]));
    const redrawsBox = clipMoves || backgroundPickRedrawsBox(before, touched, mediaUrls);
    /* ⚡ On the canvas first — every scene the patch touches — then the hold,
       then the save. */
    lay(touched);
    onSaving?.(touched, redrawsBox);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify(patch));
      const res = await makerSave(() => draftAction(eventId, fd), () => router.refresh(), { held: true }).catch(
        () => ({ ok: false as const, intent: 'save' as const, error: 'That change could not be saved. Please try again.' }),
      );
      if (!res.ok) {
        /* ↩ Refused: the canvas, the hold and the row go back to what was saved
           — unless a later choice on this scene is already on its way (it
           carries the whole canvas and decides). */
        if (latest.current === touched[widgetType] || !(widgetType in touched)) {
          if (widgetType in touched) {
            latest.current = prior;
            laid.current = prior;
            setShown(prior);
          }
          lay(before);
          onSaving?.(before, redrawsBox);
        }
        setError(res.error);
        return;
      }
      after?.();
    });
  };
  /** One change to THIS scene's background; `ask` raises the one-or-all question. */
  const put = (bg: Partial<HubSectionCanvas>, ask = true) => {
    const next = withBackground(latest.current, bg, Boolean(latest.current.own));
    latest.current = next;
    setShown(next);
    save({ widgets: { [widgetType]: { canvas: next } } });
    if (ask && resolveHubBackground(next)) setAsking(true);
  };
  /** A key beside the background (shape, crop) — never asks. */
  const putKeys = (keys: Partial<HubSectionCanvas>) => {
    const next = sanitizeHubCanvas({ canvas: { ...latest.current, ...keys } });
    latest.current = next;
    setShown(next);
    save({ widgets: { [widgetType]: { canvas: next } } });
  };

  const bg = resolveHubBackground(shown);
  const current: Choice | null = !bg ? null : bg.kind === 'photo' || bg.kind === 'snippet' ? 'media' : (bg.kind as Choice);
  const tint = hubBackgroundTint(bg) ?? themeColours[0] ?? HUB_GLASS_DEFAULT_TINT;
  const scenes = stageScenes.map((s) => (s.type === widgetType ? { ...s, canvas: shown } : s));
  const scope = sceneBackgroundScope(scenes, widgetType, shown);
  /* 🖼 ALWAYS DRAWN (owner 2026-09-28) — with nothing uploaded yet it opens the
     panel on its in-place upload. Only the store shell's free couple is not
     shown it (a Pro control there would be a paid pitch). */
  const offerMedia = makerProUsable({ owns: ownsPro, storeShell });
  /** ◆ PRO while tried, the diamond once owned (`makerProMark`); never a padlock. */
  const mediaMark = makerProMark({ owns: ownsPro, storeShell });
  const [mediaOpen, setMediaOpen] = useState(false);
  useEffect(() => setMediaOpen(false), [widgetType]);
  const showMedia = current === 'media' || (mediaOpen && offerMedia);
  /** A photo's put — a new photo keeps the chosen Motion (Still · Parallax). */
  const photoBg = (ref: string): Partial<HubSectionCanvas> => ({
    media: ref,
    ...(bg?.kind === 'photo' && shown.mediaMotion ? { mediaMotion: shown.mediaMotion } : {}),
  });
  /** The clip's put — with its still, so guests see that moment. */
  const clipBg = (ref: string, poster?: string | null): Partial<HubSectionCanvas> => ({
    kind: 'snippet',
    media: ref,
    ...(poster ? { poster } : {}),
  });

  const pick = (c: Choice) => {
    if (c !== 'media') setMediaOpen(false);
    if (c === 'none') return put({ kind: 'none' as HubBackgroundKind });
    if (c === 'media') {
      setMediaOpen(true);
      if (bg && (bg.kind === 'photo' || bg.kind === 'snippet')) return;
      const firstPhoto = photoChoices[0]?.ref ?? uploads.find((u) => u.kind === 'photo')?.ref ?? null;
      if (firstPhoto) return put({ media: firstPhoto });
      if (videoChoice) return put(clipBg(videoChoice.ref, videoChoice.poster));
      const firstClip = uploads.find((u) => u.kind === 'snippet');
      if (firstClip) return put(clipBg(firstClip.ref, firstClip.poster));
      /* Nothing uploaded yet: the panel opens on its upload. */
      return;
    }
    /* One colour holds across Plain and both ombrés. A glass starts LIGHT and
       keeps its tint only when moving between the two glasses — from a colour it
       does not carry it over (DECISION_LOG 2026-09-27, "GLASS READS AS GLASS"). */
    const glass = c === 'glass' || c === 'frost';
    const wasGlass = bg?.kind === 'glass' || bg?.kind === 'frost';
    const color = glass ? (wasGlass ? tint : HUB_GLASS_DEFAULT_TINT) : tint;
    const keepOpacity = glass && wasGlass ? { opacity: shown.opacity } : {};
    return put({ kind: c as HubBackgroundKind, color, ...keepOpacity });
  };

  /* 📤 UPLOAD IN PLACE — the Main background's pattern: the file is read in the
     browser the moment it is picked (a clip's still is grabbed and uploaded
     beside it), and the upload's ref becomes this scene's background at once,
     in the draft. */
  const picked = useRef<Promise<{ kind: 'photo' | 'snippet'; local: string; poster: string | null; posterUrl: string | null }> | null>(null);
  const [reading, setReading] = useState(false);
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
  const onUploaded = async (value: string | string[] | null) => {
    const ref = typeof value === 'string' ? value : null;
    const file = await picked.current;
    picked.current = null;
    if (!ref || !file) return;
    setJustUploaded((was) => [{ ref, url: file.local, kind: file.kind, poster: file.poster, posterUrl: file.posterUrl }, ...was]);
    if (file.kind === 'snippet') put(clipBg(ref, file.poster));
    else put(photoBg(ref));
  };

  const opacityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [opacityDraft, setOpacityDraft] = useState<number | null>(null);
  const opacity = opacityDraft ?? shown.opacity ?? (bg?.kind === 'frost' ? 50 : 86);

  return (
    <section data-scene-background-row={widgetType} aria-busy={pending}>
      <ISection>Background</ISection>
      <div role="group" aria-label="Scene background" className="grid grid-cols-4 gap-1.5 pb-2.5">
        {(['none', 'color', 'diagonal', 'glow', 'glass', 'frost', 'media'] as const).map((c) =>
          c === 'media' && !offerMedia ? null : (
            <button
              key={c}
              type="button"
              aria-pressed={c === 'media' ? showMedia : current === c}
              data-scene-bg-choice={c}
              onClick={() => pick(c)}
              className={`sn-press flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 text-center text-[11px] font-semibold leading-tight ring-1 transition-colors duration-sn-control ease-sn ${
                (c === 'media' ? showMedia : current === c)
                  ? 'bg-white text-ink shadow-sm ring-ink'
                  : 'bg-white/60 text-ink/60 ring-ink/12 hover:ring-ink/35'
              }`}
            >
              <span aria-hidden className="h-6 w-10 rounded border border-black/10" style={preview(c, tint, photoChoices[0]?.url)} />
              <span className="inline-flex items-center gap-1">
                {CHOICE_LABEL[c]}
                {/* 💎 Media behind a scene is Event Hub Pro. The mark is
                    INFORMATION, never a lock (owner 2026-09-28) — the chip is
                    open to every couple; Apply asks for Pro. */}
                {c === 'media' && mediaMark ? (
                  <PaidMark state={mediaMark} label={paidMarkLabel(mediaMark, 'Event Hub Pro')} size="xs" tone="current" />
                ) : null}
              </span>
            </button>
          ),
        )}
      </div>

      {asking && bg ? (
        <div role="group" aria-label="Use this background where?" data-scene-bg-ask="" className="mb-2.5 rounded-xl bg-gild/10 p-3">
          <p className="text-[13.5px] font-semibold text-ink">Use this background on every scene?</p>
          <div className="mt-2 flex gap-1.5">
            <IButton
              data="just-here"
              disabled={pending}
              onClick={() => {
                const next = justThisSceneCanvas(latest.current);
                latest.current = next;
                setShown(next);
                save({ widgets: { [widgetType]: { canvas: next } } }, () => setAsking(false));
              }}
            >
              Just this scene
            </IButton>
            <IButton
              fill
              data="every-scene"
              disabled={pending}
              onClick={() => {
                const patch = everySceneBackgroundPatch(scenes, latest.current);
                const mine = patch.widgets[widgetType]?.canvas;
                if (mine) {
                  latest.current = mine;
                  setShown(mine);
                }
                save(patch, () => setAsking(false));
              }}
            >
              Every scene
            </IButton>
          </div>
          <IHint>
            “Every scene” means the scenes of this stage — {stageLabel}. The other stages keep their own.
          </IHint>
        </div>
      ) : scope === 'own' ? (
        <div className="mb-2.5" data-scene-bg-scope="own">
          <button
            type="button"
            disabled={pending}
            data-scene-bg-use-hub=""
            onClick={() => {
              const next = hubBackgroundCanvasFor(scenes, widgetType, latest.current);
              latest.current = next;
              setShown(next);
              save({ widgets: { [widgetType]: { canvas: next } } });
            }}
            className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gild/60 bg-white px-3 text-[12.5px] font-semibold text-ink/70 lg:min-h-9"
          >
            Own background ·
            <RotateCcw aria-hidden className="h-3.5 w-3.5 text-ink" strokeWidth={2} />
            <span className="text-ink underline decoration-gild/60 underline-offset-2">Use the Event Hub’s</span>
          </button>
        </div>
      ) : scope === 'every' ? (
        <p className="mb-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-ink/70" data-scene-bg-scope="every">
          On every scene of {stageLabel}.
          <button
            type="button"
            disabled={pending}
            data-scene-bg-make-own=""
            onClick={() => {
              const next = justThisSceneCanvas(latest.current);
              latest.current = next;
              setShown(next);
              save({ widgets: { [widgetType]: { canvas: next } } });
            }}
            className="sn-press min-h-11 font-semibold text-ink underline underline-offset-2 lg:min-h-8"
          >
            Make this one different
          </button>
        </p>
      ) : null}

      {current && TINTED.includes(current) ? (
        <IRow label="Colour" data="scene-colour">
          <ColourWell
            value={tint}
            shown={tint}
            what="this scene"
            themeColours={themeColours}
            usedColours={usedColours}
            savedKey={`sn-maker-colours:${eventId}`}
            onPick={(hex) => put({ kind: bg!.kind as HubBackgroundKind, color: hex.slice(0, 7), opacity: shown.opacity })}
            data="scene"
          />
        </IRow>
      ) : null}

      {current === 'glass' || current === 'frost' ? (
        <IRow label="Opacity" data="scene-opacity">
          <input
            type="range"
            min={HUB_GLASS_OPACITY_MIN}
            max={HUB_GLASS_OPACITY_MAX}
            step={HUB_GLASS_OPACITY_STEP}
            value={opacity}
            aria-label="Opacity"
            data-scene-opacity=""
            onChange={(e) => {
              const n = Number(e.target.value);
              setOpacityDraft(n);
              /* ⚡ The pane at this opacity, on the canvas while the thumb moves. */
              onPreview?.(
                sceneBgPreviewMessage(
                  [{ type: widgetType, canvas: sanitizeHubCanvas({ canvas: { ...latest.current, opacity: n } }) }],
                  mediaUrl,
                  INVITE_THEMES[hubTheme ?? 'house'] ?? INVITE_THEMES.house,
                ),
              );
              if (opacityTimer.current) clearTimeout(opacityTimer.current);
              opacityTimer.current = setTimeout(() => {
                setOpacityDraft(null);
                put({ kind: bg!.kind as HubBackgroundKind, color: tint, opacity: n }, false);
              }, 350);
            }}
            className="h-11 min-w-0 flex-1 accent-ink lg:h-6"
          />
          <span className="w-10 text-right text-[12px] tabular-nums text-ink/70">{opacity}%</span>
        </IRow>
      ) : null}

      {showMedia ? (
        <>
          <IRow label="Media" wrap data="scene-uploads">
            <div className="flex flex-1 flex-wrap gap-2" role="group" aria-label="Your pictures">
              {videoChoice ? (
                <ClipTile
                  still={videoChoice.poster ? mediaUrl(videoChoice.poster) : null}
                  on={bg?.kind === 'snippet' && bg.media === videoChoice.ref}
                  onPick={() => put(clipBg(videoChoice.ref, videoChoice.poster))}
                />
              ) : null}
              {uploads.map((u) =>
                u.kind === 'snippet' ? (
                  <ClipTile
                    key={u.ref}
                    still={u.posterUrl ?? null}
                    on={bg?.kind === 'snippet' && bg.media === u.ref}
                    onPick={() => put(clipBg(u.ref, u.poster))}
                  />
                ) : (
                  <PhotoTile key={u.ref} url={u.url} on={bg?.kind === 'photo' && bg.media === u.ref} onPick={() => put(photoBg(u.ref))} />
                ),
              )}
              {photoChoices.map((p) => (
                <PhotoTile key={p.ref} url={p.url} on={bg?.kind === 'photo' && bg.media === p.ref} onPick={() => put(photoBg(p.ref))} />
              ))}
            </div>
          </IRow>
          {bg?.kind === 'photo' || bg?.kind === 'snippet' ? (
            /* 🔓 Taking a photo or clip OFF is never gated — back to the Event Hub's own look. */
            <IRow data="scene-media-off">
              <IButton data="media-off" disabled={pending} onClick={() => put({}, false)}>
                {bg.kind === 'snippet' ? 'Remove this scene’s video' : 'Remove this scene’s photo'}
              </IButton>
            </IRow>
          ) : null}
          {/* 🖼 READY-MADE (owner 2026-09-29, answer 3: *"yes"*) — the Save the
              Date's ready-made scenes, after the couple's own. */}
          <IRow label="Ready-made" wrap data="scene-library">
            <div className="flex flex-1 flex-wrap gap-2" role="group" aria-label="Ready-made backgrounds">
              {STD_REALISTIC_BACKGROUNDS.map((b) => (
                <PhotoTile key={b.id} url={b.src} label={b.label} on={bg?.kind === 'photo' && bg.media === b.src} onPick={() => put(photoBg(b.src))} />
              ))}
            </div>
          </IRow>
          <div className="border-b border-ink/[0.07] py-2.5" data-inspector-row="scene-upload">
            <FileUpload
              bucket="media"
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
              onFilePicked={onFilePicked}
              onChange={onUploaded}
              disabled={pending}
              label="Upload a photo or clip"
            />
            {reading ? <p className="pt-1 text-[12px] text-ink/60">Reading your clip…</p> : null}
          </div>
          {bg?.kind === 'photo' ? (
            <IRow label="Motion" data="scene-media-motion">
              <PickMenu
                label="How the photo moves"
                value={shown.mediaMotion ?? 'still'}
                options={HUB_MEDIA_MOTIONS.map((m) => ({ key: m, label: HUB_MEDIA_MOTION_LABEL[m] }))}
                onPick={(k) => putKeys({ mediaMotion: k === 'parallax' ? 'parallax' : undefined })}
                dataAttr="data-scene-media-motion"
              />
              <InfoTip label="" ariaLabel="About Motion" align="end">
                Parallax drifts the photo gently as guests scroll — the same drift as your hero. Guests who turn
                motion off see it still.
              </InfoTip>
            </IRow>
          ) : bg?.kind === 'snippet' ? (
            <IRow label="Clip" data="scene-media-clip">
              <p className="flex-1 text-[12.5px] text-ink/70">Plays silently, on a loop.</p>
              <InfoTip label="" ariaLabel="About the clip" align="end">
                Up to {MAKER_MAX_CLIP_SECONDS} seconds. It plays only while on screen.
              </InfoTip>
            </IRow>
          ) : null}
          {bg?.kind === 'photo' ? (
            <IRow label="In frame" wrap data="scene-crop">
              <div
                className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-md border border-ink/15 bg-ink/5 bg-cover"
                style={
                  mediaUrl(bg.media)
                    ? {
                        backgroundImage: `url("${mediaUrl(bg.media)}")`,
                        backgroundPosition: focalToObjectPosition(shown.focal ?? HUB_DEFAULT_FOCAL),
                      }
                    : undefined
                }
              >
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {HUB_FOCAL_POINTS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={(shown.focal ?? HUB_DEFAULT_FOCAL) === f}
                      aria-label={`Keep area ${f} of 9 in frame`}
                      onClick={() => putKeys({ focal: f })}
                      className={`border border-white/35 ${(shown.focal ?? HUB_DEFAULT_FOCAL) === f ? 'bg-white/70' : 'hover:bg-white/25'}`}
                    />
                  ))}
                </div>
              </div>
              <ISegmented label="How close">
                {HUB_ZOOMS.map((z) => (
                  <ISeg key={z} on={(shown.zoom ?? HUB_DEFAULT_ZOOM) === z} onClick={() => putKeys({ zoom: z })}>
                    {z === 100 ? 'As it is' : z === 120 ? 'Closer' : 'Closest'}
                  </ISeg>
                ))}
              </ISegmented>
            </IRow>
          ) : null}
        </>
      ) : null}

      {current && current !== 'none' ? (
        <IRow label="Shape" data="scene-shape">
          <ISegmented label="Framed or full width">
            {HUB_SCENE_SHAPES.map((k) => (
              <ISeg key={k} data={k} on={(shown.shape ?? HUB_DEFAULT_SCENE_SHAPE) === k} onClick={() => putKeys({ shape: k === 'framed' ? undefined : k })}>
                {HUB_SCENE_SHAPE_LABEL[k]}
              </ISeg>
            ))}
          </ISegmented>
        </IRow>
      ) : current === 'none' ? (
        <IHint data="no-box">No background: no card, no border — the words sit on the page.</IHint>
      ) : null}

      {error ? (
        <p role="alert" className="py-2 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** One of the couple's photos, as a tap target. */
function PhotoTile({ url, on, onPick, label }: { url: string; on: boolean; onPick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={label}
      aria-label={on ? `Current background${label ? ` — ${label}` : ''}` : `Use ${label ?? 'this photo'} as the background`}
      onClick={onPick}
      className={`sn-press block h-11 w-14 overflow-hidden rounded-md border-2 ${on ? 'border-ink' : 'border-transparent hover:border-ink/30'}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
    </button>
  );
}

/** One of the couple's clips, as a tap target — on its still when there is one. */
function ClipTile({ on, onPick, still }: { on: boolean; onPick: () => void; still: string | null }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Current background' : 'Use this clip as the background'}
      onClick={onPick}
      className={`sn-press grid h-11 w-14 place-items-center overflow-hidden rounded-md border-2 bg-ink bg-cover bg-center text-[10px] font-bold text-cream ${
        on ? 'border-terracotta' : 'border-transparent'
      }`}
      style={still ? { backgroundImage: `url("${still.replace(/"/g, '%22')}")` } : undefined}
    >
      <span className="rounded bg-ink/70 px-1">▶ Clip</span>
    </button>
  );
}

/** The little picture on each choice — the real effect, in the scene's colour. */
function preview(c: Choice, tint: string, photo?: string): React.CSSProperties {
  switch (c) {
    case 'none':
      return { background: 'transparent', borderStyle: 'dashed' };
    case 'color':
      return { background: tint };
    case 'diagonal':
      return { background: ombreCss({ shape: 'diagonal', base: tint.slice(0, 7) }) };
    case 'glow':
      return { background: ombreCss({ shape: 'glow', base: tint.slice(0, 7) }) };
    case 'glass':
      return { background: `linear-gradient(${tint}d9, ${tint}d9), repeating-linear-gradient(45deg, #fff 0 3px, #ddd 3px 6px)` };
    case 'frost':
      return { background: `linear-gradient(${tint}80, ${tint}80), repeating-linear-gradient(45deg, #fff 0 3px, #cfc8bb 3px 6px)` };
    case 'media':
      return photo
        ? { backgroundImage: `url("${photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: 'linear-gradient(135deg, #d9c3a5, #8a6b39 60%, #3a382f)' };
  }
}
