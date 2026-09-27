'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { ToolsResizeHandle, type ToolsResize } from './tools-resize';
import { hubFontPreviewStack } from '@/lib/hub-fonts';
import {
  HUB_EL_DELAY,
  HUB_EL_DELAY_LABEL,
  HUB_EL_DURATION,
  HUB_EL_DURATION_LABEL,
  HUB_EL_DURING_LABEL,
  HUB_EL_DURING_WORDS,
  HUB_EL_IN,
  HUB_EL_IN_LABEL,
  HUB_EL_OUT,
  HUB_EL_OUT_LABEL,
  HUB_EL_TIMELINE,
  HUB_EL_TIMELINE_LABEL,
  HUB_ELEMENT_FIELDS,
  HUB_ELEMENT_FONTS,
  HUB_ELEMENT_LABEL,
  HUB_ELEMENT_RUN_KEYS,
  HUB_ELEMENT_SIZES,
  HUB_ELEMENT_SIZE_LABEL,
  hubElementColor,
  hubElementContrast,
  withElementChoice,
  withElementMotion,
  withRunChoice,
  withoutElement,
  withoutMotion,
  withoutRuns,
  type HubElementField,
  type HubElementKey,
  type HubElementMotion,
  type HubElementRun,
} from '@/lib/element-style';
import { PickMenu } from './pick-menu';
import { Play } from 'lucide-react';

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
 * and background ride along untouched. A free couple may try it; it goes live
 * at Apply, where Event Hub Pro is asked for (`canvasLookChange`).
 *
 * 🔑 THE LATEST CANVAS IS A REF, NOT THE PROP. Two quick taps would otherwise
 * both build on the canvas from before the first save, and the second would
 * silently undo the first.
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
   * the choices style the whole part.
   */
  range?: { start: number; end: number; of: string; text: string } | null;
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
  return draftAction(eventId, fd);
}

const ROW = 'flex items-center gap-3 py-3';
const LABEL = 'w-[4.5rem] shrink-0 text-[13px] font-semibold text-ink';

