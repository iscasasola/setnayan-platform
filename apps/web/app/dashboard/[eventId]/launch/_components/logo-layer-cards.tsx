'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { layerShapes, LOGO_LAYER_KIND_LABEL, type LogoLayer } from '@/lib/logo-layers';
import { cardDropIndex } from '@/lib/logo-maker-layout';
import { PickMenu } from '../../website/editor/_components/pick-menu';

/**
 * 🃏 THE LAYERS CAROUSEL (owner 2026-10-08, LOGO_MAKER_REPLOT L2 + addenda; prototype
 * `logo_maker_replot_2026-10-08_fable.html` `.lyrs` / `.card`): one card per layer, TOP of the stack
 * first — the layer's own shapes in its colour, its name under. The picked card is dark. HOLD a card,
 * then drag it sideways to reorder (a quick flick scrolls the strip). The picked card carries ONE ⋯
 * dropdown (the layer's actions — owner: no chips on the logo). The last card ＋ Add layer.
 *
 * A phone draws it as one sideways strip; a desk as the left column — the same cards, one component.
 */
const HOLD_MS = 160;
const SLOP_PX = 6;

export type LayerCardAction = 'duplicate' | 'delete';

export function LogoLayerCards({
  layers,
  selectedId,
  onPick,
  onMoveTo,
  onAction,
  onAdd,
  addOn,
  addDisabled,
  vertical = false,
}: {
  /** Bottom of the stack first, as the logo holds them. */
  layers: readonly LogoLayer[];
  selectedId: string | null;
  onPick: (id: string) => void;
  /** Move a layer to a new place in the STACK (0 = bottom). */
  onMoveTo: (id: string, stackIndex: number) => void;
  onAction: (id: string, action: LayerCardAction) => void;
  onAdd: () => void;
  /** The Add sheet is open. */
  addOn: boolean;
  addDisabled: boolean;
  vertical?: boolean;
}) {
  const topFirst = layers.slice().reverse();
  const stripRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: string; x0: number; y0: number; timer: number; held: boolean } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number } | null>(null);

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

  const cardRects = () =>
    [...(stripRef.current?.querySelectorAll<HTMLElement>('[data-logo-layer-card]') ?? [])].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.getAttribute('data-logo-layer-card')!, mid: vertical ? r.top + r.height / 2 : r.left + r.width / 2 };
    });

  const onDown = (e: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return;
    const at = { x0: e.clientX, y0: e.clientY };
    const timer = window.setTimeout(() => {
      if (press.current) {
        press.current.held = true;
        setDragging({ id, dx: 0 });
      }
    }, HOLD_MS);
    press.current = { id, ...at, timer, held: false };
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p) return;
    const d = vertical ? e.clientY - p.y0 : e.clientX - p.x0;
    if (!p.held) {
      // A move before the hold is a scroll of the strip — let it be one.
      if (Math.abs(d) > SLOP_PX || Math.abs((vertical ? e.clientX - p.x0 : e.clientY - p.y0)) > SLOP_PX) {
        window.clearTimeout(p.timer);
        press.current = null;
      }
      return;
    }
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ id: p.id, dx: d });
    const rects = cardRects();
    const from = rects.findIndex((r) => r.id === p.id);
    const to = cardDropIndex(rects.map((r) => r.mid), from, vertical ? e.clientY : e.clientX);
    if (to !== from && to >= 0) {
      // Strip index (top first) → stack index (bottom first).
      onMoveTo(p.id, layers.length - 1 - to);
      if (vertical) p.y0 = e.clientY;
      else p.x0 = e.clientX;
      setDragging({ id: p.id, dx: 0 });
    }
  };
  const onUp = (id: string) => {
    const p = press.current;
    press.current = null;
    setDragging(null);
    if (p) window.clearTimeout(p.timer);
    // A tap (or a hold that never moved) picks the layer.
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
      className={
        vertical
          ? 'flex flex-col gap-2 px-2 pb-3'
          : 'flex h-[74px] shrink-0 items-stretch gap-2 overflow-x-auto overflow-y-hidden px-3 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      }
    >
      {topFirst.map((l) => {
        const on = l.id === selectedId;
        const drag = dragging?.id === l.id;
        const name = l.kind === 'text' && l.name === LOGO_LAYER_KIND_LABEL.text ? l.text?.trim() || 'Text' : l.name;
        return (
          <div
            key={l.id}
            role="listitem"
            data-logo-layer-card={l.id}
            data-on={on ? '' : undefined}
            className={`relative flex shrink-0 flex-col overflow-hidden rounded-xl bg-white ring-1 transition-[transform,box-shadow] duration-150 ${
              vertical ? 'h-[74px] w-full' : 'w-[66px]'
            } ${on ? 'ring-[1.5px] ring-ink' : 'ring-ink/10'} ${drag ? 'z-10 scale-105 shadow-lg' : ''}`}
            style={drag && dragging ? { transform: `${vertical ? 'translateY' : 'translateX'}(${dragging.dx}px) scale(1.05)` } : undefined}
          >
            <button
              type="button"
              aria-pressed={on}
              aria-label={`${name} — ${on ? 'picked' : 'pick this layer'}`}
              data-logo-layer-row={l.id}
              onPointerDown={(e) => onDown(e, l.id)}
              onPointerMove={onMove}
              onPointerUp={() => onUp(l.id)}
              onPointerCancel={onCancel}
              onClick={(e) => {
                // Keyboard: Enter / Space pick (a pointer already picked on its way up).
                if (e.detail === 0) onPick(l.id);
              }}
              className="flex min-h-0 flex-1 select-none flex-col [-webkit-touch-callout:none]"
            >
              <span className="flex min-h-0 flex-1 items-center justify-center bg-cream p-1.5">
                {l.body ? (
                  <svg viewBox={`0 0 ${Math.max(1, l.w)} ${Math.max(1, l.h)}`} className="h-full w-full" aria-hidden dangerouslySetInnerHTML={{ __html: layerShapes(l) }} />
                ) : null}
              </span>
              <span
                className={`block h-5 truncate border-t px-1 text-center text-[10.5px] font-semibold leading-5 ${
                  on ? 'border-ink bg-ink text-cream' : 'border-ink/10 text-ink/75'
                }`}
              >
                {name}
              </span>
            </button>
            {on ? (
              <span className="absolute right-0.5 top-0.5" data-logo-layer-more="">
                <PickMenu
                  label={`${name} — actions`}
                  value={null}
                  buttonText="⋯"
                  compact
                  options={[
                    { key: 'duplicate', label: 'Duplicate' },
                    { key: 'delete', label: 'Delete' },
                  ]}
                  onPick={(k) => onAction(l.id, k as LayerCardAction)}
                  className="!min-h-6 !px-1.5 !py-0 bg-white/90 text-[12px]"
                />
              </span>
            ) : null}
          </div>
        );
      })}
      <div role="listitem" className={`flex shrink-0 ${vertical ? 'w-full' : ''}`}>
        <button
          type="button"
          data-logo-add-card=""
          aria-pressed={addOn}
          disabled={addDisabled}
          onClick={onAdd}
          className={`flex shrink-0 flex-col overflow-hidden rounded-xl border border-dashed disabled:opacity-50 ${
            vertical ? 'h-[74px] w-full' : 'w-[66px]'
          } ${addOn ? 'border-ink bg-ink/[0.04]' : 'border-ink/25'}`}
        >
          <span className="flex min-h-0 flex-1 items-center justify-center text-terracotta-700">
            <Plus aria-hidden className="h-5 w-5" />
          </span>
          <span className="block h-5 truncate px-1 text-center text-[10.5px] font-semibold leading-5 text-terracotta-700">Add layer</span>
        </button>
      </div>
    </div>
  );
}
