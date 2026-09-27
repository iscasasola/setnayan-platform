'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { hubFontPreviewStack } from '@/lib/hub-fonts';
import {
  HUB_ELEMENT_ANIMS,
  HUB_ELEMENT_ANIM_LABEL,
  HUB_ELEMENT_FIELDS,
  HUB_ELEMENT_FONTS,
  HUB_ELEMENT_LABEL,
  HUB_ELEMENT_SIZES,
  HUB_ELEMENT_SIZE_LABEL,
  hubElementColor,
  hubElementContrast,
  withElementChoice,
  withoutElement,
  type HubElementField,
  type HubElementKey,
} from '@/lib/element-style';

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
}: {
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
  const choose = (field: HubElementField, value: string | null) =>
    commit(withElementChoice(latest.current.elements, target.el, field, value));

  /* The contrast warning — measured, never blocking (a quiet accent may be meant). */
  const ground = canvas.kind === 'color' && canvas.color ? canvas.color : palette.surface;
  const contrast = style.color ? hubElementContrast(style.color, ground) : null;
  const swatches = [...new Set([palette.ink, palette.heading, palette.accent, palette.muted].map((c) => c.toLowerCase()))];
  const custom = style.color && !swatches.includes(style.color) ? style.color : null;
  const titleId = 'maker-element-sheet-title';

  return (
    <aside
      role="dialog"
      aria-labelledby={titleId}
      data-maker-element-sheet={target.el}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="sn-glass-bare fixed inset-x-0 bottom-0 z-30 flex max-h-[55dvh] flex-col rounded-t-3xl pb-[max(env(safe-area-inset-bottom),12px)] lg:static lg:z-auto lg:order-3 lg:max-h-none lg:w-[340px] lg:shrink-0 lg:rounded-none"
    >
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

      <div className="min-h-0 flex-1 divide-y divide-ink/10 overflow-y-auto overflow-x-hidden px-4" aria-busy={pending}>
        {has('font') ? (
          <div className={ROW} data-element-row="font">
            <p className={LABEL}>Font</p>
            <div className="-my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
              <Chip on={!style.font} onClick={() => choose('font', null)}>
                Event Hub font
              </Chip>
              {HUB_ELEMENT_FONTS.map((f) => (
                <Chip key={f.key} on={style.font === f.key} onClick={() => choose('font', f.key)} fontFamily={hubFontPreviewStack(f.key)}>
                  {f.label}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        {has('color') ? (
          <div className="py-3" data-element-row="color">
            <div className="flex items-center gap-3">
              <p className={LABEL}>Colour</p>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {swatches.map((c) => (
                  <Swatch key={c} color={c} on={style.color === c} onClick={() => choose('color', c)} />
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
                    value={style.color ?? palette.ink}
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
                <Seg key={sz} on={(style.size ?? 'm') === sz} onClick={() => choose('size', sz === 'm' ? null : sz)}>
                  {HUB_ELEMENT_SIZE_LABEL[sz]}
                </Seg>
              ))}
            </Segmented>
          </div>
        ) : null}

        {has('anim') ? (
          <div className={ROW} data-element-row="anim">
            <p className={LABEL}>Animation</p>
            <Segmented>
              {HUB_ELEMENT_ANIMS.map((a) => (
                <Seg key={a} on={style.anim === a} onClick={() => choose('anim', a)}>
                  {HUB_ELEMENT_ANIM_LABEL[a]}
                </Seg>
              ))}
            </Segmented>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 py-3" data-element-row="resets">
          {style.font ? <Reset onClick={() => choose('font', null)}>Use the Event Hub font</Reset> : null}
          {style.color ? <Reset onClick={() => choose('color', null)}>Use the theme colour</Reset> : null}
          {style.anim ? <Reset onClick={() => choose('anim', null)}>Move with the scene</Reset> : null}
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

function Chip({
  on,
  onClick,
  fontFamily,
  children,
}: {
  on: boolean;
  onClick: () => void;
  fontFamily?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={fontFamily ? { fontFamily } : undefined}
      className={`sn-press inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[14px] transition-all duration-300 ease-in-out ${
        on ? 'bg-ink text-cream' : 'bg-ink/5 text-ink/80 hover:bg-ink/10'
      }`}
    >
      {children}
    </button>
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
