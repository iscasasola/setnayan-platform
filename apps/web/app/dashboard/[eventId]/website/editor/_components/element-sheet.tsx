'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave } from '@/lib/maker-refresh';
import { canvasWriteKey, draftedCanvasOr, hearDraftedCanvas, noteDraftedCanvas } from '@/lib/maker-draft-store';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { ToolsResizeHandle, type ToolsResize } from './tools-resize';
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { scrollToClearSheet } from '@/lib/part-above-sheet';
import { useMaker, useMakerTool } from '../../../launch/_components/maker-context';
import { MAKER_LT_TOOL } from '@/lib/maker-phone-room';
import {
  HUB_ELEMENT_LABEL,
  HUB_ELEMENT_RUN_KEYS,
  hubElementContrast,
  withElementAlign,
  withElementChoice,
  withElementMotion,
  withRunChoice,
  hubRunsForRange,
  withoutMotion,
  withoutRuns,
  withoutTextStyle,
  type HubElementChoiceValue,
  type HubElementField,
  type HubElementKey,
  type HubElementMotion,
  type HubElementRun,
} from '@/lib/element-style';
import type { MotionFx } from '@/lib/motion-effects';
import { IReset, ISeg, ISegmented } from './inspector-kit';
import { PART_TABS, PartAnimateTab, PartArrangeTab, PartPicker, PartTextTab, type PartTab } from './part-inspector';
import { elementPreview, refusedChoiceWords, revertAfterFailedSave, type ElementPreviewMessage } from './element-preview';
import { ColourWell } from './colour-well';
import { FontPick } from './font-pick';
import { HUB_EL_DURING_LABEL, HUB_EL_DURING_WORDS, HUB_EL_TIMELINE, HUB_EL_TIMELINE_LABEL } from '@/lib/element-style';
import { motionFxOn, sameMotionFx } from '@/lib/motion-effects';
import { HUB_MOTION_PRESETS, HUB_MOTION_PRESET_LABEL, HUB_PRESET_BODY, hubShippedFx, type HubMotionPreset } from '@/lib/hub-canvas';
import { HUB_TRANSITIONS, HUB_TRANSITION_LABEL, resolveTransition, type HubTransition } from '@/lib/hub-scenes';
import { SP_DD, SP_DD_BUTTON } from '@/lib/maker-stage-room';
import { StageText } from '../../../launch/_components/stage-panel/stage-text';
import { StageAnimate } from '../../../launch/_components/stage-panel/stage-animate';

/**
 * THE ELEMENT SHEET — one tapped element's font · colour · size · animation.
 *
 * Owner, 2026-09-26: *"if they press an element in the scene, then that font
 * will be bypassed just like on keynote, word, pages"* · *"tapping element,
 * changes fonts, color, size, animation"*. The look is
 * `build-sessions/rsvp-variants-shots/edit-element.png`: four rows and a reset
 * for each ("↺ use the Event Hub font", "↺ use the theme colour").
 *
 * ── THE DRAFT, NEVER LIVE ─────────────────────────────────────────────────
 * Every choice posts `hubDraftAction` intent=save with the scene's WHOLE canvas
 * (the draft replaces a canvas whole — `mergeHubDraft`), built from the
 * draft-over-live canvas the page handed in, so the scene's arrangement, motion
 * and background ride along untouched. Colour, size and every other Text row
 * are free (owner 2026-09-28); the part's own FONT and its ANIMATION are Event
 * Hub Pro — a free couple may try them, and they are held at Apply
 * (`canvasLookChange`) while the free edits beside them go live
 * (`canvasFreePart`).
 *
 * 🔑 THE LATEST CANVAS IS A REF, NOT THE PROP. Two quick taps would otherwise
 * both build on the canvas from before the first save, and the second would
 * silently undo the first. For the same reason a server canvas that arrives
 * while a save is still on its way is NOT adopted — it is older than the ref.
 *
 * ⚡ EVERY CHOICE IS ON THE CANVAS BEFORE IT IS SAVED (owner 2026-09-27:
 * *"changing size does nothing"*). `onPreview` posts it to the canvas first
 * (`element-preview.ts` → the bridge's `elStyle`), then the save runs behind
 * it; `onSaving` tells the shell what the canvas now shows, so the save's
 * refresh does not reload the canvas. A refused save puts the last SAVED look
 * back on the canvas and says why, in the sheet's own error line.
 *
 * ⚡⚡ AND NOTHING RE-RENDERS BEHIND IT (owner 2026-09-30: *"every edit
 * alteration create forces the whole screen to reload"* · the tester: the
 * mark's − / + "loads slowly on every click"). A pick is a `held` save, which
 * owes the Maker no render (`lib/maker-refresh.ts`); quick picks on one part
 * are ONE write (`makerLatestWrite` — the latest canvas wins, so five taps of
 * + send one save); the save answers with the Apply bar's count; and the canvas
 * the sheet builds on is the Maker's own copy (`lib/maker-draft-store.ts`), so
 * a second part, or the sheet opened again, never builds on a server prop from
 * before these picks. A refused save puts that part back and says what did not
 * save, in words.
 *
 * Phone first: a bottom sheet over the lower canvas, the element still in view
 * above it; from `lg` it is the inspector's column. Still, app-like controls —
 * no animation in the controls themselves.
 */