export function ElementSheet({
  eventId,
  target,
  canvas,
  palette,
  ownsPro,
  draftAction,
  onClose,
  resize,
  onPlay,
}: {
  /** The tools column's width and drag handle, shared with the inspector (desktop). */
  resize?: ToolsResize;
  /** ▶ Replay this part's In on the canvas (the bridge's `playEl`). */
  onPlay?: () => void;
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
  const latest = useRef<HubSectionCanvas>(canvas);
  const [style, setStyle] = useState(canvas.elements?.[target.el] ?? {});
  const canvasJson = JSON.stringify(canvas);

  /* A fresh canvas from the server (after the refresh) is the truth again. */
  useEffect(() => {
    latest.current = canvas;
    setStyle(canvas.elements?.[target.el] ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasJson, target.el, target.widgetType]);

  const fields = HUB_ELEMENT_FIELDS[target.el];
  const has = (f: HubElementField) => fields.includes(f);

  const commit = (elements: HubSectionCanvas['elements'] | null) => {
    const next: HubSectionCanvas = { ...latest.current };
    if (elements) next.elements = elements;
    else delete next.elements;
    latest.current = next;
    setStyle(next.elements?.[target.el] ?? {});
    setError(null);
    start(async () => {
      const res = await saveCanvas(draftAction, eventId, target.widgetType, next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };
  /* ✍ A selection inside the part's text makes font · colour · size a RUN; the
     couple can drop back to the whole part with one tap. */
  const [useRange, setUseRange] = useState(true);
  useEffect(() => setUseRange(true), [target.range?.start, target.range?.end, target.range?.of]);
  const range = target.range && useRange && HUB_ELEMENT_RUN_KEYS.includes(target.el) ? target.range : null;
  const run: HubElementRun | null = range
    ? ((style.of === range.of ? style.runs : undefined)?.find((r) => r.start === range.start && r.end === range.end) ?? null)
    : null;
  /** What the font · colour · size controls show: the run's own, or the part's. */
  const face = range ? { font: run?.font, color: run?.color, size: run?.size } : style;

  const choose = (field: Exclude<HubElementField, 'motion'>, value: string | null) =>
    commit(
      range
        ? withRunChoice(latest.current.elements, target.el, range, field, value)
        : withElementChoice(latest.current.elements, target.el, field, value),
    );
  const motion: HubElementMotion = style.motion ?? {};
  const moveTo = (part: keyof HubElementMotion, value: string | null) =>
    commit(withElementMotion(latest.current.elements, target.el, part, value));
  const scroll = motion.timeline === 'scroll';

  /* The contrast warning — measured, never blocking (a quiet accent may be meant). */
  const ground = canvas.kind === 'color' && canvas.color ? canvas.color : palette.surface;
  const contrast = face.color ? hubElementContrast(face.color, ground) : null;
  const swatches = [...new Set([palette.ink, palette.heading, palette.accent, palette.muted].map((c) => c.toLowerCase()))];
  const custom = face.color && !swatches.includes(face.color) ? face.color : null;
  const titleId = 'maker-element-sheet-title';

  return (
    <aside
      role="dialog"
      aria-labelledby={titleId}
      data-maker-element-sheet={target.el}
      style={resize ? { ['--maker-tools-w' as string]: `${resize.width}px` } : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="sn-glass-bare fixed inset-x-0 bottom-0 z-30 flex max-h-[55dvh] flex-col rounded-t-3xl pb-[max(env(safe-area-inset-bottom),12px)] lg:relative lg:z-auto lg:order-3 lg:max-h-none lg:w-[var(--maker-tools-w,340px)] lg:shrink-0 lg:rounded-none"
    >
      {resize ? <ToolsResizeHandle onPointerDown={resize.onPointerDown} /> : null}
      <span aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink/15 lg:hidden" />
      <div className="flex items-center gap-2 px-4 pt-2">
        <p id={titleId} className="min-w-0 flex-1 truncate font-serif text-lg text-ink">
          {HUB_ELEMENT_LABEL[target.el]}
          <PaidMark
            state={ownsPro ? 'unlocked' : 'locked'}
            text="Pro"
            label={paidMarkLabel(ownsPro ? 'unlocked' : 'locked', 'Event Hub Pro')}
            className="ml-2 align-middle"
          />
        </p>
        <InfoTip label="" ariaLabel="About this element" align="end">
          Changes this element only — the rest keeps the Event Hub&rsquo;s look. Until you choose, it wears the
          Event Hub font and colour and moves with its scene.
          {ownsPro ? '' : ' Try it here; it goes live when you Apply with Event Hub Pro.'}
        </InfoTip>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sn-press inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 text-ink/70 transition-colors duration-300 ease-in-out hover:bg-ink/10 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {target.range && HUB_ELEMENT_RUN_KEYS.includes(target.el) ? (
        <div className="flex items-center gap-2 px-4 pt-2" data-element-range="">
          <Seg on={useRange} onClick={() => setUseRange(true)}>
            “{target.range.text.length > 14 ? `${target.range.text.slice(0, 13)}…` : target.range.text}”
          </Seg>
          <Seg on={!useRange} onClick={() => setUseRange(false)}>
            Whole {HUB_ELEMENT_LABEL[target.el].toLowerCase()}
          </Seg>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 divide-y divide-ink/10 overflow-y-auto overflow-x-hidden px-4" aria-busy={pending}>
        {has('font') ? (
          <div className={ROW} data-element-row="font">
            <p className={LABEL}>Font</p>
            {/* ▾ A DROPDOWN, each face drawn in itself (owner 2026-09-27: "font
                should be a drop down"); "Event Hub font" at the top is the reset. */}
            <PickMenu
              label="Font"
              dataAttr="data-element-font"
              value={face.font ?? 'hub'}
              options={[
                { key: 'hub', label: 'Event Hub font' },
                ...HUB_ELEMENT_FONTS.map((f) => ({ key: f.key, label: f.label, fontFamily: hubFontPreviewStack(f.key) })),
              ]}
              onPick={(key) => choose('font', key === 'hub' ? null : key)}
              className="flex-1"
            />
          </div>
        ) : null}

        {has('color') ? (
          <div className="py-3" data-element-row="color">
            <div className="flex items-center gap-3">
              <p className={LABEL}>Colour</p>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {swatches.map((c) => (
                  <Swatch key={c} color={c} on={face.color === c} onClick={() => choose('color', c)} />
                ))}
                <label
                  className={`sn-press relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[18px] text-ink/70 transition-all duration-300 ease-in-out ${
                    custom ? 'ring-2 ring-ink ring-offset-2' : 'bg-ink/5 hover:bg-ink/10'
                  }`}
                  style={custom ? { background: custom } : undefined}
                  title="Your own colour"
                >
                  {custom ? null : <span aria-hidden>+</span>}
                  <span className="sr-only">Your own colour</span>
                  <input
                    type="color"
                    value={face.color ?? palette.ink}
                    onChange={(e) => {
                      const c = hubElementColor(e.target.value);
                      if (c) choose('color', c);
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
            {contrast && !contrast.ok ? (
              <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-terracotta-700" role="status" data-element-contrast="low">
                Hard to read here · {contrast.ratio.toFixed(1)}:1
                <InfoTip label="" ariaLabel="Why it is hard to read" align="center">
                  Words need about 4.5:1 against their background for every guest to read them easily. You can still keep this colour.
                </InfoTip>
              </p>
            ) : null}
          </div>
        ) : null}

        {has('size') ? (
          <div className={ROW} data-element-row="size">
            <p className={LABEL}>Size</p>
            <Segmented>
              {HUB_ELEMENT_SIZES.map((sz) => (
                <Seg key={sz} on={(face.size ?? 'm') === sz} onClick={() => choose('size', sz === 'm' ? null : sz)}>
                  {HUB_ELEMENT_SIZE_LABEL[sz]}
                </Seg>
              ))}
            </Segmented>
          </div>
        ) : null}

        {has('motion') && !range ? (
          <div className="space-y-2.5 py-3" data-element-row="motion">
            <div className="flex items-center gap-3">
              <p className={LABEL}>Motion</p>
              <Segmented>
                {HUB_EL_TIMELINE.map((t) => (
                  <Seg key={t} on={(motion.timeline ?? 'once') === t} onClick={() => moveTo('timeline', t === 'once' ? null : t)}>
                    {HUB_EL_TIMELINE_LABEL[t]}
                  </Seg>
                ))}
              </Segmented>
            </div>
            {/* In and During play TOGETHER — choosing one never clears the other. */}
            <MotionRow label="In" data="in">
              {HUB_EL_IN.map((v) => (
                <Seg key={v} on={(motion.in ?? 'none') === v} onClick={() => moveTo('in', v === 'none' ? null : v)}>
                  {HUB_EL_IN_LABEL[v]}
                </Seg>
              ))}
            </MotionRow>
            <MotionRow label="During" data="during">
              {HUB_EL_DURING_WORDS.map((v) => (
                <Seg key={v} on={(motion.during ?? 'still') === v} onClick={() => moveTo('during', v === 'still' ? null : v)}>
                  {HUB_EL_DURING_LABEL[v]}
                </Seg>
              ))}
            </MotionRow>
            {scroll ? (
              <MotionRow label="Out" data="out">
                {HUB_EL_OUT.map((v) => (
                  <Seg key={v} on={(motion.out ?? 'stay') === v} onClick={() => moveTo('out', v === 'stay' ? null : v)}>
                    {HUB_EL_OUT_LABEL[v]}
                  </Seg>
                ))}
              </MotionRow>
            ) : null}
            {/* Timed: Duration and Delay apply. Following the scroll: distance is
                the control, so they dim. */}
            <div className={scroll || !motion.in ? 'pointer-events-none opacity-40' : ''} aria-disabled={scroll || !motion.in}>
              <MotionRow label="Duration" data="duration">
                {HUB_EL_DURATION.map((v) => (
                  <Seg key={v} on={(motion.duration ?? 'normal') === v} onClick={() => moveTo('duration', v === 'normal' ? null : v)}>
                    {HUB_EL_DURATION_LABEL[v]}
                  </Seg>
                ))}
              </MotionRow>
              <div className="h-2.5" />
              <MotionRow label="Delay" data="delay">
                {HUB_EL_DELAY.map((v) => (
                  <Seg key={v} on={(motion.delay ?? 'none') === v} onClick={() => moveTo('delay', v === 'none' ? null : v)}>
                    {HUB_EL_DELAY_LABEL[v]}
                  </Seg>
                ))}
              </MotionRow>
            </div>
            {onPlay && motion.in ? (
              <button
                type="button"
                onClick={onPlay}
                data-element-play=""
                className="sn-press inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-semibold text-cream transition-colors duration-300 ease-in-out hover:bg-ink/90"
              >
                <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Play
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 py-3" data-element-row="resets">
          {face.font ? <Reset onClick={() => choose('font', null)}>Use the Event Hub font</Reset> : null}
          {face.color ? <Reset onClick={() => choose('color', null)}>Use the theme colour</Reset> : null}
          {range && run ? (
            <Reset onClick={() => commit(withoutRuns(latest.current.elements, target.el, range))}>Clear this selection</Reset>
          ) : null}
          {!range && style.motion ? (
            <Reset onClick={() => commit(withoutMotion(latest.current.elements, target.el))}>Move with the scene</Reset>
          ) : null}
          {Object.keys(style).length > 1 ? (
            <Reset onClick={() => commit(withoutElement(latest.current.elements, target.el))}>Reset this element</Reset>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="pb-3 text-[12.5px] font-semibold text-terracotta-700">
            {error}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function MotionRow({ label, data, children }: { label: string; data: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3" data-element-motion={data}>
      <p className="w-[4.5rem] shrink-0 text-[12px] font-semibold text-ink/70">{label}</p>
      <Segmented>{children}</Segmented>
    </div>
  );
}

function Swatch({ color, on, onClick }: { color: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Colour ${color}`}
      onClick={onClick}
      style={{ background: color }}
      className={`sn-press h-9 w-9 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)] transition-all duration-300 ease-in-out ${
        on ? 'ring-2 ring-ink ring-offset-2' : ''
      }`}
    />
  );
}

function Segmented({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-full bg-ink/5 p-0.5 [scrollbar-width:none]">{children}</div>;
}

function Seg({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`sn-press min-h-10 flex-1 whitespace-nowrap rounded-full px-1.5 text-[12.5px] font-semibold transition-all duration-300 ease-in-out ${
        on ? 'bg-white text-ink shadow-sm' : 'text-ink/65 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function Reset({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="sn-press inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink/5 px-3.5 text-[13px] font-semibold text-ink/80 transition-all duration-300 ease-in-out hover:bg-ink/10"
    >
      <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}
