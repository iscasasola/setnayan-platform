'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { RISE_EASE, RISE_MS, RISE_REDUCED_MS } from '@/lib/rise-motion';
import { bodyPanelBox, panelClip, type PanelBox } from '@/lib/body-panel';
import { anyModalOpen } from '@/lib/use-modal-a11y';

/**
 * 🗂 THE IN-BODY PANEL — ONE part for Shop › Makers (THE ONE BUILD §10 #33, owner 8 Nov: *"should share a single row…
 * expand like pressing an event from clients… keep the navs and just take up the body part"*) and Portfolio's albums
 * (§10 #40, owner 8 Nov: *"Portfolio should pin and take up the whole body when opening an album"*). Build 2, lane B2-B.
 *
 *   WHERE   between the top bar (`header.fd-topbar`) and the bottom nav (`[data-bottom-dock]`) — both stay on screen —
 *           and across the page's own column (`frame`), so on a wide screen it covers the page, never the rail.
 *   OPEN    it grows out of the tapped tile or row: a `clip-path` from that rect to the whole body, 700 ms on the house
 *           rise ease (`lib/rise-motion.ts`) — the SAME motion as a picked client rising from its Clients row. The
 *           content fades in over the second half, so nothing is drawn squashed.
 *   CLOSE   × (or Escape) plays the exact reverse back INTO the same tile/row, then unmounts; the page under it was
 *           never scrolled (its scroll is held while the panel is up and put back to the pixel on close — the return
 *           rule, §10 #27). A tap on the bottom nav closes it at once (it is leaving anyway).
 *   REDUCED a 120 ms cross-fade both ways, no movement.
 *   LAYERS  the pop layer (`--sn-z-pop`): over the thumb row, beside (never over) the bar; a Sheet opened from inside
 *           it is at `--sn-z-modal`, above it (spec §10 #23).
 *
 * The geometry and the clip frames are pure (`lib/body-panel.ts`, tested). 🔒 app/vendor-dashboard/_components/
 * the-body-panel-keeps-the-navs.test.ts
 */
export function BodyPanel({
  origin,
  frame,
  title,
  sub,
  lead,
  onClose,
  data,
  children,
  titleLines = 1,
  bleed = false,
}: {
  /** The tapped tile or row — the panel grows out of it and shrinks back into it. */
  origin: HTMLElement | null;
  /** The page column the panel covers (its left/width); absent → the whole width. */
  frame?: HTMLElement | null;
  title: string;
  sub?: string;
  /** The tile's own icon or the album's cover, drawn at the head's left. */
  lead?: ReactNode;
  onClose: () => void;
  /** `data-body-panel` value (the guard's and the lab's anchor). */
  data: string;
  children: ReactNode;
  /** 2 = a long name wraps to two lines before it is cut (Portfolio's opened collection, owner-approved 9 Nov). */
  titleLines?: 1 | 2;
  /** The body runs edge to edge (Portfolio's full-bleed photo grid); its own rows then keep their 16-px gutters. */
  bleed?: boolean;
}) {
  const hid = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const [box, setBox] = useState<PanelBox | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const measure = useCallback(() => {
    const top = document.querySelector('header.fd-topbar')?.getBoundingClientRect() ?? null;
    const dock = document.querySelector('[data-bottom-dock]')?.getBoundingClientRect() ?? null;
    const f = frame?.getBoundingClientRect() ?? null;
    setBox(
      bodyPanelBox({
        vw: window.innerWidth,
        vh: window.innerHeight,
        topBarBottom: top && top.height > 0 ? top.bottom : null,
        dockTop: dock && dock.height > 0 ? dock.top : null,
        frame: f ? { left: f.left, width: f.width } : null,
      }),
    );
  }, [frame]);

  // Measure before the first paint so the panel never flashes at a wrong size.
  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // 🔒 THE PAGE UNDER IT HOLDS STILL — and gets its exact scroll back on close (the return rule).
  useEffect(() => {
    const root = document.documentElement;
    const y = window.scrollY;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
      if (Math.abs(window.scrollY - y) > 0.5) window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    };
  }, []);

  const reduce = () => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  };

  // ⤴ OPEN — out of the origin's rect.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || !box || typeof el.animate !== 'function') return;
    if (reduce()) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: RISE_REDUCED_MS, easing: 'linear' });
    } else {
      const o = origin?.getBoundingClientRect();
      if (o) {
        el.animate([{ clipPath: panelClip(o, box) }, { clipPath: panelClip(null, box) }], { duration: RISE_MS, easing: RISE_EASE });
        innerRef.current?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: RISE_MS, easing: 'linear' });
      }
    }
    closeRef.current?.focus({ preventScroll: true });
    // Once, when the box is first known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box !== null]);

  // ⤵ CLOSE — the exact reverse into the same rect, then unmount.
  const close = useCallback(
    (now = false) => {
      if (closing.current) return;
      closing.current = true;
      const el = panelRef.current;
      const finish = () => {
        onClose();
        origin?.focus?.({ preventScroll: true });
      };
      if (now || !el || !box || typeof el.animate !== 'function') return finish();
      if (reduce()) {
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: RISE_REDUCED_MS, easing: 'linear', fill: 'forwards' }).finished.then(finish, finish);
        return;
      }
      const o = origin && document.contains(origin) ? origin.getBoundingClientRect() : null;
      if (!o) return finish();
      innerRef.current?.animate([{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 0 }], { duration: RISE_MS, easing: 'linear', fill: 'forwards' });
      el.animate([{ clipPath: panelClip(o, box) }, { clipPath: panelClip(null, box) }], { duration: RISE_MS, easing: RISE_EASE, direction: 'reverse', fill: 'forwards' }).finished.then(finish, finish);
    },
    [box, onClose, origin],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A Sheet opened from inside the panel takes Escape first — the shared modal stack says one is up.
      if (e.key === 'Escape' && !anyModalOpen()) close();
    };
    // A tap on the bottom nav leaves the page — the panel goes at once (the prototype's `mkClose(true)`).
    const onDock = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('[data-bottom-dock]')) close(true);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onDock, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDock, true);
    };
  }, [close]);

  if (!mounted || !box) return null;
  return createPortal(
    <div
      ref={panelRef}
      role="region"
      aria-labelledby={hid}
      className="fixed z-sn-pop flex flex-col overflow-hidden bg-[color:var(--sn-canvas)] text-ink"
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
      data-body-panel={data}
    >
      <div ref={innerRef} className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-[64px] flex-none items-center gap-3 border-b border-ink/10 px-4 py-2.5" data-body-panel-head="">
          {lead ? <span className="flex flex-none items-center">{lead}</span> : null}
          <span className="min-w-0 flex-1">
            <b id={hid} className={`block text-[17px] font-semibold leading-tight text-ink ${titleLines === 2 ? 'line-clamp-2' : 'truncate'}`}>
              {title}
            </b>
            {sub ? <small className="block truncate text-[13px] text-ink/60">{sub}</small> : null}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => close()}
            aria-label={`Close ${title}`}
            className="grid h-11 w-11 flex-none place-items-center rounded-full border border-ink/15 text-ink/70"
            data-body-panel-close=""
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 ${bleed ? '' : 'px-4 pt-3'}`} data-body-panel-body="">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