export type ElementPalette = {
  ink: string;
  heading: string;
  accent: string;
  muted: string;
  /** The ground the words sit on — what the contrast warning measures against. */
  surface: string;
};

export type ElementTarget = {
  /** The canvas key that was tapped (`f:hero`, `w:<type>`). */
  key: string;
  /** Which widget row stores it — `hero` for the hero's parts. */
  widgetType: string;
  el: HubElementKey;
  /**
   * ✍ The text selected INSIDE the part (a word, one letter), as offsets into
   * its text and the text's hash — from the bridge's `selectionInPart`. Null =
   * the choices style the whole part. `was` is the part's whole text, so the
   * part's older runs ADAPT onto it when a choice is saved (`withRunChoice`).
   */
  range?: { start: number; end: number; of: string; text: string; was?: string } | null;
};

/**
 * `hubDraftAction`, handed down by the Maker page. Passed rather than imported
 * so this module (and the shell that mounts it) has no path back to the
 * `server-only` gate — the same reason `hub-draft-button.tsx` is split out.
 */
export type ElementDraftAction = (eventId: string, formData: FormData) => Promise<HubDraftActionResult>;

async function saveCanvas(
  draftAction: ElementDraftAction,
  eventId: string,
  widgetType: string,
  canvas: HubSectionCanvas,
) {
  const fd = new FormData();
  fd.set('intent', 'save');
  fd.set('patch', JSON.stringify({ widgets: { [widgetType]: { canvas } } }));
  /* ⚡ The Apply bar's count comes back with the save — no Maker render for it. */
  fd.set(HUB_DRAFT_BAR_FIELD, '1');
  return draftAction(eventId, fd);
}

const ROW = 'flex items-center gap-3 py-3';
const LABEL = 'w-[4.5rem] shrink-0 text-[13px] font-semibold text-ink';

