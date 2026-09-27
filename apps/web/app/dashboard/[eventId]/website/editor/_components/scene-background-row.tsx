'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ImageIcon, RotateCcw } from 'lucide-react';
import {
  HUB_DEFAULT_FOCAL,
  HUB_DEFAULT_SCENE_SHAPE,
  HUB_DEFAULT_ZOOM,
  HUB_FOCAL_POINTS,
  HUB_GLASS_DEFAULT_TINT,
  HUB_GLASS_OPACITY_MAX,
  HUB_GLASS_OPACITY_MIN,
  HUB_GLASS_OPACITY_STEP,
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
  useHubBackgroundCanvas,
  withBackground,
  type SceneOnStage,
} from '@/lib/scene-background-scope';
import { ColourWell } from './colour-well';
import type { ElementDraftAction } from './element-sheet';
import { IButton, IHint, IRow, ISection, ISeg, ISegmented } from './inspector-kit';
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
 *   Media        the couple's uploads as thumbnails, then the crop
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
 * 🔓 PRO, UNCHANGED: No background, Plain, both ombrés, both glasses, opacity
 * and the shape are free (owner 2026-09-24: *"changing background color is
 * free. making media a background is pro."*); Upload media is offered to a
 * couple who owns Event Hub Pro only — a free couple is shown no photo to pick
 * (`a-free-section-shows-no-look-controls.test.ts`), and the panel's one lock
 * above names it. A photo already up stays, and can always be taken off.
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
  ownsPro,
  mediaHref,
  onPreview,
  hubTheme,
}: {
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
  videoChoice?: { ref: string; url: string } | null;
  ownsPro: boolean;
  /** Where the couple adds photos (the gallery), for "Upload a photo or clip". */
  mediaHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const latest = useRef<HubSectionCanvas>(canvas);
  const [shown, setShown] = useState<HubSectionCanvas>(canvas);
  const canvasJson = JSON.stringify(canvas);
  useEffect(() => {
    latest.current = canvas;
    setShown(canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasJson]);
  /* A new scene is a new question. */
  useEffect(() => setAsking(false), [widgetType]);

  /** The couple's own photo URLs, by ref — what a photo background paints with. */
  const mediaUrl = (ref: string) =>
    photoChoices.find((p) => p.ref === ref)?.url ?? (videoChoice?.ref === ref ? videoChoice.url : null);
  const save = (patch: { widgets: Record<string, { canvas: HubSectionCanvas }> }, after?: () => void) => {
    setError(null);
    /* ⚡ On the canvas first — every scene the patch touches — then the save. */
    onPreview?.(
      sceneBgPreviewMessage(
        Object.entries(patch.widgets).map(([type, w]) => ({ type, canvas: w.canvas })),
        mediaUrl,
        INVITE_THEMES[hubTheme ?? 'house'] ?? INVITE_THEMES.house,
      ),
    );
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify(patch));
      const res = await draftAction(eventId, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      after?.();
      router.refresh();
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
  const hasMedia = Boolean(photoChoices.length || videoChoice);
  const offerMedia = ownsPro && hasMedia;

  const pick = (c: Choice) => {
    if (c === 'none') return put({ kind: 'none' as HubBackgroundKind });
    if (c === 'media') {
      const first = bg && (bg.kind === 'photo' || bg.kind === 'snippet') ? null : (photoChoices[0]?.ref ?? null);
      if (first) return put({ media: first });
      if (!photoChoices.length && videoChoice) return put({ kind: 'snippet', media: videoChoice.ref });
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
              aria-pressed={current === c}
              data-scene-bg-choice={c}
              onClick={() => pick(c)}
              className={`sn-press flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-1.5 text-center text-[11px] font-semibold leading-tight transition-colors duration-sn-control ease-sn ${
                current === c ? 'border-ink bg-white text-ink shadow-sm' : 'border-ink/12 bg-white/60 text-ink/60 hover:border-ink/35'
              }`}
            >
              <span aria-hidden className="h-6 w-10 rounded-[5px] border border-black/10" style={preview(c, tint, photoChoices[0]?.url)} />
              {CHOICE_LABEL[c]}
            </button>
          ),
        )}
      </div>

      {asking && bg ? (
        <div role="group" aria-label="Use this background where?" data-scene-bg-ask="" className="mb-2.5 rounded-xl border border-gild/50 bg-gild/10 p-3">
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
              const next = useHubBackgroundCanvas(scenes, widgetType, latest.current);
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

      {current === 'media' && !ownsPro ? (
        /* 🔓 A free couple may always take a photo or clip OFF (never gated). */
        <IRow label="Media" data="scene-media-off">
          <IButton data="media-off" disabled={pending} onClick={() => put({}, false)}>
            {bg?.kind === 'snippet' ? 'Remove this scene’s video' : 'Remove this scene’s photo'}
          </IButton>
        </IRow>
      ) : current === 'media' ? (
        <>
          <IRow label="Media" wrap data="scene-media">
            <a
              href={mediaHref}
              className="sn-press inline-flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-ink/15 bg-white px-3 text-[12.5px] font-semibold text-ink lg:min-h-9"
            >
              <ImageIcon aria-hidden className="h-4 w-4" strokeWidth={2} />
              Upload a photo or clip
              <small className="ml-auto font-medium text-ink/50">up to 15 s</small>
            </a>
          </IRow>
          <IRow label="Your uploads" wrap data="scene-uploads">
            <div className="flex flex-1 flex-wrap gap-2">
              {videoChoice ? (
                <button
                  type="button"
                  aria-pressed={bg?.kind === 'snippet'}
                  onClick={() => put({ kind: 'snippet', media: videoChoice.ref })}
                  className={`sn-press grid h-11 w-14 place-items-center rounded-md border-2 bg-ink text-[10px] font-bold text-cream ${
                    bg?.kind === 'snippet' ? 'border-ink' : 'border-transparent'
                  }`}
                >
                  ▶ Clip
                </button>
              ) : null}
              {photoChoices.map((p) => {
                    const on = bg?.kind === 'photo' && bg.media === p.ref;
                    return (
                      <button
                        key={p.ref}
                        type="button"
                        aria-pressed={on}
                        aria-label={on ? 'Current background' : 'Use this photo as the background'}
                        onClick={() => put({ media: p.ref })}
                        className={`sn-press block h-11 w-14 overflow-hidden rounded-md border-2 ${on ? 'border-ink' : 'border-transparent hover:border-ink/30'}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    );
                  })}
            </div>
          </IRow>
          {bg?.kind === 'photo' ? (
            <IRow label="In frame" wrap data="scene-crop">
              <div
                className="relative h-[72px] w-[96px] shrink-0 overflow-hidden rounded-md border border-ink/15 bg-ink/5 bg-cover"
                style={
                  photoChoices.find((p) => p.ref === bg.media)
                    ? {
                        backgroundImage: `url("${photoChoices.find((p) => p.ref === bg.media)!.url}")`,
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
