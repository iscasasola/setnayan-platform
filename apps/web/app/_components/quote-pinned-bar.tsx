'use client';

import { useContext, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useHydrated } from '@/lib/use-hydrated';
import { ThumbLayerContext, type ThumbLayer } from '@/app/vendor-dashboard/_components/thumb-layer';

/**
 * THE QUOTE'S PINNED BAR — Total · Save · Send quote, on the SCREEN's bottom edge (live bug, owner screenshot,
 * 390 px, 12 Nov 2026: the bar floated mid-page with line items below it and the bottom nav under those).
 *
 * 🔴 WHY IT WAS NOT PINNED. It was `sticky` inside the form. Sticky pins to the nearest SCROLL BOX, and the quote is
 * mounted inside one: the chat's tool panel (`ThreadToolPanel`, `max-h-[55dvh] overflow-y-auto`) and, around that, the
 * thread's own scrolling section. So the bar stuck to the bottom of a 55dvh box that ended wherever the panel ended —
 * and, standing `--sn-bottomdock-h` up from THAT edge, it hovered a dock's height above it with the lines showing
 * through underneath. `position: fixed` inside the form would not fix it either: the dashboard's `.sn-page-enter`
 * transform and `container-type` boxes capture fixed elements (house rule, #7461).
 *
 * ✅ So the bar is PORTALED and `fixed` to the screen. On <body> (the house portal) it stands ON whatever the shell puts
 * at the bottom — the dock (`--sn-bottomdock-h`) or the floating thumb row (`--sn-thumb-room`). Inside a full-screen
 * layer — the picked client (its `ThumbLayerContext` host) or the phone's chat takeover — that layer covers the dock, so
 * the bar is drawn INTO the layer and is the bottom itself, with the home-indicator inset as its own padding.
 *   · It is up only while the quote is on screen (an IntersectionObserver on the form) — a closed tool panel is
 *     `display: none`, so the bar leaves with it; scrolling the chat away from the quote takes it away too.
 *   · A spacer at the foot of the form reserves the bar's measured height plus what it stands on, so the last line
 *     can always be scrolled clear of it.
 *   · On a phone it spans the screen; from the `tab` breakpoint up it takes the form's own left and width.
 *   · A portaled control is OUTSIDE the form's DOM: the caller passes `formId`, and every control in the bar must
 *     name it (`form={formId}`) or Send posts nothing (lib/portaled-fields-join-their-form.ts).
 *
 * 🔒 `app/_components/the-quote-bar-is-pinned.test.ts`.
 */
/** On <body>: the bar stands on the dock or the floating thumb row, whichever is taller. */
const ON_THE_DOCK = 'max(var(--sn-bottomdock-h, 0px), var(--sn-thumb-room, 0px))';
/** Inside a full-screen layer (the picked client, the phone's chat takeover): the layer covers the dock — the bar IS
 *  the bottom. */
const ON_THE_EDGE = '0px';
const TAB_MIN_PX = 701;

type Where = { host: HTMLElement; standsOn: string; column: HTMLElement | null };

/**
 * Where the bar is drawn. A full-screen layer paints OVER <body>'s page layer, so a bar on <body> would sit under it:
 *   1 · a pop-up that hands down its own thumb layer (`ThumbLayerContext`, the picked client) — the bar lands in it;
 *   2 · else the form's nearest `position: fixed` ancestor (the phone's chat takeover, `[data-chat-takeover]`) — the
 *       bar lands in it (fixed inside a fixed, untransformed layer is still fixed to the screen);
 *   3 · else <body>, on the dock.
 */
function whereFor(form: HTMLFormElement, layer: ThumbLayer | null): Where | null {
  if (layer) return layer.host ? { host: layer.host, standsOn: ON_THE_EDGE, column: layer.column } : null;
  for (let el = form.parentElement; el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).position === 'fixed') return { host: el, standsOn: ON_THE_EDGE, column: null };
  }
  return { host: document.body, standsOn: ON_THE_DOCK, column: null };
}

export function QuotePinnedBar({
  formRef,
  children,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  children: ReactNode;
}) {
  const hydrated = useHydrated();
  const layer = useContext(ThumbLayerContext);
  const [onScreen, setOnScreen] = useState(false);
  const [where, setWhere] = useState<Where | null>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const [barH, setBarH] = useState(0);

  // Up while any of the form is on screen; gone when the panel closes (display:none never intersects).
  useEffect(() => {
    const form = formRef.current;
    if (!form || typeof IntersectionObserver === 'undefined') {
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) setOnScreen(e.isIntersecting);
    });
    io.observe(form);
    return () => io.disconnect();
  }, [formRef]);

  // Which layer it lands in, and its edges: a phone spans the screen; from 701 px the bar takes the form's column.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const measure = () => {
      const w = whereFor(form, layer);
      setWhere((prev) =>
        prev && w && prev.host === w.host && prev.standsOn === w.standsOn && prev.column === w.column ? prev : w,
      );
      if (window.innerWidth < TAB_MIN_PX) return setBox(null);
      const r = (w?.column ?? form).getBoundingClientRect();
      setBox((prev) => (prev && prev.left === r.left && prev.width === r.width ? prev : { left: r.left, width: r.width }));
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(form);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [formRef, layer, onScreen]);

  // The spacer reserves what the bar really covers.
  useEffect(() => {
    if (!bar) return;
    const measure = () => setBarH(bar.offsetHeight);
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(bar);
    return () => ro?.disconnect();
  }, [bar]);

  const up = hydrated && onScreen && where !== null;
  return (
    <>
      <div
        aria-hidden
        data-quote-bar-spacer=""
        style={{ height: up ? `calc(${barH}px + ${where.standsOn})` : 0 }}
      />
      {up
        ? createPortal(
            <div
              ref={setBar}
              data-quote-pinned-bar=""
              // Page layer through the foundation's z scale (`z-sn-sticky`, under the thumb row and the nav — spec §10
              // #23 "page < thumb row < bottom nav < pop-ups"), never a raw z. Inside a full-screen layer the z counts
              // within that layer, over its page.
              className="fixed z-sn-sticky border-t border-ink/10 bg-cream/95 px-4 pt-2.5 backdrop-blur"
              style={{
                bottom: where.standsOn,
                left: box ? box.left : 0,
                width: box ? box.width : '100%',
                // The home indicator, when the bar stands on the bottom edge itself (no dock, no thumb row).
                paddingBottom: `max(0.625rem, calc(env(safe-area-inset-bottom, 0px) + 0.625rem - ${where.standsOn}))`,
              }}
            >
              {children}
            </div>,
            where.host,
          )
        : null}
    </>
  );
}