export function ElementSheet({
  eventId,
  target,
  canvas: serverCanvas,
  palette,
  ownsPro,
  draftAction,
  onClose,
  resize,
  onPlay,
  onPreview,
  onSaving,
  parts,
  onPart,
  sceneLabel,
  usedColours = [],
  hideLocked = false,
  saveCanvasWith,
  wordsSlot = null,
  section,
  onSection,
}: {
  /** Text · Motion · Arrange, held by the Maker so it survives a switch to another part. */
  section?: PartTab;
  onSection?: (section: PartTab) => void;
  /**
   * 🎞 A part that is NOT on a section row (a Post Event scene's, whose looks
   * live in the story's `sceneLooks`): how its canvas is saved instead of the
   * section write. The sheet — preview, hold, revert, error — is unchanged.
   */
  saveCanvasWith?: (canvas: HubSectionCanvas) => Promise<HubDraftActionResult>;
  /** ✍ The part's own words, edited right here, above its Text rows. */
  wordsSlot?: ReactNode;
  /** The app-store shell: a Pro row is hidden, never shown locked. */
  hideLocked?: boolean;
  /** 🔤 Part ▾ — every part of this scene, in order (like Pages' "Body ▾"). */
  parts?: readonly HubElementKey[];
  /** Switch the sheet to another part of the same scene. */
  onPart?: (el: HubElementKey) => void;
  /** "Names & date" — the scene the part is on, beside the title. */
  sceneLabel?: string;
  /** Colours this Event Hub already uses — the synced half of "Saved colours". */
  usedColours?: readonly string[];
  /** The tools column's width and drag handle, shared with the inspector (desktop). */
  resize?: ToolsResize;
  /** ▶ Replay this part's In on the canvas (the bridge's `playEl`). */
  onPlay?: () => void;
  /** ⚡ Lay a choice on the canvas NOW (the bridge's `elStyle`), before its save. */
  onPreview?: (message: ElementPreviewMessage) => void;
  /** ⚡ The canvas now shows this scene canvas — hold it through the save's refresh. */
  onSaving?: (widgetType: string, canvas: HubSectionCanvas) => void;
  /** `hubDraftAction` — see `ElementDraftAction`. */
  draftAction: ElementDraftAction;
  eventId: string;
  target: ElementTarget;
  /** The scene's canvas as the canvas draws it — the draft laid over live. */
  canvas: HubSectionCanvas;
  palette: ElementPalette;
  ownsPro: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* ⚡ The scene's canvas as THIS Maker last wrote it, while that is newer than
     the server's — the page is not re-rendered after a pick any more. */
  const canvas = draftedCanvasOr(target.widgetType, serverCanvas);
  const latest = useRef<HubSectionCanvas>(canvas);
  /** The canvas the draft last ACCEPTED — what a refused save goes back to. */
  const saved = useRef<HubSectionCanvas>(canvas);
  /** Saves still on their way — while any is, the server's canvas is older than ours. */
  const inflight = useRef(0);
  /** The last row the couple used — named if its save is refused. */
  const lastChoice = useRef('style');
  const [style, setStyle] = useState(canvas.elements?.[target.el] ?? {});
  const canvasJson = JSON.stringify(canvas);

  /* A fresh canvas from the server (after a render) is the truth again —
     unless a save is still on its way, whose canvas is newer than it. ANOTHER
     PART (or scene) is always adopted at once: its canvas comes through the
     Maker's own copy, which already holds every pick still on its way — and
     with the picks batched a save can be on its way for most of a second, so
     waiting here showed the previous part's style on the new one. */
  const targetKey = `${target.widgetType}:${target.el}`;
  const seenTarget = useRef(targetKey);
  useEffect(() => {
    const moved = seenTarget.current !== targetKey;
    seenTarget.current = targetKey;
    if (!moved && inflight.current > 0) return;
    latest.current = canvas;
    saved.current = canvas;
    setStyle(canvas.elements?.[target.el] ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasJson, targetKey]);
  /* ✍ ANOTHER WRITER OF THIS CANVAS, OPEN BESIDE THE SHEET (a phone: the words
     typed in place while the part's tools stay open — `type-in-place.tsx`):
     its every note is adopted, so the next pick here builds on the words as
     typed and the rows show them — never this sheet's older copy. */
  const serverRef = useRef(serverCanvas);
  /** True while THIS sheet notes its own canvas — not another writer's. */
  const ownNote = useRef(false);
  /** Another writer moved the canvas since this sheet's last pick (its later write carries the pick). */
  const heardOther = useRef(false);
  serverRef.current = serverCanvas;
  useEffect(
    () =>
      hearDraftedCanvas((type) => {
        if (type !== target.widgetType || ownNote.current) return;
        const now = draftedCanvasOr(type, serverRef.current);
        if (now === latest.current) return;
        latest.current = now;
        heardOther.current = true;
        // The other writer answers for its own save (and puts its words back if refused).
        if (inflight.current === 0) saved.current = now;
        const part = now.elements?.[target.el] ?? {};
        // A keystroke that changed nothing this sheet shows draws nothing.
        setStyle((was) => (JSON.stringify(was) === JSON.stringify(part) ? was : part));
      }),
    [target.widgetType, target.el],
  );

  /* 🧰 Text · Animate · Arrange (Pages' inspector + Keynote's Animate). */
  const [ownTab, setOwnTab] = useState<PartTab>('text');
  const tab = section ?? ownTab;
  const setTab = onSection ?? setOwnTab;
  /* 💎 Font ▾ and Animate are the part's only Pro rows (owner 2026-09-28) —
     the mark sits on them, never on the whole sheet: ◆ PRO while a couple
     without Pro tries them (the pick is drafted; Apply asks), the diamond once
     owned. In the store shell a couple without Pro is not shown them at all. */
  const proMark = makerProMark({ owns: ownsPro, storeShell: hideLocked });
  const hidePro = hideLocked && !ownsPro;
  /* 🔤 A part's Font ▾ is FREE since 2026-10-06 (owner, "EVENT DETAILS IS REBUILT") — no mark, never hidden. */
  const fontMark = null;
  const animateMark = proMark ? (
    <PaidMark state={proMark} text="Event Hub Pro" label={paidMarkLabel(proMark, 'Event Hub Pro')} size="xs" />
  ) : null;
  const tabs = hidePro ? PART_TABS.filter((t) => t.key !== 'animate') : PART_TABS;

  const commit = (elements: HubSectionCanvas['elements'] | null, choice?: string, scene?: (c: HubSectionCanvas) => void) => {
    if (choice) lastChoice.current = choice;
    heardOther.current = false;
    const what = lastChoice.current;
    const before = latest.current;
    const next: HubSectionCanvas = { ...before };
    if (elements) next.elements = elements;
    else delete next.elements;
    /* 🧭 The new Maker's "Into the next scene" is the part's scene's own transition — the same canvas, one save. */
    scene?.(next);
    latest.current = next;
    setStyle(next.elements?.[target.el] ?? {});
    setError(null);
    /* ⚡ On the canvas first — the save runs behind it. */
    onPreview?.(elementPreview(target.key, target.el, before, next));
    onSaving?.(target.widgetType, next);
    ownNote.current = true;
    noteDraftedCanvas(target.widgetType, next, serverCanvas);
    ownNote.current = false;
    inflight.current += 1;
    start(async () => {
      let res: HubDraftActionResult | typeof SUPERSEDED;
      try {
        /* ⚡ NO render behind it (`held`), and quick picks on this scene are ONE
           write: the latest canvas waits a beat, then goes; a pick made while
           it waits replaces it (`makerLatestWrite`). A fixed part's Style row
           hands its own writer (`saveCanvasWith`) — same queue, same key. */
        const write = () => (saveCanvasWith ? saveCanvasWith(next) : saveCanvas(draftAction, eventId, target.widgetType, next));
        res = await makerSave(
          () => makerLatestWrite(canvasWriteKey(target.widgetType), write),
          () => router.refresh(),
          { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
        );
      } catch {
        res = { ok: false, intent: 'save', error: '' };
      } finally {
        inflight.current -= 1;
      }
      /* A later pick carried this one — its answer decides for both. */
      if (res === SUPERSEDED) return;
      if (!res.ok) {
        /* ↩ Refused: the canvas and the sheet go back to the last saved look,
           and the sheet says WHAT did not save. */
        const back = revertAfterFailedSave(next, latest.current, saved.current);
        if (back) {
          latest.current = back;
          setStyle(back.elements?.[target.el] ?? {});
          onPreview?.(elementPreview(target.key, target.el, next, back, false));
          onSaving?.(target.widgetType, back);
          ownNote.current = true;
          noteDraftedCanvas(target.widgetType, back, serverCanvas);
          ownNote.current = false;
        }
        /* Words typed beside the sheet since this pick went out carry it in their
           own later write: nothing was put back, so nothing is said to have failed. */
        if (!back && heardOther.current) return;
        setError(refusedChoiceWords(target.el, what, res.error || null));
        return;
      }
      saved.current = next;
      /* Nothing re-renders: the canvas already shows it, the toolbar's count
         came back with the save (`HUB_DRAFT_BAR_FIELD`), and the next pick
         builds on the Maker's own copy (`noteDraftedCanvas`). */
    });
  };
  /* ✍ A selection inside the part's text makes font · colour · size a RUN; the
     couple can drop back to the whole part with one tap. */
  const [useRange, setUseRange] = useState(true);
  useEffect(() => setUseRange(true), [target.range?.start, target.range?.end, target.range?.of]);
  const range = target.range && useRange && HUB_ELEMENT_RUN_KEYS.includes(target.el) ? target.range : null;
  const run: HubElementRun | null = range
    ? (hubRunsForRange(style, range).find((r) => r.start === range.start && r.end === range.end) ?? null)
    : null;
  /** What the font · colour · size controls show: the run's own, or the part's. */
  const face = range ? { font: run?.font, color: run?.color, size: run?.size } : style;

  const choose = (field: Exclude<HubElementField, 'motion'>, value: HubElementChoiceValue) =>
    commit(
      range && (field === 'font' || field === 'color' || field === 'size')
        ? withRunChoice(latest.current.elements, target.el, range, field, value as string | number | null)
        : withElementChoice(latest.current.elements, target.el, field, value),
      field,
    );
  const motion: HubElementMotion = style.motion ?? {};
  const moveTo = (part: keyof HubElementMotion, value: string | MotionFx | null) =>
    commit(withElementMotion(latest.current.elements, target.el, part, value), 'motion');

  /* ⚡ A colour DRAG on the wheel or a slider: on the canvas now, nothing saved
     (the Colour panel commits through `choose` once the hand stops). */
  const previewColour = (hex: string) => {
    const els = range
      ? withRunChoice(latest.current.elements, target.el, range, 'color', hex)
      : withElementChoice(latest.current.elements, target.el, 'color', hex);
    const next: HubSectionCanvas = { ...latest.current };
    if (els) next.elements = els;
    else delete next.elements;
    onPreview?.(elementPreview(target.key, target.el, latest.current, next, false));
  };

  /* The contrast warning — measured, never blocking (a quiet accent may be meant). */
  const ground = canvas.kind === 'color' && canvas.color ? canvas.color : palette.surface;
  const contrast = face.color ? hubElementContrast(face.color, ground) : null;
  const themeColours = [...new Set([palette.ink, palette.heading, palette.accent, palette.muted].map((c) => c.toLowerCase()))];
  /* 🧭 Which of the five How it moves the part wears now: none chosen → Auto; equal to a preset → it; else Custom. */
  const partHow = !style.motion
    ? 'auto'
    : (HUB_MOTION_PRESETS.find((p) => {
        const fx = partPresetFx(p, motion.timeline === 'scroll');
        return sameMotionFx(motion.in, fx.in) && (motion.timeline !== 'scroll' || sameMotionFx(motion.out, fx.out));
      }) ?? 'custom');
  const titleId = 'maker-element-sheet-title';

  /* 📱 The part being edited stays in sight ABOVE the sheet on a phone
     (owner 2026-10-02) — the canvas scrolls it into the band still showing. */
  const sheetRef = useRef<HTMLElement>(null);
  /* 🧰 The lower third's column names the part; ‹ › step to the scene's other parts. */
  const at = parts && onPart ? parts.indexOf(target.el) : -1;
  const prevPart = at > 0 ? parts![at - 1]! : null;
  const nextPart = at >= 0 && at < parts!.length - 1 ? parts![at + 1]! : null;
  /* 🧭 THE NEW MAKER (`makerStagesStudioEnabled`): its panel's Style | Text | Animate
     picks the section (`stage-tools.tsx`), Text is Font · Colour · Size, and Animate's
     steps are Build in · Action · Build out (`lib/maker-parts.ts`). */
  const stagesStudio = useMaker()?.stagesStudio === true;
  useMakerTool(true, {
    key: `part:${target.key}:${target.el}`,
    name: HUB_ELEMENT_LABEL[target.el],
    close: onClose,
    step: { prev: prevPart && onPart ? () => onPart(prevPart) : null, next: nextPart && onPart ? () => onPart(nextPart) : null },
  });
  useEffect(() => {
    /* 🧭 The new Maker's Stages panel centres the picked part itself (`stage-tools.tsx` `centrePart`). */
    if (!window.matchMedia('(max-width: 1023px)').matches || stagesStudio) return;
    const id = window.requestAnimationFrame(() => {
      const sheet = sheetRef.current;
      if (sheet) keepPartAboveSheet(sheet, target.key, target.el);
    });
    return () => window.cancelAnimationFrame(id);
  }, [target.key, target.el, stagesStudio]);

  return (
    <>
    {/* 🧰 THE PART'S TOOLS ARE THE LOWER THIRD'S on a phone (owner 2026-10-05,
        "approve"): over the lower third, beside the column that names the part
        (‹ › steps to its neighbours, × finishes); the page above stays live. */}
    <aside
      ref={sheetRef}
      data-phone-chrome="panel"
      role="dialog"
      aria-labelledby={titleId}
      data-maker-element-sheet={target.el}
      style={resize ? { ['--maker-tools-w' as string]: `${resize.width}px` } : undefined}
      onKeyDown={(e) => {
        // One close: the lower third's own Escape sees it was taken (`defaultPrevented`). A dropdown inside keeps it.
        if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('[aria-haspopup][aria-expanded="true"]')) return;
        e.preventDefault();
        onClose();
      }}
      className={`sn-glass-bare flex min-h-0 flex-col ${MAKER_LT_TOOL} lg:relative lg:z-auto lg:order-3 lg:max-h-none lg:w-[var(--maker-tools-w,340px)] lg:shrink-0 lg:rounded-none lg:pb-3`}
    >
      {resize ? <ToolsResizeHandle onPointerDown={resize.onPointerDown} /> : null}
      {/* The title, (i) and × are the desktop's — on a phone the lower third's column names the part and closes it. */}
      <div className="hidden items-center gap-2 px-4 pt-2 lg:flex">
        <p id={titleId} className="min-w-0 flex-1 truncate font-serif text-lg text-ink">
          Part
          {sceneLabel ? (
            <span className="ml-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">on {sceneLabel}</span>
          ) : null}
        </p>
        <InfoTip label="" ariaLabel="About this part" align="end">
          Changes this part only — the rest keeps the Event Hub&rsquo;s look. Until you choose, it wears the
          Event Hub font and colour and moves with its scene.
          {ownsPro || hidePro ? '' : ' Animation comes with Event Hub Pro — try it here; it goes live when you Apply with it.'}
        </InfoTip>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink/70 transition-colors duration-300 ease-in-out hover:bg-ink/10 hover:text-ink lg:h-10 lg:w-10"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <div className="px-3 lg:px-4">
        {/* Part ▾ — a desktop's; on a phone the column's ‹ › step through the parts. */}
        <div className="hidden lg:block">
          {parts && parts.length > 1 && onPart ? (
            <PartPicker parts={parts} value={target.el} onPick={onPart} />
          ) : (
            <p className="py-2 text-[13px] font-semibold text-ink">{HUB_ELEMENT_LABEL[target.el]}</p>
          )}
        </div>
        {/* ✍ "Whole part / this selection" — above the tabs while letters are selected. */}
        {target.range && HUB_ELEMENT_RUN_KEYS.includes(target.el) ? (
          <div className="py-2" data-element-range="">
            <ISegmented label="What the choices style">
              <ISeg on={useRange} onClick={() => setUseRange(true)}>
                “{target.range.text.length > 14 ? `${target.range.text.slice(0, 13)}…` : target.range.text}”
              </ISeg>
              <ISeg on={!useRange} onClick={() => setUseRange(false)}>
                Whole {HUB_ELEMENT_LABEL[target.el].toLowerCase()}
              </ISeg>
            </ISegmented>
          </div>
        ) : null}
      </div>
      {/* ▣ THE PART'S THREE SECTIONS as ONE segmented control (owner 2026-10-04:
          "segmented control") — Text · Motion · Arrange, the chosen one in the
          Setnayan wine. Every control inside is the one that shipped. */}
      <div className={`shrink-0 px-4 pt-1${stagesStudio ? ' max-lg:hidden' : ''}`} data-element-sections="">
        <ISegmented label="Edit this part">
          {tabs.map((t) => (
            <ISeg key={t.key} tone="wine" on={tab === t.key} onClick={() => setTab(t.key)} data={`section-${t.key}`}>
              {t.label}
            </ISeg>
          ))}
        </ISegmented>
      </div>

      {stagesStudio ? (
        /* 🧭 THE NEW MAKER — the prototype's Text and Animate (`stage-panel/`), on this sheet's own saves. */
        tab === 'animate' && !hidePro ? (
          <StageAnimate
            pending={pending}
            error={error}
            pro={animateMark ? 'How a part moves is Event Hub Pro — try it here; it goes live when you Apply with it.' : null}
            how={{
              /* The prototype's five (`HOW`): Auto · Still · Calm · Editorial · Cinematic — the SHIPPED presets
                 (`HUB_PRESET_BODY`). A pick lays the preset's Build in / Build out on the switches; a switch moved
                 by hand reads "Custom". */
              value: partHow,
              buttonText: partHow === 'custom' ? 'Custom' : undefined,
              options: [{ key: 'auto', label: 'Auto' }, ...HUB_MOTION_PRESETS.map((p) => ({ key: p, label: HUB_MOTION_PRESET_LABEL[p] }))],
              onPick: (k) => {
                if (k === 'auto') {
                  if (style.motion) commit(withoutMotion(latest.current.elements, target.el), 'motion');
                  return;
                }
                const fx = partPresetFx(k as HubMotionPreset, motion.timeline === 'scroll');
                let els = withElementMotion(latest.current.elements, target.el, 'in', fx.in);
                if (motion.timeline === 'scroll') els = withElementMotion(els, target.el, 'out', fx.out);
                commit(els, 'motion');
              },
            }}
            inFx={motion.in ?? null}
            outFx={motion.out ?? null}
            onIn={(fx) => moveTo('in', fx)}
            onOut={(fx) => {
              /* A part's Build out plays as guests scroll on — choosing one makes it follow the scroll. */
              if (fx && motion.timeline !== 'scroll') moveTo('timeline', 'scroll');
              moveTo('out', fx);
            }}
            duration={
              motionFxOn(motion.in)
                ? {
                    value: PART_SPEED_S[motion.speed ?? 'regular'],
                    steps: Object.values(PART_SPEED_S),
                    onPick: (sec) => {
                      const v = (Object.keys(PART_SPEED_S) as Array<keyof typeof PART_SPEED_S>).find((k) => PART_SPEED_S[k] === sec) ?? 'regular';
                      moveTo('speed', v === 'regular' ? null : v);
                    },
                  }
                : null
            }
            delay={
              motionFxOn(motion.in) && motion.timeline !== 'scroll'
                ? {
                    value: PART_DELAY_S[motion.delay ?? 'none'],
                    steps: Object.values(PART_DELAY_S),
                    onPick: (sec) => {
                      const v = (Object.keys(PART_DELAY_S) as Array<keyof typeof PART_DELAY_S>).find((k) => PART_DELAY_S[k] === sec) ?? 'none';
                      moveTo('delay', v === 'none' ? null : v);
                    },
                  }
                : null
            }
            does={{
              value: motion.during ?? 'still',
              options: HUB_EL_DURING_WORDS.map((v) => ({ key: v, label: HUB_EL_DURING_LABEL[v] })),
              onPick: (v) => moveTo('during', v === 'still' ? null : v),
              note: PART_DOES_NOTE[motion.during ?? 'still'],
            }}
            timing={{
              value: motion.timeline ?? 'once',
              options: HUB_EL_TIMELINE.map((t) => ({ key: t, label: HUB_EL_TIMELINE_LABEL[t] })),
              onPick: (t) => moveTo('timeline', t === 'once' ? null : t),
            }}
            next={{
              /* ◆ Into the next scene — the part's scene's own (Stage default = no pick of its own). */
              value: canvas.transition ?? 'stage',
              buttonText: canvas.transition ? undefined : `Stage default · ${HUB_TRANSITION_LABEL[resolveTransition({})]}`,
              options: [{ key: 'stage', label: 'Stage default' }, ...HUB_TRANSITIONS.map((t) => ({ key: t, label: HUB_TRANSITION_LABEL[t] }))],
              onPick: (t) =>
                commit(latest.current.elements ?? null, 'motion', (c) => {
                  delete c.transition;
                  delete c.autoSpeed;
                  if (t !== 'stage') c.transition = t as HubTransition;
                }),
            }}
          />
        ) : (
          <StageText
            el={target.el}
            pending={pending}
            extra={wordsSlot}
            fontPick={
              <span className={SP_DD} data-stage-dd="font">
                <FontPick
                  eventId={eventId}
                  label="Font"
                  dataAttr="data-element-font"
                  value={face.font ?? null}
                  lead="Event Hub font"
                  onPick={(key) => choose('font', key)}
                  className={SP_DD_BUTTON}
                />
              </span>
            }
            colours={themeColours}
            colour={face.color ?? null}
            onColour={(hex) => choose('color', hex)}
            customColour={
              <ColourWell
                value={face.color ?? null}
                shown={palette.ink}
                what={`the ${HUB_ELEMENT_LABEL[target.el].toLowerCase()}`}
                themeColours={themeColours}
                usedColours={usedColours}
                savedKey={`sn-maker-colours:${eventId}`}
                alpha
                onPreview={previewColour}
                onPick={(hex) => choose('color', hex)}
                data="element"
              />
            }
            contrast={
              contrast && !contrast.ok ? (
                <p className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-terracotta-700" role="status" data-element-contrast="low">
                  Hard to read here · {contrast.ratio.toFixed(1)}:1
                </p>
              ) : null
            }
            size={face.size}
            onSize={(v) => choose('size', v)}
          />
        )
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4" aria-busy={pending} data-element-tab={tab}>
        {tab === 'text' ? (
          <>
            {wordsSlot}
            <PartTextTab
              el={target.el}
              face={face}
              style={style}
              onRange={Boolean(range)}
              choose={choose}
              chooseAlign={(v) => commit(withElementAlign(latest.current.elements, target.el, v), 'align')}
              resetText={() => commit(withoutTextStyle(latest.current.elements, target.el), 'style')}
              themeColours={themeColours}
              usedColours={usedColours}
              shownColour={palette.ink}
              contrast={contrast}
              eventId={eventId}
              onPreviewColour={previewColour}
              fontMark={fontMark}
              hideFont={false}
              threeControls={stagesStudio}
            />
            {range && run ? (
              <div className="py-1.5">
                <IReset onClick={() => commit(withoutRuns(latest.current.elements, target.el, range), 'style')}>Clear this selection</IReset>
              </div>
            ) : null}
          </>
        ) : tab === 'animate' && !hidePro ? (
          <PartAnimateTab
            proMark={animateMark}
            buildWords={stagesStudio}
            motion={motion}
            moveTo={moveTo}
            onPreview={onPlay}
            resetMotion={style.motion ? () => commit(withoutMotion(latest.current.elements, target.el), 'motion') : null}
          />
        ) : (
          <PartArrangeTab
            el={target.el}
            hidden={Boolean(style.hidden)}
            setHidden={(h) => choose('hidden', h ? true : null)}
          />
        )}
        {error ? (
          <p role="alert" className="py-3 text-[12.5px] font-semibold text-terracotta-700">
            {error}
          </p>
        ) : null}
      </div>
      )}
    </aside>
    </>
  );
}

/**
 * 📱 Scroll the shown canvas so this part sits above the sheet (`lib/part-above-sheet.ts`).
 * The canvas is a same-origin frame (the Maker already reads it — `carryScroll`).
 */
export function keepPartAboveSheet(sheet: HTMLElement, key: string, el: string): void {
  try {
    const frame = document.querySelector<HTMLIFrameElement>('iframe[data-maker-canvas-frame="shown"]');
    const win = frame?.contentWindow;
    const doc = frame?.contentDocument;
    if (!frame || !win || !doc) return;
    const section = findMakerSection(doc, key);
    const part = section?.querySelector<HTMLElement>(`[data-el="${CSS.escape(el)}"]`) ?? section;
    if (!part) return;
    const r = part.getBoundingClientRect();
    const band = sheet.getBoundingClientRect().top - frame.getBoundingClientRect().top;
    const dy = scrollToClearSheet({ partTop: r.top, partHeight: r.height, band });
    if (dy !== 0) win.scrollBy({ top: dy, behavior: 'smooth' });
  } catch {
    /* a frame we cannot reach keeps its own scroll */
  }
}

/** A preset's Build in / Build out, as a part's four effects (the scene presets' own bodies, `HUB_PRESET_BODY`). */
function partPresetFx(p: HubMotionPreset, scroll: boolean): { in: MotionFx | null; out: MotionFx | null } {
  const b = HUB_PRESET_BODY[p];
  return { in: hubShippedFx(b.in, b.inFrom), out: scroll ? hubShippedFx(b.out, b.outTo) : null };
}
/** The shipped part speeds and delays in seconds (`lib/element-style.ts` DURATION_S · DELAY_S) — the sliders' stops. */
const PART_SPEED_S = { fast: 0.6, regular: 1.1, gentle: 1.8 } as const;
const PART_DELAY_S = { none: 0, short: 0.3, long: 0.8 } as const;
/** The prototype's line under Does ▾ (`DOES_SUB`), for the shipped words. */
const PART_DOES_NOTE: Record<string, string> = {
  still: 'Nothing happens while it is on screen',
  drift: 'Drifts up and down, slowly',
};
