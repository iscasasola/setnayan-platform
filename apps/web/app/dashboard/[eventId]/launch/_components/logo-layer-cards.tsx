'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleDashed, ImagePlus, Lock, Plus, Type } from 'lucide-react';
import type { LogoLayer } from '@/lib/logo-layers';
import { LOGO_LAYER_KIND_LABEL, layerShapes } from '@/lib/logo-layers-edit';
import { cardDropIndex, LOGO_CARD_H_PX, LOGO_CARD_HALF_PX } from '@/lib/logo-maker-layout';
import { PickMenu } from '../../website/editor/_components/pick-menu';

/**
 * 🃏 THE LAYERS CAROUSEL (owner 2026-10-08, LOGO_MAKER_REPLOT L2 + the 08 Oct addenda; prototype
 * `logo_maker_replot_2026-10-08_fable.html` `.lyrs` / `.card`): one card per layer, TOP of the stack first — the
 * layer's own shapes in its colour, its name under. The picked card wears the accent. A hidden layer's card is faded
 * and says "hidden"; a locked one carries a lock. HOLD a card, then drag it to reorder (a quick flick scrolls the
 * strip). The picked card carries ONE ⋯ dropdown — Hide · Lock · Duplicate · Delete (owner 08 Oct: the four chips on
 * the logo are "not needed anymore"; they live on the card). The last card is ＋ Add layer.
 *
 * A phone draws it as one sideways strip where the event bar was; a desk as the left column — the same cards, one
 * component, only the CSS moves (the drag reads which way the strip runs when it starts).
 *
 * Ported by hand from the unwired WIP `rd/logo-maker-l2-wip` @ c851df68e (never merged — it was far behind main).
 */
const HOLD_MS = 160;
const SLOP_PX = 6;
/** The desk's column: a card is as wide as the column, so "over" is measured down it, by half a card's height. */
const DESK_QUERY = '(min-width: 1024px)';

export type LayerCardAction = 'hide' | 'lock' | 'duplicate' | 'delete';

/** What a card is called: a text layer still named "Text" shows its words. */
export function cardName(l: Pick<LogoLayer, 'kind' | 'name' | 'text'>): string {
  return l.kind === 'text' && l.name === LOGO_LAYER_KIND_LABEL.text ? l.text?.trim() || 'Text' : l.name;
}

