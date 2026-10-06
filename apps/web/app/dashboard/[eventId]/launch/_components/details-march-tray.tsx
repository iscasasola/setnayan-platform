'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { MarchOut } from '@/lib/march-drag';

/**
 * 🚶 THE "NOT WALKING" TRAY (owner, live iPhone 2026-10-06, DECISION_LOG "THE
 * WEDDING MARCH ITEM IS A DRAG-AND-DROP MARCH MAKER"): *"we want a scroll-less
 * screen there. Just show screen for those not added or will not walk the
 * isle."*
 *
 * The phone's lower third under the march (the right panel on a desk): the
 * people with a role who do not walk, as name chips — drag one into the march
 * to add them, drag a name from the march onto the tray to take them out. The
 * drags themselves are the march maker's (`details-march.tsx`); this draws the
 * chips and keeps them on one screen.
 *
 * 📏 SCROLL-LESS, BY MEASUREMENT: the chips wrap inside a box that never
 * scrolls; when they do not all fit, the last place is "+N more", which opens
 * the whole list as a sheet. Measured after layout (`useFit`) — and again when
 * the box is resized (a phone turned, the lower third shown after being hidden).
 */

export const OUT_CHIP =
  // no-card-ok: a NAME you drag (a pressable chip), not a container.
  'inline-flex min-h-11 max-w-full cursor-grab touch-pan-y select-none items-center rounded-full border border-ink/15 bg-white px-3 text-[13.5px] leading-tight text-ink [-webkit-touch-callout:none] [overflow-wrap:anywhere]';

/** How many chips fit the box with "+N more" after them (all of them: no "+N more"). */
function useFit(box: React.RefObject<HTMLElement | null>, count: number): number {
  const [shown, setShown] = useState(count);
  const [tick, setTick] = useState(0);
  // A new list, or a new size: start from all of them and measure again.
  useEffect(() => setShown(count), [count, tick]);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = '';
    const ro = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect;
      const key = r ? `${Math.round(r.width)}x${Math.round(r.height)}` : '';
      if (key !== last) {
        last = key;
        setTick((t) => t + 1);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [box]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const limit = el.getBoundingClientRect().bottom + 0.5;
    const chips = [...el.querySelectorAll<HTMLElement>('[data-tray-chip]')];
    const more = el.querySelector<HTMLElement>('[data-tray-more]');
    const over = (n: HTMLElement) => n.getBoundingClientRect().bottom > limit;
    if (!chips.some(over) && !(more && over(more))) return;
    // The chips that fit, minus one for "+N more" — then once more if "+N more" still spills.
    const fitting = chips.filter((c) => !over(c)).length;
    const next = more && !chips.some(over) ? shown - 1 : Math.max(0, Math.min(shown - 1, fitting - 1));
    if (next !== shown && next >= 0) setShown(next);
  });
  return Math.min(shown, count);
}

export function MarchTray({
  out,
  unread,
  lifted,
  over,
  carried,
}: {
  out: readonly MarchOut[];
  /** The tray could not be read — said, never drawn as an empty tray. */
  unread: boolean;
  /** The key lifted by a drag right now (dims its chip). */
  lifted: string | null;
  /** The tray is the drop target right now: true = it may go there, false = refused. */
  over: boolean | null;
  /** The key the keyboard holds. */
  carried: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const shown = useFit(box, out.length);
  const [all, setAll] = useState(false);
  const hidden = out.length - shown;
  // Lifting a chip out of the sheet puts the march back in view.
  useEffect(() => {
    if (all && lifted) setAll(false);
  }, [all, lifted]);
  const drawChip = (p: MarchOut) => (
      <span
        key={p.id}
        data-tray-chip=""
        data-march-drag={`out|${p.id}`}
        data-march-key={p.id}
        data-march-name={p.name}
        tabIndex={0}
        role="button"
        aria-pressed={carried === p.id}
        aria-label={`${p.name}, not walking — ${p.sectionLabel}. Drag into the march to add.`}
        className={`${OUT_CHIP}${lifted === p.id ? ' border-dashed opacity-30' : ''}${carried === p.id ? ' ring-2 ring-ink ring-offset-1' : ''}`}
      >
        {p.name}
      </span>
  );
  const ring = over === null ? '' : over ? ' ring-2 ring-terracotta-700' : ' ring-2 ring-danger-500/60';

  return (
    <div
      data-march-tray=""
      data-march-drop="tray"
      /* ⌨ A held name is put down here with Space, like any other drop. */
      tabIndex={carried ? 0 : undefined}
      aria-label="Not walking — drag a name here to take them out of the march"
      className={`flex h-full min-h-0 flex-1 flex-col gap-1.5 overflow-hidden rounded-xl p-1 transition-shadow${ring}`}
    >
      <p className="flex shrink-0 items-baseline gap-2 px-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/65">
        Not walking
        <small className="font-sans text-[11px] normal-case tracking-normal text-ink/50" data-march-tray-count="">
          {unread ? '' : out.length}
        </small>
      </p>
      {unread ? (
        <p role="status" className="px-1 text-sm text-ink/70" data-march-tray-unread="">
          Who isn’t walking couldn’t be read just now.
        </p>
      ) : out.length === 0 ? (
        <p
          data-march-tray-empty=""
          className="flex min-h-0 flex-1 items-center justify-center rounded-lg border-[1.5px] border-dashed border-ink/15 px-3 text-center text-sm text-ink/55"
        >
          Everyone walks. Drag a name here if they won’t.
        </p>
      ) : (
        <div ref={box} data-march-tray-chips="" className="flex min-h-0 flex-1 flex-wrap content-start gap-1.5 overflow-hidden">
          {out.slice(0, shown).map(drawChip)}
          {hidden > 0 ? (
            <button
              type="button"
              data-tray-more=""
              onClick={() => setAll(true)}
              className="inline-flex min-h-11 items-center rounded-full bg-ink px-3.5 text-[13.5px] font-semibold text-cream"
            >
              +{hidden} more
            </button>
          ) : null}
        </div>
      )}
      {all && typeof document !== 'undefined'
        ? createPortal(
            <div data-march-tray-sheet="" className="fixed inset-0 z-50 flex flex-col justify-end">
              <button type="button" aria-label="Close the list" onClick={() => setAll(false)} className="absolute inset-0 bg-ink/30" />
              <div
                role="dialog"
                aria-label="Not walking — everyone"
                className="relative mx-auto flex max-h-[70dvh] w-full max-w-lg flex-col rounded-t-2xl bg-cream pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg"
              >
                <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
                  <p className="min-w-0 flex-1 font-serif text-lg text-ink">Not walking · {out.length}</p>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setAll(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink/70"
                  >
                    <X aria-hidden className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <div data-march-tray-all="" className="flex min-h-0 flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain px-4 pb-2">
                  {out.map(drawChip)}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
