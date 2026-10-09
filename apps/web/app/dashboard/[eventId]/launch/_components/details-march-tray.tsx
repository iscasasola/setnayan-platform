'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
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
  'inline-flex min-h-11 max-w-full cursor-grab select-none items-center rounded-full border border-ink/15 bg-white px-3 text-[13.5px] leading-tight text-ink [-webkit-touch-callout:none] [overflow-wrap:anywhere]';

/**
 * The fit itself, on the box as the browser laid it out: every chip shown; if
 * any spills past the box's bottom, "+N more" is shown and chips are set aside
 * from the END until it and every chip before it fit. Exported for its test
 * (`march-tray-fits-without-scrolling.test.ts`), which lays chips out the way
 * `flex-wrap` does.
 */
export function fitChips(el: HTMLElement): number {
  const chips = [...el.querySelectorAll<HTMLElement>('[data-tray-chip]')];
  const more = el.querySelector<HTMLElement>('[data-tray-more]');
  if (!more) return 0;
  for (const c of chips) c.style.display = '';
  more.style.display = 'none';
  const limit = () => el.getBoundingClientRect().bottom + 0.5;
  const spills = (n: HTMLElement) => n.getBoundingClientRect().bottom > limit();
  if (!chips.some(spills)) {
    el.dataset.trayHidden = '0';
    return 0;
  }
  more.style.display = '';
  let hidden = 0;
  for (let i = chips.length - 1; i >= 0; i--) {
    chips[i]!.style.display = 'none';
    hidden += 1;
    more.textContent = `+${hidden} more`;
    more.setAttribute('aria-label', `${hidden} more not walking — show everyone`);
    if (!spills(more) && !chips.slice(0, i).some(spills)) break;
  }
  el.dataset.trayHidden = String(hidden);
  return hidden;
}

/**
 * Fit the chips to the box — in the DOM, in one pass, no render loop: every chip
 * is drawn; the ones that do not fit are set aside (`display: none`) from the
 * end, and "+N more" takes the last place, saying how many. Run after layout,
 * on a resize, when the web font lands, and a few beats after mounting (a box
 * that mounted hidden reports no resize in time).
 */
function useFit(box: React.RefObject<HTMLElement | null>, key: string): void {
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => fitChips(el);
    fit();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fit());
    ro?.observe(el);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    void fonts?.ready.then(fit);
    fonts?.addEventListener?.('loadingdone', fit);
    const later = [60, 400, 1200].map((ms) => setTimeout(fit, ms));
    return () => {
      later.forEach(clearTimeout);
      ro?.disconnect();
      fonts?.removeEventListener?.('loadingdone', fit);
    };
  }, [box, key]);
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
  // Re-fit whenever the names change (a drop in or out of the tray).
  useFit(box, out.map((p) => p.id).join('|'));
  const [all, setAll] = useState(false);
  /* Lifting a chip out of the sheet puts the march back in view: the sheet steps
     aside while the name is held (still mounted — the touch keeps its target, or
     the browser would take the gesture back), and closes once it is put down. */
  const held = useRef<string | null>(null);
  useEffect(() => {
    if (all && held.current && !lifted) setAll(false);
    held.current = lifted;
  }, [all, lifted]);
  /* In the full list a chip takes the touch itself (`touch-none`): a long-press lifts it with no
     browser pan to win the gesture; a swipe on the gaps still scrolls the list. */
  const drawChip = (p: MarchOut, inSheet = false) => (
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
        className={`${OUT_CHIP}${inSheet ? ' touch-none' : ' touch-pan-y'}${lifted === p.id ? ' border-dashed opacity-30' : ''}${carried === p.id ? ' ring-2 ring-ink ring-offset-1' : ''}`}
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
          {out.map((p) => drawChip(p))}
          {/* Its words and whether it shows are the fit's (`useFit`) — it knows how many were set aside. */}
          <button
            type="button"
            data-tray-more=""
            onClick={() => setAll(true)}
            style={{ display: 'none' }}
            className="inline-flex min-h-11 items-center rounded-full bg-ink px-3.5 text-[13.5px] font-semibold text-cream"
          />
        </div>
      )}
      {all && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-march-tray-sheet=""
              className={`fixed inset-0 z-[95] flex flex-col justify-end ${lifted ? 'pointer-events-none invisible' : ''}`}
            >
              <button type="button" aria-label="Close the list" onClick={() => setAll(false)} className="absolute inset-0 bg-ink/30" />
              <div
                role="dialog"
                aria-label="Not walking — everyone"
                className="relative mx-auto flex max-h-[70dvh] w-full max-w-lg flex-col rounded-t-2xl bg-cream pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg"
              >
                <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
                  <p className="min-w-0 flex-1 font-serif text-lg text-ink">Not walking · {out.length}</p>
                  <ActionButton tone="neutral" quiet iconOnly icon={X} label="Close" onClick={() => setAll(false)} />
                </div>
                <div
                  data-march-tray-all=""
                  className="flex min-h-0 flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain px-4 pb-2"
                >
                  {out.map((p) => drawChip(p, true))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