export function LogoLayerCards({
  layers,
  selectedId,
  onPick,
  onMoveTo,
  onAction,
  onAdd,
  addOn,
  addDisabled,
}: {
  /** Bottom of the stack first, as the logo holds them. */
  layers: readonly LogoLayer[];
  selectedId: string | null;
  onPick: (id: string) => void;
  /** Move a layer to a new place in the STACK (0 = bottom). */
  onMoveTo: (id: string, stackIndex: number) => void;
  onAction: (id: string, action: LayerCardAction) => void;
  onAdd: () => void;
  /** The Add list is open. */
  addOn: boolean;
  addDisabled: boolean;
}) {
  const topFirst = layers.slice().reverse();
  const stripRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: string; x0: number; y0: number; timer: number; held: boolean; down: boolean } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number; down: boolean } | null>(null);

  /* While a card is held, the strip must not scroll: a non-passive touchmove is the only way iOS listens. */
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => {
      if (press.current?.held) e.preventDefault();
    };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  const cardMids = (down: boolean) =>
    [...(stripRef.current?.querySelectorAll<HTMLElement>('[data-logo-layer-card]') ?? [])].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.getAttribute('data-logo-layer-card') as string, mid: down ? r.top + r.height / 2 : r.left + r.width / 2 };
    });

  const onDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return;
    const down = typeof window !== 'undefined' && (window.matchMedia?.(DESK_QUERY).matches ?? false);
    const timer = window.setTimeout(() => {
      if (press.current) {
        press.current.held = true;
        setDragging({ id, dx: 0, down });
      }
    }, HOLD_MS);
    press.current = { id, x0: e.clientX, y0: e.clientY, timer, held: false, down };
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p) return;
    const along = p.down ? e.clientY - p.y0 : e.clientX - p.x0;
    const across = p.down ? e.clientX - p.x0 : e.clientY - p.y0;
    if (!p.held) {
      // A move before the hold is a scroll of the strip — let it be one.
      if (Math.abs(along) > SLOP_PX || Math.abs(across) > SLOP_PX) {
        window.clearTimeout(p.timer);
        press.current = null;
      }
      return;
    }
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ id: p.id, dx: along, down: p.down });
    const mids = cardMids(p.down);
    const from = mids.findIndex((m) => m.id === p.id);
    const to = cardDropIndex(
      mids.map((m) => m.mid),
      from,
      p.down ? e.clientY : e.clientX,
      p.down ? LOGO_CARD_H_PX / 2 : LOGO_CARD_HALF_PX,
    );
    if (from >= 0 && to !== from) {
      // Strip index (top first) → stack index (bottom first).
      onMoveTo(p.id, layers.length - 1 - to);
      if (p.down) p.y0 = e.clientY;
      else p.x0 = e.clientX;
      setDragging({ id: p.id, dx: 0, down: p.down });
    }
  };
  const onUp = (id: string) => {
    const p = press.current;
    press.current = null;
    setDragging(null);
    if (p) window.clearTimeout(p.timer);
    // A tap (or a hold that ended where it began) picks the layer.
    if (p && p.id === id) onPick(id);
  };
  const onCancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setDragging(null);
  };

  return (
    <div
      ref={stripRef}
      role="list"
      aria-label="Layers — top of the stack first. Hold a card, then drag it to reorder."
      data-logo-layer-cards=""
      className="flex h-full min-h-0 items-stretch gap-2 overflow-x-auto overflow-y-hidden overscroll-contain px-3 py-[3px] [scrollbar-width:none] lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:px-2 lg:pb-3 [&::-webkit-scrollbar]:hidden"
    >
      {topFirst.map((l) => {
        const on = l.id === selectedId;
        const drag = dragging?.id === l.id ? dragging : null;
        const name = cardName(l);
        return (
          <div
            key={l.id}
            role="listitem"
            data-logo-layer-card={l.id}
            data-on={on ? '' : undefined}
            data-hidden={l.hidden ? '' : undefined}
            data-locked={l.locked ? '' : undefined}
            className={`relative flex w-[66px] shrink-0 flex-col self-stretch overflow-hidden lg:h-[74px] rounded-xl bg-raised ring-1 transition-[transform,box-shadow] duration-150 motion-reduce:transition-none lg:w-full ${
              on ? 'ring-2 ring-sn-accent' : 'ring-ink/10'
            } ${drag ? 'z-10 shadow-lg' : ''}`}
            style={drag ? { transform: `${drag.down ? 'translateY' : 'translateX'}(${drag.dx}px) scale(1.06)` } : undefined}
          >
            <button
              type="button"
              aria-pressed={on}
              aria-label={`${name}${l.hidden ? ' (hidden)' : ''}${l.locked ? ' (locked)' : ''} — ${on ? 'picked' : 'pick this layer'}`}
              data-logo-layer-row={l.id}
              onPointerDown={(e) => onDown(e, l.id)}
              onPointerMove={onMove}
              onPointerUp={() => onUp(l.id)}
              onPointerCancel={onCancel}
              onClick={(e) => {
                // Keyboard: Enter / Space pick (a pointer already picked on its way up).
                if (e.detail === 0) onPick(l.id);
              }}
              className="flex min-h-0 flex-1 touch-pan-x select-none flex-col [-webkit-touch-callout:none] lg:touch-pan-y"
            >
              {/* The thumbnail is the logo's own white artboard (as the workspace's), in light and dark alike. */}
              <span className={`flex min-h-0 w-full flex-1 items-center justify-center bg-white p-1.5 ${l.hidden ? 'opacity-30' : ''}`}>
                {l.body ? (
                  <svg
                    viewBox={`0 0 ${Math.max(1, l.w)} ${Math.max(1, l.h)}`}
                    className="h-full w-full overflow-visible"
                    aria-hidden
                    dangerouslySetInnerHTML={{ __html: layerShapes(l) }}
                  />
                ) : null}
              </span>
              <span
                className={`block h-5 w-full truncate border-t px-1 text-center text-[10.5px] font-semibold leading-5 ${
                  on ? 'border-transparent bg-sn-accent text-sn-on-accent' : 'border-ink/10 text-ink/75'
                }`}
              >
                {name}
              </span>
            </button>
            {l.locked || l.hidden ? (
              <span
                aria-hidden
                data-logo-card-state={l.locked ? 'locked' : 'hidden'}
                className="pointer-events-none absolute bottom-[22px] left-1 inline-flex h-4 items-center gap-0.5 rounded-full bg-raised px-1 text-[9px] font-semibold text-ink/70 ring-1 ring-ink/15"
              >
                {l.locked ? <Lock className="h-2.5 w-2.5" strokeWidth={2.5} /> : 'hidden'}
              </span>
            ) : null}
            {on ? (
              <span className="absolute right-0.5 top-0.5" data-logo-layer-more="">
                <PickMenu
                  label={`${name} — actions`}
                  value={null}
                  buttonText="⋯"
                  compact
                  options={[
                    { key: 'hide', label: l.hidden ? 'Show' : 'Hide' },
                    { key: 'lock', label: l.locked ? 'Unlock' : 'Lock' },
                    { key: 'duplicate', label: 'Duplicate' },
                    { key: 'delete', label: 'Delete' },
                  ]}
                  onPick={(k) => onAction(l.id, k as LayerCardAction)}
                  className="!min-h-6 !gap-0 !px-1.5 !py-0 bg-raised text-[12px]"
                />
              </span>
            ) : null}
          </div>
        );
      })}
      <div role="listitem" className="flex shrink-0 self-stretch lg:w-full">
        <button
          type="button"
          className={`sn-press flex w-[66px] shrink-0 flex-col self-stretch overflow-hidden rounded-xl border border-dashed lg:h-[74px] disabled:opacity-50 lg:w-full ${
            addOn ? 'border-sn-accent bg-ink/[0.04]' : 'border-ink/25'
          }`}
          data-logo-add-card=""
          aria-pressed={addOn}
          disabled={addDisabled}
          onClick={onAdd}
        >
          <span className="flex min-h-0 w-full flex-1 items-center justify-center text-sn-accent">
            <Plus aria-hidden className="h-5 w-5" />
          </span>
          <span className="block h-5 w-full truncate px-1 text-center text-[10.5px] font-semibold leading-5 text-sn-accent">Add layer</span>
        </button>
      </div>
    </div>
  );
}

/** The kinds a layer can be added as — ONE list (the prototype's "Add a layer" sheet), each with its line. */
export const LOGO_ADD_KINDS = [
  { kind: 'text', label: 'Text', hint: 'Words in one of your fonts' },
  { kind: 'image', label: 'Image', hint: 'From your phone — white is removed' },
  { kind: 'frame', label: 'Frame', hint: 'Ring · Diamond · Arch · Cartouche…' },
  /* ❦ L5 (owner 2026-10-08 "approve add ornament") — the prototype's fourth row, its words. */
  { kind: 'ornament', label: 'Ornament', hint: 'A flourish, a leaf, a star' },
] as const;
export type LogoAddKind = (typeof LOGO_ADD_KINDS)[number]['kind'];

const ADD_ICON: Record<LogoAddKind, ReactNode> = {
  text: <Type aria-hidden className="h-4 w-4" />,
  image: <ImagePlus aria-hidden className="h-4 w-4" />,
  frame: <CircleDashed aria-hidden className="h-4 w-4" />,
  /* The prototype's ❦ — drawn here as the leaf's own blade (no new icon module: the Maker's first load had 0.1 KB left). */
  ornament: (
    <svg aria-hidden viewBox="0 0 200 200" className="h-4 w-4" fill="currentColor">
      <path d="M100 58C84 34 48 26 30 52C12 80 34 120 62 146C76 160 90 172 100 196C110 172 124 160 138 146C166 120 188 80 170 52C152 26 116 34 100 58Z" />
    </svg>
  ),
};

/**
 * ＋ ADD A LAYER (L2) — drawn IN the tools panel, under the carousel (nothing opens over the workspace): one row per
 * kind, the kind's icon, its name and its one line, as the prototype's sheet lists them: Text · Image · Frame · Ornament.
 */
export function LogoAddLayer({ disabled, onAdd, children }: { disabled: boolean; onAdd: (kind: LogoAddKind) => void; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1" data-logo-add="">
      <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">Add a layer</p>
      {LOGO_ADD_KINDS.map((k) => (
        <button
          key={k.kind}
          type="button"
          disabled={disabled}
          data-logo-add-kind={k.kind}
          onClick={() => onAdd(k.kind)}
          className="sn-press flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-ink/5 disabled:opacity-50"
        >
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-raised text-ink ring-1 ring-ink/10">{ADD_ICON[k.kind]}</span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-medium text-ink">{k.label}</span>
            <small className="block truncate text-[11.5px] text-ink/55">{k.hint}</small>
          </span>
        </button>
      ))}
      {children}
    </div>
  );
}
